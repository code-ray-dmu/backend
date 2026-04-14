import { Injectable } from '@nestjs/common';
import {
  CreateAnalysisRunsResponseDto,
  GetAnalysisRunResponseDto,
  GetAnalysisRunsQueryDto,
  GetAnalysisRunsResponseDto,
} from './dto';
import { AnalysisRunsService } from './analysis-runs.service';

@Injectable()
export class AnalysisRunsFacade {
  constructor(private readonly analysisRunsService: AnalysisRunsService) {}

  async requestAnalysisRuns(
    applicantId: string,
    currentUserId: string,
  ): Promise<CreateAnalysisRunsResponseDto> {
    return this.analysisRunsService.requestAnalysisRuns(applicantId, currentUserId);
  }

  async getAnalysisRunStatus(
    analysisRunId: string,
    currentUserId: string,
  ): Promise<GetAnalysisRunResponseDto> {
    return this.analysisRunsService.getAnalysisRunStatus(analysisRunId, currentUserId);
  }

  async getAnalysisRuns(
    query: GetAnalysisRunsQueryDto,
    currentUserId: string,
  ): Promise<GetAnalysisRunsResponseDto> {
    return this.analysisRunsService.getAnalysisRuns(query, currentUserId);
  }
}
