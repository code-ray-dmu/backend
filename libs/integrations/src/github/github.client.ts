import { Injectable } from '@nestjs/common';
import { request } from 'node:https';
import {
  GetRepositoryContentParamsDto,
  GitHubRepositoryContentResponseDto,
  GitHubUserRepositoryResponseDto,
} from './dto';

@Injectable()
export class GitHubClient {
  private readonly baseUrl = 'https://api.github.com';

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

  async listUserRepositories(
    owner: string,
    perPage: number,
  ): Promise<GitHubUserRepositoryResponseDto[]> {
    const requestPath = new URL(`/users/${owner}/repos`, this.baseUrl);
    requestPath.searchParams.set('sort', 'updated');
    requestPath.searchParams.set('direction', 'desc');
    requestPath.searchParams.set('per_page', String(perPage));

    return this.get<GitHubUserRepositoryResponseDto[]>(requestPath);
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
              reject(
                new Error(
                  `GitHub API request failed with status ${res.statusCode}: ${responseBody}`,
                ),
              );
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
}
