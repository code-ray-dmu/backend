import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiSuccessBody, createApiSuccessBody } from '../../common/dto';
import { ApiExceptionFilter } from '../../common/filters';
import { CreateAnalysisRunsResponseDto } from '../analysis-runs/dto';
import { JwtAuthGuard } from '../auth/guards';
import { GeneratedQuestionListItemDto } from '../generated-questions/dto';
import { CurrentUserId } from '../groups/decorators/current-user-id.decorator';
import {
  ApplicantDetailDto,
  ApplicantListItemDto,
  ApplicantsPageResultDto,
  CreateApplicantDto,
  CreateApplicantResultDto,
  GetApplicantQuestionsQueryDto,
  GetApplicantsQueryDto,
} from './dto';
import { ApplicantsFacade } from './applicants.facade';

@UseFilters(ApiExceptionFilter)
@UseGuards(JwtAuthGuard)
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
    @Param('applicantId', new ParseUUIDPipe()) applicantId: string,
  ): Promise<ApiSuccessBody<ApplicantDetailDto>> {
    const applicant = await this.applicantsFacade.getApplicant(applicantId, userId);

    return createApiSuccessBody(applicant);
  }

  @Post(':applicantId/questions')
  async requestQuestions(
    @CurrentUserId() userId: string,
    @Param('applicantId', new ParseUUIDPipe()) applicantId: string,
  ): Promise<ApiSuccessBody<CreateAnalysisRunsResponseDto>> {
    const result = await this.applicantsFacade.requestQuestions(applicantId, userId);

    return createApiSuccessBody(result);
  }

  @Get(':applicantId/questions')
  async getApplicantQuestions(
    @CurrentUserId() userId: string,
    @Param('applicantId', new ParseUUIDPipe()) applicantId: string,
    @Query() query: GetApplicantQuestionsQueryDto,
  ): Promise<ApiSuccessBody<GeneratedQuestionListItemDto[]>> {
    const result = await this.applicantsFacade.getApplicantQuestions(applicantId, userId, query);

    return createApiSuccessBody(result.items, {
      page: result.page,
      size: result.size,
      total: result.total,
    });
  }
}
