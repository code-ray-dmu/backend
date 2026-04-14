import 'reflect-metadata';

import { AnalysisRunsFacade } from '../analysis-runs/analysis-runs.facade';
import { GeneratedQuestionsFacade } from '../generated-questions/generated-questions.facade';
import { ApplicantGithubReposService } from './applicant-github-repos.service';
import { GetApplicantQuestionsQueryDto, GetApplicantsQueryDto } from './dto';
import { ApplicantsFacade } from './applicants.facade';
import { ApplicantsService } from './applicants.service';

describe('ApplicantsFacade', () => {
  let facade: ApplicantsFacade;
  let applicantsService: jest.Mocked<ApplicantsService>;
  let analysisRunsFacade: jest.Mocked<AnalysisRunsFacade>;
  let generatedQuestionsFacade: jest.Mocked<GeneratedQuestionsFacade>;
  let applicantGithubReposService: jest.Mocked<ApplicantGithubReposService>;

  beforeEach((): void => {
    applicantsService = {
      createApplicant: jest.fn(),
      getApplicants: jest.fn(),
      getApplicant: jest.fn(),
      getApplicantOwnership: jest.fn(),
    } as unknown as jest.Mocked<ApplicantsService>;

    analysisRunsFacade = {
      requestQuestionsForApplicant: jest.fn(),
    } as unknown as jest.Mocked<AnalysisRunsFacade>;

    generatedQuestionsFacade = {
      getQuestionsForApplicant: jest.fn(),
    } as unknown as jest.Mocked<GeneratedQuestionsFacade>;

    applicantGithubReposService = {
      getGithubReposForApplicant: jest.fn(),
    } as unknown as jest.Mocked<ApplicantGithubReposService>;

    facade = new ApplicantsFacade(
      applicantsService,
      analysisRunsFacade,
      generatedQuestionsFacade,
      applicantGithubReposService,
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

  it('delegates github repo lookup after ownership verification', async (): Promise<void> => {
    applicantsService.getApplicantOwnership.mockResolvedValue({
      applicantId: 'applicant-1',
      groupId: 'group-1',
      groupUserId: 'user-1',
      githubUrl: 'https://github.com/example-user',
    });
    applicantGithubReposService.getGithubReposForApplicant.mockResolvedValue([
      {
        repo_name: 'repo-1',
        repo_full_name: 'example-user/repo-1',
        repo_url: 'https://github.com/example-user/repo-1',
        default_branch: 'main',
        updated_at: '2026-04-08T15:00:00.000Z',
      },
    ]);

    await expect(facade.getGithubRepos('applicant-1', 'user-1')).resolves.toEqual([
      {
        repo_name: 'repo-1',
        repo_full_name: 'example-user/repo-1',
        repo_url: 'https://github.com/example-user/repo-1',
        default_branch: 'main',
        updated_at: '2026-04-08T15:00:00.000Z',
      },
    ]);

    expect(applicantsService.getApplicantOwnership).toHaveBeenCalledWith('applicant-1', 'user-1');
    expect(applicantGithubReposService.getGithubReposForApplicant).toHaveBeenCalledWith(
      'https://github.com/example-user',
    );
  });

  it('delegates question creation to the analysis runs facade after ownership verification', async (): Promise<void> => {
    applicantsService.getApplicantOwnership.mockResolvedValue({
      applicantId: 'applicant-1',
      groupId: 'group-1',
      groupUserId: 'user-1',
      githubUrl: 'https://github.com/example-user',
    });
    analysisRunsFacade.requestQuestionsForApplicant.mockResolvedValue({
      success: true,
      analysis_run_ids: ['run-1'],
    });

    await expect(facade.createQuestions('applicant-1', 'user-1')).resolves.toEqual({
      success: true,
      analysis_run_ids: ['run-1'],
    });

    expect(applicantsService.getApplicantOwnership).toHaveBeenCalledWith('applicant-1', 'user-1');
    expect(analysisRunsFacade.requestQuestionsForApplicant).toHaveBeenCalledWith({
      applicantId: 'applicant-1',
    });
  });

  it('delegates applicant question queries to the generated questions facade', async (): Promise<void> => {
    const query = new GetApplicantQuestionsQueryDto();
    query.page = 2;
    query.size = 10;
    query.sort = 'priority';
    query.order = 'asc';

    applicantsService.getApplicantOwnership.mockResolvedValue({
      applicantId: 'applicant-1',
      groupId: 'group-1',
      groupUserId: 'user-1',
      githubUrl: 'https://github.com/example-user',
    });
    generatedQuestionsFacade.getQuestionsForApplicant.mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      size: 10,
    });

    await expect(facade.getQuestions('applicant-1', 'user-1', query)).resolves.toEqual({
      items: [],
      total: 0,
      page: 2,
      size: 10,
    });

    expect(applicantsService.getApplicantOwnership).toHaveBeenCalledWith('applicant-1', 'user-1');
    expect(generatedQuestionsFacade.getQuestionsForApplicant).toHaveBeenCalledWith({
      applicantId: 'applicant-1',
      page: 2,
      size: 10,
      sort: 'priority',
      order: 'asc',
    });
  });
});
