import { GeneratedQuestionsEntity } from '@app/database';

export const GENERATED_QUESTIONS_SORT_FIELDS = ['createdAt', 'priority'] as const;
export const GENERATED_QUESTIONS_SORT_ORDERS = ['asc', 'desc'] as const;

export type GeneratedQuestionsSortField = (typeof GENERATED_QUESTIONS_SORT_FIELDS)[number];
export type GeneratedQuestionsSortOrder = (typeof GENERATED_QUESTIONS_SORT_ORDERS)[number];

export interface GetGeneratedQuestionsForApplicantQuery {
  applicantId: string;
  page: number;
  size: number;
  sort: GeneratedQuestionsSortField;
  order: GeneratedQuestionsSortOrder;
}

export interface GeneratedQuestionListItemDto {
  question_id: string;
  analysis_run_id: string;
  category: string;
  question_text: string;
  intent: string | null;
  priority: number | null;
}

export interface GeneratedQuestionsListResultDto {
  items: GeneratedQuestionListItemDto[];
  total: number;
  page: number;
  size: number;
}

export interface GeneratedQuestionsListResult {
  items: GeneratedQuestionsEntity[];
  total: number;
  page: number;
  size: number;
}

export const toGeneratedQuestionListItemDto = (
  question: GeneratedQuestionsEntity,
): GeneratedQuestionListItemDto => ({
  question_id: question.id,
  analysis_run_id: question.analysisRunId,
  category: question.category,
  question_text: question.questionText,
  intent: question.intent ?? null,
  priority: question.priority ?? null,
});

export const toGeneratedQuestionsListResultDto = (
  result: GeneratedQuestionsListResult,
): GeneratedQuestionsListResultDto => ({
  items: result.items.map(toGeneratedQuestionListItemDto),
  total: result.total,
  page: result.page,
  size: result.size,
});
