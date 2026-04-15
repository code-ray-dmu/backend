export interface GitHubRepositoryMetadataResponseDto {
  name: string;
  full_name: string;
  default_branch: string;
  html_url: string;
  language: string | null;
  owner: {
    login: string;
  };
}
