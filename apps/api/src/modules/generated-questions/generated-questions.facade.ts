import { Injectable } from '@nestjs/common';
import {
  GeneratedQuestionsListResultDto,
  GetGeneratedQuestionsForApplicantQuery,
} from './dto';
import { GeneratedQuestionsService } from './generated-questions.service';

@Injectable()
export class GeneratedQuestionsFacade {
  constructor(private readonly generatedQuestionsService: GeneratedQuestionsService) {}

  async getQuestionsForApplicant(
    query: GetGeneratedQuestionsForApplicantQuery,
  ): Promise<GeneratedQuestionsListResultDto> {
    return this.generatedQuestionsService.getQuestionsForApplicant(query);
  }
}
