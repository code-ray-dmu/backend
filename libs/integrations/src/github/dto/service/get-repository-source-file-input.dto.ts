export interface GetRepositorySourceFileInputDto {
  repoFullName: string;
  path: string;
  ref?: string;
}
