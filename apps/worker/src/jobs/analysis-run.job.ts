import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalysisRequestPayload } from '@app/contracts';
import { AnalysisRunStatus, AnalysisStage } from '@app/core';
import {
  buildAnalysisRunLockCacheKey,
  buildAnalysisRunProgressCacheKey,
  RedisService,
} from '@app/integrations';
import { GithubRepositoryProcessor } from '../processors/github-repository.processor';
import { LlmAnalysisProcessor } from '../processors/llm-analysis.processor';
import { AnalysisRunsRepository } from '../repositories/analysis-runs.repository';
import { AnalysisRunProgressDto } from './dto';

@Injectable()
export class AnalysisRunJob {
  constructor(
    private readonly configService: ConfigService,
    private readonly analysisRunsRepository: AnalysisRunsRepository,
    private readonly redisService: RedisService,
    private readonly githubRepositoryProcessor: GithubRepositoryProcessor,
    private readonly llmAnalysisProcessor: LlmAnalysisProcessor,
  ) {}

  async run(payload: AnalysisRequestPayload): Promise<void> {
    const lockKey = buildAnalysisRunLockCacheKey(payload.repositoryId);
    const progressKey = buildAnalysisRunProgressCacheKey(payload.analysisRunId);
    const lockTtl = this.configService.get<number>('analysis.lockTtl', 600);
    const lockAcquired = await this.redisService.setIfAbsent(lockKey, payload.analysisRunId, lockTtl);

    if (!lockAcquired) {
      const failureReason = 'Concurrent analysis in progress';

      await this.analysisRunsRepository.markFailed(payload.analysisRunId, failureReason);
      await this.saveProgress({
        currentStage: AnalysisStage.REPO_LIST,
        payload,
        progressKey,
        status: AnalysisRunStatus.FAILED,
      });
      throw new Error(failureReason);
    }

    const heartbeat = this.startLockHeartbeat({
      lockKey,
      lockOwner: payload.analysisRunId,
      lockTtl,
    });

    try {
      const analysisRun = await this.analysisRunsRepository.findById(payload.analysisRunId);

      if (!analysisRun) {
        throw new NotFoundException(`Analysis run ${payload.analysisRunId} not found`);
      }

      if (analysisRun.status !== AnalysisRunStatus.QUEUED) {
        return;
      }

      await this.analysisRunsRepository.markInProgress(
        payload.analysisRunId,
        AnalysisStage.REPO_LIST,
      );
      await this.saveProgress({
        currentStage: AnalysisStage.REPO_LIST,
        payload,
        progressKey,
        status: AnalysisRunStatus.IN_PROGRESS,
      });

      const repositoryInfo = await this.githubRepositoryProcessor.syncRepositoryInfo(
        payload.analysisRunId,
      );
      const filePaths = await this.executeStage({
        payload,
        progressKey,
        stage: AnalysisStage.FOLDER_STRUCTURE,
        task: async (): Promise<string[]> => {
          return this.githubRepositoryProcessor.getRepositoryFilePaths({
            analysisRunId: payload.analysisRunId,
            defaultBranch: repositoryInfo.defaultBranch,
          });
        },
      });
      const selectedPaths = await this.llmAnalysisProcessor.selectFiles({
        analysisRunId: payload.analysisRunId,
        filePaths,
      });

      const selectedFiles = await this.executeStage({
        payload,
        progressKey,
        stage: AnalysisStage.FILE_DETAIL,
        task: async (): Promise<Array<{ content: string; path: string }>> => {
          return this.githubRepositoryProcessor.saveSelectedFiles({
            analysisRunId: payload.analysisRunId,
            defaultBranch: repositoryInfo.defaultBranch,
            selectedPaths,
          });
        },
      });

      await this.executeStage({
        payload,
        progressKey,
        stage: AnalysisStage.SUMMARY,
        task: async (): Promise<void> => {
          await this.llmAnalysisProcessor.analyzeCode({
            analysisRunId: payload.analysisRunId,
            files: selectedFiles,
          });
        },
      });

      await this.executeStage({
        payload,
        progressKey,
        stage: AnalysisStage.QUESTION_GENERATION,
        task: async (): Promise<void> => {
          await this.llmAnalysisProcessor.generateQuestions({
            analysisRunId: payload.analysisRunId,
          });
        },
      });

      await this.analysisRunsRepository.markCompleted(
        payload.analysisRunId,
        AnalysisStage.QUESTION_GENERATION,
      );
      await this.saveProgress({
        currentStage: AnalysisStage.QUESTION_GENERATION,
        payload,
        progressKey,
        status: AnalysisRunStatus.COMPLETED,
      });
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : 'Unknown analysis worker error';
      await this.analysisRunsRepository.markFailed(payload.analysisRunId, failureReason);
      await this.saveProgress({
        currentStage: await this.getCurrentStage(payload.analysisRunId),
        payload,
        progressKey,
        status: AnalysisRunStatus.FAILED,
      });
      throw error;
    } finally {
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      await this.redisService.delete(lockKey);
    }
  }

  private async executeStage<T>(input: {
    payload: AnalysisRequestPayload;
    progressKey: string;
    stage: AnalysisStage;
    task: () => Promise<T>;
  }): Promise<T> {
    await this.analysisRunsRepository.updateCurrentStage(
      input.payload.analysisRunId,
      input.stage,
    );
    await this.saveProgress({
      currentStage: input.stage,
      payload: input.payload,
      progressKey: input.progressKey,
      status: AnalysisRunStatus.IN_PROGRESS,
    });

    return input.task();
  }

  private async saveProgress(input: {
    currentStage: AnalysisStage;
    payload: AnalysisRequestPayload;
    progressKey: string;
    status: AnalysisRunStatus;
  }): Promise<void> {
    const progress: AnalysisRunProgressDto = {
      analysisRunId: input.payload.analysisRunId,
      repositoryId: input.payload.repositoryId,
      status: input.status,
      currentStage: input.currentStage,
      updatedAt: new Date().toISOString(),
    };

    await this.redisService.set(input.progressKey, JSON.stringify(progress), 3600);
  }

  private async getCurrentStage(analysisRunId: string): Promise<AnalysisStage> {
    const analysisRun = await this.analysisRunsRepository.findById(analysisRunId);
    return analysisRun?.currentStage ?? AnalysisStage.REPO_LIST;
  }

  private startLockHeartbeat(input: {
    lockKey: string;
    lockOwner: string;
    lockTtl: number;
  }): NodeJS.Timeout | null {
    if (input.lockTtl <= 1) {
      return null;
    }

    const intervalMs = Math.max(1000, Math.floor((input.lockTtl * 1000) / 3));

    return setInterval(() => {
      void this.redisService
        .expireIfValueMatches(input.lockKey, input.lockOwner, input.lockTtl)
        .catch(() => {
          return undefined;
        });
    }, intervalMs);
  }
}
