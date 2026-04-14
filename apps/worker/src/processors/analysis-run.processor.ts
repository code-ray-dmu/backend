import { AnalysisRequestPayload } from '@app/contracts';
import { AnalysisRunStatus, AnalysisStage } from '@app/core';
import { AnalysisRunsEntity } from '@app/database';
import {
  RABBITMQ_EXCHANGES,
  RABBITMQ_QUEUES,
  RABBITMQ_ROUTING_KEYS,
  RabbitMqService,
} from '@app/integrations';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalysisRunJob } from '../jobs/analysis-run.job';
import { GithubRepositoryProcessor } from './github-repository.processor';
import { LlmAnalysisProcessor } from './llm-analysis.processor';

@Injectable()
export class AnalysisRunProcessor implements OnModuleInit {
  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly analysisRunJob: AnalysisRunJob,
    private readonly githubRepositoryProcessor: GithubRepositoryProcessor,
    private readonly llmAnalysisProcessor: LlmAnalysisProcessor,
    @InjectRepository(AnalysisRunsEntity)
    private readonly analysisRunsRepository: Repository<AnalysisRunsEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.registerConsumer(
      RABBITMQ_QUEUES.ANALYSIS_REQUESTS,
      RABBITMQ_ROUTING_KEYS.ANALYSIS_RUN_REQUESTED,
    );
    await this.registerConsumer(
      RABBITMQ_QUEUES.ANALYSIS_RETRY,
      RABBITMQ_ROUTING_KEYS.ANALYSIS_RUN_RETRY,
    );
  }

  private async registerConsumer(queue: string, routingKey: string): Promise<void> {
    await this.rabbitMqService.consume<AnalysisRequestPayload>(
      queue,
      RABBITMQ_EXCHANGES.ANALYSIS_RUNS,
      routingKey,
      async (payload: AnalysisRequestPayload): Promise<void> => {
        const shouldProcess = await this.analysisRunJob.run(payload);

        if (!shouldProcess) {
          return;
        }

        await this.process(payload.analysisRunId);
      },
    );
  }

  async process(analysisRunId: string): Promise<void> {
    await this.markInProgress(analysisRunId);

    try {
      await this.updateCurrentStage(analysisRunId, AnalysisStage.REPO_LIST);
      const repositoryInfo =
        await this.githubRepositoryProcessor.syncRepositoryInfo(analysisRunId);

      await this.updateCurrentStage(analysisRunId, AnalysisStage.FOLDER_STRUCTURE);
      const filePaths = await this.githubRepositoryProcessor.getRepositoryFilePaths({
        analysisRunId,
        defaultBranch: repositoryInfo.defaultBranch,
      });
      const selectedPaths = await this.llmAnalysisProcessor.selectFiles({
        analysisRunId,
        filePaths,
      });

      await this.updateCurrentStage(analysisRunId, AnalysisStage.FILE_DETAIL);
      const selectedFiles = await this.githubRepositoryProcessor.saveSelectedFiles({
        analysisRunId,
        defaultBranch: repositoryInfo.defaultBranch,
        selectedPaths,
      });

      await this.updateCurrentStage(analysisRunId, AnalysisStage.SUMMARY);
      await this.llmAnalysisProcessor.analyzeCode({
        analysisRunId,
        files: selectedFiles,
      });

      await this.updateCurrentStage(analysisRunId, AnalysisStage.QUESTION_GENERATION);
      await this.llmAnalysisProcessor.generateQuestions({
        analysisRunId,
      });

      await this.analysisRunsRepository.update(analysisRunId, {
        completedAt: new Date(),
        failureReason: null,
        status: AnalysisRunStatus.COMPLETED,
      });
    } catch (error) {
      await this.analysisRunsRepository.update(analysisRunId, {
        completedAt: null,
        failureReason: this.toFailureReason(error),
        status: AnalysisRunStatus.FAILED,
      });

      throw error;
    }
  }

  private async markInProgress(analysisRunId: string): Promise<void> {
    const analysisRun = await this.analysisRunsRepository.findOne({
      where: {
        id: analysisRunId,
      },
    });

    if (!analysisRun) {
      throw new Error(`Analysis run not found: ${analysisRunId}`);
    }

    await this.analysisRunsRepository.update(analysisRunId, {
      completedAt: null,
      failureReason: null,
      startedAt: new Date(),
      status: AnalysisRunStatus.IN_PROGRESS,
    });
  }

  private async updateCurrentStage(
    analysisRunId: string,
    stage: AnalysisStage,
  ): Promise<void> {
    await this.analysisRunsRepository.update(analysisRunId, {
      currentStage: stage,
    });
  }

  private toFailureReason(error: unknown): string {
    if (error instanceof Error && /^[A-Z_]+: /.test(error.message)) {
      return error.message;
    }

    if (error instanceof Error) {
      return `ANALYSIS_PIPELINE_FAILED: ${error.message}`;
    }

    return 'ANALYSIS_PIPELINE_FAILED: Unknown analysis pipeline failure';
  }
}
