import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicantsEntity } from '@app/database';
import { GitHubModule } from '@app/integrations';
import { ApiExceptionFilter } from '../../common/filters';
import { ApiResponseEnvelopeInterceptor } from '../../common/interceptors';
import { ApplicantGithubReposService } from './applicant-github-repos.service';
import { ApplicantsRepository } from './repositories/applicants.repository';
import { ApplicantsController } from './applicants.controller';
import { ApplicantsFacade } from './applicants.facade';
import { ApplicantsService } from './applicants.service';
import { AnalysisRunsModule } from '../analysis-runs/analysis-runs.module';
import { AuthModule } from '../auth/auth.module';
import { GeneratedQuestionsModule } from '../generated-questions/generated-questions.module';
import { GroupsModule } from '../groups/groups.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApplicantsEntity]),
    AuthModule,
    GroupsModule,
    AnalysisRunsModule,
    GeneratedQuestionsModule,
    GitHubModule,
  ],
  controllers: [ApplicantsController],
  providers: [
    ApiExceptionFilter,
    ApiResponseEnvelopeInterceptor,
    ApplicantGithubReposService,
    ApplicantsService,
    ApplicantsFacade,
    ApplicantsRepository,
  ],
  exports: [
    ApplicantGithubReposService,
    ApplicantsService,
    ApplicantsFacade,
    ApplicantsRepository,
  ],
})
export class ApplicantsModule {}
