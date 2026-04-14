import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

type CurrentUserRequest = Request & {
  user: {
    sub: string;
  };
};

export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<CurrentUserRequest>();

    return request.user.sub;
  },
);
