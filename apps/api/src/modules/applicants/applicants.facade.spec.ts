import 'reflect-metadata';

import { ForbiddenResourceAccessException } from '../../common/exceptions';
import { AnalysisRunsFacade } from '../analysis-runs/analysis-runs.facade';
import { GeneratedQuestionsFacade } from '../generated-questions/generated-questions.facade';
import { GetApplicantsQueryDto } from './dto';
import { ApplicantsFacade } from './applicants.facade';
import { ApplicantsService } from './applicants.service';

describe('ApplicantsFacade', () => {
  let facade: ApplicantsFacade;
  let applicantsService: jest.Mocked<ApplicantsService>;
  let analysisRunsFacade: jest.Mocked<AnalysisRunsFacade>;
  let generatedQuestionsFacade: jest.Mocked<GeneratedQuestionsFacade>;

  beforeEach((): void => {
    applicantsService = {
      createApplicant: jest.fn(),
      getApplicants: jest.fn(),
      getApplicant: jest.fn(),
      getApplicantOwnership: jest.fn(),
    } as unknown as jest.Mocked<ApplicantsService>;

    analysisRunsFacade = {
      requestAnalysisRuns: jest.fn(),
    } as unknown as jest.Mocked<AnalysisRunsFacade>;

    generatedQuestionsFacade = {
      getQuestionsForApplicant: jest.fn(),
    } as unknown as jest.Mocked<GeneratedQuestionsFacade>;

    facade = new ApplicantsFacade(
      applicantsService,
      analysisRunsFacade,
      generatedQuestionsFacade,
    );
  });

  it('delegates applicant list queries to the applicants service', async (): Promise<void> => {
    const query = new GetApplicantsQueryDto();
    query.page = 1;
    query.size = 20;
    query.sort = 'createdAt';
    query.order = 'desc';

    applicantsService.getApplicants.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      size: 20,
    });

    await expect(facade.getApplicants('user-1', query)).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      size: 20,
    });

    expect(applicantsService.getApplicants).toHaveBeenCalledWith('user-1', query);
  });

  it('delegates question creation to the analysis runs facade', async (): Promise<void> => {
    analysisRunsFacade.requestAnalysisRuns.mockResolvedValue({
      success: true,
      analysis_run_ids: ['run-1'],
    });

    await expect(facade.requestQuestions('applicant-1', 'user-1')).resolves.toEqual({
      success: true,
      analysis_run_ids: ['run-1'],
    });

    expect(analysisRunsFacade.requestAnalysisRuns).toHaveBeenCalledWith('applicant-1', 'user-1');
  });

  it('delegates applicant question list queries after ownership verification', async (): Promise<void> => {
    applicantsService.getApplicantOwnership.mockResolvedValue({
      applicantId: 'applicant-1',
      groupId: 'group-1',
      groupUserId: 'user-1',
      githubUrl: 'https://github.com/example-user',
    });
    generatedQuestionsFacade.getQuestionsForApplicant.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      size: 20,
    });

    await expect(
      facade.getApplicantQuestions('applicant-1', 'user-1', {
        page: 1,
        size: 20,
        sort: 'priority',
        order: 'asc',
      }),
    ).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      size: 20,
    });

    expect(applicantsService.getApplicantOwnership).toHaveBeenCalledWith('applicant-1', 'user-1');
    expect(generatedQuestionsFacade.getQuestionsForApplicant).toHaveBeenCalledWith({
      applicantId: 'applicant-1',
      page: 1,
      size: 20,
      sort: 'priority',
      order: 'asc',
    });
  });

  it('does not query generated questions when ownership validation fails', async (): Promise<void> => {
    applicantsService.getApplicantOwnership.mockRejectedValue(new ForbiddenResourceAccessException());

    await expect(
      facade.getApplicantQuestions('applicant-1', 'user-2', {
        page: 1,
        size: 20,
        sort: 'priority',
        order: 'asc',
      }),
    ).rejects.toBeInstanceOf(ForbiddenResourceAccessException);

    expect(generatedQuestionsFacade.getQuestionsForApplicant).not.toHaveBeenCalled();
  });
});
