export interface ApiResponseMeta {
  request_id?: string;
  page?: number;
  size?: number;
  total?: number;
}

export interface ApiErrorBody {
  code: string;
  message: string;
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta: ApiResponseMeta;
  error: null;
}

export interface ApiErrorResponse {
  data: null;
  meta: ApiResponseMeta;
  error: ApiErrorBody;
}

export interface ApiSuccessBody<T> {
  __apiSuccessBody: true;
  data: T;
  meta?: Omit<ApiResponseMeta, 'request_id'>;
}

export const createApiSuccessBody = <T>(
  data: T,
  meta?: Omit<ApiResponseMeta, 'request_id'>,
): ApiSuccessBody<T> => ({
    __apiSuccessBody: true,
    data,
    meta,
  });
