import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { ApplicantsSortOrder } from './get-applicants-query.dto';

export const APPLICANT_QUESTIONS_SORT_FIELDS = ['createdAt', 'priority'] as const;

export type ApplicantQuestionsSortField = (typeof APPLICANT_QUESTIONS_SORT_FIELDS)[number];

export class GetApplicantQuestionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
    page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
    size: number = 10;

  @IsOptional()
  @IsIn(APPLICANT_QUESTIONS_SORT_FIELDS)
    sort: ApplicantQuestionsSortField = 'priority';

  @IsOptional()
  @IsIn(['asc', 'desc'])
    order: ApplicantsSortOrder = 'asc';
}

export interface ApplicantGithubRepositoryDto {
  repo_name: string;
  repo_full_name: string;
  repo_url: string;
  default_branch: string;
  updated_at: string;
}

export interface CreateApplicantQuestionsResultDto {
  success: boolean;
  analysis_run_ids: string[];
}

export interface ApplicantQuestionListItemDto {
  question_id: string;
  analysis_run_id: string;
  category: string;
  question_text: string;
  intent: string | null;
  priority: number | null;
}

export interface ApplicantQuestionsPageResultDto {
  items: ApplicantQuestionListItemDto[];
  total: number;
  page: number;
  size: number;
}
