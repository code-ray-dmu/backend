import { AnalysisRunStatus, AnalysisStage } from '@app/core';

export interface GetAnalysisRunResponseDto {
  analysis_run_id: string;
  status: AnalysisRunStatus;
  current_stage?: AnalysisStage;
  started_at?: Date;
  completed_at?: Date;
  failure_reason?: string | null;
}
