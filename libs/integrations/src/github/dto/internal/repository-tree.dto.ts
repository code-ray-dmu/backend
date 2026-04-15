export interface RepositoryTreeItemDto {
  path: string;
  mode: string;
  type: string;
  sha: string;
}

export interface RepositoryTreeDto {
  branch: string;
  isComplete: boolean;
  items: RepositoryTreeItemDto[];
}
