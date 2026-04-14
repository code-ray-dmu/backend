import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { request } from 'node:https';
import {
  GetRepositoryMetadataParamsDto,
  GetRepositoryTreeParamsDto,
  GetRepositoryContentParamsDto,
  GitHubClientResponseDto,
  GitHubRepositoryContentResponseDto,
  GitHubRepositoryMetadataResponseDto,
  GitHubRepositoryTreeResponseDto,
  GitHubUserRepositoryResponseDto,
  GitHubRateLimitDto,
  ListUserRepositoriesParamsDto,
} from './dto';
import { GitHubClientError } from './github-client.error';

@Injectable()
export class GitHubClient {
  private readonly baseUrl = 'https://api.github.com';
  private readonly githubToken: string;
  private readonly maxRepositorySelectionCount: number;

  constructor(private readonly configService: ConfigService) {
    this.githubToken = this.configService.getOrThrow<string>('github.token');
    this.maxRepositorySelectionCount = this.parseMaxRepositorySelectionCount(
      process.env.MAX_REPO_SELECTION_COUNT,
    );
  }

  async listUserRepositories(
    params: ListUserRepositoriesParamsDto,
  ): Promise<GitHubClientResponseDto<GitHubUserRepositoryResponseDto[]>> {
    const { owner } = params;
    const requestPath = new URL(
      `/users/${this.encodePathSegment(owner)}/repos`,
      this.baseUrl,
    );

    requestPath.searchParams.set('sort', 'updated');
    requestPath.searchParams.set('direction', 'desc');
    requestPath.searchParams.set('type', 'public');
    requestPath.searchParams.set(
      'per_page',
      this.maxRepositorySelectionCount.toString(),
    );

    return this.get<GitHubUserRepositoryResponseDto[]>(requestPath);
  }

  async getRepositoryMetadata(
    params: GetRepositoryMetadataParamsDto,
  ): Promise<GitHubClientResponseDto<GitHubRepositoryMetadataResponseDto>> {
    const { owner, repo } = params;
    const requestPath = new URL(
      `/repos/${this.encodePathSegment(owner)}/${this.encodePathSegment(repo)}`,
      this.baseUrl,
    );

    return this.get<GitHubRepositoryMetadataResponseDto>(requestPath);
  }

  async getRepositoryTree(
    params: GetRepositoryTreeParamsDto,
  ): Promise<GitHubClientResponseDto<GitHubRepositoryTreeResponseDto>> {
    const { owner, repo, branch } = params;
    const requestPath = new URL(
      `/repos/${this.encodePathSegment(owner)}/${this.encodePathSegment(
        repo,
      )}/git/trees/${this.encodePathSegment(branch)}`,
      this.baseUrl,
    );

    requestPath.searchParams.set('recursive', '1');

    return this.get<GitHubRepositoryTreeResponseDto>(requestPath);
  }

  async getRepositoryContent(
    params: GetRepositoryContentParamsDto,
  ): Promise<GitHubClientResponseDto<GitHubRepositoryContentResponseDto>> {
    const { owner, repo, path, ref } = params;
    const requestPath = new URL(
      `/repos/${this.encodePathSegment(owner)}/${this.encodePathSegment(
        repo,
      )}/contents/${this.encodeContentPath(path)}`,
      this.baseUrl,
    );

    if (ref) {
      requestPath.searchParams.set('ref', ref);
    }

    return this.get<GitHubRepositoryContentResponseDto>(requestPath);
  }

  private async get<T>(url: URL): Promise<GitHubClientResponseDto<T>> {
    return new Promise<GitHubClientResponseDto<T>>((resolve, reject) => {
      const req = request(
        url,
        {
          method: 'GET',
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `token ${this.githubToken}`,
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
            const rateLimit = this.extractRateLimit(res.headers);

            if (!res.statusCode || res.statusCode >= 400) {
              reject(
                new GitHubClientError({
                  message: `GitHub API request failed with status ${res.statusCode}: ${responseBody}`,
                  statusCode: res.statusCode ?? null,
                  responseBody,
                  rateLimit,
                }),
              );
              return;
            }

            try {
              resolve({
                body: JSON.parse(responseBody) as T,
                statusCode: res.statusCode,
                rateLimit,
              });
            } catch (error) {
              reject(
                new GitHubClientError({
                  message: `GitHub API response parsing failed: ${error instanceof Error ? error.message : 'unknown error'}`,
                  statusCode: res.statusCode,
                  responseBody,
                  rateLimit,
                }),
              );
            }
          });
        },
      );

      req.on('error', (error) => {
        reject(
          new GitHubClientError({
            message: `GitHub API transport failed: ${error.message}`,
            statusCode: null,
            responseBody: '',
            rateLimit: {
              remaining: null,
              resetAtEpochSeconds: null,
            },
          }),
        );
      });
      req.end();
    });
  }

  private encodePathSegment(segment: string): string {
    return encodeURIComponent(segment);
  }

  private encodeContentPath(path: string): string {
    return path
      .split('/')
      .map((segment) => this.encodePathSegment(segment))
      .join('/');
  }

  private extractRateLimit(headers: {
    [key: string]: string | string[] | undefined;
  }): GitHubRateLimitDto {
    return {
      remaining: this.parseRateLimitHeader(headers['x-ratelimit-remaining']),
      resetAtEpochSeconds: this.parseRateLimitHeader(
        headers['x-ratelimit-reset'],
      ),
    };
  }

  private parseRateLimitHeader(
    headerValue: string | string[] | undefined,
  ): number | null {
    const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!value) {
      return null;
    }

    const parsedValue = Number.parseInt(value, 10);

    return Number.isNaN(parsedValue) ? null : parsedValue;
  }

  private parseMaxRepositorySelectionCount(value: string | undefined): number {
    const parsedValue = Number.parseInt(value ?? '3', 10);

    if (Number.isNaN(parsedValue) || parsedValue <= 0) {
      return 3;
    }

    return parsedValue;
  }
}
