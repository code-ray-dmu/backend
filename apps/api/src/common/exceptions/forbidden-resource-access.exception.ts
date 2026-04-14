import { HttpStatus } from '@nestjs/common';
import { ApiHttpException } from './api-http.exception';

export class ForbiddenResourceAccessException extends ApiHttpException {
  constructor(message = 'Forbidden resource access') {
    super(HttpStatus.FORBIDDEN, 'FORBIDDEN_RESOURCE_ACCESS', message);
  }
}
