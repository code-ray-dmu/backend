export interface GitHubRepositoryContentResponseDto {
  type?: string;
  name: string;
  path: string;
  content?: string;
  encoding?: string;
}
