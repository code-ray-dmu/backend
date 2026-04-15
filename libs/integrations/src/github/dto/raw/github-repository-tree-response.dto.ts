export interface GitHubRepositoryTreeNodeResponseDto {
  path: string;
  mode: string;
  type: string;
  sha: string;
}

export interface GitHubRepositoryTreeResponseDto {
  truncated?: boolean;
  tree: GitHubRepositoryTreeNodeResponseDto[];
}
