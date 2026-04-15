import { AnalysisRunStatus } from '@app/core';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalysisRunsRepository } from '../repositories/analysis-runs.repository';

@Injectable()
export class CleanupScheduler implements OnModuleInit, OnModuleDestroy {
  private static readonly STALE_RUN_IDENTIFIER = 'ANALYSIS_RUN_STALE_TIMEOUT';
  private readonly logger = new Logger(CleanupScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly analysisRunsRepository: AnalysisRunsRepository,
  ) {}

  onModuleInit(): void {
    const intervalSeconds = this.getCleanupIntervalSeconds();
    this.timer = setInterval(() => {
      void this.runCleanupTick();
    }, intervalSeconds * 1000);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async cleanupStaleRuns(): Promise<void> {
    const staleThresholdSeconds = this.getStaleRunThresholdSeconds();
    const staleBefore = new Date(Date.now() - staleThresholdSeconds * 1000);
    const batchSize = this.getCleanupBatchSize();
    const staleRuns = await this.analysisRunsRepository.findStaleInProgressRuns({
      limit: batchSize,
      staleBefore,
    });

    if (staleRuns.length === 0) {
      return;
    }

    const failureReason = `${CleanupScheduler.STALE_RUN_IDENTIFIER}: status=${AnalysisRunStatus.IN_PROGRESS} exceeded=${staleThresholdSeconds}s`;
    const affected = await this.analysisRunsRepository.markStaleRunsFailed({
      analysisRunIds: staleRuns.map((run) => run.id),
      failureReason,
    });

    this.logger.warn(
      `Marked stale analysis runs as failed: requested=${staleRuns.length} updated=${affected}`,
    );
  }

  private async runCleanupTick(): Promise<void> {
    try {
      await this.cleanupStaleRuns();
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.logger.error('Cleanup scheduler tick failed', trace);
    }
  }

  private getCleanupIntervalSeconds(): number {
    return this.configService.get<number>('analysis.cleanupIntervalSeconds', 300);
  }

  private getStaleRunThresholdSeconds(): number {
    return this.configService.get<number>('analysis.staleRunThresholdSeconds', 1800);
  }

  private getCleanupBatchSize(): number {
    return this.configService.get<number>('analysis.cleanupBatchSize', 50);
  }
}
