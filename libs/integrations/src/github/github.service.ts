import { Injectable } from '@nestjs/common';
import {
  GetRepositoryContentParamsDto,
  GitHubRepositorySummaryDto,
  RepositorySourceFileDto,
} from './dto';
import { GitHubClient } from './github.client';
import { RepositoryContentMapper } from './mappers';

@Injectable()
export class GitHubService {
  constructor(private readonly gitHubClient: GitHubClient) {}

  async getRepositorySourceFile(
    params: GetRepositoryContentParamsDto,
  ): Promise<RepositorySourceFileDto> {
    const response = await this.gitHubClient.getRepositoryContent(params);

    return RepositoryContentMapper.toRepositorySourceFile(response);
  }

  async listPublicRepositoriesByOwner(
    owner: string,
    limit: number,
  ): Promise<GitHubRepositorySummaryDto[]> {
    const repositories = await this.gitHubClient.listUserRepositories(owner, limit);

    return repositories.map((repository) => ({
      repoName: repository.name,
      repoFullName: repository.full_name,
      repoUrl: repository.html_url,
      defaultBranch: repository.default_branch,
      updatedAt: new Date(repository.updated_at),
    }));
  }
}
