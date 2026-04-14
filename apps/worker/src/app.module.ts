import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig, AnalysisRunsEntity } from '@app/database';
import { RabbitMqModule, RedisModule } from '@app/integrations';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { AnalysisRunJob } from './jobs/analysis-run.job';
import { QuestionGenerationJob } from './jobs/question-generation.job';
import { AnalysisRunProcessor } from './processors/analysis-run.processor';
import { GithubRepositoryProcessor } from './processors/github-repository.processor';
import { QuestionGenerationProcessor } from './processors/question-generation.processor';
import { AnalysisRunsRepository } from './repositories/analysis-runs.repository';
import { CleanupScheduler } from './schedulers/cleanup.scheduler';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync(typeOrmConfig),
    TypeOrmModule.forFeature([AnalysisRunsEntity]),
    RabbitMqModule,
    RedisModule,
  ],
  providers: [
    AnalysisRunProcessor,
    GithubRepositoryProcessor,
    QuestionGenerationProcessor,
    AnalysisRunJob,
    QuestionGenerationJob,
    AnalysisRunsRepository,
    CleanupScheduler,
  ],
})
export class AppModule {}
