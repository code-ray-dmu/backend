import { ArgumentsHost, BadRequestException, ConflictException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  it('wraps domain HttpException responses in the API envelope', () => {
    const response = createResponse();
    const host = createHost(response);
    const filter = new HttpExceptionFilter();

    filter.catch(
      new ConflictException({
        code: 'USER_EMAIL_CONFLICT',
        message: 'Email already exists',
      }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      data: null,
      meta: {
        request_id: 'request-id',
      },
      error: {
        code: 'USER_EMAIL_CONFLICT',
        message: 'Email already exists',
      },
    });
  });

  it('maps validation errors to the documented error code', () => {
    const response = createResponse();
    const host = createHost(response);
    const filter = new HttpExceptionFilter();

    filter.catch(new BadRequestException(['email must be an email']), host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      data: null,
      meta: {
        request_id: 'request-id',
      },
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
      },
    });
  });
});

function createResponse(): {
  status: jest.Mock;
  json: jest.Mock;
  } {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  };

  response.status.mockReturnValue(response);

  return response;
}

function createHost(response: ReturnType<typeof createResponse>): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          'x-request-id': 'request-id',
        },
      }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
}
