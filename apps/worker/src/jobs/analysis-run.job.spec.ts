import { ConfigService } from '@nestjs/config';
import { AnalysisRunStatus, AnalysisStage } from '@app/core';
import { AnalysisRequestPayload } from '@app/contracts';
import { RedisService } from '@app/integrations';
import { AnalysisRunsRepository } from '../repositories/analysis-runs.repository';
import { AnalysisRunJob } from './analysis-run.job';

describe('AnalysisRunJob', () => {
  let job: AnalysisRunJob;
  let analysisRunsRepository: jest.Mocked<AnalysisRunsRepository>;
  let redisService: jest.Mocked<RedisService>;

  const payload: AnalysisRequestPayload = {
    analysisRunId: 'run-1',
    applicantId: 'applicant-1',
    repositoryId: 'repository-1',
    requestedByUserId: 'user-1',
    requestedAt: '2026-04-14T00:00:00.000Z',
  };

  beforeEach(() => {
    analysisRunsRepository = {
      findById: jest.fn(),
      markInProgress: jest.fn(),
      markFailed: jest.fn(),
    } as unknown as jest.Mocked<AnalysisRunsRepository>;
    redisService = {
      setIfAbsent: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;
    const configService = {
      get: jest.fn((key: string, defaultValue?: number) => {
        if (key === 'analysis.lockTtl') {
          return 600;
        }

        return defaultValue;
      }),
    } as unknown as ConfigService;

    job = new AnalysisRunJob(configService, analysisRunsRepository, redisService);
  });

  it('marks a run in progress and stores progress in redis', async () => {
    redisService.setIfAbsent.mockResolvedValue(true);
    analysisRunsRepository.findById.mockResolvedValue({
      id: 'run-1',
      status: AnalysisRunStatus.QUEUED,
    } as never);

    await job.run(payload);

    expect(analysisRunsRepository.markInProgress).toHaveBeenCalledWith(
      'run-1',
      AnalysisStage.REPO_LIST,
    );
    expect(redisService.set).toHaveBeenCalledWith(
      'analysis-run:progress:run-1',
      expect.stringContaining(`"status":"${AnalysisRunStatus.IN_PROGRESS}"`),
      3600,
    );
    expect(redisService.delete).toHaveBeenCalledWith('analysis-run:lock:repository-1');
  });

  it('marks the run failed when processing throws', async () => {
    redisService.setIfAbsent.mockResolvedValue(true);
    analysisRunsRepository.findById.mockResolvedValue(null);

    await expect(job.run(payload)).rejects.toThrow('Analysis run run-1 not found');

    expect(analysisRunsRepository.markFailed).toHaveBeenCalledWith(
      'run-1',
      'Analysis run run-1 not found',
    );
    expect(redisService.delete).toHaveBeenCalledWith('analysis-run:lock:repository-1');
  });

  it('fails immediately when the repository lock is already held', async () => {
    redisService.setIfAbsent.mockResolvedValue(false);

    await expect(job.run(payload)).rejects.toThrow('Concurrent analysis in progress');

    expect(analysisRunsRepository.findById).not.toHaveBeenCalled();
    expect(analysisRunsRepository.markFailed).toHaveBeenCalledWith(
      'run-1',
      'Concurrent analysis in progress',
    );
    expect(redisService.delete).not.toHaveBeenCalled();
  });

  it('skips runs that are no longer queued', async () => {
    redisService.setIfAbsent.mockResolvedValue(true);
    analysisRunsRepository.findById.mockResolvedValue({
      id: 'run-1',
      status: AnalysisRunStatus.FAILED,
    } as never);

    await expect(job.run(payload)).resolves.toBeUndefined();

    expect(analysisRunsRepository.markInProgress).not.toHaveBeenCalled();
    expect(redisService.set).not.toHaveBeenCalled();
    expect(redisService.delete).toHaveBeenCalledWith('analysis-run:lock:repository-1');
  });
});
