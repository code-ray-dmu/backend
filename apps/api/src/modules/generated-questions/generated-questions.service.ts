import { Injectable, NotImplementedException } from '@nestjs/common';
import {
  GeneratedQuestionsListResultDto,
  GetGeneratedQuestionsForApplicantQuery,
} from './dto';

@Injectable()
export class GeneratedQuestionsService {
  async getQuestionsForApplicant(
    _query: GetGeneratedQuestionsForApplicantQuery,
  ): Promise<GeneratedQuestionsListResultDto> {
    throw new NotImplementedException('Applicant question lookup is not implemented yet.');
  }
}
