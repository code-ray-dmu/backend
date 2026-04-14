import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

type RequestWithId = Request & {
  requestId?: string;
};

export const ensureRequestId = (request: Request): string => {
  const requestWithId = request as RequestWithId;

  if (requestWithId.requestId) {
    return requestWithId.requestId;
  }

  requestWithId.requestId = uuidv4();

  return requestWithId.requestId;
};
