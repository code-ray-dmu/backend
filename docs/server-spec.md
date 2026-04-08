
---

# 1. 프로젝트 개요

## 1.1 프로젝트명

* `code-ray-server`

## 1.2 목표

사용자가 지원자의 GitHub URL을 입력하면 서버가 GitHub API를 호출하여 레포지토리를 분석하고, 팀의 기술 스택 및 컬쳐핏 기준을 반영하여 LLM 기반 면접 질문을 자동 생성하는 백엔드 시스템을 구축한다.

## 1.3 핵심 기술 스택

* **Framework**: NestJS
* **Language**: TypeScript
* **ORM**: TypeORM
* **Database**: PostgreSQL
* **Queue**: RabbitMQ
* **Cache / Lock**: Redis
* **External API**: GitHub API
* **LLM Provider**: 추후 확장 가능한 provider adapter 구조
* **Auth**: JWT Access Token + Refresh Token
* **Infra**: Docker / Docker Compose

---

# 2. 아키텍처 원칙

## 2.1 구조 원칙

본 프로젝트는 NestJS monorepo 구조를 사용하며, 다음 두 애플리케이션으로 구성한다.

* **API App**

  * 클라이언트 요청 처리
  * 인증/인가
  * 그룹, 지원자, 저장소, 분석 실행 이력 조회/등록
  * 분석 작업 큐 발행
* **Worker App**

  * RabbitMQ 메시지 consume
  * GitHub API 호출
  * 저장소 파일/분석 결과 저장
  * LLM 질문 생성
  * 분석 상태 업데이트

## 2.2 책임 분리

* **RDB**

  * 영속 데이터 저장
  * 사용자, 그룹, 지원자, 저장소, 분석 실행, 결과, 질문, 프롬프트 템플릿 관리
* **RabbitMQ**

  * 분석 비동기 작업 처리
* **Redis**

  * GitHub API 응답 캐시
  * 중복 실행 방지 lock
  * 작업 진행 상태 보조 캐시
* **GitHub API**

  * 저장소 메타데이터 / 파일 내용 조회
* **LLM**

  * 분석 요약 / 질문 생성

---

# 3. 디렉토리 구조 명세

```bash
code-ray-server/
├─ apps/
│  ├─ api/
│  │  └─ src/
│  │     ├─ main.ts
│  │     ├─ app.module.ts
│  │     ├─ common/
│  │     │  ├─ decorators/
│  │     │  ├─ dto/
│  │     │  ├─ enums/
│  │     │  ├─ exceptions/
│  │     │  ├─ filters/
│  │     │  ├─ guards/
│  │     │  ├─ interceptors/
│  │     │  ├─ interfaces/
│  │     │  ├─ pipes/
│  │     │  └─ utils/
│  │     ├─ config/
│  │     │  ├─ configuration.ts
│  │     │  └─ env.validation.ts
│  │     └─ modules/
│  │        ├─ auth/
│  │        ├─ users/
│  │        ├─ groups/
│  │        ├─ applicants/
│  │        ├─ applicant-repositories/
│  │        ├─ analysis-runs/
│  │        ├─ generated-questions/
│  │        ├─ prompt-templates/
│  │        └─ health/
│  │
│  └─ worker/
│     └─ src/
│        ├─ main.ts
│        ├─ app.module.ts
│        ├─ config/
│        │  ├─ configuration.ts
│        │  └─ env.validation.ts
│        ├─ processors/
│        │  ├─ analysis-run.processor.ts
│        │  ├─ github-repository.processor.ts
│        │  └─ question-generation.processor.ts
│        ├─ jobs/
│        │  ├─ analysis-run.job.ts
│        │  └─ question-generation.job.ts
│        └─ schedulers/
│           └─ cleanup.scheduler.ts
│
├─ libs/
│  ├─ core/
│  │  └─ src/
│  │     ├─ constants/
│  │     ├─ enums/
│  │     ├─ types/
│  │     ├─ value-objects/
│  │     └─ services/
│  │
│  ├─ database/
│  │  └─ src/
│  │     ├─ config/
│  │     │  └─ typeorm.config.ts
│  │     ├─ migrations/
│  │     ├─ subscribers/
│  │     ├─ seeds/
│  │     └─ entities/
│  │
│  ├─ integrations/
│  │  └─ src/
│  │     ├─ github/
│  │     │  ├─ github.module.ts
│  │     │  ├─ github.client.ts
│  │     │  ├─ github.service.ts
│  │     │  ├─ dto/
│  │     │  └─ mappers/
│  │     ├─ llm/
│  │     │  ├─ llm.module.ts
│  │     │  ├─ llm.client.ts
│  │     │  ├─ llm.service.ts
│  │     │  ├─ prompt-builder/
│  │     │  └─ parsers/
│  │     ├─ rabbitmq/
│  │     │  ├─ rabbitmq.module.ts
│  │     │  ├─ publishers/
│  │     │  ├─ consumers/
│  │     │  └─ contracts/
│  │     └─ redis/
│  │        ├─ redis.module.ts
│  │        ├─ redis.service.ts
│  │        └─ cache-keys.ts
│  │
│  ├─ contracts/
│  │  └─ src/
│  │     ├─ api/
│  │     ├─ queue/
│  │     ├─ events/
│  │     └─ index.ts
│  │
│  └─ shared/
│     └─ src/
│        ├─ logger/
│        ├─ utils/
│        ├─ helpers/
│        ├─ exceptions/
│        └─ index.ts
│
├─ test/
│  ├─ e2e/
│  └─ integration/
├─ .env
├─ .env.local
├─ .env.test
├─ .env.production
├─ docker-compose.yml
├─ nest-cli.json
├─ package.json
├─ tsconfig.json
└─ tsconfig.build.json
```

---

# 4. 모듈 구성 명세

`apps/api/src/modules` 하위는 **ERD의 테이블 중심**으로 구성한다.

## 4.1 auth

### 책임

* 회원가입
* 로그인
* JWT 발급
* Refresh Token 재발급 / 폐기

### 연관 테이블

* `users`
* `refresh_tokens`

### 내부 구성

```bash
auth/
├─ auth.module.ts
├─ auth.controller.ts
├─ auth.service.ts
├─ auth.facade.ts
├─ dto/
├─ strategies/
│  ├─ jwt-access.strategy.ts
│  └─ jwt-refresh.strategy.ts
├─ guards/
│  ├─ jwt-auth.guard.ts
│  └─ jwt-refresh.guard.ts
└─ interfaces/
   └─ jwt-payload.interface.ts
```

---

## 4.2 users

### 책임

* 사용자 조회
* 사용자 기본 정보 관리

### 연관 테이블

* `users`

### 내부 구성

```bash
users/
├─ users.module.ts
├─ users.controller.ts
├─ users.service.ts
├─ dto/
└─ repositories/
   └─ users.repository.ts
```

---

## 4.3 groups

### 책임

* 팀/그룹 생성 및 관리
* 기술 스택, 컬쳐핏 우선순위 관리

### 연관 테이블

* `groups`

### 내부 구성

```bash
groups/
├─ groups.module.ts
├─ groups.controller.ts
├─ groups.service.ts
├─ dto/
└─ repositories/
   └─ groups.repository.ts
```

---

## 4.4 applicants

### 책임

* 지원자 등록/조회/수정
* 특정 그룹 소속 지원자 관리

### 연관 테이블

* `applicants`

### 내부 구성

```bash
applicants/
├─ applicants.module.ts
├─ applicants.controller.ts
├─ applicants.service.ts
├─ dto/
└─ repositories/
   └─ applicants.repository.ts
```

---

## 4.5 applicant-repositories

### 책임

* 지원자별 실제 분석 대상 GitHub 저장소 관리
* GitHub URL 정규화
* 저장소 메타데이터 저장

### 연관 테이블

* `applicant_repositories`
* `repository_files`

### 내부 구성

```bash
applicant-repositories/
├─ applicant-repositories.module.ts
├─ applicant-repositories.controller.ts
├─ applicant-repositories.service.ts
├─ dto/
├─ repositories/
│  ├─ applicant-repositories.repository.ts
│  └─ repository-files.repository.ts
└─ services/
   └─ repository-url-parser.service.ts
```

---

## 4.6 analysis-runs

### 책임

* 분석 실행 생성
* 분석 상태 조회
* 큐 발행
* 실행 이력 관리

### 연관 테이블

* `analysis_runs`
* `llm_messages`
* `code_analysis`

### 내부 구성

```bash
analysis-runs/
├─ analysis-runs.module.ts
├─ analysis-runs.controller.ts
├─ analysis-runs.service.ts
├─ analysis-runs.facade.ts
├─ dto/
├─ repositories/
│  ├─ analysis-runs.repository.ts
│  ├─ llm-messages.repository.ts
│  └─ code-analysis.repository.ts
└─ publishers/
   └─ analysis-run.publisher.ts
```

---

## 4.7 generated-questions

### 책임

* 생성된 면접 질문 조회
* 질문 결과 저장
* 카테고리별 정렬 및 우선순위 관리

### 연관 테이블

* `generated_questions`

### 내부 구성

```bash
generated-questions/
├─ generated-questions.module.ts
├─ generated-questions.controller.ts
├─ generated-questions.service.ts
├─ dto/
└─ repositories/
   └─ generated-questions.repository.ts
```

---

## 4.8 prompt-templates

### 책임

* 프롬프트 템플릿 CRUD
* 활성 템플릿 버전 관리
* 목적별 템플릿 조회

### 연관 테이블

* `prompt_templates`

### 내부 구성

```bash
prompt-templates/
├─ prompt-templates.module.ts
├─ prompt-templates.controller.ts
├─ prompt-templates.service.ts
├─ dto/
└─ repositories/
   └─ prompt-templates.repository.ts
```

---

## 4.9 health

### 책임

* 헬스체크
* DB / Redis / RabbitMQ 상태 확인

---

# 5. Worker 구성 명세

Worker는 API에서 발행한 메시지를 consume하여 비동기 분석을 수행한다.

## 5.1 analysis-run.processor.ts

### 책임

* 분석 실행 메시지 수신
* 실행 상태 변경
* 전체 파이프라인 orchestration

### 처리 흐름

1. `analysis_runs.status = QUEUED`
2. 메시지 수신 후 `IN_PROGRESS`
3. GitHub 저장소 정보 조회
4. 주요 파일 추출 및 `repository_files` 저장
5. LLM 분석 요청 및 `llm_messages` 저장
6. 최종 분석 결과 `code_analysis` 저장
7. 질문 생성
8. `generated_questions` 저장
9. 완료 시 `COMPLETED`, 실패 시 `FAILED`

---

## 5.2 github-repository.processor.ts

### 책임

* GitHub API 호출
* 저장소 기본 정보 / 브랜치 / 파일 목록 / 핵심 파일 raw content 조회

### 저장 대상

* `applicant_repositories`
* `repository_files`

---

## 5.3 question-generation.processor.ts

### 책임

* 그룹의 `tech_stacks`, `culture_fit_priority`
* 저장소 분석 결과
* 프롬프트 템플릿
  을 결합해 질문 생성

### 저장 대상

* `llm_messages`
* `generated_questions`

---

# 6. Entity 설계 명세

모든 Entity는 `libs/database/src/entities`에 위치시킨다.

## 6.1 공통 베이스 엔티티

```ts
abstract class BaseTimestampEntity {
  createdAt: Date;
  updatedAt: Date;
}
```

적용 대상:

* users
* groups
* applicants
* applicant_repositories
* analysis_runs
* repository_files
* code_analysis
* prompt_templates

---

## 6.2 UsersEntity

* `id: uuid`
* `email: string`
* `passwordHash: string`
* `name?: string`

관계:

* `groups`: one-to-many
* `refreshTokens`: one-to-many
* `requestedAnalysisRuns`: one-to-many

---

## 6.3 GroupsEntity

* `id: uuid`
* `userId: uuid`
* `name: string`
* `description?: string`
* `techStacks: Record<string, unknown>` (`jsonb`)
* `cultureFitPriority: string`

관계:

* `user`: many-to-one
* `applicants`: one-to-many

---

## 6.4 RefreshTokensEntity

* `id: number`
* `userId: uuid`
* `tokenValue: string`
* `expiresAt: Date`
* `isRevoked: boolean`

관계:

* `user`: many-to-one

---

## 6.5 ApplicantsEntity

* `id: uuid`
* `groupId: uuid`
* `name: string`
* `email: string`
* `githubUrl: string`

관계:

* `group`: many-to-one
* `repositories`: one-to-many
* `analysisRuns`: one-to-many
* `generatedQuestions`: one-to-many
* `codeAnalyses`: one-to-many

---

## 6.6 ApplicantRepositoriesEntity

* `id: uuid`
* `applicantId: uuid`
* `repoName: string`
* `repoFullName: string`
* `repoUrl: string`
* `defaultBranch?: string`

관계:

* `applicant`: many-to-one
* `files`: one-to-many
* `analysisRuns`: one-to-many

---

## 6.7 AnalysisRunsEntity

* `id: uuid`
* `applicantId: uuid`
* `repositoryId: uuid`
* `requestedByUserId: uuid`
* `status: AnalysisRunStatus`
* `currentStage?: AnalysisStage`
* `startedAt?: Date`
* `completedAt?: Date`
* `failureReason?: string`

관계:

* `applicant`: many-to-one
* `repository`: many-to-one
* `requestedByUser`: many-to-one
* `llmMessages`: one-to-many
* `codeAnalysis`: one-to-one
* `generatedQuestions`: one-to-many

---

## 6.8 LlmMessagesEntity

* `id: uuid`
* `analysisRunId: uuid`
* `stage: AnalysisStage`
* `role: LlmMessageRole`
* `content: string`

관계:

* `analysisRun`: many-to-one

---

## 6.9 RepositoryFilesEntity

* `id: uuid`
* `repositoryId: uuid`
* `path: string`
* `rawAnalysisReport?: string`

관계:

* `repository`: many-to-one

---

## 6.10 CodeAnalysisEntity

* `id: uuid`
* `analysisRunId: uuid`
* `applicantId: uuid`
* `rawAnalysisReport: string`

관계:

* `analysisRun`: one-to-one
* `applicant`: many-to-one

---

## 6.11 GeneratedQuestionsEntity

* `id: uuid`
* `analysisRunId: uuid`
* `applicantId: uuid`
* `category: GeneratedQuestionCategory`
* `questionText: string`
* `intent?: string`
* `priority?: number`

관계:

* `analysisRun`: many-to-one
* `applicant`: many-to-one

---

## 6.12 PromptTemplatesEntity

* `id: number`
* `templateKey: string`
* `templateName: string`
* `purpose: string`
* `templateText: string`
* `variablesJson?: Record<string, unknown>`
* `version: number`
* `isActive: boolean`

---

# 7. Enum 명세

`libs/core/src/enums`에 정의한다.

## 7.1 AnalysisRunStatus

```ts
export enum AnalysisRunStatus {
  QUEUED = 'QUEUED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
```

## 7.2 AnalysisStage

```ts
export enum AnalysisStage {
  REPO_LIST = 'REPO_LIST',
  FOLDER_STRUCTURE = 'FOLDER_STRUCTURE',
  FILE_DETAIL = 'FILE_DETAIL',
  SUMMARY = 'SUMMARY',
  QUESTION_GENERATION = 'QUESTION_GENERATION',
}
```

## 7.3 LlmMessageRole

```ts
export enum LlmMessageRole {
  SYSTEM = 'SYSTEM',
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
}
```

## 7.4 GeneratedQuestionCategory

```ts
export enum GeneratedQuestionCategory {
  SKILL = 'SKILL',
  CULTURE_FIT = 'CULTURE_FIT',
}
```

---

# 8. TypeORM 설정 명세

## 8.1 DB 종류

* PostgreSQL

## 8.2 TypeORM 설정 위치

* `libs/database/src/config/typeorm.config.ts`

## 8.3 설정 원칙

* `autoLoadEntities: false`
* 운영 환경에서 `synchronize: false`
* migration 기반 스키마 관리
* snake_case naming strategy 적용

## 8.4 예시 구성

```ts
TypeOrmModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    type: 'postgres',
    host: configService.get<string>('DB_HOST'),
    port: configService.get<number>('DB_PORT'),
    username: configService.get<string>('DB_USERNAME'),
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_NAME'),
    entities: [__dirname + '/../entities/*.entity.{ts,js}'],
    migrations: [__dirname + '/../migrations/*.{ts,js}'],
    synchronize: false,
    logging: configService.get<string>('NODE_ENV') !== 'production',
    uuidExtension: 'pgcrypto',
  }),
  inject: [ConfigService],
})
```

## 8.5 Migration 정책

* 모든 테이블은 migration으로 생성
* enum 변경도 migration으로 처리
* 배포 파이프라인에서 migration 실행

---

# 9. Repository 패턴 명세

각 모듈은 TypeORM entity를 직접 controller에서 다루지 않고, service를 통해 접근한다.

원칙:

* `Controller -> Service -> Repository`
* 복잡한 쿼리는 custom repository 또는 query service로 분리
* worker에서도 동일 repository layer 재사용 가능하게 설계

예시:

* `groups.repository.ts`
* `analysis-runs.repository.ts`
* `generated-questions.repository.ts`

---

# 10. 분석 파이프라인 명세

## 10.1 입력

* 사용자 ID
* 지원자 ID
* 저장소 ID

## 10.2 처리 단계

### 1) 분석 실행 생성

* `analysis_runs` 레코드 생성
* 상태 `QUEUED`

### 2) 큐 발행

* RabbitMQ에 분석 요청 메시지 발행

### 3) GitHub 저장소 분석

* repo 기본 정보 조회
* 기본 브랜치 조회
* 파일 트리 탐색
* 핵심 파일 추출
* `repository_files` 저장

### 4) 단계별 LLM 메시지 기록

* repo 목록/폴더 구조/파일 내용/요약/질문 생성 요청과 응답 저장
* `llm_messages` 저장

### 5) 코드 분석 결과 저장

* `code_analysis.raw_analysis_report` 저장

### 6) 질문 생성

* 그룹 기술 스택
* 컬쳐핏 우선순위
* 코드 분석 결과
* 활성 prompt template
  를 사용하여 질문 생성

### 7) 질문 저장

* `generated_questions` 저장

### 8) 완료 처리

* `analysis_runs.status = COMPLETED`

### 9) 실패 처리

* `analysis_runs.status = FAILED`
* `failure_reason` 저장

---

# 11. RabbitMQ 메시지 명세

## 11.1 Exchange / Queue 예시

* Exchange: `code-ray.analysis`
* Queue: `analysis.run.requested`
* Queue: `analysis.run.retry`
* Queue: `question.generation.requested`

## 11.2 메시지 payload 예시

```json
{
  "analysisRunId": "uuid",
  "applicantId": "uuid",
  "repositoryId": "uuid",
  "requestedByUserId": "uuid",
  "requestedAt": "2026-04-08T10:00:00Z"
}
```

## 11.3 실패 정책

* 최대 재시도 횟수 설정
* 재시도 초과 시 dead-letter queue 이동
* 실패 사유는 `analysis_runs.failure_reason`에 반영

---

# 12. Redis 사용 명세

## 12.1 사용 목적

* GitHub API 호출 캐시
* 분석 중복 실행 방지 락
* 분석 진행률 임시 저장

## 12.2 캐시 키 예시

* `github:repo:{repoFullName}`
* `github:tree:{repoFullName}:{branch}`
* `analysis:lock:{repositoryId}`
* `analysis:progress:{analysisRunId}`

---

# 13. GitHub 연동 명세

## 13.1 위치

* `libs/integrations/src/github`

## 13.2 책임

* URL 파싱
* 저장소 정보 조회
* 트리 조회
* 파일 content 조회
* rate limit 대응

## 13.3 원칙

* API 응답 원문을 바로 서비스 계층에 노출하지 않음
* mapper로 내부 DTO 변환
* 404 / rate limit / private repository 예외 구분 처리

---

# 14. LLM 연동 명세

## 14.1 위치

* `libs/integrations/src/llm`

## 14.2 책임

* 프롬프트 조합
* 모델 호출
* structured output 파싱
* 질문 생성 결과 정규화

## 14.3 입력 컨텍스트

* 그룹 정보
* 기술 스택
* 컬쳐핏 우선순위
* 저장소 분석 결과
* prompt template

## 14.4 출력 형식

```json
[
  {
    "category": "SKILL",
    "questionText": "트랜잭션 처리 로직을 이렇게 설계한 이유를 설명해 주세요.",
    "intent": "아키텍처 판단 근거 검증",
    "priority": 1
  },
  {
    "category": "CULTURE_FIT",
    "questionText": "이 프로젝트에서 협업 시 가장 중요하게 생각한 기준은 무엇이었나요?",
    "intent": "협업 성향 검증",
    "priority": 2
  }
]
```

---

# 15. 환경변수 명세

## 15.1 공통

```env
NODE_ENV=local
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=code_ray

REDIS_HOST=localhost
REDIS_PORT=6379

RABBITMQ_URL=amqp://guest:guest@localhost:5672

JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=14d

GITHUB_TOKEN=your-github-token

LLM_API_KEY=your-llm-api-key
LLM_MODEL=your-model-name
```

## 15.2 validation 대상

* 필수값 누락 시 부팅 실패
* 숫자형 포트 validation
* JWT 만료 형식 validation

---

# 16. 보안 명세

## 16.1 인증

* Access Token: 짧은 만료
* Refresh Token: DB 저장 및 revoke 처리

## 16.2 비밀번호

* bcrypt 해시 사용
* 원문 저장 금지

## 16.3 권한

* 그룹 소유자만 그룹/지원자/분석 결과 접근 가능

## 16.4 민감 데이터

* GitHub 토큰, LLM 키는 env로만 관리
* 로그에 비밀값 출력 금지

---

# 17. 예외 처리 명세

## 17.1 공통 예외 필터

응답 형식 통일:

```json
{
  "timestamp": "2026-04-08T10:00:00.000Z",
  "path": "/analysis-runs",
  "code": "ANALYSIS_RUN_NOT_FOUND",
  "message": "Analysis run not found"
}
```

## 17.2 주요 예외 코드

* `AUTH_INVALID_CREDENTIALS`
* `AUTH_REFRESH_TOKEN_REVOKED`
* `GROUP_NOT_FOUND`
* `APPLICANT_NOT_FOUND`
* `REPOSITORY_NOT_FOUND`
* `ANALYSIS_RUN_NOT_FOUND`
* `GITHUB_REPOSITORY_ACCESS_DENIED`
* `GITHUB_RATE_LIMIT_EXCEEDED`
* `LLM_RESPONSE_PARSE_FAILED`

---

# 18. 테스트 명세

## 18.1 단위 테스트

대상:

* service
* repository-url-parser
* prompt-builder
* auth token 로직

## 18.2 통합 테스트

대상:

* TypeORM repository
* DB relation
* GitHub service mock integration
* RabbitMQ publisher/consumer

## 18.3 E2E 테스트

시나리오:

* 회원가입 → 로그인 → 그룹 생성 → 지원자 등록 → 저장소 등록 → 분석 요청 → 질문 조회

---

# 19. 생성 명령 및 초기 셋업 명세

## 19.1 프로젝트 생성

* NestJS monorepo 모드 사용
* `apps/api`, `apps/worker` 생성
* `libs/core`, `libs/database`, `libs/integrations`, `libs/contracts`, `libs/shared` 생성

## 19.2 필수 패키지

### 공통

* `@nestjs/common`
* `@nestjs/core`
* `@nestjs/config`
* `@nestjs/jwt`
* `@nestjs/passport`
* `passport`
* `passport-jwt`
* `passport-local`
* `class-validator`
* `class-transformer`
* `bcrypt`

### DB

* `@nestjs/typeorm`
* `typeorm`
* `pg`

### Queue / Cache

* `amqplib` 또는 Nest용 RabbitMQ 패키지
* `ioredis`

### 기타

* `uuid`
* `dotenv`
* `joi`

---
