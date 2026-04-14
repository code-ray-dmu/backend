import 'reflect-metadata';

import { AnalysisRunsFacade } from '../analysis-runs/analysis-runs.facade';
import { GetApplicantsQueryDto } from './dto';
import { ApplicantsFacade } from './applicants.facade';
import { ApplicantsService } from './applicants.service';

describe('ApplicantsFacade', () => {
  let facade: ApplicantsFacade;
  let applicantsService: jest.Mocked<ApplicantsService>;
  let analysisRunsFacade: jest.Mocked<AnalysisRunsFacade>;

  beforeEach((): void => {
    applicantsService = {
      createApplicant: jest.fn(),
      getApplicants: jest.fn(),
      getApplicant: jest.fn(),
    } as unknown as jest.Mocked<ApplicantsService>;

    analysisRunsFacade = {
      requestAnalysisRuns: jest.fn(),
    } as unknown as jest.Mocked<AnalysisRunsFacade>;

    facade = new ApplicantsFacade(applicantsService, analysisRunsFacade);
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
      analysisRunIds: ['run-1'],
    });

    await expect(facade.requestQuestions('applicant-1', 'user-1')).resolves.toEqual({
      success: true,
      analysisRunIds: ['run-1'],
    });

    expect(analysisRunsFacade.requestAnalysisRuns).toHaveBeenCalledWith('applicant-1', 'user-1');
  });
});
