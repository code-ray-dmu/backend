export interface RepositoryMetadataDto {
  name: string;
  fullName: string;
  defaultBranch: string;
  ownerLogin: string;
  htmlUrl: string;
  language: string | null;
}
