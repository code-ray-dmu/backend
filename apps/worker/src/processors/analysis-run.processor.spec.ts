import { AnalysisRunStatus, AnalysisStage } from '@app/core';
import { AnalysisRunsEntity } from '@app/database';
import { RabbitMqService } from '@app/integrations';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalysisRunJob } from '../jobs/analysis-run.job';
import { AnalysisRunProcessor } from './analysis-run.processor';
import { GithubRepositoryProcessor } from './github-repository.processor';
import { LlmAnalysisProcessor } from './llm-analysis.processor';

describe('AnalysisRunProcessor', () => {
  let processor: AnalysisRunProcessor;
  let analysisRunsRepository: jest.Mocked<Repository<AnalysisRunsEntity>>;
  let githubRepositoryProcessor: {
    getRepositoryFilePaths: jest.Mock;
    saveSelectedFiles: jest.Mock;
    syncRepositoryInfo: jest.Mock;
  };
  let llmAnalysisProcessor: {
    analyzeCode: jest.Mock;
    generateQuestions: jest.Mock;
    selectFiles: jest.Mock;
  };
  let rabbitMqService: {
    consume: jest.Mock;
  };
  let analysisRunJob: {
    run: jest.Mock;
  };

  beforeEach(async () => {
    analysisRunsRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<AnalysisRunsEntity>>;
    githubRepositoryProcessor = {
      getRepositoryFilePaths: jest.fn(),
      saveSelectedFiles: jest.fn(),
      syncRepositoryInfo: jest.fn(),
    };
    llmAnalysisProcessor = {
      analyzeCode: jest.fn(),
      generateQuestions: jest.fn(),
      selectFiles: jest.fn(),
    };
    rabbitMqService = {
      consume: jest.fn(),
    };
    analysisRunJob = {
      run: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AnalysisRunProcessor,
        {
          provide: RabbitMqService,
          useValue: rabbitMqService,
        },
        {
          provide: AnalysisRunJob,
          useValue: analysisRunJob,
        },
        {
          provide: GithubRepositoryProcessor,
          useValue: githubRepositoryProcessor,
        },
        {
          provide: LlmAnalysisProcessor,
          useValue: llmAnalysisProcessor,
        },
        {
          provide: getRepositoryToken(AnalysisRunsEntity),
          useValue: analysisRunsRepository,
        },
      ],
    }).compile();

    processor = moduleRef.get(AnalysisRunProcessor);
  });

  it('registers queue consumers and runs the pipeline for queued messages', async () => {
    const consumers: Array<(payload: { analysisRunId: string }) => Promise<void>> = [];
    rabbitMqService.consume.mockImplementation(
      async (
        _queue: string,
        _exchange: string,
        _routingKey: string,
        handler: (payload: { analysisRunId: string }) => Promise<void>,
      ) => {
        consumers.push(handler);
      },
    );
    analysisRunJob.run.mockResolvedValue(true);
    analysisRunsRepository.findOne.mockResolvedValue({
      id: 'run-queue',
    } as AnalysisRunsEntity);
    githubRepositoryProcessor.syncRepositoryInfo.mockResolvedValue({
      defaultBranch: 'main',
      fullName: 'owner/repo',
    });
    githubRepositoryProcessor.getRepositoryFilePaths.mockResolvedValue(['src/main.ts']);
    llmAnalysisProcessor.selectFiles.mockResolvedValue(['src/main.ts']);
    githubRepositoryProcessor.saveSelectedFiles.mockResolvedValue([
      { content: 'console.log("hi");', path: 'src/main.ts' },
    ]);
    llmAnalysisProcessor.analyzeCode.mockResolvedValue({});
    llmAnalysisProcessor.generateQuestions.mockResolvedValue([]);

    await processor.onModuleInit();
    await consumers[0]({ analysisRunId: 'run-queue' });

    expect(rabbitMqService.consume).toHaveBeenCalledTimes(2);
    expect(analysisRunJob.run).toHaveBeenCalledWith({
      analysisRunId: 'run-queue',
    });
    expect(githubRepositoryProcessor.syncRepositoryInfo).toHaveBeenCalledWith(
      'run-queue',
    );
  });

  it('skips the pipeline when the queued message is no longer processable', async () => {
    let consumer: ((payload: { analysisRunId: string }) => Promise<void>) | undefined;
    rabbitMqService.consume.mockImplementation(
      async (
        _queue: string,
        _exchange: string,
        _routingKey: string,
        handler: (payload: { analysisRunId: string }) => Promise<void>,
      ) => {
        consumer = handler;
      },
    );
    analysisRunJob.run.mockResolvedValue(false);

    await processor.onModuleInit();
    await consumer?.({ analysisRunId: 'run-skipped' });

    expect(githubRepositoryProcessor.syncRepositoryInfo).not.toHaveBeenCalled();
  });

  it('orchestrates github and llm stages and completes the run', async () => {
    analysisRunsRepository.findOne.mockResolvedValue({
      id: 'run-1',
      startedAt: undefined,
    } as AnalysisRunsEntity);
    githubRepositoryProcessor.syncRepositoryInfo.mockResolvedValue({
      defaultBranch: 'main',
      fullName: 'owner/repo',
    });
    githubRepositoryProcessor.getRepositoryFilePaths.mockResolvedValue([
      'src/main.ts',
      'src/app.ts',
    ]);
    llmAnalysisProcessor.selectFiles.mockResolvedValue(['src/main.ts']);
    githubRepositoryProcessor.saveSelectedFiles.mockResolvedValue([
      { content: 'console.log("hi");', path: 'src/main.ts' },
    ]);
    llmAnalysisProcessor.analyzeCode.mockResolvedValue({
      architecture: {
        pattern: 'modular',
        summary: 'summary',
      },
      codeQuality: {
        summary: 'quality',
      },
      keyFindings: [],
      risks: [],
      summary: 'overall',
    });
    llmAnalysisProcessor.generateQuestions.mockResolvedValue([]);

    await processor.process('run-1');

    expect(analysisRunsRepository.update).toHaveBeenNthCalledWith(
      1,
      'run-1',
      expect.objectContaining({
        failureReason: null,
        startedAt: expect.any(Date),
        status: AnalysisRunStatus.IN_PROGRESS,
      }),
    );
    expect(analysisRunsRepository.update).toHaveBeenNthCalledWith(2, 'run-1', {
      currentStage: AnalysisStage.REPO_LIST,
    });
    expect(analysisRunsRepository.update).toHaveBeenNthCalledWith(3, 'run-1', {
      currentStage: AnalysisStage.FOLDER_STRUCTURE,
    });
    expect(analysisRunsRepository.update).toHaveBeenNthCalledWith(4, 'run-1', {
      currentStage: AnalysisStage.FILE_DETAIL,
    });
    expect(analysisRunsRepository.update).toHaveBeenNthCalledWith(5, 'run-1', {
      currentStage: AnalysisStage.SUMMARY,
    });
    expect(analysisRunsRepository.update).toHaveBeenNthCalledWith(6, 'run-1', {
      currentStage: AnalysisStage.QUESTION_GENERATION,
    });
    expect(analysisRunsRepository.update).toHaveBeenNthCalledWith(
      7,
      'run-1',
      expect.objectContaining({
        completedAt: expect.any(Date),
        failureReason: null,
        status: AnalysisRunStatus.COMPLETED,
      }),
    );
    expect(githubRepositoryProcessor.getRepositoryFilePaths).toHaveBeenCalledWith({
      analysisRunId: 'run-1',
      defaultBranch: 'main',
    });
    expect(llmAnalysisProcessor.selectFiles).toHaveBeenCalledWith({
      analysisRunId: 'run-1',
      filePaths: ['src/main.ts', 'src/app.ts'],
    });
    expect(githubRepositoryProcessor.saveSelectedFiles).toHaveBeenCalledWith({
      analysisRunId: 'run-1',
      defaultBranch: 'main',
      selectedPaths: ['src/main.ts'],
    });
  });

  it('marks the run as failed when a stage throws', async () => {
    analysisRunsRepository.findOne.mockResolvedValue({
      id: 'run-2',
      startedAt: undefined,
    } as AnalysisRunsEntity);
    githubRepositoryProcessor.syncRepositoryInfo.mockResolvedValue({
      defaultBranch: 'main',
      fullName: 'owner/repo',
    });
    githubRepositoryProcessor.getRepositoryFilePaths.mockResolvedValue(['src/main.ts']);
    llmAnalysisProcessor.selectFiles.mockRejectedValue(
      new Error('LLM_RESPONSE_PARSE_FAILED: stage=file_selection detail=invalid json'),
    );

    await expect(processor.process('run-2')).rejects.toThrow(
      'LLM_RESPONSE_PARSE_FAILED: stage=file_selection detail=invalid json',
    );

    expect(analysisRunsRepository.update).toHaveBeenNthCalledWith(3, 'run-2', {
      currentStage: AnalysisStage.FOLDER_STRUCTURE,
    });
    expect(analysisRunsRepository.update).toHaveBeenLastCalledWith('run-2', {
      completedAt: null,
      failureReason:
        'LLM_RESPONSE_PARSE_FAILED: stage=file_selection detail=invalid json',
      status: AnalysisRunStatus.FAILED,
    });
  });

  it('wraps non-prefixed errors with the pipeline failure code', async () => {
    analysisRunsRepository.findOne.mockResolvedValue({
      id: 'run-3',
      startedAt: undefined,
    } as AnalysisRunsEntity);
    githubRepositoryProcessor.syncRepositoryInfo.mockRejectedValue(
      new Error('unexpected GitHub failure'),
    );

    await expect(processor.process('run-3')).rejects.toThrow('unexpected GitHub failure');

    expect(analysisRunsRepository.update).toHaveBeenLastCalledWith('run-3', {
      completedAt: null,
      failureReason: 'ANALYSIS_PIPELINE_FAILED: unexpected GitHub failure',
      status: AnalysisRunStatus.FAILED,
    });
  });
});
