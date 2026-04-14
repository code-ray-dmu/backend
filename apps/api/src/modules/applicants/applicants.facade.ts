import { Injectable } from '@nestjs/common';
import { AnalysisRunsFacade } from '../analysis-runs/analysis-runs.facade';
import { CreateAnalysisRunsResponseDto } from '../analysis-runs/dto';

@Injectable()
export class ApplicantsFacade {
  constructor(private readonly analysisRunsFacade: AnalysisRunsFacade) {}

  async requestQuestions(
    applicantId: string,
    currentUserId: string,
  ): Promise<CreateAnalysisRunsResponseDto> {
    return this.analysisRunsFacade.requestAnalysisRuns(applicantId, currentUserId);
  }
}
