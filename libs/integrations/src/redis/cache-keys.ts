export const REDIS_CACHE_KEYS = {
  GITHUB_REPOSITORY: 'github:repository',
  GITHUB_REPOSITORY_METADATA: 'github:repo',
  GITHUB_REPOSITORY_TREE: 'github:tree',
  ANALYSIS_RUN_PROGRESS: 'analysis-run:progress',
  ANALYSIS_RUN_LOCK: 'analysis-run:lock',
} as const;

export function buildGitHubRepositoryMetadataCacheKey(
  owner: string,
  repo: string,
): string {
  return `${REDIS_CACHE_KEYS.GITHUB_REPOSITORY_METADATA}:${owner}/${repo}`;
}

export function buildGitHubRepositoryTreeCacheKey(
  owner: string,
  repo: string,
  branch: string,
): string {
  return `${REDIS_CACHE_KEYS.GITHUB_REPOSITORY_TREE}:${owner}/${repo}:${branch}`;
}
