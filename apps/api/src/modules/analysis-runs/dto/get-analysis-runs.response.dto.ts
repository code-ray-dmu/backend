import { AnalysisRunStatus, AnalysisStage } from '@app/core';

export interface AnalysisRunListItemResponseDto {
  analysis_run_id: string;
  applicant_id: string;
  repository_id: string;
  status: AnalysisRunStatus;
  current_stage?: AnalysisStage;
  started_at?: Date;
  completed_at?: Date;
  failure_reason?: string | null;
}

export interface GetAnalysisRunsResponseDto {
  data: AnalysisRunListItemResponseDto[];
  meta: {
    page: number;
    size: number;
    total: number;
  };
}
