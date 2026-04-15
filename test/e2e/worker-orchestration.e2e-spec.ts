import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AnalysisRunStatus, AnalysisStage } from '@app/core';
import { AnalysisRequestPayload } from '@app/contracts';
import {
  buildAnalysisRunLockCacheKey,
  buildAnalysisRunProgressCacheKey,
  RabbitMqService,
  RedisService,
  RABBITMQ_EXCHANGES,
  RABBITMQ_QUEUES,
  RABBITMQ_ROUTING_KEYS,
} from '@app/integrations';
import { AnalysisRunJob } from '../../apps/worker/src/jobs/analysis-run.job';
import { AnalysisRunProcessor } from '../../apps/worker/src/processors/analysis-run.processor';
import { GithubRepositoryProcessor } from '../../apps/worker/src/processors/github-repository.processor';
import { LlmAnalysisProcessor } from '../../apps/worker/src/processors/llm-analysis.processor';
import { AnalysisRunsRepository } from '../../apps/worker/src/repositories/analysis-runs.repository';

describe('Worker queue-to-job orchestration integration', () => {
  let processor: AnalysisRunProcessor;
  let rabbitMqService: jest.Mocked<RabbitMqService>;
  let analysisRunsRepository: jest.Mocked<AnalysisRunsRepository>;
  let redisService: jest.Mocked<RedisService>;
  let githubRepositoryProcessor: jest.Mocked<GithubRepositoryProcessor>;
  let llmAnalysisProcessor: jest.Mocked<LlmAnalysisProcessor>;

  let consumer:
    | ((payload: AnalysisRequestPayload) => Promise<void>)
    | undefined;

  const payload: AnalysisRequestPayload = {
    analysisRunId: 'run-e2e',
    applicantId: 'applicant-1',
    repositoryId: 'repository-1',
    requestedByUserId: 'user-1',
    requestedAt: '2026-04-15T00:00:00.000Z',
  };

  beforeEach(async () => {
    rabbitMqService = {
      consume: jest.fn(),
    } as unknown as jest.Mocked<RabbitMqService>;
    analysisRunsRepository = {
      findById: jest.fn(),
      markCompleted: jest.fn(),
      markInProgress: jest.fn(),
      markFailed: jest.fn(),
      updateCurrentStage: jest.fn(),
    } as unknown as jest.Mocked<AnalysisRunsRepository>;
    redisService = {
      setIfAbsent: jest.fn(),
      expireIfValueMatches: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;
    githubRepositoryProcessor = {
      syncRepositoryInfo: jest.fn(),
      getRepositoryFilePaths: jest.fn(),
      saveSelectedFiles: jest.fn(),
    } as unknown as jest.Mocked<GithubRepositoryProcessor>;
    llmAnalysisProcessor = {
      selectFiles: jest.fn(),
      analyzeCode: jest.fn(),
      generateQuestions: jest.fn(),
    } as unknown as jest.Mocked<LlmAnalysisProcessor>;

    rabbitMqService.consume.mockImplementation(
      async (
        _queue: string,
        _exchange: string,
        _routingKey: string,
        handler: (nextPayload: AnalysisRequestPayload) => Promise<void>,
      ): Promise<void> => {
        consumer = handler;
      },
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        AnalysisRunProcessor,
        AnalysisRunJob,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: number): number | undefined => {
              if (key === 'analysis.lockTtl') {
                return 600;
              }

              return defaultValue;
            }),
          },
        },
        {
          provide: RabbitMqService,
          useValue: rabbitMqService,
        },
        {
          provide: AnalysisRunsRepository,
          useValue: analysisRunsRepository,
        },
        {
          provide: RedisService,
          useValue: redisService,
        },
        {
          provide: GithubRepositoryProcessor,
          useValue: githubRepositoryProcessor,
        },
        {
          provide: LlmAnalysisProcessor,
          useValue: llmAnalysisProcessor,
        },
      ],
    }).compile();

    processor = moduleRef.get(AnalysisRunProcessor);
  });

  it('consumes the analysis queue and completes the worker pipeline', async () => {
    redisService.setIfAbsent.mockResolvedValue(true);
    analysisRunsRepository.findById.mockResolvedValue({
      id: payload.analysisRunId,
      status: AnalysisRunStatus.QUEUED,
    } as never);
    githubRepositoryProcessor.syncRepositoryInfo.mockResolvedValue({
      defaultBranch: 'main',
    } as never);
    githubRepositoryProcessor.getRepositoryFilePaths.mockResolvedValue([
      'src/main.ts',
      'src/app.module.ts',
    ]);
    llmAnalysisProcessor.selectFiles.mockResolvedValue(['src/main.ts']);
    githubRepositoryProcessor.saveSelectedFiles.mockResolvedValue([
      {
        path: 'src/main.ts',
        content: 'export const main = true;',
      },
    ]);
    llmAnalysisProcessor.analyzeCode.mockResolvedValue({} as never);
    llmAnalysisProcessor.generateQuestions.mockResolvedValue([]);

    await processor.onModuleInit();
    await consumer?.(payload);

    expect(rabbitMqService.consume).toHaveBeenCalledWith(
      RABBITMQ_QUEUES.ANALYSIS_REQUEST,
      RABBITMQ_EXCHANGES.ANALYSIS_REQUEST,
      RABBITMQ_ROUTING_KEYS.ANALYSIS_REQUEST,
      expect.any(Function),
    );
    expect(analysisRunsRepository.markInProgress).toHaveBeenCalledWith(
      payload.analysisRunId,
      AnalysisStage.REPO_LIST,
    );
    expect(analysisRunsRepository.updateCurrentStage).toHaveBeenNthCalledWith(
      1,
      payload.analysisRunId,
      AnalysisStage.FOLDER_STRUCTURE,
    );
    expect(analysisRunsRepository.updateCurrentStage).toHaveBeenNthCalledWith(
      2,
      payload.analysisRunId,
      AnalysisStage.FILE_DETAIL,
    );
    expect(analysisRunsRepository.updateCurrentStage).toHaveBeenNthCalledWith(
      3,
      payload.analysisRunId,
      AnalysisStage.SUMMARY,
    );
    expect(analysisRunsRepository.updateCurrentStage).toHaveBeenNthCalledWith(
      4,
      payload.analysisRunId,
      AnalysisStage.QUESTION_GENERATION,
    );
    expect(analysisRunsRepository.markCompleted).toHaveBeenCalledWith(
      payload.analysisRunId,
      AnalysisStage.QUESTION_GENERATION,
    );
    expect(redisService.delete).toHaveBeenCalledWith(
      buildAnalysisRunLockCacheKey(payload.repositoryId),
    );

    const finalProgressPayload = redisService.set.mock.calls.at(-1)?.[1];
    expect(finalProgressPayload).toBeDefined();

    const finalProgress = JSON.parse(finalProgressPayload as string) as {
      analysisRunId: string;
      currentStage: AnalysisStage;
      repositoryId: string;
      status: AnalysisRunStatus;
    };
    expect(finalProgress).toMatchObject({
      analysisRunId: payload.analysisRunId,
      repositoryId: payload.repositoryId,
      status: AnalysisRunStatus.COMPLETED,
      currentStage: AnalysisStage.QUESTION_GENERATION,
    });
  });

  it('propagates queue failures and records failed progress for the active stage', async () => {
    redisService.setIfAbsent.mockResolvedValue(true);
    analysisRunsRepository.findById
      .mockResolvedValueOnce({
        id: payload.analysisRunId,
        status: AnalysisRunStatus.QUEUED,
      } as never)
      .mockResolvedValueOnce({
        id: payload.analysisRunId,
        status: AnalysisRunStatus.IN_PROGRESS,
        currentStage: AnalysisStage.FILE_DETAIL,
      } as never);
    githubRepositoryProcessor.syncRepositoryInfo.mockResolvedValue({
      defaultBranch: 'main',
    } as never);
    githubRepositoryProcessor.getRepositoryFilePaths.mockResolvedValue(['src/main.ts']);
    llmAnalysisProcessor.selectFiles.mockResolvedValue(['src/main.ts']);
    githubRepositoryProcessor.saveSelectedFiles.mockRejectedValue(
      new Error('GitHub source file not found'),
    );

    await processor.onModuleInit();

    await expect(consumer?.(payload)).rejects.toThrow('GitHub source file not found');

    expect(analysisRunsRepository.markFailed).toHaveBeenCalledWith(
      payload.analysisRunId,
      'GitHub source file not found',
    );
    expect(redisService.delete).toHaveBeenCalledWith(
      buildAnalysisRunLockCacheKey(payload.repositoryId),
    );

    const finalProgressPayload = redisService.set.mock.calls.at(-1)?.[1];
    expect(finalProgressPayload).toBeDefined();

    const finalProgress = JSON.parse(finalProgressPayload as string) as {
      currentStage: AnalysisStage;
      status: AnalysisRunStatus;
    };
    expect(finalProgress).toMatchObject({
      status: AnalysisRunStatus.FAILED,
      currentStage: AnalysisStage.FILE_DETAIL,
    });
    expect(redisService.set).toHaveBeenCalledWith(
      buildAnalysisRunProgressCacheKey(payload.analysisRunId),
      expect.any(String),
      3600,
    );
  });
});
