import { HttpException, HttpStatus } from '@nestjs/common';

export class ApiHttpException extends HttpException {
  constructor(status: HttpStatus, code: string, message: string) {
    super(
      {
        code,
        message,
      },
      status,
    );
  }
}
