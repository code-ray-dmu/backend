import { Injectable, NotImplementedException } from '@nestjs/common';
import { RequestApplicantAnalysisInput, RequestApplicantAnalysisResult } from './dto';

@Injectable()
export class AnalysisRunsService {
  async requestQuestionsForApplicant(
    _input: RequestApplicantAnalysisInput,
  ): Promise<RequestApplicantAnalysisResult> {
    throw new NotImplementedException('Applicant question creation is not implemented yet.');
  }
}
