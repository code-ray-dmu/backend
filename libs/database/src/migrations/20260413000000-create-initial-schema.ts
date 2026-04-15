import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInitialSchema20260413000000 implements MigrationInterface {
  name = 'CreateInitialSchema20260413000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'analysis_runs_status_enum'
        ) THEN
          CREATE TYPE "analysis_runs_status_enum" AS ENUM (
            'QUEUED',
            'IN_PROGRESS',
            'COMPLETED',
            'FAILED'
          );
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'analysis_runs_current_stage_enum'
        ) THEN
          CREATE TYPE "analysis_runs_current_stage_enum" AS ENUM (
            'REPO_LIST',
            'FOLDER_STRUCTURE',
            'FILE_DETAIL',
            'SUMMARY',
            'QUESTION_GENERATION'
          );
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'llm_messages_stage_enum'
        ) THEN
          CREATE TYPE "llm_messages_stage_enum" AS ENUM (
            'REPO_LIST',
            'FOLDER_STRUCTURE',
            'FILE_DETAIL',
            'SUMMARY',
            'QUESTION_GENERATION'
          );
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'llm_messages_role_enum'
        ) THEN
          CREATE TYPE "llm_messages_role_enum" AS ENUM (
            'SYSTEM',
            'USER',
            'ASSISTANT'
          );
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'generated_questions_category_enum'
        ) THEN
          CREATE TYPE "generated_questions_category_enum" AS ENUM (
            'SKILL',
            'CULTURE_FIT'
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "name" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "prompt_templates" (
        "id" SERIAL NOT NULL,
        "template_key" character varying NOT NULL,
        "template_name" character varying NOT NULL,
        "purpose" character varying NOT NULL,
        "template_text" text NOT NULL,
        "variables_json" jsonb,
        "version" integer NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_prompt_templates_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" SERIAL NOT NULL,
        "user_id" uuid NOT NULL,
        "token_value" character varying NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "is_revoked" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_refresh_tokens_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "groups" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "description" character varying,
        "tech_stacks" jsonb NOT NULL,
        "culture_fit_priority" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_groups_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "applicants" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "group_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "email" character varying NOT NULL,
        "github_url" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_applicants_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "applicant_repositories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "applicant_id" uuid NOT NULL,
        "repo_name" character varying NOT NULL,
        "repo_full_name" character varying NOT NULL,
        "repo_url" character varying NOT NULL,
        "default_branch" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_applicant_repositories_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "analysis_runs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "applicant_id" uuid NOT NULL,
        "repository_id" uuid NOT NULL,
        "requested_by_user_id" uuid NOT NULL,
        "status" "analysis_runs_status_enum" NOT NULL,
        "current_stage" "analysis_runs_current_stage_enum",
        "started_at" TIMESTAMP,
        "completed_at" TIMESTAMP,
        "failure_reason" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_analysis_runs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "repository_files" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "repository_id" uuid NOT NULL,
        "path" character varying NOT NULL,
        "raw_analysis_report" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_repository_files_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "llm_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "analysis_run_id" uuid NOT NULL,
        "stage" "llm_messages_stage_enum" NOT NULL,
        "role" "llm_messages_role_enum" NOT NULL,
        "content" text NOT NULL,
        CONSTRAINT "PK_llm_messages_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "code_analysis" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "analysis_run_id" uuid NOT NULL,
        "applicant_id" uuid NOT NULL,
        "raw_analysis_report" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_code_analysis_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "generated_questions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "analysis_run_id" uuid NOT NULL,
        "applicant_id" uuid NOT NULL,
        "category" "generated_questions_category_enum" NOT NULL,
        "question_text" text NOT NULL,
        "intent" character varying,
        "priority" integer,
        CONSTRAINT "PK_generated_questions_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_email_unique" ON "users" ("email")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_refresh_tokens_token_value" ON "refresh_tokens" ("token_value")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_prompt_templates_template_key" ON "prompt_templates" ("template_key")',
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_prompt_templates_active_purpose_unique"
      ON "prompt_templates" ("purpose")
      WHERE "is_active" = true
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_groups_user_id" ON "groups" ("user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_applicants_group_id" ON "applicants" ("group_id")',
    );
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_applicant_repositories_applicant_id"
      ON "applicant_repositories" ("applicant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_analysis_runs_applicant_id"
      ON "analysis_runs" ("applicant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_analysis_runs_repository_id"
      ON "analysis_runs" ("repository_id")
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_analysis_runs_status" ON "analysis_runs" ("status")',
    );
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_llm_messages_analysis_run_id"
      ON "llm_messages" ("analysis_run_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_generated_questions_applicant_id"
      ON "generated_questions" ("applicant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_generated_questions_analysis_run_id"
      ON "generated_questions" ("analysis_run_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_prompt_templates_purpose_is_active"
      ON "prompt_templates" ("purpose", "is_active")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_user_id_is_revoked"
      ON "refresh_tokens" ("user_id", "is_revoked")
    `);

    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      ADD CONSTRAINT "FK_refresh_tokens_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "groups"
      ADD CONSTRAINT "FK_groups_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "applicants"
      ADD CONSTRAINT "FK_applicants_group_id"
      FOREIGN KEY ("group_id") REFERENCES "groups"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "applicant_repositories"
      ADD CONSTRAINT "FK_applicant_repositories_applicant_id"
      FOREIGN KEY ("applicant_id") REFERENCES "applicants"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "analysis_runs"
      ADD CONSTRAINT "FK_analysis_runs_applicant_id"
      FOREIGN KEY ("applicant_id") REFERENCES "applicants"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "analysis_runs"
      ADD CONSTRAINT "FK_analysis_runs_repository_id"
      FOREIGN KEY ("repository_id") REFERENCES "applicant_repositories"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "analysis_runs"
      ADD CONSTRAINT "FK_analysis_runs_requested_by_user_id"
      FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "repository_files"
      ADD CONSTRAINT "FK_repository_files_repository_id"
      FOREIGN KEY ("repository_id") REFERENCES "applicant_repositories"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "llm_messages"
      ADD CONSTRAINT "FK_llm_messages_analysis_run_id"
      FOREIGN KEY ("analysis_run_id") REFERENCES "analysis_runs"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "code_analysis"
      ADD CONSTRAINT "FK_code_analysis_analysis_run_id"
      FOREIGN KEY ("analysis_run_id") REFERENCES "analysis_runs"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "code_analysis"
      ADD CONSTRAINT "FK_code_analysis_applicant_id"
      FOREIGN KEY ("applicant_id") REFERENCES "applicants"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "generated_questions"
      ADD CONSTRAINT "FK_generated_questions_analysis_run_id"
      FOREIGN KEY ("analysis_run_id") REFERENCES "analysis_runs"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "generated_questions"
      ADD CONSTRAINT "FK_generated_questions_applicant_id"
      FOREIGN KEY ("applicant_id") REFERENCES "applicants"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "generated_questions" DROP CONSTRAINT IF EXISTS "FK_generated_questions_applicant_id"');
    await queryRunner.query('ALTER TABLE "generated_questions" DROP CONSTRAINT IF EXISTS "FK_generated_questions_analysis_run_id"');
    await queryRunner.query('ALTER TABLE "code_analysis" DROP CONSTRAINT IF EXISTS "FK_code_analysis_applicant_id"');
    await queryRunner.query('ALTER TABLE "code_analysis" DROP CONSTRAINT IF EXISTS "FK_code_analysis_analysis_run_id"');
    await queryRunner.query('ALTER TABLE "llm_messages" DROP CONSTRAINT IF EXISTS "FK_llm_messages_analysis_run_id"');
    await queryRunner.query('ALTER TABLE "repository_files" DROP CONSTRAINT IF EXISTS "FK_repository_files_repository_id"');
    await queryRunner.query('ALTER TABLE "analysis_runs" DROP CONSTRAINT IF EXISTS "FK_analysis_runs_requested_by_user_id"');
    await queryRunner.query('ALTER TABLE "analysis_runs" DROP CONSTRAINT IF EXISTS "FK_analysis_runs_repository_id"');
    await queryRunner.query('ALTER TABLE "analysis_runs" DROP CONSTRAINT IF EXISTS "FK_analysis_runs_applicant_id"');
    await queryRunner.query('ALTER TABLE "applicant_repositories" DROP CONSTRAINT IF EXISTS "FK_applicant_repositories_applicant_id"');
    await queryRunner.query('ALTER TABLE "applicants" DROP CONSTRAINT IF EXISTS "FK_applicants_group_id"');
    await queryRunner.query('ALTER TABLE "groups" DROP CONSTRAINT IF EXISTS "FK_groups_user_id"');
    await queryRunner.query('ALTER TABLE "refresh_tokens" DROP CONSTRAINT IF EXISTS "FK_refresh_tokens_user_id"');

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_refresh_tokens_user_id_is_revoked"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_prompt_templates_purpose_is_active"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_generated_questions_analysis_run_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_generated_questions_applicant_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_llm_messages_analysis_run_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_analysis_runs_status"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_analysis_runs_repository_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_analysis_runs_applicant_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_applicant_repositories_applicant_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_applicants_group_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_groups_user_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_prompt_templates_active_purpose_unique"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_prompt_templates_template_key"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_refresh_tokens_token_value"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_users_email_unique"');

    await queryRunner.query('DROP TABLE IF EXISTS "generated_questions"');
    await queryRunner.query('DROP TABLE IF EXISTS "code_analysis"');
    await queryRunner.query('DROP TABLE IF EXISTS "llm_messages"');
    await queryRunner.query('DROP TABLE IF EXISTS "repository_files"');
    await queryRunner.query('DROP TABLE IF EXISTS "analysis_runs"');
    await queryRunner.query('DROP TABLE IF EXISTS "applicant_repositories"');
    await queryRunner.query('DROP TABLE IF EXISTS "applicants"');
    await queryRunner.query('DROP TABLE IF EXISTS "groups"');
    await queryRunner.query('DROP TABLE IF EXISTS "refresh_tokens"');
    await queryRunner.query('DROP TABLE IF EXISTS "prompt_templates"');
    await queryRunner.query('DROP TABLE IF EXISTS "users"');

    await queryRunner.query('DROP TYPE IF EXISTS "generated_questions_category_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "llm_messages_role_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "llm_messages_stage_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "analysis_runs_current_stage_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "analysis_runs_status_enum"');
  }
}
