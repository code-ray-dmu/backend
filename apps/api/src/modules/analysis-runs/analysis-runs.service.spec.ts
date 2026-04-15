import { AnalysisRunStatus, AnalysisStage } from '@app/core';
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

  const createApplicant = (
    overrides?: Partial<{ githubUrl: string; userId: string }>,
  ): never =>
    ({
      id: 'applicant-1',
      githubUrl: overrides?.githubUrl ?? 'https://github.com/openai',
      group: {
        userId: overrides?.userId ?? 'user-1',
      },
    }) as never;

  const createGitHubRepository = (
    suffix: string,
    updatedAt: string,
  ): {
    repoName: string;
    repoFullName: string;
    repoUrl: string;
    defaultBranch: string;
    updatedAt: Date;
  } => ({
    repoName: `repo-${suffix}`,
    repoFullName: `openai/repo-${suffix}`,
    repoUrl: `https://github.com/openai/repo-${suffix}`,
    defaultBranch: 'main',
    updatedAt: new Date(updatedAt),
  });

  it('creates analysis runs for repositories without completed runs', async () => {
    applicantsRepository.findOne.mockResolvedValue(createApplicant());
    gitHubService.listPublicRepositoriesByOwner.mockResolvedValue([
      createGitHubRepository('1', '2026-01-02T00:00:00.000Z'),
      createGitHubRepository('2', '2026-01-01T00:00:00.000Z'),
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

  it('throws APPLICANT_NOT_FOUND when the applicant does not exist', async (): Promise<void> => {
    applicantsRepository.findOne.mockResolvedValue(null);

    await expect(service.requestAnalysisRuns('applicant-1', 'user-1')).rejects.toMatchObject({
      response: {
        code: 'APPLICANT_NOT_FOUND',
      },
    });
  });

  it('throws FORBIDDEN_RESOURCE_ACCESS when another user owns the applicant', async (): Promise<void> => {
    applicantsRepository.findOne.mockResolvedValue(createApplicant({ userId: 'user-2' }));

    await expect(service.requestAnalysisRuns('applicant-1', 'user-1')).rejects.toMatchObject({
      response: {
        code: 'FORBIDDEN_RESOURCE_ACCESS',
      },
    });
  });

  it('throws VALIDATION_ERROR when the applicant GitHub URL is invalid', async (): Promise<void> => {
    applicantsRepository.findOne.mockResolvedValue(createApplicant({ githubUrl: 'not-a-url' }));

    await expect(service.requestAnalysisRuns('applicant-1', 'user-1')).rejects.toMatchObject({
      response: {
        code: 'VALIDATION_ERROR',
      },
    });
  });

  it('throws REPOSITORY_NOT_FOUND when the applicant has no public repositories', async (): Promise<void> => {
    applicantsRepository.findOne.mockResolvedValue(createApplicant());
    gitHubService.listPublicRepositoriesByOwner.mockResolvedValue([]);
    applicantRepositoriesRepository.find.mockResolvedValue([]);
    applicantRepositoriesRepository.save.mockResolvedValue([]);

    await expect(service.requestAnalysisRuns('applicant-1', 'user-1')).rejects.toMatchObject({
      response: {
        code: 'REPOSITORY_NOT_FOUND',
      },
    });
  });

  it('rejects requests when every selected repository already completed', async () => {
    applicantsRepository.findOne.mockResolvedValue(createApplicant());
    gitHubService.listPublicRepositoriesByOwner.mockResolvedValue([
      createGitHubRepository('1', '2026-01-01T00:00:00.000Z'),
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

  it('limits repository selection to MAX_REPO_SELECTION_COUNT', async (): Promise<void> => {
    configService.get.mockReturnValue(2);
    applicantsRepository.findOne.mockResolvedValue(createApplicant());
    gitHubService.listPublicRepositoriesByOwner.mockResolvedValue([
      createGitHubRepository('1', '2026-01-03T00:00:00.000Z'),
      createGitHubRepository('2', '2026-01-02T00:00:00.000Z'),
      createGitHubRepository('3', '2026-01-01T00:00:00.000Z'),
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

    await expect(service.requestAnalysisRuns('applicant-1', 'user-1')).resolves.toEqual({
      success: true,
      analysisRunIds: ['run-repo-1', 'run-repo-2'],
    });

    expect(gitHubService.listPublicRepositoriesByOwner).toHaveBeenCalledWith('openai', 2);
    expect(applicantRepositoriesRepository.create).toHaveBeenCalledTimes(2);
    expect(analysisRunsRepository.createQueuedRun).toHaveBeenCalledTimes(2);
  });

  it('returns the status for an owned analysis run', async () => {
    analysisRunsRepository.findByIdAndRequestedByUserId.mockResolvedValue({
      id: 'run-1',
      status: AnalysisRunStatus.IN_PROGRESS,
    } as never);

    await expect(service.getAnalysisRunStatus('run-1', 'user-1')).resolves.toEqual({
      analysis_run_id: 'run-1',
      status: AnalysisRunStatus.IN_PROGRESS,
      current_stage: null,
      started_at: null,
      completed_at: null,
      failure_reason: null,
    });
  });

  it('preserves populated status fields for an owned analysis run', async () => {
    const startedAt = new Date('2026-02-01T00:00:00.000Z');
    const completedAt = new Date('2026-02-01T00:05:00.000Z');
    analysisRunsRepository.findByIdAndRequestedByUserId.mockResolvedValue({
      id: 'run-2',
      status: AnalysisRunStatus.FAILED,
      currentStage: AnalysisStage.FILE_DETAIL,
      startedAt,
      completedAt,
      failureReason: 'GITHUB_RATE_LIMIT_EXCEEDED: API rate limit exceeded',
    } as never);

    await expect(service.getAnalysisRunStatus('run-2', 'user-1')).resolves.toEqual({
      analysis_run_id: 'run-2',
      status: AnalysisRunStatus.FAILED,
      current_stage: AnalysisStage.FILE_DETAIL,
      started_at: startedAt,
      completed_at: completedAt,
      failure_reason: 'GITHUB_RATE_LIMIT_EXCEEDED: API rate limit exceeded',
    });
  });

  it('throws ANALYSIS_RUN_NOT_FOUND when the run is not owned by the current user', async () => {
    analysisRunsRepository.findByIdAndRequestedByUserId.mockResolvedValue(null);

    await expect(service.getAnalysisRunStatus('run-1', 'user-1')).rejects.toMatchObject({
      response: {
        code: 'ANALYSIS_RUN_NOT_FOUND',
      },
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
          current_stage: null,
          started_at: null,
          completed_at: null,
          failure_reason: null,
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

  it('preserves populated status fields for analysis run list items', async () => {
    const startedAt = new Date('2026-02-01T00:00:00.000Z');
    const completedAt = new Date('2026-02-01T00:05:00.000Z');
    analysisRunsRepository.findManyByRequestedByUserId.mockResolvedValue([
      [
        {
          id: 'run-2',
          applicantId: 'applicant-1',
          repositoryId: 'repository-2',
          status: AnalysisRunStatus.FAILED,
          currentStage: AnalysisStage.FILE_DETAIL,
          startedAt,
          completedAt,
          failureReason: 'GITHUB_RATE_LIMIT_EXCEEDED: API rate limit exceeded',
        },
      ] as never,
      1,
    ]);

    await expect(service.getAnalysisRuns({}, 'user-1')).resolves.toEqual({
      data: [
        {
          analysis_run_id: 'run-2',
          applicant_id: 'applicant-1',
          repository_id: 'repository-2',
          status: AnalysisRunStatus.FAILED,
          current_stage: AnalysisStage.FILE_DETAIL,
          started_at: startedAt,
          completed_at: completedAt,
          failure_reason: 'GITHUB_RATE_LIMIT_EXCEEDED: API rate limit exceeded',
        },
      ],
      meta: {
        page: 1,
        size: 20,
        total: 1,
      },
    });
  });

  it('applies applicantId filter and pagination for analysis run list lookups', async () => {
    analysisRunsRepository.findManyByRequestedByUserId.mockResolvedValue([[], 0]);

    await expect(
      service.getAnalysisRuns(
        {
          applicantId: 'applicant-filter',
          page: 2,
          size: 10,
        },
        'user-1',
      ),
    ).resolves.toEqual({
      data: [],
      meta: {
        page: 2,
        size: 10,
        total: 0,
      },
    });

    expect(analysisRunsRepository.findManyByRequestedByUserId).toHaveBeenCalledWith('user-1', {
      applicantId: 'applicant-filter',
      page: 2,
      size: 10,
    });
  });

  it('marks the run failed when queue publishing fails', async () => {
    applicantsRepository.findOne.mockResolvedValue(createApplicant());
    gitHubService.listPublicRepositoriesByOwner.mockResolvedValue([
      createGitHubRepository('1', '2026-01-01T00:00:00.000Z'),
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
    applicantsRepository.findOne.mockResolvedValue(createApplicant());
    gitHubService.listPublicRepositoriesByOwner.mockResolvedValue([
      createGitHubRepository('1', '2026-01-03T00:00:00.000Z'),
      createGitHubRepository('2', '2026-01-02T00:00:00.000Z'),
      createGitHubRepository('3', '2026-01-01T00:00:00.000Z'),
    ] as never);
    applicantRepositoriesRepository.find.mockResolvedValue([]);
    applicantRepositoriesRepository.create.mockImplementation((value) => value as never);
    applicantRepositoriesRepository.save.mockResolvedValue([
      { id: 'repo-1', repoFullName: 'openai/repo-1' },
      { id: 'repo-2', repoFullName: 'openai/repo-2' },
      { id: 'repo-3', repoFullName: 'openai/repo-3' },
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
      } as never)
      .mockResolvedValueOnce({
        id: 'run-repo-3',
        applicantId: 'applicant-1',
        repositoryId: 'repo-3',
        requestedByUserId: 'user-1',
        status: AnalysisRunStatus.QUEUED,
      } as never);
    analysisRunPublisher.publishRequested
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('publish failed'))
      .mockResolvedValueOnce(undefined);

    await expect(service.requestAnalysisRuns('applicant-1', 'user-1')).resolves.toEqual({
      success: true,
      analysisRunIds: ['run-repo-1', 'run-repo-3'],
    });

    expect(analysisRunsRepository.markFailedByIds).toHaveBeenCalledWith(['run-repo-2'], 'publish failed');
    expect(analysisRunPublisher.publishRequested).toHaveBeenCalledTimes(3);
  });

  it('skips completed repositories and still marks only a later failed publish attempt failed', async (): Promise<void> => {
    applicantsRepository.findOne.mockResolvedValue(createApplicant());
    gitHubService.listPublicRepositoriesByOwner.mockResolvedValue([
      createGitHubRepository('1', '2026-01-04T00:00:00.000Z'),
      createGitHubRepository('2', '2026-01-03T00:00:00.000Z'),
      createGitHubRepository('3', '2026-01-02T00:00:00.000Z'),
    ] as never);
    applicantRepositoriesRepository.find.mockResolvedValue([]);
    applicantRepositoriesRepository.create.mockImplementation((value) => value as never);
    applicantRepositoriesRepository.save.mockResolvedValue([
      { id: 'repo-1', repoFullName: 'openai/repo-1' },
      { id: 'repo-2', repoFullName: 'openai/repo-2' },
      { id: 'repo-3', repoFullName: 'openai/repo-3' },
    ] as never);
    analysisRunsRepository.findCompletedRepositoryIds.mockResolvedValue(new Set(['repo-1']));
    analysisRunsRepository.createQueuedRun
      .mockResolvedValueOnce({
        id: 'run-repo-2',
        applicantId: 'applicant-1',
        repositoryId: 'repo-2',
        requestedByUserId: 'user-1',
        status: AnalysisRunStatus.QUEUED,
      } as never)
      .mockResolvedValueOnce({
        id: 'run-repo-3',
        applicantId: 'applicant-1',
        repositoryId: 'repo-3',
        requestedByUserId: 'user-1',
        status: AnalysisRunStatus.QUEUED,
      } as never);
    analysisRunPublisher.publishRequested
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('publish failed'));

    await expect(service.requestAnalysisRuns('applicant-1', 'user-1')).resolves.toEqual({
      success: true,
      analysisRunIds: ['run-repo-2'],
    });

    expect(analysisRunsRepository.createQueuedRun).toHaveBeenNthCalledWith(
      1,
      'applicant-1',
      'repo-2',
      'user-1',
    );
    expect(analysisRunsRepository.createQueuedRun).toHaveBeenNthCalledWith(
      2,
      'applicant-1',
      'repo-3',
      'user-1',
    );
    expect(analysisRunsRepository.markFailedByIds).toHaveBeenCalledWith(['run-repo-3'], 'publish failed');
  });
});
