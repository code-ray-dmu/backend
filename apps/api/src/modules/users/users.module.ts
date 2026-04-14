import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersEntity } from '@app/database';
import { UsersRepository } from './repositories/users.repository';
import { UsersController } from './users.controller';
import { UsersFacade } from './users.facade';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([UsersEntity])],
  controllers: [UsersController],
  providers: [UsersService, UsersFacade, UsersRepository],
  exports: [UsersService, UsersFacade, UsersRepository],
})
export class UsersModule {}
