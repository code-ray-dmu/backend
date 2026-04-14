import {
  GitHubRepositoryTreeResponseDto,
  RepositoryTreeDto,
} from '../dto';

export class RepositoryTreeMapper {
  static toRepositoryTree(
    source: GitHubRepositoryTreeResponseDto,
    branch: string,
  ): RepositoryTreeDto {
    return {
      branch,
      isComplete: true,
      items: source.tree.map((node) => ({
        path: node.path,
        mode: node.mode,
        type: node.type,
        sha: node.sha,
      })),
    };
  }
}
