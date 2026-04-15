import { AnalysisRunStatus, AnalysisStage } from '@app/core';
import { ApiSuccessBody } from '../../../common/dto';

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

export type GetAnalysisRunsResponseDto = ApiSuccessBody<
  AnalysisRunListItemResponseDto[]
>;
