import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { CreateAnalysisRunsResponseDto } from '../analysis-runs/dto';
import { JwtAuthGuard } from '../auth/guards';
import { JwtPayload } from '../auth/interfaces';
import { ApplicantsFacade } from './applicants.facade';

@Controller('applicants')
export class ApplicantsController {
  constructor(private readonly applicantsFacade: ApplicantsFacade) {}

  @UseGuards(JwtAuthGuard)
  @Post(':applicantId/questions')
  async requestQuestions(
    @Param('applicantId', new ParseUUIDPipe()) applicantId: string,
    @CurrentUser() currentUser?: JwtPayload,
  ): Promise<CreateAnalysisRunsResponseDto> {
    if (!currentUser?.sub) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    return this.applicantsFacade.requestQuestions(applicantId, currentUser.sub);
  }
}
