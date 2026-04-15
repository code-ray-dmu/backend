import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorBody, ApiErrorResponse } from '../dto';
import { ensureRequestId } from '../utils';

@Injectable()
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const requestId = ensureRequestId(request);
    const { status, error } = this.resolveErrorResponse(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled API exception: ${request.method} ${request.url} requestId=${requestId}`,
        this.getErrorTrace(exception),
      );
    }

    response.status(status).json({
      data: null,
      meta: {
        request_id: requestId,
      },
      error,
    } satisfies ApiErrorResponse);
  }

  private resolveErrorResponse(exception: unknown): {
    status: number;
    error: ApiErrorBody;
  } {
    if (exception instanceof BadRequestException) {
      return {
        status: exception.getStatus(),
        error: {
          code: 'VALIDATION_ERROR',
          message: this.getValidationMessage(exception),
        },
      };
    }

    if (exception instanceof UnauthorizedException) {
      const status = exception.getStatus();
      const error = this.getHttpExceptionError(exception, status);

      if (error.code !== 'UNAUTHORIZED') {
        return {
          status,
          error,
        };
      }

      return {
        status,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      };
    }

    if (exception instanceof ForbiddenException) {
      return {
        status: exception.getStatus(),
        error: {
          code: 'FORBIDDEN_RESOURCE_ACCESS',
          message: 'Forbidden resource access',
        },
      };
    }

    if (exception instanceof HttpException) {
      return {
        status: exception.getStatus(),
        error: this.getHttpExceptionError(exception, exception.getStatus()),
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      },
    };
  }

  private getValidationMessage(exception: BadRequestException): string {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return response;
    }

    if (typeof response === 'object' && response !== null) {
      const message = (response as { message?: string | string[] }).message;

      if (Array.isArray(message)) {
        return message.join(', ');
      }

      if (typeof message === 'string') {
        return message;
      }
    }

    return 'Invalid request';
  }

  private getHttpExceptionError(exception: HttpException, status: number): ApiErrorBody {
    const response = exception.getResponse();

    if (typeof response === 'object' && response !== null) {
      const code = (response as { code?: string }).code;
      const message = (response as { message?: string | string[] }).message;

      if (typeof code === 'string') {
        return {
          code,
          message: Array.isArray(message) ? message.join(', ') : message ?? exception.message,
        };
      }
    }

    return {
      code: this.getDefaultErrorCode(status),
      message: exception.message || 'Request failed',
    };
  }

  private getDefaultErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN_RESOURCE_ACCESS';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'INTERNAL_SERVER_ERROR';
      default:
        return `HTTP_${status}`;
    }
  }

  private getErrorTrace(exception: unknown): string {
    if (exception instanceof Error) {
      return exception.stack ?? exception.message;
    }

    return JSON.stringify(exception);
  }
}
