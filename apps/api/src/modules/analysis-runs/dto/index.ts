export interface RequestApplicantAnalysisInput {
  applicantId: string;
}

export interface RequestApplicantAnalysisResult {
  success: boolean;
  analysis_run_ids: string[];
}
