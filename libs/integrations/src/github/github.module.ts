import { Module } from '@nestjs/common';
import { GitHubClient } from './github.client';
import { GitHubService } from './github.service';

@Module({
  providers: [GitHubClient, GitHubService],
  exports: [GitHubClient, GitHubService],
})
export class GitHubModule {}
