export interface GetRepositoryContentParamsDto {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}
