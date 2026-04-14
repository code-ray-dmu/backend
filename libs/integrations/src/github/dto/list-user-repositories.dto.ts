export interface GitHubUserRepositoryResponseDto {
  name: string;
  full_name: string;
  html_url: string;
  default_branch?: string;
  updated_at: string;
}

export interface GitHubRepositorySummaryDto {
  repoName: string;
  repoFullName: string;
  repoUrl: string;
  defaultBranch?: string;
  updatedAt: Date;
}
