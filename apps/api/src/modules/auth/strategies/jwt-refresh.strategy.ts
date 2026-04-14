import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload, RefreshTokenAuthContext } from '../interfaces';
import { RefreshTokensRepository } from '../repositories/refresh-tokens.repository';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    configService: ConfigService,
    private readonly refreshTokensRepository: RefreshTokensRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractRefreshTokenFromBody]),
      ignoreExpiration: false,
      passReqToCallback: true,
      secretOrKey: getRequiredJwtConfig(configService, 'jwt.refreshSecret'),
    });
  }

  async validate(
    request: { body?: { refreshToken?: string } },
    payload: JwtPayload,
  ): Promise<RefreshTokenAuthContext> {
    const refreshToken = request.body?.refreshToken;

    if (typeof refreshToken !== 'string' || refreshToken.length < 1) {
      throwInvalidRefreshTokenBody();
    }

    const storedToken = await this.refreshTokensRepository.findByTokenValue(refreshToken);

    if (!storedToken) {
      throwInvalidRefreshToken();
    }

    if (storedToken.userId !== payload.sub) {
      throwInvalidRefreshToken();
    }

    if (storedToken.isRevoked || storedToken.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        code: 'AUTH_REFRESH_TOKEN_REVOKED',
        message: 'Refresh token revoked',
      });
    }

    return {
      ...payload,
      refreshToken,
      refreshTokenId: storedToken.id,
    };
  }
}

function extractRefreshTokenFromBody(request: {
  body?: { refreshToken?: string };
}): string | null {
  return request.body?.refreshToken ?? null;
}

function getRequiredJwtConfig(configService: ConfigService, key: string): string {
  const value = configService.get<string>(key);

  if (!value) {
    throw new InternalServerErrorException({
      code: 'INTERNAL_SERVER_ERROR',
      message: `${key} is not configured`,
    });
  }

  return value;
}

function throwInvalidRefreshToken(): never {
  throw new UnauthorizedException({
    code: 'AUTH_TOKEN_INVALID',
    message: 'Refresh token is invalid',
  });
}

function throwInvalidRefreshTokenBody(): never {
  throw new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: 'refreshToken must be a non-empty string',
  });
}
