import { randomUUID } from 'node:crypto';

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

interface HttpRequestLike {
  headers: Record<string, string | string[] | undefined>;
}

interface HttpResponseLike {
  status(statusCode: number): {
    json(body: ApiErrorResponse): void;
  };
}

interface ExceptionResponseBody {
  code?: string;
  message?: string | string[];
}

interface ApiErrorResponse {
  data: null;
  meta: {
    request_id: string;
  };
  error: {
    code: string;
    message: string;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<HttpRequestLike>();
    const response = context.getResponse<HttpResponseLike>();
    const statusCode = getStatusCode(exception);

    response.status(statusCode).json({
      data: null,
      meta: {
        request_id: getRequestId(request),
      },
      error: getErrorBody(exception, statusCode),
    });
  }
}

function getStatusCode(exception: unknown): number {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }

  return HttpStatus.INTERNAL_SERVER_ERROR;
}

function getErrorBody(
  exception: unknown,
  statusCode: number,
): ApiErrorResponse['error'] {
  if (!(exception instanceof HttpException)) {
    return {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    };
  }

  const response = exception.getResponse();

  if (isExceptionResponseBody(response) && response.code && response.message) {
    return {
      code: response.code,
      message: normalizeMessage(response.message),
    };
  }

  return {
    code: getDefaultErrorCode(statusCode),
    message: getDefaultErrorMessage(statusCode),
  };
}

function isExceptionResponseBody(value: unknown): value is ExceptionResponseBody {
  return typeof value === 'object' && value !== null;
}

function normalizeMessage(message: string | string[]): string {
  if (Array.isArray(message)) {
    return message.join(', ');
  }

  return message;
}

function getDefaultErrorCode(statusCode: number): string {
  if (statusCode === HttpStatus.BAD_REQUEST) {
    return 'VALIDATION_ERROR';
  }

  if (statusCode === HttpStatus.UNAUTHORIZED) {
    return 'UNAUTHORIZED';
  }

  return 'INTERNAL_SERVER_ERROR';
}

function getDefaultErrorMessage(statusCode: number): string {
  if (statusCode === HttpStatus.BAD_REQUEST) {
    return 'Invalid request body';
  }

  if (statusCode === HttpStatus.UNAUTHORIZED) {
    return 'Authentication required';
  }

  return 'Internal server error';
}

function getRequestId(request: HttpRequestLike): string {
  const requestId = request.headers['x-request-id'];

  if (Array.isArray(requestId)) {
    return requestId[0] ?? randomUUID();
  }

  return requestId ?? randomUUID();
}
