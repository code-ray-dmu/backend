import 'reflect-metadata';

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common/interfaces';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  let filter: ApiExceptionFilter;
  let status: jest.Mock;
  let json: jest.Mock;

  beforeEach((): void => {
    status = jest.fn().mockReturnThis();
    json = jest.fn();
    filter = new ApiExceptionFilter();
  });

  const createArgumentsHost = (): ArgumentsHost =>
    ({
      switchToHttp: (): {
        getResponse: () => { status: jest.Mock; json: jest.Mock };
        getRequest: () => Record<string, unknown>;
      } => ({
        getResponse: () => ({
          status,
          json,
        }),
        getRequest: () => ({
          method: 'GET',
          url: '/api/groups',
        }),
      }),
    }) as ArgumentsHost;

  it('maps validation failures to VALIDATION_ERROR envelope', (): void => {
    filter.catch(
      new BadRequestException(['name should not be empty']),
      createArgumentsHost(),
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: null,
        meta: expect.objectContaining({
          request_id: expect.any(String),
        }),
        error: {
          code: 'VALIDATION_ERROR',
          message: 'name should not be empty',
        },
      }),
    );
  });

  it('maps unauthorized failures to UNAUTHORIZED envelope', (): void => {
    filter.catch(new UnauthorizedException(), createArgumentsHost());

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: null,
        meta: expect.objectContaining({
          request_id: expect.any(String),
        }),
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      }),
    );
  });
});
