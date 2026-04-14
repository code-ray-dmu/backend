import {
  GitHubRepositoryResponseDto,
  GitHubRepositoryTreeEntryDto,
  GitHubRepositoryContentResponseDto,
  RepositoryInfoDto,
  RepositorySourceFileDto,
  RepositoryTreeEntryDto,
} from '../dto/get-repository-content.dto';

export class RepositoryContentMapper {
  static toRepositorySourceFile(
    source: GitHubRepositoryContentResponseDto,
  ): RepositorySourceFileDto {
    const normalizedContent = source.content.replace(/\n/g, '');
    const decodedContent =
      source.encoding.toLowerCase() === 'base64'
        ? Buffer.from(normalizedContent, 'base64').toString('utf-8')
        : source.content;

    return {
      name: source.name,
      path: source.path,
      encoding: source.encoding,
      content: source.content,
      decodedContent,
    };
  }

  static toRepositoryInfo(source: GitHubRepositoryResponseDto): RepositoryInfoDto {
    return {
      defaultBranch: source.default_branch,
      fullName: source.full_name,
    };
  }

  static toRepositoryTreeEntry(
    source: GitHubRepositoryTreeEntryDto,
  ): RepositoryTreeEntryDto {
    return {
      path: source.path,
      size: source.size,
      type: source.type,
    };
  }
}
