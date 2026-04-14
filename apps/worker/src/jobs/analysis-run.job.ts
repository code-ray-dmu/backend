import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalysisRequestPayload } from '@app/contracts';
import { AnalysisRunStatus, AnalysisStage } from '@app/core';
import { REDIS_CACHE_KEYS, RedisService } from '@app/integrations';
import { AnalysisRunsRepository } from '../repositories/analysis-runs.repository';
import { AnalysisRunProgressDto } from './dto';

@Injectable()
export class AnalysisRunJob {
  constructor(
    private readonly configService: ConfigService,
    private readonly analysisRunsRepository: AnalysisRunsRepository,
    private readonly redisService: RedisService,
  ) {}

  async run(payload: AnalysisRequestPayload): Promise<boolean> {
    const lockKey = `${REDIS_CACHE_KEYS.ANALYSIS_RUN_LOCK}:${payload.repositoryId}`;
    const progressKey = `${REDIS_CACHE_KEYS.ANALYSIS_RUN_PROGRESS}:${payload.analysisRunId}`;
    const lockTtl = this.configService.get<number>('analysis.lockTtl', 600);
    const lockAcquired = await this.redisService.setIfAbsent(lockKey, payload.analysisRunId, lockTtl);

    if (!lockAcquired) {
      const failureReason = 'Concurrent analysis in progress';

      await this.analysisRunsRepository.markFailed(payload.analysisRunId, failureReason);
      throw new Error(failureReason);
    }

    try {
      const analysisRun = await this.analysisRunsRepository.findById(payload.analysisRunId);

      if (!analysisRun) {
        throw new NotFoundException(`Analysis run ${payload.analysisRunId} not found`);
      }

      if (analysisRun.status !== AnalysisRunStatus.QUEUED) {
        return false;
      }

      await this.analysisRunsRepository.markInProgress(
        payload.analysisRunId,
        AnalysisStage.REPO_LIST,
      );

      const progress: AnalysisRunProgressDto = {
        analysisRunId: payload.analysisRunId,
        repositoryId: payload.repositoryId,
        status: AnalysisRunStatus.IN_PROGRESS,
        currentStage: AnalysisStage.REPO_LIST,
        updatedAt: new Date().toISOString(),
      };

      await this.redisService.set(progressKey, JSON.stringify(progress), 3600);

      return true;
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : 'Unknown analysis worker error';
      await this.analysisRunsRepository.markFailed(payload.analysisRunId, failureReason);
      throw error;
    } finally {
      await this.redisService.delete(lockKey);
    }
  }
}
