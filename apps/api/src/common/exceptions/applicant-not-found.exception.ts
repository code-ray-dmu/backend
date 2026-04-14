import { HttpStatus } from '@nestjs/common';
import { ApiHttpException } from './api-http.exception';

export class ApplicantNotFoundException extends ApiHttpException {
  constructor(message = 'Applicant not found') {
    super(HttpStatus.NOT_FOUND, 'APPLICANT_NOT_FOUND', message);
  }
}
