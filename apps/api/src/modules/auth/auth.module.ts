import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshTokensEntity } from '@app/database';
import { AuthController } from './auth.controller';
import { AuthFacade } from './auth.facade';
import { AuthService } from './auth.service';
import { JwtAuthGuard, JwtRefreshGuard } from './guards';
import { RefreshTokensRepository } from './repositories/refresh-tokens.repository';
import { JwtAccessStrategy, JwtRefreshStrategy } from './strategies';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    TypeOrmModule.forFeature([RefreshTokensEntity]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthFacade,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    JwtAuthGuard,
    JwtRefreshGuard,
    RefreshTokensRepository,
  ],
  exports: [
    AuthService,
    AuthFacade,
    RefreshTokensRepository,
    JwtAuthGuard,
    JwtRefreshGuard,
  ],
})
export class AuthModule {}
