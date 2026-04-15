import 'reflect-metadata';

import { BadRequestException, Logger, UnauthorizedException } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common/interfaces';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  let filter: ApiExceptionFilter;
  let loggerErrorSpy: jest.SpyInstance;
  let status: jest.Mock;
  let json: jest.Mock;

  beforeEach((): void => {
    status = jest.fn().mockReturnThis();
    json = jest.fn();
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    filter = new ApiExceptionFilter();
  });

  afterEach((): void => {
    loggerErrorSpy.mockRestore();
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
    expect(loggerErrorSpy).not.toHaveBeenCalled();
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
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it('preserves custom auth error codes from unauthorized failures', (): void => {
    filter.catch(
      new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      }),
      createArgumentsHost(),
    );

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: null,
        meta: expect.objectContaining({
          request_id: expect.any(String),
        }),
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      }),
    );
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it('logs unexpected internal errors before responding', (): void => {
    const error = new Error('Database connection lost');

    filter.catch(error, createArgumentsHost());

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
        },
      }),
    );
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unhandled API exception: GET /api/groups'),
      expect.stringContaining('Database connection lost'),
    );
  });
});
