import { Test } from '@nestjs/testing';
import { GitHubClient } from './github.client';
import { GitHubService } from './github.service';

describe('GitHubService', () => {
  let service: GitHubService;
  let gitHubClient: {
    getRepository: jest.Mock;
    getRepositoryContent: jest.Mock;
    getRepositoryTree: jest.Mock;
  };

  beforeEach(async () => {
    gitHubClient = {
      getRepository: jest.fn(),
      getRepositoryContent: jest.fn(),
      getRepositoryTree: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        GitHubService,
        {
          provide: GitHubClient,
          useValue: gitHubClient,
        },
      ],
    }).compile();

    service = moduleRef.get(GitHubService);
  });

  it('fails fast when the GitHub tree response is truncated', async () => {
    gitHubClient.getRepositoryTree.mockResolvedValue({
      tree: [],
      truncated: true,
    });

    await expect(
      service.getRepositoryTree({
        owner: 'owner',
        repo: 'repo',
        treeSha: 'main',
      }),
    ).rejects.toThrow(
      'GITHUB_REPOSITORY_TREE_TRUNCATED: repository tree response was truncated',
    );
  });
});
