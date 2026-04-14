import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessBody, ApiSuccessResponse } from '../dto';
import { ensureRequestId } from '../utils';

@Injectable()
export class ApiResponseEnvelopeInterceptor<T>
implements NestInterceptor<T, ApiSuccessResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const requestId = ensureRequestId(request);

    return next.handle().pipe(
      map((body: T): ApiSuccessResponse<T> => {
        const normalized = this.normalizeBody(body);

        return {
          data: normalized.data,
          meta: {
            request_id: requestId,
            ...normalized.meta,
          },
          error: null,
        };
      }),
    );
  }

  private normalizeBody(body: T): ApiSuccessBody<T> {
    if (this.isApiSuccessBody(body)) {
      return body as ApiSuccessBody<T>;
    }

    return {
      __apiSuccessBody: true,
      data: body,
    };
  }

  private isApiSuccessBody(body: unknown): body is ApiSuccessBody<unknown> {
    if (typeof body !== 'object' || body === null) {
      return false;
    }

    return '__apiSuccessBody' in body && body.__apiSuccessBody === true;
  }
}
