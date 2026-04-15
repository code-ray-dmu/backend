import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getRequiredJwtConfig(configService, 'jwt.accessSecret'),
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
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
