import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { AnalysisRunsRepository } from '../repositories/analysis-runs.repository';
import { CleanupScheduler } from './cleanup.scheduler';

describe('CleanupScheduler', () => {
  let scheduler: CleanupScheduler;
  let configService: jest.Mocked<ConfigService>;
  let analysisRunsRepository: jest.Mocked<AnalysisRunsRepository>;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, defaultValue?: number) => {
        const values: Record<string, number> = {
          'analysis.cleanupIntervalSeconds': 120,
          'analysis.staleRunThresholdSeconds': 1800,
          'analysis.cleanupBatchSize': 25,
        };

        return values[key] ?? defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    analysisRunsRepository = {
      findStaleInProgressRuns: jest.fn(),
      markStaleRunsFailed: jest.fn(),
    } as unknown as jest.Mocked<AnalysisRunsRepository>;

    scheduler = new CleanupScheduler(configService, analysisRunsRepository);
  });

  afterEach(() => {
    scheduler.onModuleDestroy();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('marks stale in-progress runs as failed with identifiable failure reason', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-15T09:00:00.000Z'));
    analysisRunsRepository.findStaleInProgressRuns.mockResolvedValue([
      { id: 'run-1', startedAt: new Date('2026-04-15T08:00:00.000Z') },
      { id: 'run-2', startedAt: new Date('2026-04-15T08:10:00.000Z') },
    ]);
    analysisRunsRepository.markStaleRunsFailed.mockResolvedValue(2);

    await scheduler.cleanupStaleRuns();

    expect(analysisRunsRepository.findStaleInProgressRuns).toHaveBeenCalledWith({
      limit: 25,
      staleBefore: new Date('2026-04-15T08:30:00.000Z'),
    });
    expect(analysisRunsRepository.markStaleRunsFailed).toHaveBeenCalledWith({
      analysisRunIds: ['run-1', 'run-2'],
      failureReason: 'ANALYSIS_RUN_STALE_TIMEOUT: status=IN_PROGRESS exceeded=1800s',
    });
  });

  it('does not mark failed when no stale runs are found', async () => {
    analysisRunsRepository.findStaleInProgressRuns.mockResolvedValue([]);

    await scheduler.cleanupStaleRuns();

    expect(analysisRunsRepository.markStaleRunsFailed).not.toHaveBeenCalled();
  });

  it('starts and stops periodic cleanup using configured interval', () => {
    jest.useFakeTimers();
    const cleanupSpy = jest
      .spyOn(scheduler, 'cleanupStaleRuns')
      .mockResolvedValue(undefined);

    scheduler.onModuleInit();
    jest.advanceTimersByTime(120_000);

    expect(cleanupSpy).toHaveBeenCalledTimes(1);

    scheduler.onModuleDestroy();
    jest.advanceTimersByTime(120_000);

    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });

  it('logs and swallows errors from periodic cleanup tick', async () => {
    jest.useFakeTimers();
    const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    analysisRunsRepository.findStaleInProgressRuns.mockRejectedValue(
      new Error('database unavailable'),
    );

    scheduler.onModuleInit();
    await jest.advanceTimersByTimeAsync(120_000);

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Cleanup scheduler tick failed',
      expect.stringContaining('database unavailable'),
    );
  });
});
