import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { AnalysisRunJob } from './jobs/analysis-run.job';
import { QuestionGenerationJob } from './jobs/question-generation.job';
import { AnalysisRunProcessor } from './processors/analysis-run.processor';
import { GithubRepositoryProcessor } from './processors/github-repository.processor';
import { QuestionGenerationProcessor } from './processors/question-generation.processor';
import { CleanupScheduler } from './schedulers/cleanup.scheduler';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    // Shared/database/integrations modules will be wired here as their modules are added.
  ],
  providers: [
    AnalysisRunProcessor,
    GithubRepositoryProcessor,
    QuestionGenerationProcessor,
    AnalysisRunJob,
    QuestionGenerationJob,
    CleanupScheduler,
  ],
})
export class AppModule {}
