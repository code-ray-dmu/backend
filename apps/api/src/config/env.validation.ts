import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('local', 'development', 'test', 'production')
    .default('local'),

  PORT: Joi.number().integer().min(1).max(65535).default(3000),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().integer().min(1).max(65535).default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().integer().min(1).max(65535).default(6379),

  RABBITMQ_URL: Joi.string().uri().required(),

  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .required(),

  GITHUB_TOKEN: Joi.string().required(),

  LLM_API_KEY: Joi.string().optional(),
  LLM_MODEL: Joi.string().optional(),
  LLM_MAX_RETRIES: Joi.number().integer().min(0).max(10).optional(),
  LLM_TIMEOUT_MS: Joi.number().integer().min(1000).max(120000).optional(),
});
