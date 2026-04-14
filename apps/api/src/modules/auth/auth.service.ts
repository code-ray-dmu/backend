import { randomUUID } from 'node:crypto';

import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersEntity } from '@app/database';
import { UsersService } from '../users/users.service';
import { SignInDto, SignUpDto } from './dto';
import { JwtPayload, RefreshTokenAuthContext } from './interfaces';
import { RefreshTokensRepository } from './repositories/refresh-tokens.repository';

export interface SignUpResult {
  user_id: string;
  email: string;
}

export interface AuthTokenPair {
  access_token: string;
  refresh_token: string;
}

const BCRYPT_SALT_ROUNDS = 10;
const JWT_EXPIRES_IN_PATTERN = /^(\d+)([smhd])$/;
const SECONDS_BY_UNIT: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
};

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly refreshTokensRepository: RefreshTokensRepository,
  ) {}

  async signUp(input: SignUpDto): Promise<SignUpResult> {
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
    const createResult = await this.usersService.createUser({
      email: input.email,
      passwordHash,
      name: input.name,
    });

    if (!createResult.isCreated) {
      throw new ConflictException({
        code: 'USER_EMAIL_CONFLICT',
        message: 'Email already exists',
      });
    }

    return {
      user_id: createResult.user.id,
      email: createResult.user.email,
    };
  }

  async signIn(input: SignInDto): Promise<AuthTokenPair> {
    const user = await this.usersService.findByEmail(input.email);

    if (!user) {
      throwInvalidCredentials();
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throwInvalidCredentials();
    }

    return this.issueTokenPair(user);
  }

  async refreshToken(authContext: RefreshTokenAuthContext): Promise<AuthTokenPair> {
    const user = await this.usersService.findById(authContext.sub);

    if (!user) {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Refresh token is invalid',
      });
    }

    const nextTokenPair = await this.createSignedTokenPair(user);
    const isRevoked = await this.refreshTokensRepository.rotateActiveRefreshToken(
      authContext.refreshTokenId,
      {
        userId: user.id,
        tokenValue: nextTokenPair.refresh_token,
        expiresAt: getExpiresAt(this.getRequiredConfig('jwt.refreshExpiresIn')),
      },
    );

    if (!isRevoked) {
      throwRefreshTokenRevoked();
    }

    return nextTokenPair;
  }

  private async issueTokenPair(user: UsersEntity): Promise<AuthTokenPair> {
    const tokenPair = await this.createSignedTokenPair(user);

    await this.refreshTokensRepository.createRefreshToken({
      userId: user.id,
      tokenValue: tokenPair.refresh_token,
      expiresAt: getExpiresAt(this.getRequiredConfig('jwt.refreshExpiresIn')),
    });

    return tokenPair;
  }

  private async createSignedTokenPair(user: UsersEntity): Promise<AuthTokenPair> {
    const payload = this.createPayload(user);
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.getRequiredConfig('jwt.accessSecret'),
        expiresIn: this.getRequiredConfig('jwt.accessExpiresIn'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.getRequiredConfig('jwt.refreshSecret'),
        expiresIn: this.getRequiredConfig('jwt.refreshExpiresIn'),
        jwtid: randomUUID(),
      }),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private createPayload(user: UsersEntity): JwtPayload {
    return {
      sub: user.id,
      email: user.email,
    };
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new InternalServerErrorException({
        code: 'INTERNAL_SERVER_ERROR',
        message: `${key} is not configured`,
      });
    }

    return value;
  }
}

function getExpiresAt(expiresIn: string): Date {
  const match = JWT_EXPIRES_IN_PATTERN.exec(expiresIn);

  if (!match) {
    throw new InternalServerErrorException({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'jwt.refreshExpiresIn is invalid',
    });
  }

  const [, amount, unit] = match;
  const expiresInSeconds = Number(amount) * SECONDS_BY_UNIT[unit];

  return new Date(Date.now() + expiresInSeconds * 1000);
}

function throwInvalidCredentials(): never {
  throw new UnauthorizedException({
    code: 'AUTH_INVALID_CREDENTIALS',
    message: 'Invalid email or password',
  });
}

function throwRefreshTokenRevoked(): never {
  throw new UnauthorizedException({
    code: 'AUTH_REFRESH_TOKEN_REVOKED',
    message: 'Refresh token revoked',
  });
}
