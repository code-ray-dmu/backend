import { Injectable } from '@nestjs/common';
import { request } from 'node:https';
import {
  GetRepositoryParamsDto,
  GetRepositoryTreeParamsDto,
  GetRepositoryContentParamsDto,
  GitHubRepositoryResponseDto,
  GitHubRepositoryTreeResponseDto,
  GitHubRepositoryContentResponseDto,
} from './dto';

@Injectable()
export class GitHubClient {
  private readonly baseUrl = 'https://api.github.com';

  async getRepository(
    params: GetRepositoryParamsDto,
  ): Promise<GitHubRepositoryResponseDto> {
    const { owner, repo } = params;
    const requestPath = new URL(`/repos/${owner}/${repo}`, this.baseUrl);

    return this.get<GitHubRepositoryResponseDto>(requestPath);
  }

  async getRepositoryTree(
    params: GetRepositoryTreeParamsDto,
  ): Promise<GitHubRepositoryTreeResponseDto> {
    const { owner, repo, treeSha } = params;
    const requestPath = new URL(
      `/repos/${owner}/${repo}/git/trees/${treeSha}`,
      this.baseUrl,
    );

    requestPath.searchParams.set('recursive', '1');

    return this.get<GitHubRepositoryTreeResponseDto>(requestPath);
  }

  async getRepositoryContent(
    params: GetRepositoryContentParamsDto,
  ): Promise<GitHubRepositoryContentResponseDto> {
    const { owner, repo, path, ref } = params;
    const requestPath = new URL(
      `/repos/${owner}/${repo}/contents/${path}`,
      this.baseUrl,
    );

    if (ref) {
      requestPath.searchParams.set('ref', ref);
    }

    return this.get<GitHubRepositoryContentResponseDto>(requestPath);
  }

  private async get<T>(url: URL): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const req = request(
        url,
        {
          method: 'GET',
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'code-ray-server',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        },
        (res) => {
          let responseBody = '';

          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            responseBody += chunk;
          });
          res.on('end', () => {
            if (!res.statusCode || res.statusCode >= 400) {
              reject(new Error(this.toGitHubRequestError(res.statusCode, responseBody)));
              return;
            }

            resolve(JSON.parse(responseBody) as T);
          });
        },
      );

      req.on('error', reject);
      req.end();
    });
  }

  private toGitHubRequestError(statusCode: number, responseBody: string): string {
    const normalizedBody = responseBody.toLowerCase();

    if (
      statusCode === 403 &&
      (normalizedBody.includes('rate limit') || normalizedBody.includes('api rate limit'))
    ) {
      return `GITHUB_RATE_LIMIT_EXCEEDED: ${responseBody}`;
    }

    if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
      return `GITHUB_REPOSITORY_ACCESS_DENIED: ${responseBody}`;
    }

    return `GITHUB_REQUEST_FAILED: status=${statusCode} body=${responseBody}`;
  }
}
