import { Injectable } from '@nestjs/common';
import {
  GeneratedQuestionsListResultDto,
  GetGeneratedQuestionsForApplicantQuery,
  toGeneratedQuestionsListResultDto,
} from './dto';
import { GeneratedQuestionsRepository } from './repositories/generated-questions.repository';

@Injectable()
export class GeneratedQuestionsService {
  constructor(
    private readonly generatedQuestionsRepository: GeneratedQuestionsRepository,
  ) {}

  async getQuestionsForApplicant(
    query: GetGeneratedQuestionsForApplicantQuery,
  ): Promise<GeneratedQuestionsListResultDto> {
    const result = await this.generatedQuestionsRepository.getQuestionsForApplicant(query);

    return toGeneratedQuestionsListResultDto(result);
  }
}
