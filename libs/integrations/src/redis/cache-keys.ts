export const REDIS_CACHE_KEYS = {
  GITHUB_REPOSITORY: 'github:repository',
  GITHUB_REPOSITORY_METADATA: 'github:repo',
  GITHUB_REPOSITORY_TREE: 'github:tree',
  ANALYSIS_RUN_PROGRESS: 'analysis:progress',
  ANALYSIS_RUN_LOCK: 'analysis:lock',
} as const;

export function buildAnalysisRunProgressCacheKey(analysisRunId: string): string {
  return `${REDIS_CACHE_KEYS.ANALYSIS_RUN_PROGRESS}:${analysisRunId}`;
}

export function buildAnalysisRunLockCacheKey(repositoryId: string): string {
  return `${REDIS_CACHE_KEYS.ANALYSIS_RUN_LOCK}:${repositoryId}`;
}

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
