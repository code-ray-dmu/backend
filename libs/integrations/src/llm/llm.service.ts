import { Injectable } from '@nestjs/common';
import { LlmClient } from './llm.client';

@Injectable()
export class LlmService {
  constructor(private readonly llmClient: LlmClient) {}
}
