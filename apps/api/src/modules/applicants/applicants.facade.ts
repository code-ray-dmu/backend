import { Injectable } from '@nestjs/common';
import { AnalysisRunsFacade } from '../analysis-runs/analysis-runs.facade';
import { CreateAnalysisRunsResponseDto } from '../analysis-runs/dto';
import {
  ApplicantDetailDto,
  ApplicantsPageResultDto,
  CreateApplicantDto,
  CreateApplicantResultDto,
  GetApplicantsQueryDto,
} from './dto';
import { ApplicantsService } from './applicants.service';

@Injectable()
export class ApplicantsFacade {
  constructor(
    private readonly applicantsService: ApplicantsService,
    private readonly analysisRunsFacade: AnalysisRunsFacade,
  ) {}

  async createApplicant(
    userId: string,
    input: CreateApplicantDto,
  ): Promise<CreateApplicantResultDto> {
    return this.applicantsService.createApplicant(userId, input);
  }

  async getApplicants(userId: string, query: GetApplicantsQueryDto): Promise<ApplicantsPageResultDto> {
    return this.applicantsService.getApplicants(userId, query);
  }

  async getApplicant(applicantId: string, userId: string): Promise<ApplicantDetailDto> {
    return this.applicantsService.getApplicant(applicantId, userId);
  }

  async requestQuestions(
    applicantId: string,
    currentUserId: string,
  ): Promise<CreateAnalysisRunsResponseDto> {
    return this.analysisRunsFacade.requestAnalysisRuns(applicantId, currentUserId);
  }
}
