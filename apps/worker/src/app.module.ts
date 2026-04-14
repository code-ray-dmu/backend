import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  AnalysisRunsEntity,
  ApplicantRepositoriesEntity,
  CodeAnalysisEntity,
  GeneratedQuestionsEntity,
  LlmMessagesEntity,
  PromptTemplatesEntity,
  RepositoryFilesEntity,
  typeOrmConfig,
} from '@app/database';
import { GitHubModule, LlmModule, RabbitMqModule, RedisModule } from '@app/integrations';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { AnalysisRunJob } from './jobs/analysis-run.job';
import { LlmAnalysisJob } from './jobs/llm-analysis.job';
import { AnalysisRunProcessor } from './processors/analysis-run.processor';
import { GithubRepositoryProcessor } from './processors/github-repository.processor';
import { AnalysisRunsRepository } from './repositories/analysis-runs.repository';
import { LlmAnalysisProcessor } from './processors/llm-analysis.processor';
import { CleanupScheduler } from './schedulers/cleanup.scheduler';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync(typeOrmConfig),
    TypeOrmModule.forFeature([
      AnalysisRunsEntity,
      ApplicantRepositoriesEntity,
      CodeAnalysisEntity,
      GeneratedQuestionsEntity,
      LlmMessagesEntity,
      PromptTemplatesEntity,
      RepositoryFilesEntity,
    ]),
    GitHubModule,
    LlmModule,
    RabbitMqModule,
    RedisModule,
  ],
  providers: [
    AnalysisRunProcessor,
    GithubRepositoryProcessor,
    LlmAnalysisProcessor,
    AnalysisRunJob,
    AnalysisRunsRepository,
    LlmAnalysisJob,
    CleanupScheduler,
  ],
})
export class AppModule {}
