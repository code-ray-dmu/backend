import {
  RepositoryContentMapper,
  RepositoryMetadataMapper,
  RepositoryTreeMapper,
  UserRepositoryMapper,
} from './index';

describe('GitHub mappers', () => {
  describe('RepositoryContentMapper', () => {
    it('decodes base64 content after removing newlines', () => {
      const result = RepositoryContentMapper.toRepositorySourceFile({
        type: 'file',
        name: 'app.ts',
        path: 'src/app.ts',
        content: 'Y29uc29sZS5sb2coJ2hpJyk7\n',
        encoding: 'base64',
      });

      expect(result).toEqual({
        name: 'app.ts',
        path: 'src/app.ts',
        encoding: 'base64',
        content: 'Y29uc29sZS5sb2coJ2hpJyk7\n',
        decodedContent: "console.log('hi');",
      });
    });

    it('returns raw content when encoding is not base64', () => {
      const result = RepositoryContentMapper.toRepositorySourceFile({
        type: 'file',
        name: 'README.md',
        path: 'README.md',
        content: 'plain text',
        encoding: 'utf-8',
      });

      expect(result.decodedContent).toBe('plain text');
    });
  });

  it('maps repository metadata to internal dto', () => {
    expect(
      RepositoryMetadataMapper.toRepositoryMetadata({
        name: 'backend',
        full_name: 'owner/backend',
        default_branch: 'main',
        html_url: 'https://github.com/owner/backend',
        language: 'TypeScript',
        owner: {
          login: 'owner',
        },
      }),
    ).toEqual({
      name: 'backend',
      fullName: 'owner/backend',
      defaultBranch: 'main',
      ownerLogin: 'owner',
      htmlUrl: 'https://github.com/owner/backend',
      language: 'TypeScript',
    });
  });

  it('maps repository tree to internal dto', () => {
    expect(
      RepositoryTreeMapper.toRepositoryTree(
        {
          tree: [
            {
              path: 'src/app.ts',
              mode: '100644',
              type: 'blob',
              sha: 'abc123',
            },
          ],
        },
        'main',
      ),
    ).toEqual({
      branch: 'main',
      isComplete: true,
      items: [
        {
          path: 'src/app.ts',
          mode: '100644',
          type: 'blob',
          sha: 'abc123',
        },
      ],
    });
  });

  it('maps user repository summary to internal dto', () => {
    expect(
      UserRepositoryMapper.toUserRepositorySummary({
        name: 'backend',
        full_name: 'owner/backend',
        html_url: 'https://github.com/owner/backend',
        language: 'TypeScript',
        updated_at: '2026-04-14T10:00:00Z',
      }),
    ).toEqual({
      name: 'backend',
      fullName: 'owner/backend',
      htmlUrl: 'https://github.com/owner/backend',
      language: 'TypeScript',
      updatedAt: '2026-04-14T10:00:00Z',
    });
  });
});
