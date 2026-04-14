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
  UseInterceptors,
} from '@nestjs/common';
import { ApiSuccessBody, createApiSuccessBody } from '../../common/dto';
import { ApiExceptionFilter } from '../../common/filters';
import { ApiResponseEnvelopeInterceptor } from '../../common/interceptors';
import { CreateAnalysisRunsResponseDto } from '../analysis-runs/dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUserId } from '../groups/decorators/current-user-id.decorator';
import {
  ApplicantDetailDto,
  ApplicantListItemDto,
  ApplicantsPageResultDto,
  CreateApplicantDto,
  CreateApplicantResultDto,
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
}
