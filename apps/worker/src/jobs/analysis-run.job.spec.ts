import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalysisRunStatus, AnalysisStage } from '@app/core';
import { AnalysisRequestPayload } from '@app/contracts';
import {
  buildAnalysisRunLockCacheKey,
  buildAnalysisRunProgressCacheKey,
  RedisService,
} from '@app/integrations';
import { GithubRepositoryProcessor } from '../processors/github-repository.processor';
import { LlmAnalysisProcessor } from '../processors/llm-analysis.processor';
import { AnalysisRunsRepository } from '../repositories/analysis-runs.repository';
import { AnalysisRunJob } from './analysis-run.job';

describe('AnalysisRunJob', () => {
  let job: AnalysisRunJob;
  let analysisRunsRepository: jest.Mocked<AnalysisRunsRepository>;
  let redisService: jest.Mocked<RedisService>;
  let githubRepositoryProcessor: jest.Mocked<GithubRepositoryProcessor>;
  let llmAnalysisProcessor: jest.Mocked<LlmAnalysisProcessor>;
  let loggerErrorSpy: jest.SpyInstance;

  const payload: AnalysisRequestPayload = {
    analysisRunId: 'run-1',
    applicantId: 'applicant-1',
    repositoryId: 'repository-1',
    requestedByUserId: 'user-1',
    requestedAt: '2026-04-14T00:00:00.000Z',
  };

  beforeEach(() => {
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
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
    const configService = {
      get: jest.fn((key: string, defaultValue?: number) => {
        if (key === 'analysis.lockTtl') {
          return 600;
        }

        return defaultValue;
      }),
    } as unknown as ConfigService;

    job = new AnalysisRunJob(
      configService,
      analysisRunsRepository,
      redisService,
      githubRepositoryProcessor,
      llmAnalysisProcessor,
    );
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  it('orchestrates all stages and completes analysis run with a single lock lifecycle', async () => {
    redisService.setIfAbsent.mockResolvedValue(true);
    analysisRunsRepository.findById.mockResolvedValue({
      id: 'run-1',
      status: AnalysisRunStatus.QUEUED,
    } as never);
    githubRepositoryProcessor.syncRepositoryInfo.mockResolvedValue({
      defaultBranch: 'main',
    } as never);
    githubRepositoryProcessor.getRepositoryFilePaths.mockResolvedValue(['src/main.ts']);
    llmAnalysisProcessor.selectFiles.mockResolvedValue(['src/main.ts']);
    githubRepositoryProcessor.saveSelectedFiles.mockResolvedValue([
      {
        content: 'console.log("hello");',
        path: 'src/main.ts',
      },
    ]);
    llmAnalysisProcessor.analyzeCode.mockResolvedValue({} as never);
    llmAnalysisProcessor.generateQuestions.mockResolvedValue([]);

    await expect(job.run(payload)).resolves.toBeUndefined();

    expect(redisService.setIfAbsent).toHaveBeenCalledWith(
      buildAnalysisRunLockCacheKey('repository-1'),
      'run-1',
      600,
    );
    expect(analysisRunsRepository.markInProgress).toHaveBeenCalledWith(
      'run-1',
      AnalysisStage.REPO_LIST,
    );
    expect(analysisRunsRepository.updateCurrentStage).toHaveBeenNthCalledWith(
      1,
      'run-1',
      AnalysisStage.FOLDER_STRUCTURE,
    );
    expect(analysisRunsRepository.updateCurrentStage).toHaveBeenNthCalledWith(
      2,
      'run-1',
      AnalysisStage.FILE_DETAIL,
    );
    expect(analysisRunsRepository.updateCurrentStage).toHaveBeenNthCalledWith(
      3,
      'run-1',
      AnalysisStage.SUMMARY,
    );
    expect(analysisRunsRepository.updateCurrentStage).toHaveBeenNthCalledWith(
      4,
      'run-1',
      AnalysisStage.QUESTION_GENERATION,
    );
    expect(analysisRunsRepository.markCompleted).toHaveBeenCalledWith(
      'run-1',
      AnalysisStage.QUESTION_GENERATION,
    );
    expect(githubRepositoryProcessor.syncRepositoryInfo).toHaveBeenCalledWith('run-1');
    expect(githubRepositoryProcessor.getRepositoryFilePaths).toHaveBeenCalledWith({
      analysisRunId: 'run-1',
      defaultBranch: 'main',
    });
    expect(llmAnalysisProcessor.selectFiles).toHaveBeenCalledWith({
      analysisRunId: 'run-1',
      filePaths: ['src/main.ts'],
    });
    expect(githubRepositoryProcessor.saveSelectedFiles).toHaveBeenCalledWith({
      analysisRunId: 'run-1',
      defaultBranch: 'main',
      selectedPaths: ['src/main.ts'],
    });
    expect(llmAnalysisProcessor.analyzeCode).toHaveBeenCalledWith({
      analysisRunId: 'run-1',
      files: [{ content: 'console.log("hello");', path: 'src/main.ts' }],
    });
    expect(llmAnalysisProcessor.generateQuestions).toHaveBeenCalledWith({
      analysisRunId: 'run-1',
    });
    expect(redisService.set).toHaveBeenCalledWith(
      buildAnalysisRunProgressCacheKey('run-1'),
      expect.any(String),
      3600,
    );
    expect(redisService.delete).toHaveBeenCalledWith(
      buildAnalysisRunLockCacheKey('repository-1'),
    );

    const finalProgressPayload = redisService.set.mock.calls.at(-1)?.[1];
    const finalProgress = JSON.parse(finalProgressPayload as string) as {
      analysisRunId: string;
      currentStage: AnalysisStage;
      repositoryId: string;
      status: AnalysisRunStatus;
      updatedAt: string;
    };
    expect(finalProgress.analysisRunId).toBe('run-1');
    expect(finalProgress.repositoryId).toBe('repository-1');
    expect(finalProgress.status).toBe(AnalysisRunStatus.COMPLETED);
    expect(finalProgress.currentStage).toBe(AnalysisStage.QUESTION_GENERATION);
    expect(finalProgress.updatedAt).toEqual(expect.any(String));
  });

  it('marks the run failed when processing throws', async () => {
    redisService.setIfAbsent.mockResolvedValue(true);
    analysisRunsRepository.findById.mockResolvedValue(null);

    await expect(job.run(payload)).rejects.toThrow('Analysis run run-1 not found');

    expect(analysisRunsRepository.markFailed).toHaveBeenCalledWith(
      'run-1',
      'Analysis run run-1 not found',
    );
    expect(githubRepositoryProcessor.syncRepositoryInfo).not.toHaveBeenCalled();
    const finalProgressPayload = redisService.set.mock.calls.at(-1)?.[1];
    const finalProgress = JSON.parse(finalProgressPayload as string) as {
      currentStage: AnalysisStage;
      status: AnalysisRunStatus;
    };
    expect(finalProgress.status).toBe(AnalysisRunStatus.FAILED);
    expect(finalProgress.currentStage).toBe(AnalysisStage.REPO_LIST);
    expect(redisService.delete).toHaveBeenCalledWith(
      buildAnalysisRunLockCacheKey('repository-1'),
    );
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Analysis run failed: analysisRunId=run-1 repositoryId=repository-1'),
      expect.stringContaining('Analysis run run-1 not found'),
    );
  });

  it('fails immediately when the repository lock is already held', async () => {
    redisService.setIfAbsent.mockResolvedValue(false);

    await expect(job.run(payload)).rejects.toThrow('Concurrent analysis in progress');

    expect(analysisRunsRepository.findById).not.toHaveBeenCalled();
    expect(analysisRunsRepository.markFailed).toHaveBeenCalledWith(
      'run-1',
      'Concurrent analysis in progress',
    );
    expect(redisService.set).toHaveBeenCalledWith(
      buildAnalysisRunProgressCacheKey('run-1'),
      expect.any(String),
      3600,
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
    expect(analysisRunsRepository.markCompleted).not.toHaveBeenCalled();
    expect(analysisRunsRepository.markFailed).not.toHaveBeenCalled();
    expect(analysisRunsRepository.updateCurrentStage).not.toHaveBeenCalled();
    expect(githubRepositoryProcessor.syncRepositoryInfo).not.toHaveBeenCalled();
    expect(redisService.set).not.toHaveBeenCalled();
    expect(redisService.delete).toHaveBeenCalledWith(
      buildAnalysisRunLockCacheKey('repository-1'),
    );
  });

  it('marks failed with active stage and releases lock when a pipeline stage throws', async () => {
    redisService.setIfAbsent.mockResolvedValue(true);
    analysisRunsRepository.findById
      .mockResolvedValueOnce({
        id: 'run-1',
        status: AnalysisRunStatus.QUEUED,
      } as never)
      .mockResolvedValueOnce({
        id: 'run-1',
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

    await expect(job.run(payload)).rejects.toThrow('GitHub source file not found');

    expect(analysisRunsRepository.markFailed).toHaveBeenCalledWith(
      'run-1',
      'GitHub source file not found',
    );
    const finalProgressPayload = redisService.set.mock.calls.at(-1)?.[1];
    const finalProgress = JSON.parse(finalProgressPayload as string) as {
      currentStage: AnalysisStage;
      status: AnalysisRunStatus;
    };
    expect(finalProgress.status).toBe(AnalysisRunStatus.FAILED);
    expect(finalProgress.currentStage).toBe(AnalysisStage.FILE_DETAIL);
    expect(redisService.delete).toHaveBeenCalledWith(
      buildAnalysisRunLockCacheKey('repository-1'),
    );
  });

  it('persists parse failure reason and FOLDER_STRUCTURE stage when file selection parsing fails', async () => {
    redisService.setIfAbsent.mockResolvedValue(true);
    analysisRunsRepository.findById
      .mockResolvedValueOnce({
        id: 'run-1',
        status: AnalysisRunStatus.QUEUED,
      } as never)
      .mockResolvedValueOnce({
        id: 'run-1',
        status: AnalysisRunStatus.IN_PROGRESS,
        currentStage: AnalysisStage.FOLDER_STRUCTURE,
      } as never);
    githubRepositoryProcessor.syncRepositoryInfo.mockResolvedValue({
      defaultBranch: 'main',
    } as never);
    githubRepositoryProcessor.getRepositoryFilePaths.mockResolvedValue(['src/main.ts']);
    llmAnalysisProcessor.selectFiles.mockRejectedValue(
      new Error(
        'LLM_RESPONSE_PARSE_FAILED: stage=file_selection detail=Unexpected end of JSON input',
      ),
    );

    await expect(job.run(payload)).rejects.toThrow(
      'LLM_RESPONSE_PARSE_FAILED: stage=file_selection detail=Unexpected end of JSON input',
    );

    expect(analysisRunsRepository.markFailed).toHaveBeenCalledWith(
      'run-1',
      'LLM_RESPONSE_PARSE_FAILED: stage=file_selection detail=Unexpected end of JSON input',
    );
    const finalProgressPayload = redisService.set.mock.calls.at(-1)?.[1];
    const finalProgress = JSON.parse(finalProgressPayload as string) as {
      currentStage: AnalysisStage;
      status: AnalysisRunStatus;
    };
    expect(finalProgress.status).toBe(AnalysisRunStatus.FAILED);
    expect(finalProgress.currentStage).toBe(AnalysisStage.FOLDER_STRUCTURE);
    expect(redisService.delete).toHaveBeenCalledWith(
      buildAnalysisRunLockCacheKey('repository-1'),
    );
  });

  it('persists GitHub pipeline identifier as failure_reason when REPO_LIST fails', async () => {
    redisService.setIfAbsent.mockResolvedValue(true);
    analysisRunsRepository.findById
      .mockResolvedValueOnce({
        id: 'run-1',
        status: AnalysisRunStatus.QUEUED,
      } as never)
      .mockResolvedValueOnce({
        id: 'run-1',
        status: AnalysisRunStatus.IN_PROGRESS,
        currentStage: AnalysisStage.REPO_LIST,
      } as never);
    githubRepositoryProcessor.syncRepositoryInfo.mockRejectedValue(
      new Error(
        'GITHUB_RATE_LIMIT_EXCEEDED: rate limit remaining 0, resets at 2026-04-12T12:00:00.000Z',
      ),
    );

    await expect(job.run(payload)).rejects.toThrow(
      'GITHUB_RATE_LIMIT_EXCEEDED: rate limit remaining 0, resets at 2026-04-12T12:00:00.000Z',
    );

    expect(analysisRunsRepository.markFailed).toHaveBeenCalledWith(
      'run-1',
      'GITHUB_RATE_LIMIT_EXCEEDED: rate limit remaining 0, resets at 2026-04-12T12:00:00.000Z',
    );
    const finalProgressPayload = redisService.set.mock.calls.at(-1)?.[1];
    const finalProgress = JSON.parse(finalProgressPayload as string) as {
      currentStage: AnalysisStage;
      status: AnalysisRunStatus;
    };
    expect(finalProgress.status).toBe(AnalysisRunStatus.FAILED);
    expect(finalProgress.currentStage).toBe(AnalysisStage.REPO_LIST);
  });
});
