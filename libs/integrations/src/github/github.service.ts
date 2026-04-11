import { Injectable } from '@nestjs/common';
import {
  GetRepositoryContentParamsDto,
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
}
