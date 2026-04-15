import {
  GitHubRepositoryMetadataResponseDto,
  RepositoryMetadataDto,
} from '../dto';

export class RepositoryMetadataMapper {
  static toRepositoryMetadata(
    source: GitHubRepositoryMetadataResponseDto,
  ): RepositoryMetadataDto {
    return {
      name: source.name,
      fullName: source.full_name,
      defaultBranch: source.default_branch,
      ownerLogin: source.owner.login,
      htmlUrl: source.html_url,
      language: source.language,
    };
  }
}
