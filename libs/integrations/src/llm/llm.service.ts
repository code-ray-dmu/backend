import { Injectable } from '@nestjs/common';
import { LlmClient } from './llm.client';
import type {
  GenerateQuestionsInput,
  GenerateQuestionsResult,
  SelectFilesInput,
  SelectFilesResult,
  SummarizeCodeInput,
  SummarizeCodeResult,
} from './llm.types';

@Injectable()
export class LlmService {
  constructor(private readonly llmClient: LlmClient) {}

  async generateQuestions(
    input: GenerateQuestionsInput,
  ): Promise<GenerateQuestionsResult> {
    return this.llmClient.generateQuestions(input);
  }

  async selectFiles(input: SelectFilesInput): Promise<SelectFilesResult> {
    return this.llmClient.selectFiles(input);
  }

  async summarizeCode(
    input: SummarizeCodeInput,
  ): Promise<SummarizeCodeResult> {
    return this.llmClient.summarizeCode(input);
  }
}
