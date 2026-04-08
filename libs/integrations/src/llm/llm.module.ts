import { Module } from '@nestjs/common';
import { LlmClient } from './llm.client';
import { LlmService } from './llm.service';

@Module({
  providers: [LlmClient, LlmService],
  exports: [LlmClient, LlmService],
})
export class LlmModule {}
