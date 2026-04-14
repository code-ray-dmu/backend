export default (): {
  nodeEnv: string;
  db: {
    host: string | undefined;
    port: number;
    username: string | undefined;
    password: string | undefined;
    name: string | undefined;
  };
  redis: {
    host: string | undefined;
    port: number;
  };
  rabbitmq: {
    url: string | undefined;
    maxRetry: number;
  };
  analysis: {
    lockTtl: number;
  };
  github: {
    token: string | undefined;
  };
  llm: {
    apiKey: string | undefined;
    model: string | undefined;
  };
} => ({
  nodeEnv: process.env.NODE_ENV ?? 'local',

  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
  },

  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },

  rabbitmq: {
    url: process.env.RABBITMQ_URL,
    maxRetry: parseInt(process.env.RABBITMQ_MAX_RETRY ?? '2', 10),
  },

  analysis: {
    lockTtl: parseInt(process.env.ANALYSIS_LOCK_TTL ?? '600', 10),
  },

  github: {
    token: process.env.GITHUB_TOKEN,
  },

  llm: {
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL,
  },
});
