export interface GetRepositoryContentParamsDto {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}

export interface GetRepositoryParamsDto {
  owner: string;
  repo: string;
}

export interface GetRepositoryTreeParamsDto {
  owner: string;
  repo: string;
  treeSha: string;
}

export interface GitHubRepositoryContentResponseDto {
  name: string;
  path: string;
  content: string;
  encoding: string;
}

export interface GitHubRepositoryResponseDto {
  default_branch: string;
  full_name: string;
}

export interface GitHubRepositoryTreeEntryDto {
  path: string;
  size?: number;
  type: 'blob' | 'tree' | string;
}

export interface GitHubRepositoryTreeResponseDto {
  tree: GitHubRepositoryTreeEntryDto[];
  truncated: boolean;
}

export interface RepositorySourceFileDto {
  name: string;
  path: string;
  encoding: string;
  content: string;
  decodedContent: string;
}

export interface RepositoryInfoDto {
  defaultBranch: string;
  fullName: string;
}

export interface RepositoryTreeEntryDto {
  path: string;
  size?: number;
  type: string;
}
