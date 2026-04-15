import { GitHubRateLimitDto } from './dto';

export class GitHubClientError extends Error {
  readonly statusCode: number | null;
  readonly responseBody: string;
  readonly rateLimit: GitHubRateLimitDto;

  constructor(params: {
    message: string;
    statusCode: number | null;
    responseBody: string;
    rateLimit: GitHubRateLimitDto;
  }) {
    super(params.message);
    this.name = 'GitHubClientError';
    this.statusCode = params.statusCode;
    this.responseBody = params.responseBody;
    this.rateLimit = params.rateLimit;
  }
}
