import {
  GitHubClientResponseDto,
  RepositoryMetadataDto,
  RepositoryTreeDto,
} from './dto';
import { GitHubClientError } from './github-client.error';
import { GitHubServiceError } from './github-service.error';
import { GitHubClient } from './github.client';
import { GitHubService } from './github.service';
import { RedisService } from '../redis';

describe('GitHubService', () => {
  let gitHubClient: jest.Mocked<GitHubClient>;
  let redisService: jest.Mocked<RedisService>;
  let gitHubService: GitHubService;

  beforeEach(() => {
    gitHubClient = {
      listUserRepositories: jest.fn(),
      getRepositoryMetadata: jest.fn(),
      getRepositoryTree: jest.fn(),
      getRepositoryContent: jest.fn(),
    } as unknown as jest.Mocked<GitHubClient>;

    redisService = {
      get: jest.fn(),
      set: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;

    gitHubService = new GitHubService(gitHubClient, redisService);
  });

  function createClientResponse<T>(body: T): GitHubClientResponseDto<T> {
    return {
      body,
      statusCode: 200,
      rateLimit: {
        remaining: 5000,
        resetAtEpochSeconds: 1713088800,
      },
    };
  }

  it('maps user repositories from the client response', async () => {
    gitHubClient.listUserRepositories.mockResolvedValue(
      createClientResponse([
        {
          name: 'backend',
          full_name: 'owner/backend',
          html_url: 'https://github.com/owner/backend',
          language: 'TypeScript',
          updated_at: '2026-04-14T10:00:00Z',
        },
      ]),
    );

    await expect(
      gitHubService.listUserRepositories({
        owner: 'owner',
      }),
    ).resolves.toEqual([
      {
        name: 'backend',
        fullName: 'owner/backend',
        htmlUrl: 'https://github.com/owner/backend',
        language: 'TypeScript',
        updatedAt: '2026-04-14T10:00:00Z',
      },
    ]);
  });

  it('normalizes client errors from listUserRepositories', async () => {
    gitHubClient.listUserRepositories.mockRejectedValue(
      new GitHubClientError({
        message: 'forbidden',
        statusCode: 403,
        responseBody: '',
        rateLimit: {
          remaining: 1,
          resetAtEpochSeconds: 1,
        },
      }),
    );

    await expect(
      gitHubService.listUserRepositories({
        owner: 'owner',
      }),
    ).rejects.toMatchObject<Partial<GitHubServiceError>>({
      code: 'forbidden',
      statusCode: 403,
    });
  });

  it('returns cached repository metadata without calling client', async () => {
    const cachedMetadata: RepositoryMetadataDto = {
      name: 'backend',
      fullName: 'owner/backend',
      defaultBranch: 'main',
      ownerLogin: 'owner',
      htmlUrl: 'https://github.com/owner/backend',
      language: 'TypeScript',
    };
    redisService.get.mockResolvedValue(cachedMetadata);

    const result = await gitHubService.getRepositoryMetadata({
      repoFullName: 'owner/backend',
    });

    expect(result).toEqual(cachedMetadata);
    expect(gitHubClient.getRepositoryMetadata).not.toHaveBeenCalled();
  });

  it('loads repository metadata on cache miss and stores it for one hour', async () => {
    redisService.get.mockResolvedValue(null);
    gitHubClient.getRepositoryMetadata.mockResolvedValue(
      createClientResponse({
        name: 'backend',
        full_name: 'owner/backend',
        default_branch: 'main',
        html_url: 'https://github.com/owner/backend',
        language: 'TypeScript',
        owner: {
          login: 'owner',
        },
      }),
    );

    const result = await gitHubService.getRepositoryMetadata({
      repoFullName: 'owner/backend',
    });

    expect(gitHubClient.getRepositoryMetadata).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'backend',
    });
    expect(redisService.set).toHaveBeenCalledWith(
      'github:repo:owner/backend',
      result,
      3600,
    );
  });

  it('uses cached tree result without calling client again', async () => {
    const cachedTree: RepositoryTreeDto = {
      branch: 'main',
      isComplete: true,
      items: [
        {
          path: 'src/app.ts',
          mode: '100644',
          type: 'blob',
          sha: 'sha-1',
        },
      ],
    };
    redisService.get.mockResolvedValueOnce(cachedTree);

    const result = await gitHubService.getRepositoryTree({
      repoFullName: 'owner/backend',
      branch: 'main',
    });

    expect(result).toEqual(cachedTree);
    expect(gitHubClient.getRepositoryTree).not.toHaveBeenCalled();
  });

  it('ignores legacy cached trees without completeness metadata', async () => {
    redisService.get
      .mockResolvedValueOnce({
        branch: 'main',
        items: [],
      } as RepositoryTreeDto)
      .mockResolvedValueOnce(null);
    gitHubClient.getRepositoryMetadata.mockResolvedValue(
      createClientResponse({
        name: 'backend',
        full_name: 'owner/backend',
        default_branch: 'main',
        html_url: 'https://github.com/owner/backend',
        language: 'TypeScript',
        owner: {
          login: 'owner',
        },
      }),
    );
    gitHubClient.getRepositoryTree.mockResolvedValue(
      createClientResponse({
        tree: [
          {
            path: 'src/app.ts',
            mode: '100644',
            type: 'blob',
            sha: 'sha-1',
          },
        ],
      }),
    );

    const result = await gitHubService.getRepositoryTree({
      repoFullName: 'owner/backend',
      branch: 'main',
    });

    expect(gitHubClient.getRepositoryTree).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'backend',
      branch: 'main',
    });
    expect(result.isComplete).toBe(true);
  });

  it('loads default branch metadata before tree lookup and caches tree for thirty minutes', async () => {
    redisService.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    gitHubClient.getRepositoryMetadata.mockResolvedValue(
      createClientResponse({
        name: 'backend',
        full_name: 'owner/backend',
        default_branch: 'main',
        html_url: 'https://github.com/owner/backend',
        language: 'TypeScript',
        owner: {
          login: 'owner',
        },
      }),
    );
    gitHubClient.getRepositoryTree.mockResolvedValue(
      createClientResponse({
        tree: [
          {
            path: 'src/app.ts',
            mode: '100644',
            type: 'blob',
            sha: 'sha-1',
          },
        ],
      }),
    );

    const result = await gitHubService.getRepositoryTree({
      repoFullName: 'owner/backend',
    });

    expect(gitHubClient.getRepositoryTree).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'backend',
      branch: 'main',
    });
    expect(redisService.set).toHaveBeenNthCalledWith(
      1,
      'github:repo:owner/backend',
      expect.objectContaining({ defaultBranch: 'main' }),
      3600,
    );
    expect(redisService.set).toHaveBeenNthCalledWith(
      2,
      'github:tree:owner/backend:main',
      result,
      1800,
    );
  });

  it('rejects truncated repository trees as invalid-response', async () => {
    redisService.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    gitHubClient.getRepositoryMetadata.mockResolvedValue(
      createClientResponse({
        name: 'backend',
        full_name: 'owner/backend',
        default_branch: 'main',
        html_url: 'https://github.com/owner/backend',
        language: 'TypeScript',
        owner: {
          login: 'owner',
        },
      }),
    );
    gitHubClient.getRepositoryTree.mockResolvedValue(
      createClientResponse({
        truncated: true,
        tree: [],
      }),
    );

    await expect(
      gitHubService.getRepositoryTree({
        repoFullName: 'owner/backend',
      }),
    ).rejects.toMatchObject<Partial<GitHubServiceError>>({
      code: 'invalid-response',
    });
    expect(redisService.set).toHaveBeenCalledTimes(1);
  });

  it('falls back to direct GitHub call when redis read fails', async () => {
    redisService.get.mockRejectedValue(new Error('redis down'));
    gitHubClient.getRepositoryMetadata.mockResolvedValue(
      createClientResponse({
        name: 'backend',
        full_name: 'owner/backend',
        default_branch: 'main',
        html_url: 'https://github.com/owner/backend',
        language: 'TypeScript',
        owner: {
          login: 'owner',
        },
      }),
    );

    await expect(
      gitHubService.getRepositoryMetadata({
        repoFullName: 'owner/backend',
      }),
    ).resolves.toMatchObject({
      fullName: 'owner/backend',
    });
    expect(gitHubClient.getRepositoryMetadata).toHaveBeenCalled();
  });

  it('swallows redis write failures after a successful client response', async () => {
    redisService.get.mockResolvedValue(null);
    redisService.set.mockRejectedValue(new Error('write failed'));
    gitHubClient.getRepositoryMetadata.mockResolvedValue(
      createClientResponse({
        name: 'backend',
        full_name: 'owner/backend',
        default_branch: 'main',
        html_url: 'https://github.com/owner/backend',
        language: 'TypeScript',
        owner: {
          login: 'owner',
        },
      }),
    );

    await expect(
      gitHubService.getRepositoryMetadata({
        repoFullName: 'owner/backend',
      }),
    ).resolves.toMatchObject({
      defaultBranch: 'main',
    });
  });

  it('resolves source file using default branch when ref is omitted', async () => {
    redisService.get.mockResolvedValueOnce({
      name: 'backend',
      fullName: 'owner/backend',
      defaultBranch: 'main',
      ownerLogin: 'owner',
      htmlUrl: 'https://github.com/owner/backend',
      language: 'TypeScript',
    });
    gitHubClient.getRepositoryContent.mockResolvedValue(
      createClientResponse({
        type: 'file',
        name: 'app.ts',
        path: 'src/app.ts',
        content: 'Y29uc29sZS5sb2coJ2hpJyk7\n',
        encoding: 'base64',
      }),
    );

    const result = await gitHubService.getRepositorySourceFile({
      repoFullName: 'owner/backend',
      path: 'src/app.ts',
    });

    expect(gitHubClient.getRepositoryContent).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'backend',
      path: 'src/app.ts',
      ref: 'main',
    });
    expect(result.decodedContent).toBe("console.log('hi');");
  });

  it('throws invalid-repo-full-name for malformed repoFullName', async () => {
    await expect(
      gitHubService.getRepositoryMetadata({
        repoFullName: 'owner/backend/extra',
      }),
    ).rejects.toMatchObject<Partial<GitHubServiceError>>({
      code: 'invalid-repo-full-name',
    });
  });

  it('normalizes not-found errors from client', async () => {
    redisService.get.mockResolvedValue(null);
    gitHubClient.getRepositoryMetadata.mockRejectedValue(
      new GitHubClientError({
        message: 'not found',
        statusCode: 404,
        responseBody: '{"message":"Not Found"}',
        rateLimit: {
          remaining: 5,
          resetAtEpochSeconds: 1,
        },
      }),
    );

    await expect(
      gitHubService.getRepositoryMetadata({
        repoFullName: 'owner/backend',
      }),
    ).rejects.toMatchObject<Partial<GitHubServiceError>>({
      code: 'not-found',
      statusCode: 404,
    });
  });

  it('normalizes forbidden and rate-limit errors from client', async () => {
    redisService.get.mockResolvedValue(null);
    gitHubClient.getRepositoryMetadata.mockRejectedValueOnce(
      new GitHubClientError({
        message: 'forbidden',
        statusCode: 403,
        responseBody: '',
        rateLimit: {
          remaining: 1,
          resetAtEpochSeconds: 1,
        },
      }),
    );

    await expect(
      gitHubService.getRepositoryMetadata({
        repoFullName: 'owner/backend',
      }),
    ).rejects.toMatchObject<Partial<GitHubServiceError>>({
      code: 'forbidden',
    });

    gitHubClient.getRepositoryMetadata.mockRejectedValueOnce(
      new GitHubClientError({
        message: 'rate limit',
        statusCode: 403,
        responseBody: '',
        rateLimit: {
          remaining: 0,
          resetAtEpochSeconds: 1,
        },
      }),
    );

    await expect(
      gitHubService.getRepositoryMetadata({
        repoFullName: 'owner/backend',
      }),
    ).rejects.toMatchObject<Partial<GitHubServiceError>>({
      code: 'rate-limit',
    });
  });

  it('normalizes 429 errors as rate-limit and preserves metadata', async () => {
    redisService.get.mockResolvedValue(null);
    gitHubClient.getRepositoryMetadata.mockRejectedValue(
      new GitHubClientError({
        message: 'too many requests',
        statusCode: 429,
        responseBody: '',
        rateLimit: {
          remaining: 0,
          resetAtEpochSeconds: 1713088800,
        },
      }),
    );

    await expect(
      gitHubService.getRepositoryMetadata({
        repoFullName: 'owner/backend',
      }),
    ).rejects.toMatchObject<Partial<GitHubServiceError>>({
      code: 'rate-limit',
      statusCode: 429,
      rateLimit: {
        remaining: 0,
        resetAtEpochSeconds: 1713088800,
      },
    });
  });

  it('normalizes invalid content payload as invalid-response', async () => {
    redisService.get.mockResolvedValueOnce({
      name: 'backend',
      fullName: 'owner/backend',
      defaultBranch: 'main',
      ownerLogin: 'owner',
      htmlUrl: 'https://github.com/owner/backend',
      language: 'TypeScript',
    });
    gitHubClient.getRepositoryContent.mockResolvedValue(
      createClientResponse({
        type: 'dir',
        name: 'src',
        path: 'src',
      }),
    );

    await expect(
      gitHubService.getRepositorySourceFile({
        repoFullName: 'owner/backend',
        path: 'src',
      }),
    ).rejects.toMatchObject<Partial<GitHubServiceError>>({
      code: 'invalid-response',
    });
  });

  it('normalizes invalid base64 content as invalid-response', async () => {
    redisService.get.mockResolvedValueOnce({
      name: 'backend',
      fullName: 'owner/backend',
      defaultBranch: 'main',
      ownerLogin: 'owner',
      htmlUrl: 'https://github.com/owner/backend',
      language: 'TypeScript',
    });
    gitHubClient.getRepositoryContent.mockResolvedValue(
      createClientResponse({
        type: 'file',
        name: 'app.ts',
        path: 'src/app.ts',
        content: 'not-base64',
        encoding: 'base64',
      }),
    );

    await expect(
      gitHubService.getRepositorySourceFile({
        repoFullName: 'owner/backend',
        path: 'src/app.ts',
      }),
    ).rejects.toMatchObject<Partial<GitHubServiceError>>({
      code: 'invalid-response',
    });
  });

  it('accepts empty base64 file content', async () => {
    redisService.get.mockResolvedValueOnce({
      name: 'backend',
      fullName: 'owner/backend',
      defaultBranch: 'main',
      ownerLogin: 'owner',
      htmlUrl: 'https://github.com/owner/backend',
      language: 'TypeScript',
    });
    gitHubClient.getRepositoryContent.mockResolvedValue(
      createClientResponse({
        type: 'file',
        name: 'empty.ts',
        path: 'src/empty.ts',
        content: '',
        encoding: 'base64',
      }),
    );

    await expect(
      gitHubService.getRepositorySourceFile({
        repoFullName: 'owner/backend',
        path: 'src/empty.ts',
      }),
    ).resolves.toMatchObject({
      decodedContent: '',
      path: 'src/empty.ts',
    });
  });
});
