import { EventEmitter } from 'node:events';
import { ConfigService } from '@nestjs/config';
import { request } from 'node:https';
import { GitHubClientError } from './github-client.error';
import { GitHubClient } from './github.client';

jest.mock('node:https', () => ({
  request: jest.fn(),
}));

type MockRequest = {
  on: jest.Mock;
  end: jest.Mock;
};

class MockResponse extends EventEmitter {
  statusCode?: number;
  headers: Record<string, string | string[] | undefined>;

  constructor(params: {
    statusCode?: number;
    headers?: Record<string, string | string[] | undefined>;
  }) {
    super();
    this.statusCode = params.statusCode;
    this.headers = params.headers ?? {};
  }

  setEncoding(_encoding: string): void {}
}

describe('GitHubClient', () => {
  const mockedRequest = jest.mocked(request);
  const configService = {
    getOrThrow: jest.fn().mockReturnValue('test-token'),
  } as unknown as ConfigService;

  let gitHubClient: GitHubClient;
  let currentRequest: MockRequest;
  let pendingResponse:
    | {
        statusCode?: number;
        body: string;
        headers?: Record<string, string | string[] | undefined>;
      }
    | null;

  beforeEach(() => {
    jest.clearAllMocks();
    gitHubClient = new GitHubClient(configService);
    pendingResponse = null;

    currentRequest = {
      on: jest.fn().mockReturnThis(),
      end: jest.fn(),
    };

    mockedRequest.mockImplementation((url, options, callback) => {
      currentRequest.end.mockImplementation(() => {
        if (callback && pendingResponse) {
          const response = new MockResponse({
            statusCode: pendingResponse.statusCode,
            headers: pendingResponse.headers,
          });

          callback(response as never);
          response.emit('data', pendingResponse.body);
          response.emit('end');
        }
      });

      return currentRequest as never;
    });
  });

  function emitResponse(params: {
    statusCode?: number;
    body: string;
    headers?: Record<string, string | string[] | undefined>;
  }): void {
    pendingResponse = params;
  }

  it('builds list repositories request with auth headers and rate limit metadata', async () => {
    emitResponse({
      statusCode: 200,
      body: JSON.stringify([
        {
          name: 'backend',
          full_name: 'owner/backend',
          html_url: 'https://github.com/owner/backend',
          language: 'TypeScript',
          updated_at: '2026-04-14T10:00:00Z',
        },
      ]),
      headers: {
        'x-ratelimit-remaining': '4999',
        'x-ratelimit-reset': '1713088800',
      },
    });

    const response = await gitHubClient.listUserRepositories({
      owner: 'octo team',
    });

    const [url, options] = mockedRequest.mock.calls[0];

    expect(url.toString()).toBe(
      'https://api.github.com/users/octo%20team/repos?sort=updated&direction=desc&type=public&per_page=3',
    );
    expect(options).toMatchObject({
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: 'token test-token',
        'User-Agent': 'code-ray-server',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.rateLimit).toEqual({
      remaining: 4999,
      resetAtEpochSeconds: 1713088800,
    });
    expect(response.body).toHaveLength(1);
  });

  it('encodes tree branch correctly', async () => {
    emitResponse({
      statusCode: 200,
      body: JSON.stringify({ tree: [] }),
    });

    await gitHubClient.getRepositoryTree({
      owner: 'owner',
      repo: 'repo',
      branch: 'feature/test #1',
    });

    expect(mockedRequest.mock.calls[0][0].toString()).toBe(
      'https://api.github.com/repos/owner/repo/git/trees/feature%2Ftest%20%231?recursive=1',
    );
  });

  it('encodes content path correctly', async () => {
    emitResponse({
      statusCode: 200,
      body: JSON.stringify({
        type: 'file',
        name: 'a.ts',
        path: 'dir name/a.ts',
        content: 'YQ==',
        encoding: 'base64',
      }),
    });

    await gitHubClient.getRepositoryContent({
      owner: 'owner',
      repo: 'repo',
      path: 'dir name/a.ts',
      ref: 'feature/test',
    });

    expect(mockedRequest.mock.calls[0][0].toString()).toBe(
      'https://api.github.com/repos/owner/repo/contents/dir%20name/a.ts?ref=feature%2Ftest',
    );
  });

  it('throws GitHubClientError for non-success status', async () => {
    emitResponse({
      statusCode: 404,
      body: '{"message":"Not Found"}',
      headers: {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': '1713088800',
      },
    });

    await expect(
      gitHubClient.getRepositoryMetadata({
        owner: 'owner',
        repo: 'missing',
      }),
    ).rejects.toMatchObject<Partial<GitHubClientError>>({
      name: 'GitHubClientError',
      statusCode: 404,
      responseBody: '{"message":"Not Found"}',
      rateLimit: {
        remaining: 0,
        resetAtEpochSeconds: 1713088800,
      },
    });
  });

  it('throws GitHubClientError for invalid JSON response', async () => {
    emitResponse({
      statusCode: 200,
      body: 'not-json',
    });

    await expect(
      gitHubClient.getRepositoryMetadata({
        owner: 'owner',
        repo: 'repo',
      }),
    ).rejects.toMatchObject<Partial<GitHubClientError>>({
      name: 'GitHubClientError',
      statusCode: 200,
      responseBody: 'not-json',
      rateLimit: {
        remaining: null,
        resetAtEpochSeconds: null,
      },
    });
  });

  it('returns null rate limit fields when headers are missing or malformed', async () => {
    emitResponse({
      statusCode: 200,
      body: JSON.stringify({
        name: 'backend',
        full_name: 'owner/backend',
        html_url: 'https://github.com/owner/backend',
        language: 'TypeScript',
        updated_at: '2026-04-14T10:00:00Z',
      }),
      headers: {
        'x-ratelimit-remaining': 'not-a-number',
      },
    });

    const response = await gitHubClient.getRepositoryMetadata({
      owner: 'owner',
      repo: 'repo',
    });

    expect(response.rateLimit).toEqual({
      remaining: null,
      resetAtEpochSeconds: null,
    });
  });

  it('reads the first value from array rate limit headers', async () => {
    emitResponse({
      statusCode: 200,
      body: JSON.stringify({ tree: [] }),
      headers: {
        'x-ratelimit-remaining': ['42', '41'],
        'x-ratelimit-reset': ['1713088800'],
      },
    });

    const response = await gitHubClient.getRepositoryTree({
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
    });

    expect(response.rateLimit).toEqual({
      remaining: 42,
      resetAtEpochSeconds: 1713088800,
    });
  });

  it('wraps transport errors as GitHubClientError', async () => {
    mockedRequest.mockImplementation((_url, _options, _callback) => {
      currentRequest.end.mockImplementation(() => {
        const errorHandler = currentRequest.on.mock.calls.find(
          ([eventName]) => eventName === 'error',
        )?.[1] as ((error: Error) => void) | undefined;

        if (errorHandler) {
          errorHandler(new Error('socket hang up'));
        }
      });

      return currentRequest as never;
    });

    await expect(
      gitHubClient.getRepositoryMetadata({
        owner: 'owner',
        repo: 'repo',
      }),
    ).rejects.toMatchObject<Partial<GitHubClientError>>({
      name: 'GitHubClientError',
      statusCode: null,
      responseBody: '',
      rateLimit: {
        remaining: null,
        resetAtEpochSeconds: null,
      },
    });
  });
});
