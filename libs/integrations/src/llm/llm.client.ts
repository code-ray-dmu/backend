import { Inject, Injectable } from '@nestjs/common';
import { LLM_PROVIDER_ADAPTER } from './llm.tokens';
import type {
  GenerateQuestionsInput,
  GenerateQuestionsResult,
  SelectFilesInput,
  SelectFilesResult,
  SummarizeCodeInput,
  SummarizeCodeResult,
} from './llm.types';
import type { LlmProviderAdapter } from './interfaces';

@Injectable()
export class LlmClient {
  constructor(
    @Inject(LLM_PROVIDER_ADAPTER)
    private readonly providerAdapter: LlmProviderAdapter,
  ) {}

  async generateQuestions(
    input: GenerateQuestionsInput,
  ): Promise<GenerateQuestionsResult> {
    return this.providerAdapter.generateQuestions(input);
  }

  async selectFiles(input: SelectFilesInput): Promise<SelectFilesResult> {
    return this.providerAdapter.selectFiles(input);
  }

  async summarizeCode(
    input: SummarizeCodeInput,
  ): Promise<SummarizeCodeResult> {
    return this.providerAdapter.summarizeCode(input);
  }
}
