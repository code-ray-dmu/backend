import 'reflect-metadata';

import { GeneratedQuestionsEntity } from '@app/database';
import { GeneratedQuestionsRepository } from './repositories/generated-questions.repository';
import { GeneratedQuestionsService } from './generated-questions.service';

describe('GeneratedQuestionsService', () => {
  let service: GeneratedQuestionsService;
  let generatedQuestionsRepository: jest.Mocked<GeneratedQuestionsRepository>;

  beforeEach((): void => {
    generatedQuestionsRepository = {
      getQuestionsForApplicant: jest.fn(),
    } as unknown as jest.Mocked<GeneratedQuestionsRepository>;

    service = new GeneratedQuestionsService(generatedQuestionsRepository);
  });

  it('maps generated question entities to API dto contracts', async (): Promise<void> => {
    generatedQuestionsRepository.getQuestionsForApplicant.mockResolvedValue({
      items: [
        {
          id: 'question-1',
          analysisRunId: 'analysis-run-1',
          applicantId: 'applicant-1',
          category: 'SKILL',
          questionText: 'What trade-off did you make?',
          intent: undefined,
          priority: undefined,
        } as unknown as GeneratedQuestionsEntity,
      ],
      total: 1,
      page: 1,
      size: 10,
    });

    await expect(
      service.getQuestionsForApplicant({
        applicantId: 'applicant-1',
        page: 1,
        size: 10,
        sort: 'priority',
        order: 'asc',
      }),
    ).resolves.toEqual({
      items: [
        {
          question_id: 'question-1',
          analysis_run_id: 'analysis-run-1',
          category: 'SKILL',
          question_text: 'What trade-off did you make?',
          intent: null,
          priority: null,
        },
      ],
      total: 1,
      page: 1,
      size: 10,
    });
  });
});
