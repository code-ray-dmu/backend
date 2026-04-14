import {
  GitHubUserRepositoryResponseDto,
  UserRepositorySummaryDto,
} from '../dto';

export class UserRepositoryMapper {
  static toUserRepositorySummary(
    source: GitHubUserRepositoryResponseDto,
  ): UserRepositorySummaryDto {
    return {
      name: source.name,
      fullName: source.full_name,
      htmlUrl: source.html_url,
      language: source.language,
      updatedAt: source.updated_at,
    };
  }
}
