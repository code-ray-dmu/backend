export interface GetRepositoryContentParamsDto {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}

export interface GitHubRepositoryContentResponseDto {
  name: string;
  path: string;
  content: string;
  encoding: string;
}

export interface RepositorySourceFileDto {
  name: string;
  path: string;
  encoding: string;
  content: string;
  decodedContent: string;
}
