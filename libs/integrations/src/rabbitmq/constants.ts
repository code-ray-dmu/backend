export const RABBITMQ_EXCHANGES = {
  ANALYSIS_REQUEST: 'code-ray.analysis',
} as const;

export const RABBITMQ_QUEUES = {
  ANALYSIS_REQUEST: 'analysis.run.requested',
  // Phase 4 retry/dead-letter 운영 정책에서 사용 예정
  PHASE4_ANALYSIS_RETRY: 'analysis.run.retry',
  PHASE4_ANALYSIS_DEAD_LETTER: 'analysis.run.deadletter',
} as const;

export const RABBITMQ_ROUTING_KEYS = {
  ANALYSIS_REQUEST: 'analysis.run.requested',
  // Phase 4 retry/dead-letter 운영 정책에서 사용 예정
  PHASE4_ANALYSIS_RETRY: 'analysis.run.retry',
  PHASE4_ANALYSIS_DEAD_LETTER: 'analysis.run.deadletter',
} as const;
