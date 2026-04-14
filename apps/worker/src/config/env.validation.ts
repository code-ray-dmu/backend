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

  ANALYSIS_LOCK_TTL: Joi.number().integer().min(1).default(600),
});
