import { Injectable } from '@nestjs/common';
import {
  GetRepositoryMetadataInputDto,
  GetRepositorySourceFileInputDto,
  GetRepositoryTreeInputDto,
  GitHubRepositoryContentResponseDto,
  ListUserRepositoriesInputDto,
  RepositoryMetadataDto,
  RepositorySourceFileDto,
  RepositoryTreeDto,
  UserRepositorySummaryDto,
} from './dto';
import { GitHubClient } from './github.client';
import { GitHubClientError } from './github-client.error';
import { GitHubServiceError } from './github-service.error';
import {
  RepositoryContentMapper,
  RepositoryMetadataMapper,
  RepositoryTreeMapper,
  UserRepositoryMapper,
} from './mappers';
import {
  buildGitHubRepositoryMetadataCacheKey,
  buildGitHubRepositoryTreeCacheKey,
  RedisService,
} from '../redis';

@Injectable()
export class GitHubService {
  private readonly repositoryMetadataCacheTtlSeconds = 3600;
  private readonly repositoryTreeCacheTtlSeconds = 1800;

  constructor(
    private readonly gitHubClient: GitHubClient,
    private readonly redisService: RedisService,
  ) {}

  async listUserRepositories(
    input: ListUserRepositoriesInputDto,
  ): Promise<UserRepositorySummaryDto[]> {
    try {
      const response = await this.gitHubClient.listUserRepositories({
        owner: input.owner,
      });

      return response.body.map((repository) =>
        UserRepositoryMapper.toUserRepositorySummary(repository),
      );
    } catch (error) {
      throw this.normalizeGitHubError(error);
    }
  }

  async getRepositoryMetadata(
    input: GetRepositoryMetadataInputDto,
  ): Promise<RepositoryMetadataDto> {
    const parsedRepository = this.parseRepoFullName(input.repoFullName);
    const cacheKey = buildGitHubRepositoryMetadataCacheKey(
      parsedRepository.owner,
      parsedRepository.repo,
    );
    const cachedRepositoryMetadata =
      await this.getFromCache<RepositoryMetadataDto>(cacheKey);

    if (cachedRepositoryMetadata) {
      return cachedRepositoryMetadata;
    }

    try {
      const response = await this.gitHubClient.getRepositoryMetadata(
        parsedRepository,
      );
      const repositoryMetadata = RepositoryMetadataMapper.toRepositoryMetadata(
        response.body,
      );

      await this.setToCache(
        cacheKey,
        repositoryMetadata,
        this.repositoryMetadataCacheTtlSeconds,
      );

      return repositoryMetadata;
    } catch (error) {
      throw this.normalizeGitHubError(error);
    }
  }

  async getRepositoryTree(
    input: GetRepositoryTreeInputDto,
  ): Promise<RepositoryTreeDto> {
    const parsedRepository = this.parseRepoFullName(input.repoFullName);
    const branch = input.branch ?? (await this.getDefaultBranch(input.repoFullName));
    const cacheKey = buildGitHubRepositoryTreeCacheKey(
      parsedRepository.owner,
      parsedRepository.repo,
      branch,
    );
    const cachedRepositoryTree =
      await this.getFromCache<RepositoryTreeDto>(cacheKey);

    if (this.isCacheableRepositoryTree(cachedRepositoryTree)) {
      return cachedRepositoryTree;
    }

    try {
      const response = await this.gitHubClient.getRepositoryTree({
        ...parsedRepository,
        branch,
      });
      this.validateRepositoryTreeResponse(response.body);
      const repositoryTree = RepositoryTreeMapper.toRepositoryTree(
        response.body,
        branch,
      );

      await this.setToCache(
        cacheKey,
        repositoryTree,
        this.repositoryTreeCacheTtlSeconds,
      );

      return repositoryTree;
    } catch (error) {
      throw this.normalizeGitHubError(error);
    }
  }

  async getRepositorySourceFile(
    input: GetRepositorySourceFileInputDto,
  ): Promise<RepositorySourceFileDto> {
    const parsedRepository = this.parseRepoFullName(input.repoFullName);
    const ref = input.ref ?? (await this.getDefaultBranch(input.repoFullName));

    try {
      const response = await this.gitHubClient.getRepositoryContent({
        ...parsedRepository,
        path: input.path,
        ref,
      });
      const repositoryContent = this.validateRepositoryContentResponse(
        response.body,
      );

      return RepositoryContentMapper.toRepositorySourceFile(repositoryContent);
    } catch (error) {
      throw this.normalizeGitHubError(error);
    }
  }

  private async getDefaultBranch(repoFullName: string): Promise<string> {
    const repositoryMetadata = await this.getRepositoryMetadata({
      repoFullName,
    });

    return repositoryMetadata.defaultBranch;
  }

  private parseRepoFullName(repoFullName: string): {
    owner: string;
    repo: string;
  } {
    const segments = repoFullName.split('/');

    if (segments.length !== 2 || !segments[0] || !segments[1]) {
      throw new GitHubServiceError({
        code: 'invalid-repo-full-name',
        message: `Invalid GitHub repository full name: ${repoFullName}`,
      });
    }

    return {
      owner: segments[0],
      repo: segments[1],
    };
  }

  private normalizeGitHubError(error: unknown): GitHubServiceError {
    if (error instanceof GitHubServiceError) {
      return error;
    }

    if (error instanceof GitHubClientError) {
      if (error.statusCode === 404) {
        return new GitHubServiceError({
          code: 'not-found',
          message: error.message,
          statusCode: error.statusCode,
          rateLimit: error.rateLimit,
          cause: error,
        });
      }

      if (
        error.statusCode === 429 ||
        (error.statusCode === 403 && error.rateLimit.remaining === 0)
      ) {
        return new GitHubServiceError({
          code: 'rate-limit',
          message: error.message,
          statusCode: error.statusCode,
          rateLimit: error.rateLimit,
          cause: error,
        });
      }

      if (error.statusCode === 403) {
        return new GitHubServiceError({
          code: 'forbidden',
          message: error.message,
          statusCode: error.statusCode,
          rateLimit: error.rateLimit,
          cause: error,
        });
      }

      return new GitHubServiceError({
        code: 'invalid-response',
        message: error.message,
        statusCode: error.statusCode,
        rateLimit: error.rateLimit,
        cause: error,
      });
    }

    if (error instanceof Error) {
      return new GitHubServiceError({
        code: 'invalid-response',
        message: error.message,
        cause: error,
      });
    }

    return new GitHubServiceError({
      code: 'invalid-response',
      message: 'Unknown GitHub service error.',
    });
  }

  private async getFromCache<T>(key: string): Promise<T | null> {
    try {
      return await this.redisService.get<T>(key);
    } catch {
      return null;
    }
  }

  private async setToCache(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.redisService.set(key, value, ttlSeconds);
    } catch {
      return;
    }
  }

  private validateRepositoryContentResponse(
    source: GitHubRepositoryContentResponseDto,
  ): GitHubRepositoryContentResponseDto & {
    content: string;
    encoding: string;
  } {
    if (
      source.type === 'file' &&
      typeof source.content === 'string' &&
      typeof source.encoding === 'string' &&
      this.isSupportedRepositoryContent({
        content: source.content,
        encoding: source.encoding,
      })
    ) {
      return source as GitHubRepositoryContentResponseDto & {
        content: string;
        encoding: string;
      };
    }

    if (
      source.type === undefined &&
      typeof source.content === 'string' &&
      typeof source.encoding === 'string' &&
      this.isSupportedRepositoryContent({
        content: source.content,
        encoding: source.encoding,
      })
    ) {
      return source as GitHubRepositoryContentResponseDto & {
        content: string;
        encoding: string;
      };
    }

    throw new GitHubServiceError({
      code: 'invalid-response',
      message: 'GitHub repository content response is not a file payload.',
    });
  }

  private isSupportedRepositoryContent(
    source: {
      content: string;
      encoding: string;
    },
  ): boolean {
    if (source.encoding.toLowerCase() !== 'base64') {
      return true;
    }

    const normalizedContent = source.content.replace(/\n/g, '');

    if (normalizedContent.length === 0) {
      return true;
    }

    if (normalizedContent.length % 4 !== 0) {
      return false;
    }

    return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      normalizedContent,
    );
  }

  private validateRepositoryTreeResponse(source: {
    truncated?: boolean;
  }): void {
    if (source.truncated === true) {
      throw new GitHubServiceError({
        code: 'invalid-response',
        message: 'GitHub repository tree response was truncated.',
      });
    }
  }

  private isCacheableRepositoryTree(
    source: RepositoryTreeDto | null,
  ): source is RepositoryTreeDto {
    return source?.isComplete === true;
  }

  async listPublicRepositoriesByOwner(
    owner: string,
    limit: number,
  ): Promise<
    Array<{
      repoName: string;
      repoFullName: string;
      repoUrl: string;
      defaultBranch?: string;
      updatedAt: Date;
    }>
  > {
    const repositories = await this.listUserRepositories({
      owner,
    });

    return repositories.slice(0, limit).map((repository) => ({
      repoName: repository.name,
      repoFullName: repository.fullName,
      repoUrl: repository.htmlUrl,
      defaultBranch: undefined,
      updatedAt: new Date(repository.updatedAt),
    }));
  }
}
