import { HttpStatus } from '@nestjs/common';
import { ApiHttpException } from './api-http.exception';

export class GroupNotFoundException extends ApiHttpException {
  constructor(message = 'Group not found') {
    super(HttpStatus.NOT_FOUND, 'GROUP_NOT_FOUND', message);
  }
}
