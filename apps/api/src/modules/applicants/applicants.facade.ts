import { Injectable } from '@nestjs/common';
import { RequestApplicantAnalysisResult } from '../analysis-runs/dto';
import { AnalysisRunsFacade } from '../analysis-runs/analysis-runs.facade';
import { GeneratedQuestionsListResultDto } from '../generated-questions/dto';
import { GeneratedQuestionsFacade } from '../generated-questions/generated-questions.facade';
import { ApplicantGithubReposService } from './applicant-github-repos.service';
import {
  ApplicantDetailDto,
  ApplicantGithubRepositoryDto,
  ApplicantQuestionsPageResultDto,
  ApplicantsPageResultDto,
  CreateApplicantDto,
  CreateApplicantQuestionsResultDto,
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
    private readonly applicantGithubReposService: ApplicantGithubReposService,
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

  async getGithubRepos(applicantId: string, userId: string): Promise<ApplicantGithubRepositoryDto[]> {
    const ownership = await this.applicantsService.getApplicantOwnership(applicantId, userId);

    return this.applicantGithubReposService.getGithubReposForApplicant(ownership.githubUrl);
  }

  async createQuestions(
    applicantId: string,
    userId: string,
  ): Promise<CreateApplicantQuestionsResultDto> {
    await this.applicantsService.getApplicantOwnership(applicantId, userId);

    const result: RequestApplicantAnalysisResult = await this.analysisRunsFacade.requestQuestionsForApplicant({
      applicantId,
    });

    return {
      success: result.success,
      analysis_run_ids: result.analysis_run_ids,
    };
  }

  async getQuestions(
    applicantId: string,
    userId: string,
    query: GetApplicantQuestionsQueryDto,
  ): Promise<ApplicantQuestionsPageResultDto> {
    await this.applicantsService.getApplicantOwnership(applicantId, userId);

    const result: GeneratedQuestionsListResultDto =
      await this.generatedQuestionsFacade.getQuestionsForApplicant({
        applicantId,
        page: query.page,
        size: query.size,
        sort: query.sort,
        order: query.order,
      });

    return {
      items: result.items.map((item) => ({
        question_id: item.question_id,
        analysis_run_id: item.analysis_run_id,
        category: item.category,
        question_text: item.question_text,
        intent: item.intent,
        priority: item.priority,
      })),
      total: result.total,
      page: result.page,
      size: result.size,
    };
  }
}
