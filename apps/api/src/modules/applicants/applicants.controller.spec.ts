import 'reflect-metadata';

import { ForbiddenException } from '@nestjs/common';
import {
  EXCEPTION_FILTERS_METADATA,
  GUARDS_METADATA,
  INTERCEPTORS_METADATA,
} from '@nestjs/common/constants';
import { ArgumentsHost } from '@nestjs/common/interfaces';
import { lastValueFrom, of } from 'rxjs';
import { ApiExceptionFilter } from '../../common/filters';
import { ApiResponseEnvelopeInterceptor } from '../../common/interceptors';
import {
  ApplicantNotFoundException,
  GroupNotFoundException,
} from '../../common/exceptions';
import { JwtAuthGuard } from '../auth/guards';
import { CreateApplicantDto, GetApplicantsQueryDto } from './dto';
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
      requestQuestions: jest.fn(),
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

  it('returns an enveloped body for POST /applicants/:applicantId/questions', async (): Promise<void> => {
    facade.requestQuestions.mockResolvedValue({
      success: true,
      analysis_run_ids: ['run-1', 'run-2'],
    });

    await expect(
      controller.requestQuestions('user-1', '550e8400-e29b-41d4-a716-446655440010'),
    ).resolves.toEqual({
      __apiSuccessBody: true,
      data: {
        success: true,
        analysis_run_ids: ['run-1', 'run-2'],
      },
      meta: undefined,
    });

    expect(facade.requestQuestions).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440010',
      'user-1',
    );
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
                ok: true,
              },
              meta: {
                page: 1,
              },
            }),
        },
      ),
    );

    expect(result).toEqual({
      data: {
        ok: true,
      },
      meta: {
        page: 1,
        request_id: 'request-1',
      },
      error: null,
    });
  });

  it('maps applicant and group exceptions through the API filter', (): void => {
    const filter = new ApiExceptionFilter();
    const host = {
      switchToHttp: (): {
        getResponse: () => { status: jest.Mock; json: jest.Mock };
        getRequest: () => { requestId: string };
      } => ({
        getResponse: () => ({
          status: responseStatus,
          json: responseJson,
        }),
        getRequest: () => ({
          requestId: 'request-1',
        }),
      }),
    } as unknown as ArgumentsHost;

    filter.catch(new ApplicantNotFoundException(), host);

    expect(responseStatus).toHaveBeenCalledWith(404);
    expect(responseJson).toHaveBeenCalledWith({
      data: null,
      meta: {
        request_id: 'request-1',
      },
      error: {
        code: 'APPLICANT_NOT_FOUND',
        message: 'Applicant not found',
      },
    });

    responseStatus.mockClear();
    responseJson.mockClear();

    filter.catch(new GroupNotFoundException(), host);

    expect(responseStatus).toHaveBeenCalledWith(404);
    expect(responseJson).toHaveBeenCalledWith({
      data: null,
      meta: {
        request_id: 'request-1',
      },
      error: {
        code: 'GROUP_NOT_FOUND',
        message: 'Group not found',
      },
    });
  });

  it('maps forbidden exceptions through the API filter', (): void => {
    const filter = new ApiExceptionFilter();
    const host = {
      switchToHttp: (): {
        getResponse: () => { status: jest.Mock; json: jest.Mock };
        getRequest: () => { requestId: string };
      } => ({
        getResponse: () => ({
          status: responseStatus,
          json: responseJson,
        }),
        getRequest: () => ({
          requestId: 'request-1',
        }),
      }),
    } as unknown as ArgumentsHost;

    filter.catch(
      new ForbiddenException({
        code: 'FORBIDDEN_RESOURCE_ACCESS',
        message: 'You do not have access to this resource',
      }),
      host,
    );

    expect(responseStatus).toHaveBeenCalledWith(403);
    expect(responseJson).toHaveBeenCalledWith({
      data: null,
      meta: {
        request_id: 'request-1',
      },
      error: {
        code: 'FORBIDDEN_RESOURCE_ACCESS',
        message: 'Forbidden resource access',
      },
    });
  });
});
