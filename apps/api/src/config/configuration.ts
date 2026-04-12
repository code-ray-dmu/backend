export default (): {
  nodeEnv: string;
  port: number;
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
  };
  jwt: {
    accessSecret: string | undefined;
    refreshSecret: string | undefined;
    accessExpiresIn: string | undefined;
    refreshExpiresIn: string | undefined;
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
  port: parseInt(process.env.PORT ?? '3000', 10),

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
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  },

  github: {
    token: process.env.GITHUB_TOKEN,
  },

  llm: {
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL,
  },
});
