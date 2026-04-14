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
