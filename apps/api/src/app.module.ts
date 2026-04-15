import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from '@app/database';
import { RabbitMqModule, RedisModule } from '@app/integrations';
import { getEnvFilePaths } from '@app/shared';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { AnalysisRunsModule } from './modules/analysis-runs/analysis-runs.module';
import { ApplicantRepositoriesModule } from './modules/applicant-repositories/applicant-repositories.module';
import { ApplicantsModule } from './modules/applicants/applicants.module';
import { AuthModule } from './modules/auth/auth.module';
import { GeneratedQuestionsModule } from './modules/generated-questions/generated-questions.module';
import { GroupsModule } from './modules/groups/groups.module';
import { HealthModule } from './modules/health/health.module';
import { PromptTemplatesModule } from './modules/prompt-templates/prompt-templates.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: getEnvFilePaths(process.env.NODE_ENV),
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync(typeOrmConfig),
    RabbitMqModule,
    RedisModule,
    AuthModule,
    UsersModule,
    GroupsModule,
    ApplicantsModule,
    ApplicantRepositoriesModule,
    AnalysisRunsModule,
    GeneratedQuestionsModule,
    PromptTemplatesModule,
    HealthModule,
  ],
})
export class AppModule {}
