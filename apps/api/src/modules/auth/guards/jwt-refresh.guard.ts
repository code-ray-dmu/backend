import {
  BadRequestException,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ body?: { refreshToken?: unknown } }>();
    const refreshToken = request.body?.refreshToken;

    if (typeof refreshToken !== 'string' || refreshToken.length < 1) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'refreshToken must be a non-empty string',
      });
    }

    return super.canActivate(context) as boolean | Promise<boolean>;
  }
}
