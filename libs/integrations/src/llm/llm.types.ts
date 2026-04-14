export interface LlmTextResult {
  content: string;
}

export interface SelectFilesInput {
  maxAnalysisFiles: number;
  prompt: string;
}

export interface SelectFilesResult extends LlmTextResult {}

export interface SummarizeCodeInput {
  prompt: string;
}

export interface SummarizeCodeResult extends LlmTextResult {}

export interface GenerateQuestionsInput {
  maxQuestionsPerAnalysisRun: number;
  prompt: string;
}

export interface GenerateQuestionsResult extends LlmTextResult {}
