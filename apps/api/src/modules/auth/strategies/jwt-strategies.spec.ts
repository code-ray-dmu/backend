import {
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RefreshTokensEntity } from '@app/database';
import { JwtAccessStrategy, JwtRefreshStrategy } from './index';
import { RefreshTokensRepository } from '../repositories/refresh-tokens.repository';

describe('JWT strategies', () => {
  it('validates access token payloads', () => {
    const strategy = new JwtAccessStrategy(createConfigService('jwt.accessSecret'));
    const payload = {
      sub: 'user-id',
      email: 'john@example.com',
    };

    expect(strategy.validate(payload)).toBe(payload);
  });

  it('validates refresh token payloads against the stored token', async () => {
    const strategy = new JwtRefreshStrategy(
      createConfigService('jwt.refreshSecret'),
      createRefreshTokensRepository(),
    );
    const payload = {
      sub: 'user-id',
      email: 'john@example.com',
    };

    await expect(
      strategy.validate(
        {
          body: {
            refreshToken: 'refresh-token',
          },
        },
        payload,
      ),
    ).resolves.toEqual({
      ...payload,
      refreshToken: 'refresh-token',
      refreshTokenId: 1,
    });
  });

  it('rejects revoked or expired refresh tokens', async () => {
    const strategy = new JwtRefreshStrategy(
      createConfigService('jwt.refreshSecret'),
      createRefreshTokensRepository(createRefreshTokenEntity({ isRevoked: true })),
    );

    await expect(
      strategy.validate(
        {
          body: {
            refreshToken: 'refresh-token',
          },
        },
        {
          sub: 'user-id',
          email: 'john@example.com',
        },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects empty refresh token bodies as validation errors', async () => {
    const strategy = new JwtRefreshStrategy(
      createConfigService('jwt.refreshSecret'),
      createRefreshTokensRepository(),
    );

    await expect(
      strategy.validate(
        {
          body: {
            refreshToken: '',
          },
        },
        {
          sub: 'user-id',
          email: 'john@example.com',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails fast when the access secret is missing', () => {
    expect(() => new JwtAccessStrategy(createConfigService())).toThrow(
      InternalServerErrorException,
    );
  });

  it('fails fast when the refresh secret is missing', () => {
    expect(() => new JwtRefreshStrategy(createConfigService(), createRefreshTokensRepository())).toThrow(
      InternalServerErrorException,
    );
  });
});

function createConfigService(definedKey?: string): ConfigService {
  return {
    get: jest.fn((key: string) => {
      if (key === definedKey) {
        return 'secret';
      }

      return undefined;
    }),
  } as unknown as ConfigService;
}

function createRefreshTokensRepository(
  storedToken: RefreshTokensEntity | null = createRefreshTokenEntity(),
): RefreshTokensRepository {
  return {
    findByTokenValue: jest.fn(async (_tokenValue: string) => storedToken),
  } as unknown as RefreshTokensRepository;
}

function createRefreshTokenEntity(
  overrides: Partial<RefreshTokensEntity> = {},
): RefreshTokensEntity {
  return {
    id: 1,
    userId: 'user-id',
    tokenValue: 'refresh-token',
    expiresAt: new Date(Date.now() + 60 * 1000),
    isRevoked: false,
    user: null as never,
    ...overrides,
  };
}
