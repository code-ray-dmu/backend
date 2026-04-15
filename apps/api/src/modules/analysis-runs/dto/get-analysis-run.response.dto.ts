import { AnalysisRunStatus, AnalysisStage } from '@app/core';

export interface GetAnalysisRunResponseDto {
  analysis_run_id: string;
  status: AnalysisRunStatus;
  current_stage: AnalysisStage | null;
  started_at: Date | null;
  completed_at: Date | null;
  failure_reason: string | null;
}
