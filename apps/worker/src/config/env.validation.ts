import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('local', 'development', 'test', 'production')
    .default('local'),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().integer().min(1).max(65535).default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().integer().min(1).max(65535).default(6379),

  RABBITMQ_URL: Joi.string().uri().required(),
  RABBITMQ_MAX_RETRY: Joi.number().integer().min(0).default(2),

  GITHUB_TOKEN: Joi.string().required(),

  LLM_API_KEY: Joi.string().required(),
  LLM_MODEL: Joi.string().required(),
  LLM_MAX_RETRIES: Joi.number().integer().min(0).max(10).default(2),
  LLM_TIMEOUT_MS: Joi.number().integer().min(1000).max(120000).default(30000),

  MAX_ANALYSIS_FILES: Joi.number().integer().min(1).max(100).default(10),
  MAX_QUESTIONS_PER_ANALYSIS_RUN: Joi.number()
    .integer()
    .min(1)
    .max(20)
    .default(3),

  ANALYSIS_LOCK_TTL: Joi.number().integer().min(1).default(600),
});
