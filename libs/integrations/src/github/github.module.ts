import { Module } from '@nestjs/common';
import { RedisModule } from '../redis';
import { GitHubClient } from './github.client';
import { GitHubService } from './github.service';

@Module({
  imports: [RedisModule],
  providers: [GitHubClient, GitHubService],
  exports: [GitHubClient, GitHubService],
})
export class GitHubModule {}
