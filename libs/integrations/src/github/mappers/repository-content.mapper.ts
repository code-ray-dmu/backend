import {
  GitHubRepositoryContentResponseDto,
  RepositorySourceFileDto,
} from '../dto';

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
}
