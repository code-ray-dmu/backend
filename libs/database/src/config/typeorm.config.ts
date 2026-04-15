import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { DataSourceOptions, DefaultNamingStrategy } from 'typeorm';
import { snakeCase } from 'typeorm/util/StringUtils';
import { AnalysisRunsEntity } from '../entities/analysis-runs.entity';
import { ApplicantRepositoriesEntity } from '../entities/applicant-repositories.entity';
import { ApplicantsEntity } from '../entities/applicants.entity';
import { CodeAnalysisEntity } from '../entities/code-analysis.entity';
import { GeneratedQuestionsEntity } from '../entities/generated-questions.entity';
import { GroupsEntity } from '../entities/groups.entity';
import { LlmMessagesEntity } from '../entities/llm-messages.entity';
import { PromptTemplatesEntity } from '../entities/prompt-templates.entity';
import { RefreshTokensEntity } from '../entities/refresh-tokens.entity';
import { RepositoryFilesEntity } from '../entities/repository-files.entity';
import { UsersEntity } from '../entities/users.entity';

export class SnakeCaseNamingStrategy extends DefaultNamingStrategy {
  tableName(targetName: string, userSpecifiedName: string | undefined): string {
    return userSpecifiedName ?? snakeCase(targetName);
  }

  columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    return snakeCase(embeddedPrefixes.concat(customName ?? propertyName).join('_'));
  }

  relationName(propertyName: string): string {
    return snakeCase(propertyName);
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    return snakeCase(`${relationName}_${referencedColumnName}`);
  }

  joinTableName(
    firstTableName: string,
    secondTableName: string,
    firstPropertyName: string,
  ): string {
    return snakeCase(
      `${firstTableName}_${firstPropertyName.replace(/\./gi, '_')}_${secondTableName}`,
    );
  }

  joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return snakeCase(`${tableName}_${columnName ?? propertyName}`);
  }
}

export const databaseEntities = [
  AnalysisRunsEntity,
  ApplicantRepositoriesEntity,
  ApplicantsEntity,
  CodeAnalysisEntity,
  GeneratedQuestionsEntity,
  GroupsEntity,
  LlmMessagesEntity,
  PromptTemplatesEntity,
  RefreshTokensEntity,
  RepositoryFilesEntity,
  UsersEntity,
];

export function createTypeOrmDataSourceOptions(
  config: DatabaseConfig,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.database,
    entities: databaseEntities,
    migrations: [__dirname + '/../migrations/*.{ts,js}'],
    synchronize: false,
    logging: config.nodeEnv !== 'production',
    uuidExtension: 'pgcrypto',
    namingStrategy: new SnakeCaseNamingStrategy(),
  };
}

interface DatabaseConfig {
  nodeEnv: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export const typeOrmConfig: TypeOrmModuleAsyncOptions = {
  useFactory: (configService: ConfigService) =>
    createTypeOrmDataSourceOptions({
      nodeEnv: configService.get<string>('NODE_ENV') ?? 'local',
      host: configService.getOrThrow<string>('DB_HOST'),
      port: configService.getOrThrow<number>('DB_PORT'),
      username: configService.getOrThrow<string>('DB_USERNAME'),
      password: configService.getOrThrow<string>('DB_PASSWORD'),
      database: configService.getOrThrow<string>('DB_NAME'),
    }),
  inject: [ConfigService],
};
