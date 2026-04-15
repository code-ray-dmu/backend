import { GitHubRateLimitDto } from './dto';

export type GitHubServiceErrorCode =
  | 'not-found'
  | 'forbidden'
  | 'rate-limit'
  | 'invalid-repo-full-name'
  | 'invalid-response';

export class GitHubServiceError extends Error {
  readonly code: GitHubServiceErrorCode;
  readonly statusCode: number | null;
  readonly rateLimit: GitHubRateLimitDto | null;
  readonly cause: unknown;

  constructor(params: {
    message: string;
    code: GitHubServiceErrorCode;
    statusCode?: number | null;
    rateLimit?: GitHubRateLimitDto | null;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = 'GitHubServiceError';
    this.code = params.code;
    this.statusCode = params.statusCode ?? null;
    this.rateLimit = params.rateLimit ?? null;
    this.cause = params.cause;
  }
}
