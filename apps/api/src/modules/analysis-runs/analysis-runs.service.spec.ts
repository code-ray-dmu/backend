import { AnalysisRunStatus } from '@app/core';
import { AnalysisRunsEntity } from '@app/database';
import { ConfigService } from '@nestjs/config';
import { GitHubService } from '@app/integrations';
import { AnalysisRunPublisher } from './publishers/analysis-run.publisher';
import { AnalysisRunsRepository } from './repositories/analysis-runs.repository';
import { AnalysisRunsService } from './analysis-runs.service';

describe('AnalysisRunsService', () => {
  let service: AnalysisRunsService;
  let configService: jest.Mocked<ConfigService>;
  let gitHubService: jest.Mocked<GitHubService>;
  let applicantsRepository: { findOne: jest.Mock };
  let applicantRepositoriesRepository: {
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let analysisRunsRepository: jest.Mocked<AnalysisRunsRepository>;
  let analysisRunPublisher: jest.Mocked<AnalysisRunPublisher>;

  beforeEach(() => {
    configService = {
      get: jest.fn().mockReturnValue(3),
    } as unknown as jest.Mocked<ConfigService>;
    gitHubService = {
      listPublicRepositoriesByOwner: jest.fn(),
    } as unknown as jest.Mocked<GitHubService>;
    applicantsRepository = {
      findOne: jest.fn(),
    };
    applicantRepositoriesRepository = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    analysisRunsRepository = {
      createQueuedRun: jest.fn(),
      findCompletedRepositoryIds: jest.fn(),
      findByIdAndRequestedByUserId: jest.fn(),
      findManyByRequestedByUserId: jest.fn(),
      markFailed: jest.fn(),
      markFailedByIds: jest.fn(),
    } as unknown as jest.Mocked<AnalysisRunsRepository>;
    analysisRunPublisher = {
      publishRequested: jest.fn(),
    } as unknown as jest.Mocked<AnalysisRunPublisher>;
    service = new AnalysisRunsService(
      configService,
      gitHubService,
      applicantsRepository as never,
      applicantRepositoriesRepository as never,
      analysisRunsRepository,
      analysisRunPublisher,
    );
  });

  it('creates analysis runs for repositories without completed runs', async () => {
    applicantsRepository.findOne.mockResolvedValue({
      id: 'applicant-1',
      githubUrl: 'https://github.com/openai',
      group: {
        userId: 'user-1',
      },
    } as never);
    gitHubService.listPublicRepositoriesByOwner.mockResolvedValue([
      {
        repoName: 'repo-1',
        repoFullName: 'openai/repo-1',
        repoUrl: 'https://github.com/openai/repo-1',
        defaultBranch: 'main',
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
      {
        repoName: 'repo-2',
        repoFullName: 'openai/repo-2',
        repoUrl: 'https://github.com/openai/repo-2',
        defaultBranch: 'main',
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ] as never);
    applicantRepositoriesRepository.find.mockResolvedValue([]);
    applicantRepositoriesRepository.create.mockImplementation((value) => value as never);
    applicantRepositoriesRepository.save.mockResolvedValue([
      { id: 'repo-1', repoFullName: 'openai/repo-1' },
      { id: 'repo-2', repoFullName: 'openai/repo-2' },
    ] as never);
    analysisRunsRepository.findCompletedRepositoryIds.mockResolvedValue(new Set(['repo-1']));
    analysisRunsRepository.createQueuedRun.mockImplementation(
      async (_applicantId: string, repositoryId: string): Promise<AnalysisRunsEntity> =>
        ({
          id: `run-${repositoryId}`,
          applicantId: 'applicant-1',
          repositoryId,
          requestedByUserId: 'user-1',
          status: AnalysisRunStatus.QUEUED,
        }) as AnalysisRunsEntity,
    );

    const result = await service.requestAnalysisRuns('applicant-1', 'user-1');

    expect(result).toEqual({
      success: true,
      analysisRunIds: ['run-repo-2'],
    });
    expect(analysisRunPublisher.publishRequested).toHaveBeenCalledTimes(1);
  });

  it('rejects requests when every selected repository already completed', async () => {
    applicantsRepository.findOne.mockResolvedValue({
      id: 'applicant-1',
      githubUrl: 'https://github.com/openai',
      group: {
        userId: 'user-1',
      },
    } as never);
    gitHubService.listPublicRepositoriesByOwner.mockResolvedValue([
      {
        repoName: 'repo-1',
        repoFullName: 'openai/repo-1',
        repoUrl: 'https://github.com/openai/repo-1',
        defaultBranch: 'main',
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ] as never);
    applicantRepositoriesRepository.find.mockResolvedValue([]);
    applicantRepositoriesRepository.create.mockImplementation((value) => value as never);
    applicantRepositoriesRepository.save.mockResolvedValue([
      { id: 'repo-1', repoFullName: 'openai/repo-1' },
    ] as never);
    analysisRunsRepository.findCompletedRepositoryIds.mockResolvedValue(new Set(['repo-1']));

    await expect(service.requestAnalysisRuns('applicant-1', 'user-1')).rejects.toThrow(
      'All selected repositories already have completed analysis runs',
    );
  });

  it('returns the status for an owned analysis run', async () => {
    analysisRunsRepository.findByIdAndRequestedByUserId.mockResolvedValue({
      id: 'run-1',
      status: AnalysisRunStatus.IN_PROGRESS,
    } as never);

    await expect(service.getAnalysisRunStatus('run-1', 'user-1')).resolves.toEqual({
      analysis_run_id: 'run-1',
      status: AnalysisRunStatus.IN_PROGRESS,
      current_stage: undefined,
      started_at: undefined,
      completed_at: undefined,
      failure_reason: undefined,
    });
  });

  it('returns paginated analysis runs for the current user', async () => {
    analysisRunsRepository.findManyByRequestedByUserId.mockResolvedValue([
      [
        {
          id: 'run-1',
          applicantId: 'applicant-1',
          repositoryId: 'repository-1',
          status: AnalysisRunStatus.IN_PROGRESS,
        },
      ] as never,
      1,
    ]);

    await expect(service.getAnalysisRuns({}, 'user-1')).resolves.toEqual({
      data: [
        {
          analysis_run_id: 'run-1',
          applicant_id: 'applicant-1',
          repository_id: 'repository-1',
          status: AnalysisRunStatus.IN_PROGRESS,
          current_stage: undefined,
          started_at: undefined,
          completed_at: undefined,
          failure_reason: undefined,
        },
      ],
      meta: {
        page: 1,
        size: 20,
        total: 1,
      },
    });
    expect(analysisRunsRepository.findManyByRequestedByUserId).toHaveBeenCalledWith('user-1', {
      applicantId: undefined,
      page: 1,
      size: 20,
    });
  });

  it('marks the run failed when queue publishing fails', async () => {
    applicantsRepository.findOne.mockResolvedValue({
      id: 'applicant-1',
      githubUrl: 'https://github.com/openai',
      group: {
        userId: 'user-1',
      },
    } as never);
    gitHubService.listPublicRepositoriesByOwner.mockResolvedValue([
      {
        repoName: 'repo-1',
        repoFullName: 'openai/repo-1',
        repoUrl: 'https://github.com/openai/repo-1',
        defaultBranch: 'main',
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ] as never);
    applicantRepositoriesRepository.find.mockResolvedValue([]);
    applicantRepositoriesRepository.create.mockImplementation((value) => value as never);
    applicantRepositoriesRepository.save.mockResolvedValue([
      { id: 'repo-1', repoFullName: 'openai/repo-1' },
    ] as never);
    analysisRunsRepository.findCompletedRepositoryIds.mockResolvedValue(new Set());
    analysisRunsRepository.createQueuedRun.mockResolvedValue({
      id: 'run-repo-1',
      applicantId: 'applicant-1',
      repositoryId: 'repo-1',
      requestedByUserId: 'user-1',
      status: AnalysisRunStatus.QUEUED,
    } as never);
    analysisRunPublisher.publishRequested.mockRejectedValue(new Error('publish failed'));

    await expect(service.requestAnalysisRuns('applicant-1', 'user-1')).rejects.toThrow(
      'Failed to enqueue analysis run',
    );

    expect(analysisRunsRepository.markFailedByIds).toHaveBeenCalledWith(
      ['run-repo-1'],
      'publish failed',
    );
  });

  it('returns published run ids and marks only the failed publish attempt failed', async () => {
    applicantsRepository.findOne.mockResolvedValue({
      id: 'applicant-1',
      githubUrl: 'https://github.com/openai',
      group: {
        userId: 'user-1',
      },
    } as never);
    gitHubService.listPublicRepositoriesByOwner.mockResolvedValue([
      {
        repoName: 'repo-1',
        repoFullName: 'openai/repo-1',
        repoUrl: 'https://github.com/openai/repo-1',
        defaultBranch: 'main',
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
      {
        repoName: 'repo-2',
        repoFullName: 'openai/repo-2',
        repoUrl: 'https://github.com/openai/repo-2',
        defaultBranch: 'main',
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ] as never);
    applicantRepositoriesRepository.find.mockResolvedValue([]);
    applicantRepositoriesRepository.create.mockImplementation((value) => value as never);
    applicantRepositoriesRepository.save.mockResolvedValue([
      { id: 'repo-1', repoFullName: 'openai/repo-1' },
      { id: 'repo-2', repoFullName: 'openai/repo-2' },
    ] as never);
    analysisRunsRepository.findCompletedRepositoryIds.mockResolvedValue(new Set());
    analysisRunsRepository.createQueuedRun
      .mockResolvedValueOnce({
        id: 'run-repo-1',
        applicantId: 'applicant-1',
        repositoryId: 'repo-1',
        requestedByUserId: 'user-1',
        status: AnalysisRunStatus.QUEUED,
      } as never)
      .mockResolvedValueOnce({
        id: 'run-repo-2',
        applicantId: 'applicant-1',
        repositoryId: 'repo-2',
        requestedByUserId: 'user-1',
        status: AnalysisRunStatus.QUEUED,
      } as never);
    analysisRunPublisher.publishRequested
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('publish failed'));

    await expect(service.requestAnalysisRuns('applicant-1', 'user-1')).resolves.toEqual({
      success: true,
      analysisRunIds: ['run-repo-1'],
    });

    expect(analysisRunsRepository.markFailedByIds).toHaveBeenCalledWith(['run-repo-2'], 'publish failed');
  });
});
