import {
  AnalysisRunsEntity,
  ApplicantRepositoriesEntity,
  RepositoryFilesEntity,
} from '@app/database';
import {
  GitHubService,
  GitHubServiceError,
  type RepositoryMetadataDto,
} from '@app/integrations';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GithubRepositoryProcessor } from './github-repository.processor';

describe('GithubRepositoryProcessor', () => {
  let processor: GithubRepositoryProcessor;
  let gitHubService: jest.Mocked<GitHubService>;
  let analysisRunsRepository: jest.Mocked<Repository<AnalysisRunsEntity>>;
  let applicantRepositoriesRepository: jest.Mocked<
    Repository<ApplicantRepositoriesEntity>
  >;
  let repositoryFilesRepository: jest.Mocked<Repository<RepositoryFilesEntity>>;
  let repositoryFilesEntityManager: {
    create: jest.Mock;
    delete: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    gitHubService = {
      getRepositoryMetadata: jest.fn(),
      getRepositoryTree: jest.fn(),
      getRepositorySourceFile: jest.fn(),
    } as unknown as jest.Mocked<GitHubService>;
    analysisRunsRepository = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<AnalysisRunsEntity>>;
    applicantRepositoriesRepository = {
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<ApplicantRepositoriesEntity>>;
    repositoryFilesEntityManager = {
      create: jest.fn((_: unknown, entity: unknown) => entity),
      delete: jest.fn(),
      save: jest.fn(),
    };
    repositoryFilesRepository = {
      manager: {
        transaction: jest
          .fn()
          .mockImplementation(async (task: (manager: unknown) => Promise<void>) => {
            await task(repositoryFilesEntityManager);
          }),
      },
    } as unknown as jest.Mocked<Repository<RepositoryFilesEntity>>;

    const moduleRef = await Test.createTestingModule({
      providers: [
        GithubRepositoryProcessor,
        {
          provide: GitHubService,
          useValue: gitHubService,
        },
        {
          provide: getRepositoryToken(AnalysisRunsEntity),
          useValue: analysisRunsRepository,
        },
        {
          provide: getRepositoryToken(ApplicantRepositoriesEntity),
          useValue: applicantRepositoriesRepository,
        },
        {
          provide: getRepositoryToken(RepositoryFilesEntity),
          useValue: repositoryFilesRepository,
        },
      ],
    }).compile();

    processor = moduleRef.get(GithubRepositoryProcessor);
  });

  it('syncs repository metadata and persists default branch in REPO_LIST', async () => {
    analysisRunsRepository.findOne.mockResolvedValue({
      id: 'run-1',
      repository: {
        id: 'repo-1',
        repoFullName: 'owner/project',
      },
      repositoryId: 'repo-1',
    } as AnalysisRunsEntity);
    const metadata: RepositoryMetadataDto = {
      defaultBranch: 'main',
      fullName: 'owner/project',
      htmlUrl: 'https://github.com/owner/project',
      language: 'TypeScript',
      name: 'project',
      ownerLogin: 'owner',
    };
    gitHubService.getRepositoryMetadata.mockResolvedValue(metadata);

    await expect(processor.syncRepositoryInfo('run-1')).resolves.toEqual(metadata);

    expect(gitHubService.getRepositoryMetadata).toHaveBeenCalledWith({
      repoFullName: 'owner/project',
    });
    expect(applicantRepositoriesRepository.update).toHaveBeenCalledWith('repo-1', {
      defaultBranch: 'main',
    });
  });

  it('normalizes repository tree into non-empty blob paths for FOLDER_STRUCTURE', async () => {
    analysisRunsRepository.findOne.mockResolvedValue({
      id: 'run-1',
      repository: {
        id: 'repo-1',
        repoFullName: 'owner/project',
      },
      repositoryId: 'repo-1',
    } as AnalysisRunsEntity);
    gitHubService.getRepositoryTree.mockResolvedValue({
      branch: 'main',
      isComplete: true,
      items: [
        {
          mode: '100644',
          path: 'src/main.ts',
          sha: 'sha-1',
          type: 'blob',
        },
        {
          mode: '040000',
          path: 'src',
          sha: 'sha-2',
          type: 'tree',
        },
        {
          mode: '100644',
          path: '',
          sha: 'sha-3',
          type: 'blob',
        },
      ],
    });

    await expect(
      processor.getRepositoryFilePaths({
        analysisRunId: 'run-1',
        defaultBranch: 'main',
      }),
    ).resolves.toEqual(['src/main.ts']);
  });

  it('stores only text files within 100KB and returns FILE_DETAIL payload for SUMMARY', async () => {
    analysisRunsRepository.findOne.mockResolvedValue({
      id: 'run-1',
      repository: {
        id: 'repo-1',
        repoFullName: 'owner/project',
      },
      repositoryId: 'repo-1',
    } as AnalysisRunsEntity);

    gitHubService.getRepositorySourceFile
      .mockResolvedValueOnce({
        content: 'Y29uc29sZS5sb2coJ2hpJyk7',
        decodedContent: "console.log('hi');",
        encoding: 'base64',
        name: 'main.ts',
        path: 'src/main.ts',
      })
      .mockResolvedValueOnce({
        content: 'AAECAw==',
        decodedContent: 'a\u0000b',
        encoding: 'base64',
        name: 'image.bin',
        path: 'assets/image.bin',
      })
      .mockResolvedValueOnce({
        content: '',
        decodedContent: 'a'.repeat(100 * 1024 + 1),
        encoding: 'utf-8',
        name: 'large.txt',
        path: 'docs/large.txt',
      });

    await expect(
      processor.saveSelectedFiles({
        analysisRunId: 'run-1',
        defaultBranch: 'main',
        selectedPaths: ['src/main.ts', 'assets/image.bin', 'docs/large.txt'],
      }),
    ).resolves.toEqual([
      {
        content: "console.log('hi');",
        path: 'src/main.ts',
      },
    ]);

    expect(gitHubService.getRepositorySourceFile).toHaveBeenCalledTimes(3);
    expect(repositoryFilesEntityManager.delete).toHaveBeenCalledWith(
      RepositoryFilesEntity,
      {
        repositoryId: 'repo-1',
      },
    );
    expect(repositoryFilesEntityManager.create).toHaveBeenCalledTimes(1);
    expect(repositoryFilesEntityManager.create).toHaveBeenCalledWith(
      RepositoryFilesEntity,
      {
        path: 'src/main.ts',
        rawAnalysisReport: "console.log('hi');",
        repositoryId: 'repo-1',
      },
    );
    expect(repositoryFilesEntityManager.save).toHaveBeenCalledWith(
      RepositoryFilesEntity,
      [
        {
          path: 'src/main.ts',
          rawAnalysisReport: "console.log('hi');",
          repositoryId: 'repo-1',
        },
      ],
    );
  });

  it('clears existing repository_files when no selected file is storable', async () => {
    analysisRunsRepository.findOne.mockResolvedValue({
      id: 'run-1',
      repository: {
        id: 'repo-1',
        repoFullName: 'owner/project',
      },
      repositoryId: 'repo-1',
    } as AnalysisRunsEntity);
    gitHubService.getRepositorySourceFile.mockResolvedValue({
      content: 'AAECAw==',
      decodedContent: '\u0000\u0001',
      encoding: 'base64',
      name: 'image.bin',
      path: 'assets/image.bin',
    });

    await expect(
      processor.saveSelectedFiles({
        analysisRunId: 'run-1',
        defaultBranch: 'main',
        selectedPaths: ['assets/image.bin'],
      }),
    ).resolves.toEqual([]);

    expect(repositoryFilesEntityManager.delete).toHaveBeenCalledWith(
      RepositoryFilesEntity,
      {
        repositoryId: 'repo-1',
      },
    );
    expect(repositoryFilesEntityManager.save).not.toHaveBeenCalled();
  });

  it('stores files with exactly 100KB content', async () => {
    analysisRunsRepository.findOne.mockResolvedValue({
      id: 'run-1',
      repository: {
        id: 'repo-1',
        repoFullName: 'owner/project',
      },
      repositoryId: 'repo-1',
    } as AnalysisRunsEntity);
    const exactLimitContent = 'a'.repeat(100 * 1024);
    gitHubService.getRepositorySourceFile.mockResolvedValue({
      content: exactLimitContent,
      decodedContent: exactLimitContent,
      encoding: 'utf-8',
      name: 'limit.txt',
      path: 'docs/limit.txt',
    });

    await expect(
      processor.saveSelectedFiles({
        analysisRunId: 'run-1',
        defaultBranch: 'main',
        selectedPaths: ['docs/limit.txt'],
      }),
    ).resolves.toEqual([
      {
        content: exactLimitContent,
        path: 'docs/limit.txt',
      },
    ]);

    expect(repositoryFilesEntityManager.save).toHaveBeenCalledWith(
      RepositoryFilesEntity,
      [
        {
          path: 'docs/limit.txt',
          rawAnalysisReport: exactLimitContent,
          repositoryId: 'repo-1',
        },
      ],
    );
  });

  it('filters out base64 files with invalid UTF-8 byte sequences', async () => {
    analysisRunsRepository.findOne.mockResolvedValue({
      id: 'run-1',
      repository: {
        id: 'repo-1',
        repoFullName: 'owner/project',
      },
      repositoryId: 'repo-1',
    } as AnalysisRunsEntity);
    gitHubService.getRepositorySourceFile.mockResolvedValue({
      content: '//79',
      decodedContent: '���',
      encoding: 'base64',
      name: 'invalid.bin',
      path: 'bin/invalid.bin',
    });

    await expect(
      processor.saveSelectedFiles({
        analysisRunId: 'run-1',
        defaultBranch: 'main',
        selectedPaths: ['bin/invalid.bin'],
      }),
    ).resolves.toEqual([]);

    expect(repositoryFilesEntityManager.save).not.toHaveBeenCalled();
  });

  it('deduplicates selected paths before FILE_DETAIL fetch and save', async () => {
    analysisRunsRepository.findOne.mockResolvedValue({
      id: 'run-1',
      repository: {
        id: 'repo-1',
        repoFullName: 'owner/project',
      },
      repositoryId: 'repo-1',
    } as AnalysisRunsEntity);
    gitHubService.getRepositorySourceFile.mockResolvedValue({
      content: 'Y29uc29sZS5sb2coJ2hpJyk7',
      decodedContent: "console.log('hi');",
      encoding: 'base64',
      name: 'main.ts',
      path: 'src/main.ts',
    });

    await expect(
      processor.saveSelectedFiles({
        analysisRunId: 'run-1',
        defaultBranch: 'main',
        selectedPaths: ['src/main.ts', 'src/main.ts'],
      }),
    ).resolves.toEqual([
      {
        content: "console.log('hi');",
        path: 'src/main.ts',
      },
    ]);

    expect(gitHubService.getRepositorySourceFile).toHaveBeenCalledTimes(1);
    expect(repositoryFilesEntityManager.create).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      code: 'not-found' as const,
      expected: 'GITHUB_REPOSITORY_ACCESS_DENIED: repository not found or is private',
    },
    {
      code: 'forbidden' as const,
      expected: 'GITHUB_REPOSITORY_ACCESS_DENIED: repository access forbidden',
    },
  ])(
    'maps $code errors to repository access denied identifier',
    async ({ code, expected }) => {
      analysisRunsRepository.findOne.mockResolvedValue({
        id: 'run-1',
        repository: {
          id: 'repo-1',
          repoFullName: 'owner/project',
        },
        repositoryId: 'repo-1',
      } as AnalysisRunsEntity);
      gitHubService.getRepositoryMetadata.mockRejectedValue(
        new GitHubServiceError({
          code,
          message: 'github failure',
          statusCode: 404,
        }),
      );

      await expect(processor.syncRepositoryInfo('run-1')).rejects.toThrow(expected);
    },
  );

  it('maps rate-limit errors to pipeline identifier with reset timestamp', async () => {
    analysisRunsRepository.findOne.mockResolvedValue({
      id: 'run-1',
      repository: {
        id: 'repo-1',
        repoFullName: 'owner/project',
      },
      repositoryId: 'repo-1',
    } as AnalysisRunsEntity);
    gitHubService.getRepositoryTree.mockRejectedValue(
      new GitHubServiceError({
        code: 'rate-limit',
        message: 'too many requests',
        rateLimit: {
          remaining: 0,
          resetAtEpochSeconds: 1713088800,
        },
        statusCode: 429,
      }),
    );

    await expect(
      processor.getRepositoryFilePaths({
        analysisRunId: 'run-1',
        defaultBranch: 'main',
      }),
    ).rejects.toThrow(
      'GITHUB_RATE_LIMIT_EXCEEDED: rate limit remaining 0, resets at 2024-04-14T10:00:00.000Z',
    );
  });

  it('maps forbidden errors from FOLDER_STRUCTURE tree fetch to access denied identifier', async () => {
    analysisRunsRepository.findOne.mockResolvedValue({
      id: 'run-1',
      repository: {
        id: 'repo-1',
        repoFullName: 'owner/project',
      },
      repositoryId: 'repo-1',
    } as AnalysisRunsEntity);
    gitHubService.getRepositoryTree.mockRejectedValue(
      new GitHubServiceError({
        code: 'forbidden',
        message: 'forbidden',
        statusCode: 403,
      }),
    );

    await expect(
      processor.getRepositoryFilePaths({
        analysisRunId: 'run-1',
        defaultBranch: 'main',
      }),
    ).rejects.toThrow('GITHUB_REPOSITORY_ACCESS_DENIED: repository access forbidden');
  });

  it('maps rate-limit errors from REPO_LIST metadata fetch to rate limit identifier', async () => {
    analysisRunsRepository.findOne.mockResolvedValue({
      id: 'run-1',
      repository: {
        id: 'repo-1',
        repoFullName: 'owner/project',
      },
      repositoryId: 'repo-1',
    } as AnalysisRunsEntity);
    gitHubService.getRepositoryMetadata.mockRejectedValue(
      new GitHubServiceError({
        code: 'rate-limit',
        message: 'too many requests',
        rateLimit: {
          remaining: 0,
          resetAtEpochSeconds: 1713088800,
        },
        statusCode: 429,
      }),
    );

    await expect(processor.syncRepositoryInfo('run-1')).rejects.toThrow(
      'GITHUB_RATE_LIMIT_EXCEEDED: rate limit remaining 0, resets at 2024-04-14T10:00:00.000Z',
    );
  });
});
