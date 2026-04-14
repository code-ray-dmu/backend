export interface GitHubRateLimitDto {
  remaining: number | null;
  resetAtEpochSeconds: number | null;
}

export interface GitHubClientResponseDto<TBody> {
  body: TBody;
  statusCode: number;
  rateLimit: GitHubRateLimitDto;
}
