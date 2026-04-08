# NestJS Server Skeleton Plan

Source: [server-spec.md](../server-spec.md)

Scope: create the NestJS server skeleton for `code-ray-server`: project setup, app/lib folders, config stubs, module/class stubs, and infra/test placeholders.

Out of scope: module business logic, detailed DTO fields, worker job logic, GitHub/LLM calls, Redis/RabbitMQ runtime behavior, real migrations, and production deployment.

## Rules

- Use `- [ ]` before a task is done, then change it to `- [x]`.
- After each task, commit the changes and write the commit hash after `Commit:`.
- Prefer one task per commit.
- If a task grows, split it into a new task and note why.

## Tasks

### 1. Initialize NestJS Monorepo

- [x] Create base NestJS monorepo files. Commit: cbd0796

Do:

- Add `package.json`, `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json`
- Register apps: `apps/api`, `apps/worker`
- Register libs: `libs/core`, `libs/database`, `libs/integrations`, `libs/contracts`, `libs/shared`
- Add basic build/test/lint scripts

Do not:

- Add domain logic
- Add API endpoint behavior
- Add worker message handling

### 2. Add Dependencies and Env Examples

- [x] Add common server dependencies and env example files. Commit: 670d48a

Do:

- Add NestJS, TypeORM, PostgreSQL, RabbitMQ, Redis, JWT, and validation deps
- Add `.env.example`, `.env.local.example`, `.env.test.example`, `.env.production.example`
- List env keys from the spec with sample values
- Add `.gitignore` rules for real `.env*` files

Do not:

- Add real secrets
- Implement external service checks

### 3. Create API Bootstrap and Common Folders

- [x] Create `apps/api` entry files and common folder layout. Commit: 92bab72

Do:

- Add `apps/api/src/main.ts`
- Add `apps/api/src/app.module.ts`
- Add `apps/api/src/common` folders:
  - `decorators`
  - `dto`
  - `enums`
  - `exceptions`
  - `filters`
  - `guards`
  - `interceptors`
  - `interfaces`
  - `pipes`
  - `utils`
- Add placeholders or barrel files
- Add minimal bootstrap stubs for global prefix, validation pipe, and config module

Do not:

- Implement filters, guards, interceptors, or pipes
- Define DTO fields

### 4. Create API Config Stubs

- [x] Create `apps/api/src/config` config files. Commit: 2ec085a

Do:

- Add `configuration.ts`
- Add `env.validation.ts`
- Include required env keys from the spec
- Add minimal validation structure for numeric ports and JWT expiry format

Do not:

- Add detailed environment branching
- Implement secret management

### 5. Create API Domain Module Skeletons

- [x] Create API module/controller/service/facade/repository stubs and folders. Commit: 636ca56

Do:

- Add `apps/api/src/modules/auth`
  - `auth.module.ts`
  - `auth.controller.ts`
  - `auth.service.ts`
  - `auth.facade.ts`
  - `dto`
  - `strategies`
  - `guards`
  - `interfaces`
- Add module skeletons for:
  - `users`
  - `groups`
  - `applicants`
  - `applicant-repositories`
  - `analysis-runs`
  - `generated-questions`
  - `prompt-templates`
  - `health`
- Import modules in `apps/api/src/app.module.ts`

Do not:

- Implement auth, CRUD, authorization, DTO fields, or repository queries

### 6. Create Auth Security Stubs

- [x] Create basic Auth strategy, guard, and interface files. Commit: 59dc710

Do:

- Add `jwt-access.strategy.ts`
- Add `jwt-refresh.strategy.ts`
- Add `jwt-auth.guard.ts`
- Add `jwt-refresh.guard.ts`
- Add `jwt-payload.interface.ts`
- Add minimal JWT/Passport imports in `AuthModule`

Do not:

- Implement JWT validation
- Implement refresh token revoke behavior
- Implement bcrypt password checks

### 7. Create Worker Bootstrap and Config Stubs

- [x] Create `apps/worker` entry files and config stubs. Commit: 90b8a86

Do:

- Add `apps/worker/src/main.ts`
- Add `apps/worker/src/app.module.ts`
- Add `apps/worker/src/config/configuration.ts`
- Add `apps/worker/src/config/env.validation.ts`
- Add minimal worker bootstrap
- Leave import slots for shared/database/integrations modules

Do not:

- Implement RabbitMQ consuming
- Implement analysis orchestration

### 8. Create Worker Processor, Job, and Scheduler Stubs

- [x] Create worker processor/job/scheduler class stubs. Commit: 9cdd3dc

Do:

- Add `processors/analysis-run.processor.ts`
- Add `processors/github-repository.processor.ts`
- Add `processors/question-generation.processor.ts`
- Add `jobs/analysis-run.job.ts`
- Add `jobs/question-generation.job.ts`
- Add `schedulers/cleanup.scheduler.ts`
- Register classes as DI providers in worker `AppModule`

Do not:

- Call GitHub API
- Save repository files
- Run LLM analysis or question generation
- Implement status transitions
- Implement cleanup policy

### 9. Create Core Lib Enums and Folders

- [x] Create `libs/core` enums and common folder layout. Commit: b5b54d0

Do:

- Add `analysis-run-status.enum.ts`
- Add `analysis-stage.enum.ts`
- Add `llm-message-role.enum.ts`
- Add `generated-question-category.enum.ts`
- Add folders: `constants`, `types`, `value-objects`, `services`
- Export from `libs/core/src/index.ts`

Do not:

- Implement value-object validation
- Implement domain services

### 10. Create Database Lib TypeORM and Entity Stubs

- [x] Create `libs/database` TypeORM config and entity stubs. Commit: 26da378

Do:

- Add `config/typeorm.config.ts`
- Add `entities/base-timestamp.entity.ts`
- Add entity stubs:
  - `users.entity.ts`
  - `groups.entity.ts`
  - `refresh-tokens.entity.ts`
  - `applicants.entity.ts`
  - `applicant-repositories.entity.ts`
  - `analysis-runs.entity.ts`
  - `llm-messages.entity.ts`
  - `repository-files.entity.ts`
  - `code-analysis.entity.ts`
  - `generated-questions.entity.ts`
  - `prompt-templates.entity.ts`
- Add folders: `migrations`, `subscribers`, `seeds`
- Export from `libs/database/src/index.ts`

Do not:

- Finalize detailed column options
- Implement detailed relations
- Write migrations or seed data

### 11. Create GitHub Integration Stubs

- [x] Create GitHub integration module skeleton. Commit: 4c5b43b

Do:

- Add `github.module.ts`
- Add `github.client.ts`
- Add `github.service.ts`
- Add folders: `dto`, `mappers`
- Reserve mapper location for converting GitHub responses to internal DTOs

Do not:

- Implement REST/GraphQL calls
- Implement URL parsing
- Implement rate-limit/private-repo error handling

### 12. Create LLM Integration Stubs

- [x] Create LLM provider adapter skeleton. Commit: dd10748

Do:

- Add `llm.module.ts`
- Add `llm.client.ts`
- Add `llm.service.ts`
- Add folders: `prompt-builder`, `parsers`
- Reserve an interface location for future provider adapters

Do not:

- Call models
- Build prompts
- Parse structured output
- Normalize generated questions

### 13. Create RabbitMQ and Redis Integration Stubs

- [x] Create RabbitMQ and Redis integration skeletons. Commit: c166bfe

Do:

- Add `rabbitmq/rabbitmq.module.ts`
- Add folders: `rabbitmq/publishers`, `rabbitmq/consumers`, `rabbitmq/contracts`
- Add `redis/redis.module.ts`
- Add `redis/redis.service.ts`
- Add `redis/cache-keys.ts`
- Reserve locations for exchange/queue/cache-key constants

Do not:

- Implement RabbitMQ connection/channel logic
- Implement publish/consume behavior
- Implement Redis cache or lock behavior

### 14. Create Contracts Lib Folders

- [ ] Create `libs/contracts` API, queue, and event folders. Commit: _pending_

Do:

- Add folders: `api`, `queue`, `events`
- Add `libs/contracts/src/index.ts`
- Reserve location for RabbitMQ analysis request payload types

Do not:

- Define detailed API response DTOs
- Finalize event schemas

### 15. Create Shared Lib Folders

- [ ] Create `libs/shared` support folders. Commit: _pending_

Do:

- Add folders: `logger`, `utils`, `helpers`, `exceptions`
- Add `libs/shared/src/index.ts`
- Reserve location for common exception response format

Do not:

- Configure logger transports
- Implement common exception filters
- Implement helper functions

### 16. Create Docker Compose Skeleton

- [ ] Create local infra compose skeleton for PostgreSQL, Redis, and RabbitMQ. Commit: _pending_

Do:

- Add `docker-compose.yml`
- Define PostgreSQL service
- Define Redis service
- Define RabbitMQ service
- Add basic ports, volumes, and env examples

Do not:

- Add production deploy config
- Auto-run migrations
- Add observability stack

### 17. Create Test Folders and Base Test Config

- [ ] Create base test directories and config placeholders. Commit: _pending_

Do:

- Add `test/e2e`
- Add `test/integration`
- Add Jest or Nest base test config
- Reserve location for API/Worker smoke tests

Do not:

- Implement full E2E scenario
- Implement DB/RabbitMQ/Redis integration tests
- Implement service unit tests

### 18. Verify Skeleton Build

- [ ] Verify type check and build for the skeleton. Commit: _pending_

Do:

- Run package install with the chosen package manager
- Verify API app build
- Verify Worker app build
- Check TypeScript path aliases
- Fix missing imports/exports

Do not:

- Test business features
- Require live DB/RabbitMQ/Redis connections

### 19. Final Skeleton Review

- [ ] Compare generated structure with the spec and fix missing skeleton items. Commit: _pending_

Do:

- Compare actual files with `docs/server-spec.md`
- Confirm no module business logic was added
- Confirm worker processors/jobs stay as stubs
- Add minimal README/run commands only if needed

Do not:

- Develop features
- Write ERD/migrations
- Generate API docs
