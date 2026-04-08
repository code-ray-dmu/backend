import { Injectable } from '@nestjs/common';
import { GitHubClient } from './github.client';

@Injectable()
export class GitHubService {
  constructor(private readonly gitHubClient: GitHubClient) {}
}
