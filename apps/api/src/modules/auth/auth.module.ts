import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthFacade } from './auth.facade';
import { AuthService } from './auth.service';
import { JwtAuthGuard, JwtRefreshGuard } from './guards';
import { JwtAccessStrategy, JwtRefreshStrategy } from './strategies';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthFacade,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    JwtAuthGuard,
    JwtRefreshGuard,
  ],
  exports: [AuthService, AuthFacade, JwtAuthGuard, JwtRefreshGuard],
})
export class AuthModule {}
