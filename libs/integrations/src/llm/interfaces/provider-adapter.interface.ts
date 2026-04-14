import type {
  GenerateQuestionsInput,
  GenerateQuestionsResult,
  SelectFilesInput,
  SelectFilesResult,
  SummarizeCodeInput,
  SummarizeCodeResult,
} from '../llm.types';

export interface LlmProviderAdapter {
  generateQuestions(
    input: GenerateQuestionsInput,
  ): Promise<GenerateQuestionsResult>;

  selectFiles(input: SelectFilesInput): Promise<SelectFilesResult>;

  summarizeCode(input: SummarizeCodeInput): Promise<SummarizeCodeResult>;
}
