import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthTokenHashAndUserEmailUnique20260414000000 implements MigrationInterface {
  name = 'AddAuthTokenHashAndUserEmailUnique20260414000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        has_duplicate_users_email boolean;
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'email'
        ) THEN
          EXECUTE 'SELECT EXISTS (
            SELECT 1 FROM "users" GROUP BY "email" HAVING COUNT(*) > 1
          )' INTO has_duplicate_users_email;

          IF has_duplicate_users_email THEN
            RAISE EXCEPTION 'Cannot create IDX_users_email_unique because duplicate users.email values exist';
          END IF;
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'refresh_tokens'
            AND column_name = 'token_hash'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'refresh_tokens'
            AND column_name = 'token_value'
        ) THEN
          ALTER TABLE "refresh_tokens" RENAME COLUMN "token_hash" TO "token_value";
        ELSIF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'refresh_tokens'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'refresh_tokens'
            AND column_name = 'token_value'
        ) THEN
          ALTER TABLE "refresh_tokens" ADD COLUMN "token_value" character varying;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'email'
        ) THEN
          CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_email_unique" ON "users" ("email");
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'refresh_tokens'
            AND column_name = 'token_value'
        ) THEN
          CREATE UNIQUE INDEX IF NOT EXISTS "IDX_refresh_tokens_token_value"
            ON "refresh_tokens" ("token_value");
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_refresh_tokens_token_value"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_users_email_unique"');

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'refresh_tokens'
            AND column_name = 'token_value'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'refresh_tokens'
            AND column_name = 'token_hash'
        ) THEN
          ALTER TABLE "refresh_tokens" RENAME COLUMN "token_value" TO "token_hash";
        END IF;
      END $$;
    `);
  }
}
