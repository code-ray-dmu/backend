import { Injectable } from '@nestjs/common';
import { RequestApplicantAnalysisInput, RequestApplicantAnalysisResult } from './dto';
import { AnalysisRunsService } from './analysis-runs.service';

@Injectable()
export class AnalysisRunsFacade {
  constructor(private readonly analysisRunsService: AnalysisRunsService) {}

  async requestQuestionsForApplicant(
    input: RequestApplicantAnalysisInput,
  ): Promise<RequestApplicantAnalysisResult> {
    return this.analysisRunsService.requestQuestionsForApplicant(input);
  }
}
