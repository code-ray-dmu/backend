import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicantsEntity } from '@app/database';
import { ApiExceptionFilter } from '../../common/filters';
import { ApiResponseEnvelopeInterceptor } from '../../common/interceptors';
import { AnalysisRunsModule } from '../analysis-runs/analysis-runs.module';
import { AuthModule } from '../auth/auth.module';
import { GeneratedQuestionsModule } from '../generated-questions/generated-questions.module';
import { GroupsModule } from '../groups/groups.module';
import { ApplicantsController } from './applicants.controller';
import { ApplicantsFacade } from './applicants.facade';
import { ApplicantsRepository } from './repositories/applicants.repository';
import { ApplicantsService } from './applicants.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApplicantsEntity]),
    AuthModule,
    GroupsModule,
    AnalysisRunsModule,
    GeneratedQuestionsModule,
  ],
  controllers: [ApplicantsController],
  providers: [
    ApiExceptionFilter,
    ApiResponseEnvelopeInterceptor,
    ApplicantsService,
    ApplicantsFacade,
    ApplicantsRepository,
  ],
  exports: [ApplicantsService, ApplicantsFacade, ApplicantsRepository],
})
export class ApplicantsModule {}
