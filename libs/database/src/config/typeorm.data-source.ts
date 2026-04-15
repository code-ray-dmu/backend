import { DataSource } from 'typeorm';
import { loadEnvFiles } from '@app/shared';
import { createTypeOrmDataSourceOptions } from './typeorm.config';

loadEnvFiles(process.env.NODE_ENV);

const appDataSource = new DataSource(
  createTypeOrmDataSourceOptions({
    nodeEnv: process.env.NODE_ENV ?? 'local',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'code_ray',
  }),
);

export default appDataSource;
