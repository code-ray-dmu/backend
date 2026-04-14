import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RefreshTokensEntity, UsersEntity } from '@app/database';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { RefreshTokenAuthContext } from './interfaces';
import { CreateRefreshTokenRepositoryInput } from './repositories/refresh-tokens.repository';
import { RefreshTokensRepository } from './repositories/refresh-tokens.repository';

interface AuthServiceMocks {
  configService: {
    get: jest.Mock<string | undefined, [string]>;
  };
  jwtService: {
    signAsync: jest.Mock<
      Promise<string>,
      [object, { secret: string; expiresIn: string; jwtid?: string }]
    >;
  };
  usersService: {
    createUser: jest.Mock<
      ReturnType<UsersService['createUser']>,
      Parameters<UsersService['createUser']>
    >;
    findByEmail: jest.Mock<
      ReturnType<UsersService['findByEmail']>,
      Parameters<UsersService['findByEmail']>
    >;
    findById: jest.Mock<
      ReturnType<UsersService['findById']>,
      Parameters<UsersService['findById']>
    >;
  };
  refreshTokensRepository: {
    createRefreshToken: jest.Mock<
      ReturnType<RefreshTokensRepository['createRefreshToken']>,
      Parameters<RefreshTokensRepository['createRefreshToken']>
    >;
    findByTokenValue: jest.Mock<
      ReturnType<RefreshTokensRepository['findByTokenValue']>,
      Parameters<RefreshTokensRepository['findByTokenValue']>
    >;
    rotateActiveRefreshToken: jest.Mock<
      ReturnType<RefreshTokensRepository['rotateActiveRefreshToken']>,
      Parameters<RefreshTokensRepository['rotateActiveRefreshToken']>
    >;
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let mocks: AuthServiceMocks;

  beforeEach(() => {
    mocks = createMocks();
    service = new AuthService(
      mocks.configService as unknown as ConfigService,
      mocks.jwtService as unknown as JwtService,
      mocks.usersService as unknown as UsersService,
      mocks.refreshTokensRepository as unknown as RefreshTokensRepository,
    );
  });

  it('creates a user with a bcrypt password hash', async () => {
    mocks.usersService.createUser.mockImplementation(async (input) => ({
      isCreated: true,
      user: createUser({
        email: input.email,
        passwordHash: input.passwordHash,
        name: input.name,
      }),
    }));

    const result = await service.signUp({
      email: 'john@example.com',
      password: '1234',
      name: 'john',
    });

    const createInput = mocks.usersService.createUser.mock.calls[0][0];

    expect(result).toEqual({
      user_id: 'user-id',
      email: 'john@example.com',
    });
    expect(createInput.passwordHash).not.toBe('1234');
    await expect(bcrypt.compare('1234', createInput.passwordHash)).resolves.toBe(true);
  });

  it('maps duplicate email creation to USER_EMAIL_CONFLICT', async () => {
    mocks.usersService.createUser.mockResolvedValue({
      isCreated: false,
      reason: 'EMAIL_CONFLICT',
    });

    await expect(
      service.signUp({
        email: 'john@example.com',
        password: '1234',
        name: 'john',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'USER_EMAIL_CONFLICT',
      },
    });
  });

  it('signs in with a valid password and stores the issued refresh token value', async () => {
    const passwordHash = await bcrypt.hash('1234', 4);

    mocks.usersService.findByEmail.mockResolvedValue(createUser({ passwordHash }));

    const result = await service.signIn({
      email: 'john@example.com',
      password: '1234',
    });

    expect(result).toEqual({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
    expect(mocks.jwtService.signAsync).toHaveBeenNthCalledWith(
      2,
      { sub: 'user-id', email: 'john@example.com' },
      {
        secret: 'refresh-secret',
        expiresIn: '14d',
        jwtid: expect.any(String),
      },
    );
    expect(mocks.refreshTokensRepository.createRefreshToken).toHaveBeenCalledWith(
      {
        userId: 'user-id',
        tokenValue: 'refresh-token',
        expiresAt: expect.any(Date),
      },
    );
  });

  it('rejects sign in when the user does not exist', async () => {
    mocks.usersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.signIn({
        email: 'missing@example.com',
        password: '1234',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'AUTH_INVALID_CREDENTIALS',
      },
    });
  });

  it('rejects sign in when the password is invalid', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);

    mocks.usersService.findByEmail.mockResolvedValue(createUser({ passwordHash }));

    await expect(
      service.signIn({
        email: 'john@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'AUTH_INVALID_CREDENTIALS',
      },
    });
  });

  it('rotates a valid refresh token', async () => {
    mocks.usersService.findById.mockResolvedValue(createUser());
    mocks.refreshTokensRepository.rotateActiveRefreshToken.mockResolvedValue(true);
    mocks.jwtService.signAsync.mockImplementation(
      async (
        _payload: object,
        options: { secret: string; expiresIn: string; jwtid?: string },
      ) => (options.secret === 'access-secret' ? 'new-access-token' : 'new-refresh-token'),
    );

    const result = await service.refreshToken(createRefreshTokenAuthContext());

    expect(result).toEqual({
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
    });
    expect(mocks.refreshTokensRepository.rotateActiveRefreshToken).toHaveBeenCalledWith(
      1,
      {
        userId: 'user-id',
        tokenValue: 'new-refresh-token',
        expiresAt: expect.any(Date),
      },
    );
  });

  it('rejects refresh requests when the user no longer exists', async () => {
    mocks.usersService.findById.mockResolvedValue(null);

    await expect(service.refreshToken(createRefreshTokenAuthContext())).rejects.toMatchObject({
      response: {
        code: 'AUTH_TOKEN_INVALID',
      },
    });
  });

  it('rejects refresh rotation when the active revoke loses the race', async () => {
    mocks.usersService.findById.mockResolvedValue(createUser());
    mocks.refreshTokensRepository.rotateActiveRefreshToken.mockResolvedValue(false);

    await expect(service.refreshToken(createRefreshTokenAuthContext())).rejects.toMatchObject({
      response: {
        code: 'AUTH_REFRESH_TOKEN_REVOKED',
      },
    });
  });
});

function createMocks(): AuthServiceMocks {
  return {
    configService: {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          'jwt.accessSecret': 'access-secret',
          'jwt.refreshExpiresIn': '14d',
          'jwt.refreshSecret': 'refresh-secret',
          'jwt.accessExpiresIn': '1h',
        };

        return config[key];
      }),
    },
    jwtService: {
      signAsync: jest.fn(
        async (
          _payload: object,
          options: { secret: string; expiresIn: string; jwtid?: string },
        ) => (options.secret === 'access-secret' ? 'access-token' : 'refresh-token'),
      ),
    },
    usersService: {
      createUser: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
    },
    refreshTokensRepository: {
      createRefreshToken: jest.fn(
        async (_input: CreateRefreshTokenRepositoryInput) => createRefreshToken(),
      ),
      findByTokenValue: jest.fn(),
      rotateActiveRefreshToken: jest.fn(),
    },
  };
}

function createUser(overrides: Partial<UsersEntity> = {}): UsersEntity {
  return {
    id: 'user-id',
    email: 'john@example.com',
    passwordHash: '$2b$10$Nrk8AAky0f1ZljNbeAC4GeO/JnDkGwZMNOr81KU10nh6GdAEvD.Vq',
    name: 'john',
    groups: [],
    refreshTokens: [],
    requestedAnalysisRuns: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createRefreshToken(
  overrides: Partial<RefreshTokensEntity> = {},
): RefreshTokensEntity {
  return {
    id: 1,
    userId: 'user-id',
    tokenValue: 'refresh-token',
    expiresAt: new Date(Date.now() + 60 * 1000),
    isRevoked: false,
    user: createUser(),
    ...overrides,
  };
}

function createRefreshTokenAuthContext(
  overrides: Partial<RefreshTokenAuthContext> = {},
): RefreshTokenAuthContext {
  return {
    sub: 'user-id',
    email: 'john@example.com',
    refreshToken: 'refresh-token',
    refreshTokenId: 1,
    ...overrides,
  };
}
