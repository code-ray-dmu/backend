import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiSuccessBody, createApiSuccessBody } from '../../common/dto';
import { ApiExceptionFilter } from '../../common/filters';
import { ApiResponseEnvelopeInterceptor } from '../../common/interceptors';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUserId } from '../groups/decorators/current-user-id.decorator';
import {
  ApplicantDetailDto,
  ApplicantGithubRepositoryDto,
  ApplicantListItemDto,
  ApplicantQuestionListItemDto,
  ApplicantQuestionsPageResultDto,
  ApplicantsPageResultDto,
  CreateApplicantDto,
  CreateApplicantQuestionsResultDto,
  CreateApplicantResultDto,
  GetApplicantQuestionsQueryDto,
  GetApplicantsQueryDto,
} from './dto';
import { ApplicantsFacade } from './applicants.facade';

@UseFilters(ApiExceptionFilter)
@UseGuards(JwtAuthGuard)
@UseInterceptors(ApiResponseEnvelopeInterceptor)
@Controller('applicants')
export class ApplicantsController {
  constructor(private readonly applicantsFacade: ApplicantsFacade) {}

  @Post()
  async createApplicant(
    @CurrentUserId() userId: string,
    @Body() body: CreateApplicantDto,
  ): Promise<ApiSuccessBody<CreateApplicantResultDto>> {
    const applicant = await this.applicantsFacade.createApplicant(userId, body);

    return createApiSuccessBody(applicant);
  }

  @Get()
  async getApplicants(
    @CurrentUserId() userId: string,
    @Query() query: GetApplicantsQueryDto,
  ): Promise<ApiSuccessBody<ApplicantListItemDto[]>> {
    const result: ApplicantsPageResultDto = await this.applicantsFacade.getApplicants(userId, query);

    return createApiSuccessBody(result.items, {
      page: result.page,
      size: result.size,
      total: result.total,
    });
  }

  @Get(':applicantId')
  async getApplicant(
    @CurrentUserId() userId: string,
    @Param('applicantId') applicantId: string,
  ): Promise<ApiSuccessBody<ApplicantDetailDto>> {
    const applicant = await this.applicantsFacade.getApplicant(applicantId, userId);

    return createApiSuccessBody(applicant);
  }

  @Get(':applicantId/github-repos')
  async getGithubRepos(
    @CurrentUserId() userId: string,
    @Param('applicantId') applicantId: string,
  ): Promise<ApiSuccessBody<ApplicantGithubRepositoryDto[]>> {
    const repositories = await this.applicantsFacade.getGithubRepos(applicantId, userId);

    return createApiSuccessBody(repositories);
  }

  @Post(':applicantId/questions')
  async createQuestions(
    @CurrentUserId() userId: string,
    @Param('applicantId') applicantId: string,
  ): Promise<ApiSuccessBody<CreateApplicantQuestionsResultDto>> {
    const result: CreateApplicantQuestionsResultDto = await this.applicantsFacade.createQuestions(
      applicantId,
      userId,
    );

    return createApiSuccessBody(result);
  }

  @Get(':applicantId/questions')
  async getQuestions(
    @CurrentUserId() userId: string,
    @Param('applicantId') applicantId: string,
    @Query() query: GetApplicantQuestionsQueryDto,
  ): Promise<ApiSuccessBody<ApplicantQuestionListItemDto[]>> {
    const result: ApplicantQuestionsPageResultDto = await this.applicantsFacade.getQuestions(
      applicantId,
      userId,
      query,
    );

    return createApiSuccessBody(result.items, {
      page: result.page,
      size: result.size,
      total: result.total,
    });
  }
}
