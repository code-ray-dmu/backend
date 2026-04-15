import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AnalysisRunsEntity,
  ApplicantRepositoriesEntity,
  ApplicantsEntity,
} from '@app/database';
import { GitHubModule, RabbitMqModule } from '@app/integrations';
import { AnalysisRunsController } from './analysis-runs.controller';
import { AnalysisRunsFacade } from './analysis-runs.facade';
import { AnalysisRunPublisher } from './publishers/analysis-run.publisher';
import { AnalysisRunsRepository } from './repositories/analysis-runs.repository';
import { CodeAnalysisRepository } from './repositories/code-analysis.repository';
import { LlmMessagesRepository } from './repositories/llm-messages.repository';
import { AnalysisRunsService } from './analysis-runs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AnalysisRunsEntity,
      ApplicantsEntity,
      ApplicantRepositoriesEntity,
    ]),
    GitHubModule,
    RabbitMqModule,
  ],
  controllers: [AnalysisRunsController],
  providers: [
    AnalysisRunsService,
    AnalysisRunsFacade,
    AnalysisRunsRepository,
    LlmMessagesRepository,
    CodeAnalysisRepository,
    AnalysisRunPublisher,
  ],
  exports: [
    AnalysisRunsService,
    AnalysisRunsFacade,
    AnalysisRunsRepository,
    LlmMessagesRepository,
    CodeAnalysisRepository,
    AnalysisRunPublisher,
  ],
})
export class AnalysisRunsModule {}
