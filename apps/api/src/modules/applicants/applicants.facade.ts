import { Injectable } from '@nestjs/common';
import { AnalysisRunsFacade } from '../analysis-runs/analysis-runs.facade';
import { CreateAnalysisRunsResponseDto } from '../analysis-runs/dto';
import { GeneratedQuestionsFacade } from '../generated-questions/generated-questions.facade';
import { GeneratedQuestionsListResultDto } from '../generated-questions/dto';
import {
  ApplicantDetailDto,
  ApplicantsPageResultDto,
  CreateApplicantDto,
  CreateApplicantResultDto,
  GetApplicantQuestionsQueryDto,
  GetApplicantsQueryDto,
} from './dto';
import { ApplicantsService } from './applicants.service';

@Injectable()
export class ApplicantsFacade {
  constructor(
    private readonly applicantsService: ApplicantsService,
    private readonly analysisRunsFacade: AnalysisRunsFacade,
    private readonly generatedQuestionsFacade: GeneratedQuestionsFacade,
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

  async getApplicantQuestions(
    applicantId: string,
    currentUserId: string,
    query: GetApplicantQuestionsQueryDto,
  ): Promise<GeneratedQuestionsListResultDto> {
    await this.applicantsService.getApplicantOwnership(applicantId, currentUserId);

    return this.generatedQuestionsFacade.getQuestionsForApplicant({
      applicantId,
      page: query.page,
      size: query.size,
      sort: query.sort,
      order: query.order,
    });
  }
}
