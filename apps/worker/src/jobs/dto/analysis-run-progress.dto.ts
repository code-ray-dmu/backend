import { AnalysisRunStatus, AnalysisStage } from '@app/core';

export interface AnalysisRunProgressDto {
  analysisRunId: string;
  repositoryId: string;
  status: AnalysisRunStatus;
  currentStage: AnalysisStage;
  updatedAt: string;
}
