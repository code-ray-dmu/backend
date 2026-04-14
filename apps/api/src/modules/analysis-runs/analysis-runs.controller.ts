import {
  Controller,
  Get,
  Query,
  Param,
  ParseUUIDPipe,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { JwtAuthGuard } from '../auth/guards';
import { JwtPayload } from '../auth/interfaces';
import {
  GetAnalysisRunResponseDto,
  GetAnalysisRunsQueryDto,
  GetAnalysisRunsResponseDto,
} from './dto';
import { AnalysisRunsFacade } from './analysis-runs.facade';

@Controller('analysis-runs')
export class AnalysisRunsController {
  constructor(private readonly analysisRunsFacade: AnalysisRunsFacade) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getAnalysisRuns(
    @Query() query: GetAnalysisRunsQueryDto,
    @CurrentUser() currentUser?: JwtPayload,
  ): Promise<GetAnalysisRunsResponseDto> {
    if (!currentUser?.sub) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    return this.analysisRunsFacade.getAnalysisRuns(query, currentUser.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':analysisRunId')
  async getAnalysisRunStatus(
    @Param('analysisRunId', new ParseUUIDPipe()) analysisRunId: string,
    @CurrentUser() currentUser?: JwtPayload,
  ): Promise<GetAnalysisRunResponseDto> {
    if (!currentUser?.sub) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    return this.analysisRunsFacade.getAnalysisRunStatus(analysisRunId, currentUser.sub);
  }
}
