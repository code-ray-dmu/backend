import { Injectable } from '@nestjs/common';
import {
  GetRepositoryParamsDto,
  GetRepositoryTreeParamsDto,
  GetRepositoryContentParamsDto,
  RepositoryInfoDto,
  RepositorySourceFileDto,
  RepositoryTreeEntryDto,
} from './dto';
import { GitHubClient } from './github.client';
import { RepositoryContentMapper } from './mappers';

@Injectable()
export class GitHubService {
  constructor(private readonly gitHubClient: GitHubClient) {}

  async getRepositoryInfo(params: GetRepositoryParamsDto): Promise<RepositoryInfoDto> {
    const response = await this.gitHubClient.getRepository(params);

    return RepositoryContentMapper.toRepositoryInfo(response);
  }

  async getRepositoryTree(
    params: GetRepositoryTreeParamsDto,
  ): Promise<RepositoryTreeEntryDto[]> {
    const response = await this.gitHubClient.getRepositoryTree(params);

    if (response.truncated) {
      throw new Error(
        'GITHUB_REPOSITORY_TREE_TRUNCATED: repository tree response was truncated',
      );
    }

    return response.tree.map((entry) => {
      return RepositoryContentMapper.toRepositoryTreeEntry(entry);
    });
  }

  async getRepositorySourceFile(
    params: GetRepositoryContentParamsDto,
  ): Promise<RepositorySourceFileDto> {
    const response = await this.gitHubClient.getRepositoryContent(params);

    return RepositoryContentMapper.toRepositorySourceFile(response);
  }
}
