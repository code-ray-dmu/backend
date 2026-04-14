import 'reflect-metadata';

import { ForbiddenException } from '@nestjs/common';
import {
  EXCEPTION_FILTERS_METADATA,
  GUARDS_METADATA,
  INTERCEPTORS_METADATA,
} from '@nestjs/common/constants';
import { ArgumentsHost } from '@nestjs/common/interfaces';
import { of, lastValueFrom } from 'rxjs';
import { ApiExceptionFilter } from '../../common/filters';
import { ApiResponseEnvelopeInterceptor } from '../../common/interceptors';
import {
  ApplicantNotFoundException,
  GroupNotFoundException,
} from '../../common/exceptions';
import { JwtAuthGuard } from '../auth/guards';
import {
  CreateApplicantDto,
  GetApplicantQuestionsQueryDto,
  GetApplicantsQueryDto,
} from './dto';
import { ApplicantsController } from './applicants.controller';
import { ApplicantsFacade } from './applicants.facade';

describe('ApplicantsController', () => {
  let controller: ApplicantsController;
  let facade: jest.Mocked<ApplicantsFacade>;
  let responseStatus: jest.Mock;
  let responseJson: jest.Mock;

  beforeEach((): void => {
    facade = {
      createApplicant: jest.fn(),
      getApplicants: jest.fn(),
      getApplicant: jest.fn(),
      getGithubRepos: jest.fn(),
      createQuestions: jest.fn(),
      getQuestions: jest.fn(),
    } as unknown as jest.Mocked<ApplicantsFacade>;

    controller = new ApplicantsController(facade);
    responseStatus = jest.fn().mockReturnThis();
    responseJson = jest.fn();
  });

  it('applies the applicants auth and response contract decorators', (): void => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      ApplicantsController,
    ) as Array<new () => unknown>;
    const interceptors = Reflect.getMetadata(
      INTERCEPTORS_METADATA,
      ApplicantsController,
    ) as Array<new () => unknown>;
    const filters = Reflect.getMetadata(
      EXCEPTION_FILTERS_METADATA,
      ApplicantsController,
    ) as Array<new () => unknown>;

    expect(guards).toContain(JwtAuthGuard);
    expect(interceptors).toContain(ApiResponseEnvelopeInterceptor);
    expect(filters).toContain(ApiExceptionFilter);
  });

  it('returns an enveloped body for POST /applicants', async (): Promise<void> => {
    const body: CreateApplicantDto = {
      groupId: 'group-1',
      name: 'candidate',
      email: 'candidate@example.com',
      githubUrl: 'https://github.com/example-user',
    };

    facade.createApplicant.mockResolvedValue({
      applicant_id: 'applicant-1',
    });

    await expect(controller.createApplicant('user-1', body)).resolves.toEqual({
      __apiSuccessBody: true,
      data: {
        applicant_id: 'applicant-1',
      },
      meta: undefined,
    });

    expect(facade.createApplicant).toHaveBeenCalledWith('user-1', body);
  });

  it('returns an enveloped body for GET /applicants with pagination meta', async (): Promise<void> => {
    const query = new GetApplicantsQueryDto();
    query.page = 1;
    query.size = 20;
    query.sort = 'createdAt';
    query.order = 'desc';

    facade.getApplicants.mockResolvedValue({
      items: [
        {
          applicant_id: 'applicant-1',
          group_id: 'group-1',
          name: 'candidate',
          email: 'candidate@example.com',
          github_url: 'https://github.com/example-user',
          created_at: '2026-04-08T15:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      size: 20,
    });

    await expect(controller.getApplicants('user-1', query)).resolves.toEqual({
      __apiSuccessBody: true,
      data: [
        {
          applicant_id: 'applicant-1',
          group_id: 'group-1',
          name: 'candidate',
          email: 'candidate@example.com',
          github_url: 'https://github.com/example-user',
          created_at: '2026-04-08T15:00:00.000Z',
        },
      ],
      meta: {
        page: 1,
        size: 20,
        total: 1,
      },
    });
  });

  it('returns an enveloped body for GET /applicants/:applicantId', async (): Promise<void> => {
    facade.getApplicant.mockResolvedValue({
      applicant_id: 'applicant-1',
      group_id: 'group-1',
      name: 'candidate',
      email: 'candidate@example.com',
      github_url: 'https://github.com/example-user',
    });

    await expect(controller.getApplicant('user-1', 'applicant-1')).resolves.toEqual({
      __apiSuccessBody: true,
      data: {
        applicant_id: 'applicant-1',
        group_id: 'group-1',
        name: 'candidate',
        email: 'candidate@example.com',
        github_url: 'https://github.com/example-user',
      },
      meta: undefined,
    });
  });

  it('returns an enveloped body for GET /applicants/:applicantId/github-repos', async (): Promise<void> => {
    facade.getGithubRepos.mockResolvedValue([
      {
        repo_name: 'repo-1',
        repo_full_name: 'example-user/repo-1',
        repo_url: 'https://github.com/example-user/repo-1',
        default_branch: 'main',
        updated_at: '2026-04-08T15:00:00.000Z',
      },
    ]);

    await expect(controller.getGithubRepos('user-1', 'applicant-1')).resolves.toEqual({
      __apiSuccessBody: true,
      data: [
        {
          repo_name: 'repo-1',
          repo_full_name: 'example-user/repo-1',
          repo_url: 'https://github.com/example-user/repo-1',
          default_branch: 'main',
          updated_at: '2026-04-08T15:00:00.000Z',
        },
      ],
      meta: undefined,
    });

    expect(facade.getGithubRepos).toHaveBeenCalledWith('applicant-1', 'user-1');
  });

  it('returns an enveloped body for POST /applicants/:applicantId/questions', async (): Promise<void> => {
    facade.createQuestions.mockResolvedValue({
      success: true,
      analysis_run_ids: ['run-1', 'run-2'],
    });

    await expect(controller.createQuestions('user-1', 'applicant-1')).resolves.toEqual({
      __apiSuccessBody: true,
      data: {
        success: true,
        analysis_run_ids: ['run-1', 'run-2'],
      },
      meta: undefined,
    });

    expect(facade.createQuestions).toHaveBeenCalledWith('applicant-1', 'user-1');
  });

  it('returns an enveloped body for GET /applicants/:applicantId/questions with pagination meta', async (): Promise<void> => {
    const query = new GetApplicantQuestionsQueryDto();
    query.page = 1;
    query.size = 10;
    query.sort = 'priority';
    query.order = 'asc';

    facade.getQuestions.mockResolvedValue({
      items: [
        {
          question_id: 'question-1',
          analysis_run_id: 'run-1',
          category: 'SKILL',
          question_text: 'What did you optimize here?',
          intent: 'Understand reasoning',
          priority: 1,
        },
      ],
      total: 1,
      page: 1,
      size: 10,
    });

    await expect(controller.getQuestions('user-1', 'applicant-1', query)).resolves.toEqual({
      __apiSuccessBody: true,
      data: [
        {
          question_id: 'question-1',
          analysis_run_id: 'run-1',
          category: 'SKILL',
          question_text: 'What did you optimize here?',
          intent: 'Understand reasoning',
          priority: 1,
        },
      ],
      meta: {
        page: 1,
        size: 10,
        total: 1,
      },
    });

    expect(facade.getQuestions).toHaveBeenCalledWith('applicant-1', 'user-1', query);
  });

  it('produces the final success envelope through the response interceptor', async (): Promise<void> => {
    const interceptor = new ApiResponseEnvelopeInterceptor();

    const result = await lastValueFrom(
      interceptor.intercept(
        {
          switchToHttp: (): { getRequest: () => { requestId: string } } => ({
            getRequest: () => ({
              requestId: 'request-1',
            }),
          }),
        } as never,
        {
          handle: () =>
            of({
              __apiSuccessBody: true as const,
              data: {
                applicant_id: 'applicant-1',
              },
            }),
        },
      ),
    );

    expect(result).toEqual({
      data: {
        applicant_id: 'applicant-1',
      },
      meta: {
        request_id: 'request-1',
      },
      error: null,
    });
  });

  it.each([
    [new GroupNotFoundException(), 404, 'GROUP_NOT_FOUND'],
    [new ApplicantNotFoundException(), 404, 'APPLICANT_NOT_FOUND'],
    [new ForbiddenException(), 403, 'FORBIDDEN_RESOURCE_ACCESS'],
  ])(
    'renders %p through the API exception filter contract',
    (exception, expectedStatus, expectedCode): void => {
      const filter = new ApiExceptionFilter();

      filter.catch(
        exception,
        {
          switchToHttp: (): {
            getResponse: () => { status: jest.Mock; json: jest.Mock };
            getRequest: () => Record<string, unknown>;
          } => ({
            getResponse: () => ({
              status: responseStatus,
              json: responseJson,
            }),
            getRequest: () => ({
              method: 'GET',
              url: '/v1/applicants',
            }),
          }),
        } as ArgumentsHost,
      );

      expect(responseStatus).toHaveBeenCalledWith(expectedStatus);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          data: null,
          meta: expect.objectContaining({
            request_id: expect.any(String),
          }),
          error: expect.objectContaining({
            code: expectedCode,
          }),
        }),
      );
    },
  );
});
