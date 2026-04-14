export const RABBITMQ_EXCHANGES = {
  ANALYSIS_RUNS: 'code-ray.analysis',
} as const;

export const RABBITMQ_QUEUES = {
  ANALYSIS_REQUESTS: 'analysis.run.requested',
  ANALYSIS_RETRY: 'analysis.run.retry',
  ANALYSIS_DEAD_LETTER: 'analysis.run.deadletter',
} as const;

export const RABBITMQ_ROUTING_KEYS = {
  ANALYSIS_RUN_REQUESTED: 'analysis.run.requested',
  ANALYSIS_RUN_RETRY: 'analysis.run.retry',
  ANALYSIS_RUN_DEAD_LETTER: 'analysis.run.deadletter',
} as const;
