import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupsEntity } from '@app/database';
import { ApiExceptionFilter } from '../../common/filters';
import { ApiResponseEnvelopeInterceptor } from '../../common/interceptors';
import { AuthModule } from '../auth/auth.module';
import { GroupsRepository } from './repositories/groups.repository';
import { GroupsController } from './groups.controller';
import { GroupsFacade } from './groups.facade';
import { GroupsService } from './groups.service';

@Module({
  imports: [TypeOrmModule.forFeature([GroupsEntity]), AuthModule],
  controllers: [GroupsController],
  providers: [
    GroupsService,
    GroupsFacade,
    GroupsRepository,
    ApiExceptionFilter,
    ApiResponseEnvelopeInterceptor,
  ],
  exports: [GroupsService, GroupsFacade, GroupsRepository],
})
export class GroupsModule {}
