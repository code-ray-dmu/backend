# code-ray-server 기술 명세서 (Tech Spec)

> 버전: 1.1 | 작성일: 2026-04-12

---

## 1. 문서 개요

### 1.1 목적

이 문서는 `code-ray-server` 백엔드의 구현 지침서다. 아키텍처 개요에 그치지 않고, 실제 코드를 작성하는 개발자가 모듈 책임, 데이터 흐름, 상태 전이, 외부 연동 방식, 파이프라인 처리 순서를 직접 참조하여 구현할 수 있도록 작성한다.

추상적인 설명보다 **책임 경계**, **처리 소유권**, **상태 관리 규칙**을 중심으로 기술한다.

### 1.2 범위

- API App(`apps/api`)과 Worker App(`apps/worker`)의 전체 백엔드 구현 범위
- PostgreSQL, Redis, RabbitMQ, GitHub API, LLM 연동 설계
- 분석 파이프라인의 비동기 처리 흐름 전반
- MVP 범위에 한정. 프로덕션 운영 확장은 제외

### 1.3 참조 문서

- [`docs/server-spec.md`](./server-spec.md): 프로젝트 구조, 기술 스택, 모듈 구성, Worker 구성의 기준
- [`docs/api-spec.md`](./api-spec.md): API 엔드포인트, 인증 정책, 요청/응답 형식의 기준
- [`docs/erd.md`](./erd.md): 데이터 모델, 엔티티 관계, 분석 결과 저장 구조의 기준

---

## 2. MVP 범위

### 2.1 구현 대상

- 회원가입 / 로그인 / JWT 토큰 발급 및 재발급
- 그룹 생성 및 조회 (소유자 기반 접근 제어 포함)
- 지원자 등록 및 조회
- 지원자의 GitHub 공개 저장소 목록 조회 API
- `applicant_repositories` 내부 자동 생성 (분석 요청 시 GitHub API로 최근 수정 저장소 자동 선택)
- 분석 실행 요청 → 비동기 파이프라인 → 질문 조회 전체 흐름
- GitHub API를 통한 저장소 파일 수집 및 LLM 기반 핵심 파일 선별
- LLM을 통한 코드 분석 및 면접 질문 생성
- 분석 상태 폴링 API (`GET /analysis-runs/{id}`)
- 프롬프트 템플릿 관리 (내부 운영용, 일반 사용자 접근 불가)

### 2.2 MVP 제외 항목

- 소셜 로그인 (OAuth2)
- 실시간 알림 (WebSocket / SSE)
- 관리자 콘솔 및 내부 운영 API (프롬프트 템플릿 관리는 별도 수동 운영)
- 멀티 LLM 제공자 자동 전환 (provider 추상화는 설계하되 MVP는 단일 provider)
- private 저장소 접근 (public 저장소만 지원)
- 재분석 (동일 지원자/저장소 조합에 COMPLETED 분석이 이미 존재하면 새 분석 요청 거부)
- 질문 재생성 (기존 분석 결과로부터 질문만 다시 생성하는 기능 미지원)
- 로그아웃 기능 (Refresh Token 폐기 방식의 로그아웃 미지원, 클라이언트 토큰 삭제로 처리)

### 2.3 핵심 MVP 제약

- 모든 리소스는 **분석 요청자(requested_by_user_id)** 단위로 접근 제어한다. 멤버 초대나 공유 기능은 없다.
- `applicants.github_url`은 **GitHub 프로필 URL만 허용**한다 (`https://github.com/{owner}` 형식). 개별 저장소 URL 직접 입력은 지원하지 않는다.
- `applicant_repositories`는 분석 요청 시 GitHub API로 최근 수정된 공개 저장소를 자동으로 최대 N개(환경변수 `MAX_REPO_SELECTION_COUNT`, 기본값 3) 선택하여 내부적으로 생성된다. 수동 등록 엔드포인트는 제공하지 않는다.
- 하나의 저장소에 대해 동시에 하나의 분석 실행만 허용한다 (Redis lock으로 제어).
- 이미 COMPLETED 상태의 `analysis_run`이 존재하는 지원자/저장소 조합에 대한 재분석 요청은 거부한다.
- LLM이 분석할 핵심 파일은 최대 N개(환경변수 `MAX_ANALYSIS_FILES`)로 제한한다.
- LLM 응답은 structured output을 전제로 하며, 파싱 실패 시 분석 실행이 FAILED 처리된다.

---

## 3. 도메인 모델 및 핵심 개념

### 3.1 User

면접관 또는 채용 담당자. 이 시스템의 실제 사용자다. 회원가입 시 `email` + `password_hash`로 저장되며 JWT를 통해 인증한다. 각 User는 하나 이상의 Group을 소유한다. 모든 리소스 접근의 인가 기준이 되는 최상위 소유자 개념이다.

연관: `groups` (1:N), `refresh_tokens` (1:N), `analysis_runs` (요청자, 1:N)

### 3.2 Group

면접관 팀의 단위. 기술 스택(`tech_stacks: jsonb`)과 문화 적합성 우선순위(`culture_fit_priority`)를 보유한다. 이 두 값은 LLM 질문 생성 시 컨텍스트로 제공되며, 그룹마다 다른 성격의 질문이 생성되도록 설계되어 있다.

Group은 반드시 특정 User에 속한다. 그룹의 지원자, 분석 결과, 생성된 질문은 모두 이 그룹 소유자 User만 접근할 수 있다.

연관: `users` (N:1), `applicants` (1:N)

### 3.3 Applicant

특정 그룹에 등록된 지원자. `github_url` 필드에는 **GitHub 프로필 URL만 허용**한다 (`https://github.com/{owner}` 형식). 이 URL은 분석 요청 시 GitHub API를 통해 해당 사용자의 공개 저장소 목록을 조회하는 출발점이 된다.

`Applicant` 자체는 분석의 주체이며, 분석 결과(`code_analysis`)와 생성된 질문(`generated_questions`)이 `applicant_id`로 직접 연결된다.

연관: `groups` (N:1), `applicant_repositories` (1:N), `analysis_runs` (1:N), `generated_questions` (1:N), `code_analysis` (1:N)

### 3.4 ApplicantRepository

`Applicant`의 실제 분석 대상 저장소. **사용자가 직접 등록하는 것이 아니라**, 분석 요청 시 `applicant.github_url`(프로필 URL)로 GitHub API를 조회하여 최근 수정된 공개 저장소를 최대 N개(`MAX_REPO_SELECTION_COUNT`) 자동 선택하고 내부적으로 생성된다. `repo_full_name`(`owner/repo`)은 GitHub API 호출의 식별자로 사용된다. `default_branch`는 저장소 기본 정보 조회 시 저장한다.

하나의 지원자에 여러 저장소가 생성될 수 있으며, 분석 실행은 저장소 단위(`repository_id`)로 각각 생성된다.

연관: `applicants` (N:1), `repository_files` (1:N), `analysis_runs` (1:N)

### 3.5 AnalysisRun

분석 1회 실행의 단위. 동일 `(applicant_id, repository_id)` 조합에 이미 `COMPLETED` 상태의 레코드가 존재하면 새 분석 요청을 거부한다(재분석 불허). 상태(`status`)와 현재 단계(`current_stage`)를 추적하며, 실패 시 `failure_reason`에 원인을 기록한다.

API는 `POST /applicants/{applicantId}/questions` 호출을 통해 분석 실행을 시작하며, 응답에 `analysisRunIds` 배열을 포함하여 클라이언트가 즉시 폴링 URL을 구성할 수 있도록 한다. 저장소가 여러 개 선택될 수 있으므로 복수 ID 배열로 반환한다. 클라이언트는 `GET /analysis-runs/{id}`로 각 실행의 진행 상태를 확인한다.

연관: `applicants` (N:1), `applicant_repositories` (N:1), `users` (요청자, N:1), `llm_messages` (1:N), `code_analysis` (1:1), `generated_questions` (1:N)

### 3.6 LlmMessage

LLM과 단계별로 주고받은 모든 메시지의 영구 기록. `stage`(분석 단계)와 `role`(SYSTEM / USER / ASSISTANT)로 구분된다. 각 단계에서 프롬프트로 전달한 내용과 LLM이 반환한 응답을 모두 저장하여, 분석 과정의 재현성과 디버깅을 지원한다.

연관: `analysis_runs` (N:1)

### 3.7 RepositoryFile

LLM 분석에 실제 전달된 핵심 파일의 경로와 내용을 저장한다. 저장소 전체 파일 트리를 정규화하지 않고, Worker가 선별한 핵심 파일만 저장한다. `path` 컬럼에 파일 경로를, `raw_analysis_report`에 파일 내용(또는 개별 파일 단위 분석 결과)을 저장한다.

연관: `applicant_repositories` (N:1)

### 3.8 CodeAnalysis

분석 실행 단위의 최종 종합 분석 결과. LLM이 전체 파일을 검토한 뒤 작성한 코드 요약 및 평가를 `raw_analysis_report` 텍스트 컬럼에 저장한다. 이 결과는 이후 질문 생성 단계(`QUESTION_GENERATION`)의 입력으로 사용된다.

연관: `analysis_runs` (1:1), `applicants` (N:1)

### 3.9 GeneratedQuestion

LLM이 생성한 면접 질문. `category`(`SKILL` 또는 `CULTURE_FIT`), `question_text`, `intent`, `priority`를 포함한다. 하나의 `AnalysisRun`에 복수의 질문이 생성되며, 지원자 단위로도 조회 가능하도록 `applicant_id`를 직접 저장한다.

연관: `analysis_runs` (N:1), `applicants` (N:1)

### 3.10 PromptTemplate

LLM 호출에 사용되는 프롬프트 텍스트의 관리 단위. `template_key`로 식별하며, `purpose` 필드로 분석 단계별 용도를 구분한다. `version`과 `is_active` 필드로 활성 버전을 관리한다. Worker는 각 분석 단계에서 해당 단계의 `is_active = true`인 템플릿을 조회하여 사용한다.

---

## 4. 시스템 아키텍처

### 4.1 전체 구조

시스템은 NestJS monorepo 구조를 기반으로 두 개의 독립 애플리케이션으로 구성된다.

```
code-ray-server (monorepo)
├── apps/api      → HTTP 요청 처리, 인증/인가, 큐 발행
└── apps/worker   → 비동기 분석 파이프라인 실행
```

두 앱은 공유 라이브러리(`libs/`)를 통해 Entity, Enum, 연동 클라이언트를 재사용한다.

```
libs/
├── core/         → Enum, 공통 타입, 상수
├── database/     → TypeORM 설정, Entity, Migration
├── integrations/ → GitHub / LLM / RabbitMQ / Redis 클라이언트
├── contracts/    → API 요청/응답 타입, 큐 메시지 타입
└── shared/       → 공통 유틸, 로거, 예외
```

### 4.2 동기 처리와 비동기 처리의 경계

```
[Client]
   │
   ▼
[API App]  ──(HTTP 동기)──▶ 인증/인가, 데이터 조회, 분석 요청 등록
   │
   └──(RabbitMQ 발행)──▶ [Worker App] ──▶ GitHub API / LLM / DB 쓰기
```

- API App은 분석 실행을 등록(`analysis_runs` 레코드 생성)하고 RabbitMQ에 메시지를 발행한 뒤 즉시 `{ success: true, analysisRunIds: [...] }`를 반환한다.
- 이후 실제 분석 처리(GitHub 조회, LLM 호출, 결과 저장)는 전부 Worker App이 담당한다.
- 클라이언트는 `GET /analysis-runs/{analysisRunId}`를 폴링하여 진행 상태를 확인한다.

### 4.3 인프라 역할 정의

**PostgreSQL**
- 모든 영속 데이터 저장
- 사용자, 그룹, 지원자, 저장소, 분석 실행, 결과, 질문, 프롬프트 템플릿

**RabbitMQ**
- 분석 비동기 작업 전달
- API App → Worker App 단방향 메시지 흐름
- 재시도 큐 및 dead-letter 큐 운영

**Redis**
- GitHub API 응답 캐시 (`github:repo:*`, `github:tree:*`)
- 동일 저장소 동시 분석 방지 lock (`analysis:lock:{repositoryId}`)
- 분석 진행률 임시 캐시 (`analysis:progress:{analysisRunId}`)

**GitHub API**
- 저장소 메타데이터, 파일 트리, 핵심 파일 raw content 조회
- `libs/integrations/src/github`에서 추상화

**LLM**
- 코드 분석 요약 및 면접 질문 생성
- `libs/integrations/src/llm`에서 provider adapter 구조로 추상화

### 4.4 디렉토리 책임 경계 요약

- `apps/api/src/modules/`: HTTP 요청 처리, 인증/인가, 큐 발행
- `apps/worker/src/processors/`: RabbitMQ consume 및 파이프라인 오케스트레이션 (`analysis-run`, `github-repository`, `llm-analysis`)
- `apps/worker/src/jobs/`: 파이프라인 단계별 실행 단위 로직
- `apps/worker/src/schedulers/`: 정기 정리 작업 (만료된 데이터 cleanup 등)
- `libs/integrations/`: 외부 API 클라이언트 (HTTP 호출, 파싱, 매핑)
- `libs/database/src/entities/`: TypeORM Entity 정의 (단일 소스)
- `libs/core/src/enums/`: 시스템 전체 공유 Enum 정의

---

## 5. 모듈 설계

### 5.1 API 모듈

#### auth

**책임**
회원가입, 로그인, JWT Access Token 발급, Refresh Token 재발급 및 폐기.

**주요 유스케이스**
- `POST /users/sign-up`: 이메일 중복 확인 후 `users` 생성. 비밀번호는 bcrypt로 해시 후 저장.
- `POST /users/sign-in`: 이메일/비밀번호 검증. Access Token + Refresh Token 발급. Refresh Token은 `refresh_tokens` 테이블에 저장.
- `POST /users/refresh-token`: Refresh Token의 유효성(만료, 폐기 여부) 검증 후 새 Access Token 발급.

**연관 엔티티**: `users`, `refresh_tokens`

**인가 체크**: 이 모듈의 엔드포인트는 인증 예외 대상. Guard 미적용.

**Worker 연결**: 없음.

**내부 구조**
```
auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── auth.facade.ts
├── dto/
├── strategies/
│   ├── jwt-access.strategy.ts    ← Access Token 검증 전략
│   └── jwt-refresh.strategy.ts   ← Refresh Token 검증 전략
├── guards/
│   ├── jwt-auth.guard.ts
│   └── jwt-refresh.guard.ts
└── interfaces/
    └── jwt-payload.interface.ts  ← { sub: userId, email }
```

---

#### users

**책임**
인증된 사용자의 기본 정보 조회. 현재 사용자(`GET /users/me`) 정도의 범위를 예상한다. (추천: api-spec에 명시되지 않았으므로 오픈 이슈로 이동)

**주요 유스케이스**
- JWT에서 추출된 userId로 `users` 레코드 조회

**연관 엔티티**: `users`

**인가 체크**: Access Token 필수. `JwtAuthGuard` 적용.

**Worker 연결**: 없음.

---

#### groups

**책임**
면접관 팀(그룹) 생성 및 조회. `tech_stacks`와 `culture_fit_priority`를 관리한다.

**주요 유스케이스**
- `POST /groups`: 현재 인증된 userId를 소유자로 그룹 생성. `tech_stacks`는 jsonb로 저장.
- `GET /groups`: 현재 userId가 소유한 그룹 목록 조회. 페이지네이션 지원.
- `GET /groups/{groupId}`: 단건 조회. 소유자 검증 필수 (`group.userId === jwtPayload.sub`).

**연관 엔티티**: `groups`

**인가 체크**: 모든 엔드포인트에 `JwtAuthGuard` 적용. 상세 조회 시 `group.userId !== currentUserId`이면 `403 FORBIDDEN_RESOURCE_ACCESS`.

**Worker 연결**: 없음. 그러나 Worker는 질문 생성 시 `groups.tech_stacks`와 `culture_fit_priority`를 DB에서 직접 조회한다.

---

#### applicants

**책임**
지원자 등록, 조회. 특정 그룹에 소속되며 그룹 소유자만 접근 가능하다. 분석 요청, 질문 조회, GitHub 저장소 목록 조회의 진입점 라우트도 `applicants.controller.ts`가 소유한다.

**주요 유스케이스**
- `POST /applicants`: `groupId` 검증(그룹 존재 여부 + 소유자 일치) 후 지원자 생성. `githubUrl`은 프로필 URL 형식만 허용.
- `GET /applicants`: `groupId` 필터 지원. 현재 userId가 소유한 그룹의 지원자만 조회.
- `GET /applicants/{applicantId}`: 단건 조회. 지원자 → 그룹 → userId 경로로 소유자 검증.
- `GET /applicants/{applicantId}/github-repos`: **GitHub 공개 저장소 목록 조회.** `applicants.controller.ts`에 `@Get(':applicantId/github-repos')`로 선언. 내부적으로 `GitHubService`를 호출하여 해당 지원자의 GitHub 프로필 공개 저장소 목록을 반환한다. `applicant_repositories` 레코드를 생성하지 않으며, 조회 전용이다.
- `POST /applicants/{applicantId}/questions`: **분석 실행 요청 진입점.** `applicants.controller.ts`에 `@Post(':applicantId/questions')`로 선언하며, 내부적으로 `AnalysisRunsService`에 위임하여 GitHub 저장소 자동 선택 → `applicant_repositories` 생성 → 저장소별 재분석 여부 확인 → `analysis_runs` 레코드 생성 → 큐 발행을 수행한다. 응답에 `analysisRunIds` 배열을 포함한다.
- `GET /applicants/{applicantId}/questions`: **생성된 질문 조회.** `applicants.controller.ts`에 `@Get(':applicantId/questions')`로 선언하며, 내부적으로 `GeneratedQuestionsService`에 위임한다.

하위 라우트(`/github-repos`, `/questions`)는 URL 경로 구조상 지원자를 부모 리소스로 두므로 `applicants.controller.ts`에서 라우트를 정의하되, 처리 로직은 각각 해당 서비스로 위임한다.

**연관 엔티티**: `applicants`

**인가 체크**: 지원자 접근 시 항상 `applicant.group.userId === currentUserId` 검증.

**Worker 연결**: 없음. Worker는 분석 실행 시 `applicant_id`로 지원자 정보를 조회한다.

---

#### applicant-repositories

**책임**
지원자의 분석 대상 GitHub 저장소 관리. **수동 등록 엔드포인트를 제공하지 않는다.** `applicant_repositories` 레코드는 분석 요청 시 `AnalysisRunsService`가 내부적으로 생성한다.

**내부 생성 흐름**:
1. `POST /applicants/{applicantId}/questions` 요청 수신
2. `applicant.github_url`(프로필 URL)에서 `owner` 추출
3. GitHub API로 `owner`의 공개 저장소 목록 조회 (최근 수정 기준 정렬)
4. 상위 N개(`MAX_REPO_SELECTION_COUNT`, 기본값 3) 선택
5. 각 저장소에 대해 `applicant_repositories` 레코드 생성 (없는 경우에만)

**주요 유스케이스**
- 저장소 목록 조회: `GET /applicants/{applicantId}/repositories` — 해당 지원자에 대해 생성된 `applicant_repositories` 레코드 목록 반환. (추가 엔드포인트, api-spec 추가 필요)

**연관 엔티티**: `applicant_repositories`, `repository_files`

**서비스 분리**: `repository-url-parser.service.ts`에서 GitHub 프로필 URL → `owner` 파싱 로직을 독립 분리.

**URL 파싱 규칙**:
- `https://github.com/{owner}` → `owner` 추출. 프로필 URL 형식만 허용.
- 저장소 URL 형식(`https://github.com/{owner}/{repo}`)은 유효성 검사 단계에서 거부한다.

**인가 체크**: 지원자 소유자 검증 경유(`applicant.group.userId === currentUserId`).

**Worker 연결**: Worker의 `github-repository.processor`가 `applicant_repositories` 레코드를 조회하고 `default_branch`를 업데이트한다.

---

#### analysis-runs

**책임**
분석 실행 생성(저장소 자동 생성 + 큐 발행 포함), 상태 조회, 실행 이력 관리.

분석 실행의 진입점은 `POST /applicants/{applicantId}/questions`이며, 이 요청이 들어오면 내부적으로 `analysis-runs` 서비스가 GitHub 저장소 자동 선택 → `applicant_repositories` 생성 → 실행 레코드 생성 → 큐 발행을 수행한다.

**주요 유스케이스**
- 분석 요청(`POST /applicants/{applicantId}/questions` 처리 시 내부 호출):
  1. `applicantId`로 지원자 존재 여부 및 `applicant.group.userId === currentUserId` 검증
  2. `GitHubService`로 프로필의 공개 저장소 조회 → 최근 수정 상위 `MAX_REPO_SELECTION_COUNT`개 선택
  3. 선택된 저장소별로 `applicant_repositories` upsert (이 시점에 `repository_id` 확정)
  4. 각 저장소에 대해 `(applicantId, repositoryId)` 조합으로 COMPLETED 상태의 `analysis_run` 존재 여부 확인. 모든 저장소가 COMPLETED이면 `ANALYSIS_RUN_ALREADY_COMPLETED` 에러 반환.
  5. 재분석 대상이 아닌 저장소에 대해 `analysis_runs` 레코드 생성 (`status: QUEUED`)
  6. RabbitMQ에 저장소별 메시지 발행 (`analysis-run.publisher.ts`)
  7. `{ success: true, analysisRunIds: [...] }` 반환
- `GET /analysis-runs/{analysisRunId}`: 상태 + 현재 단계 조회
- `GET /analysis-runs`: 목록 조회. `applicantId` 필터 지원.

**연관 엔티티**: `analysis_runs`, `llm_messages`, `code_analysis`

**Publisher**: `analysis-run.publisher.ts`에서 RabbitMQ exchange/queue에 발행.

**인가 체크**: `analysis_runs.requested_by_user_id === currentUserId` 검증. 다른 사용자가 요청한 분석 실행에는 접근 불가.

**Worker 연결**: 발행 후 Worker가 consume하여 파이프라인 실행.

---

#### generated-questions

**책임**
생성된 면접 질문 조회. 질문 저장은 Worker가 수행하며, API는 조회 전용.

**주요 유스케이스**
- `GET /applicants/{applicantId}/questions`: 해당 지원자의 생성된 질문 목록 조회. 페이지네이션, 정렬 지원.

**연관 엔티티**: `generated_questions`

**인가 체크**: `applicant → group → userId` 경로로 소유자 검증.

**Worker 연결**: Worker의 `llm-analysis.processor`가 생성 후 저장.

---

#### prompt-templates

**책임**
프롬프트 템플릿 CRUD. 활성 버전 관리, 목적별 조회.

**주요 유스케이스**
- 템플릿 생성: `template_key`, `purpose`, `template_text`, `version`, `is_active` 저장.
- 활성 템플릿 조회: `purpose` + `is_active = true` 조건으로 Worker가 사용할 템플릿 조회.
- 버전 변경: `is_active` 전환을 통해 버전 관리. 동일 `purpose`에 `is_active = true`인 레코드는 1개만 유지 (권장).

**연관 엔티티**: `prompt_templates`

**인가 체크**: **일반 사용자 접근 불가.** 프롬프트 템플릿은 내부 운영 담당자가 직접 DB 또는 별도 수단으로 관리한다. MVP에서는 이 모듈의 HTTP 엔드포인트를 외부에 노출하지 않거나, 별도 내부망 전용 라우트로 제한한다.

**Worker 연결**: Worker가 각 분석 단계에서 해당 `purpose`의 활성 템플릿을 DB에서 직접 조회하여 사용.

---

#### health

**책임**
서버 헬스체크. DB, Redis, RabbitMQ 연결 상태 확인.

**주요 유스케이스**
- `GET /health`: 각 인프라 컴포넌트 상태를 확인하고 요약 결과 반환.

**인가 체크**: 인증 예외.

---

### 5.2 Worker 컴포넌트

Worker App은 RabbitMQ 메시지를 consume하여 분석 파이프라인을 실행한다. 세 개의 processor로 책임을 분리한다.

#### analysis-run.processor

**책임**
분석 실행 메시지 수신 및 전체 파이프라인 오케스트레이션.

- 메시지 수신 후 `analysis_runs.status = IN_PROGRESS`, `startedAt = now()` 업데이트
- `github-repository.processor`를 호출하여 저장소 기본 정보 및 파일 트리 수집
- `llm-analysis.processor`를 호출하여 핵심 파일 선별 (LLM 기반)
- `github-repository.processor`를 재호출하여 선별된 파일 raw content 수집
- `llm-analysis.processor`를 호출하여 코드 분석(SUMMARY) 및 질문 생성(QUESTION_GENERATION)
- 성공: `status = COMPLETED`, `completedAt = now()`
- 실패: `status = FAILED`, `failure_reason`에 에러 내용 저장

이 processor는 파이프라인 전체를 책임지며, 세부 단계는 하위 processor에 위임한다.

#### github-repository.processor

**책임**
GitHub API 호출 전담. LLM 호출은 수행하지 않는다.

- REPO_LIST: `applicant_repositories.repo_full_name`으로 저장소 기본 정보 조회 → `default_branch` 저장
- FOLDER_STRUCTURE: 기본 브랜치 파일 트리 전체 조회 → 경로 목록 반환
- FILE_DETAIL: `llm-analysis.processor`가 선별한 파일 경로 목록에 대해 GitHub API로 raw content 조회 → `repository_files` 레코드 저장
- `current_stage`를 `REPO_LIST` → `FOLDER_STRUCTURE` → `FILE_DETAIL`로 순차 업데이트

**중요**: GitHub API 응답을 직접 서비스 레이어에 노출하지 않으며, `mappers/`로 내부 DTO 변환 후 반환한다.

#### llm-analysis.processor

**책임**
모든 LLM 호출 전담. GitHub API 호출은 수행하지 않는다.

`question-generation.processor`에서 이름이 변경됨. 파일 선별 LLM 작업을 포함하도록 책임이 확장되었다.

세부 역할:
- **파일 선별 (FOLDER_STRUCTURE 단계 이후)**: `github-repository.processor`가 반환한 파일 트리 경로 목록을 활성 프롬프트 템플릿(`purpose = 'file_selection'`)과 함께 LLM에 전달. LLM이 분석할 핵심 파일 경로 목록을 선별하여 반환. 최대 파일 수는 `MAX_ANALYSIS_FILES` 환경변수로 제한. `llm_messages` 저장 (FOLDER_STRUCTURE 단계).
- **코드 분석 요약 (SUMMARY)**: 선별된 파일 내용을 종합하여 LLM에 최종 분석 요청. `code_analysis` 저장.
- **질문 생성 (QUESTION_GENERATION)**: 그룹 컨텍스트 + 코드 분석 결과 + 활성 프롬프트 템플릿(`purpose = 'question_generation'`)으로 LLM에 질문 생성 요청. `generated_questions` 저장.
- 모든 LLM 입출력을 `llm_messages`에 저장 (stage + role 포함).

---

## 6. 데이터 설계

### 6.1 엔티티 역할 요약

ERD 기준으로 각 테이블의 역할과 주요 설계 의도는 다음과 같다.

- `users`: 시스템 사용자. 모든 데이터의 소유 기준.
- `refresh_tokens`: Refresh Token 영구 저장 및 폐기 추적.
- `groups`: 채용 팀 단위. `tech_stacks(jsonb)` + `culture_fit_priority`로 LLM 컨텍스트 제공.
- `applicants`: 지원자. `github_url`로 GitHub 연동의 출발점.
- `applicant_repositories`: 실제 분석 대상 저장소. `repo_full_name`이 GitHub API 호출 식별자.
- `analysis_runs`: 분석 1회 실행 단위. 상태 머신의 중심.
- `llm_messages`: 분석 과정의 모든 LLM 통신 기록 (재현성 보장).
- `repository_files`: Worker가 선별하여 LLM에 전달한 핵심 파일.
- `code_analysis`: 분석 실행별 최종 종합 보고서.
- `generated_questions`: 면접 질문 결과 저장. 카테고리/우선순위 포함.
- `prompt_templates`: LLM 프롬프트의 버전 관리 단위.

### 6.2 관계 구조

```
users
 └── groups (1:N, userId)
      └── applicants (1:N, groupId)
           └── applicant_repositories (1:N, applicantId)
                └── repository_files (1:N, repositoryId)
                └── analysis_runs (1:N, repositoryId + applicantId)
                     └── llm_messages (1:N, analysisRunId)
                     └── code_analysis (1:1, analysisRunId)
                     └── generated_questions (1:N, analysisRunId + applicantId)

users
 └── refresh_tokens (1:N, userId)
```

### 6.3 주요 제약 조건

- `users.email`: UNIQUE, NOT NULL
- `groups.user_id`: NOT NULL (FK → users)
- `applicant_repositories.repo_full_name`: NOT NULL
- `analysis_runs.status`: NOT NULL (enum: QUEUED / IN_PROGRESS / COMPLETED / FAILED)
- `llm_messages.stage`: NOT NULL (enum: REPO_LIST / FOLDER_STRUCTURE / FILE_DETAIL / SUMMARY / QUESTION_GENERATION)
- `llm_messages.role`: NOT NULL (enum: SYSTEM / USER / ASSISTANT)
- `generated_questions.category`: NOT NULL (enum: SKILL / CULTURE_FIT)
- `prompt_templates.template_key`: UNIQUE, NOT NULL
- `refresh_tokens.is_revoked`: DEFAULT false

### 6.4 인덱스 권장 컬럼

- `groups(user_id)`: 사용자별 그룹 조회
- `applicants(group_id)`: 그룹별 지원자 조회
- `applicant_repositories(applicant_id)`: 지원자별 저장소 조회
- `analysis_runs(applicant_id)`: 지원자별 실행 이력 조회
- `analysis_runs(repository_id)`: 저장소별 실행 이력 조회
- `analysis_runs(status)`: 상태 기반 Worker 필터링 (선택)
- `llm_messages(analysis_run_id)`: 실행별 메시지 조회
- `generated_questions(applicant_id)`: 지원자별 질문 조회
- `generated_questions(analysis_run_id)`: 실행별 질문 조회
- `prompt_templates(purpose, is_active)`: 활성 템플릿 조회
- `refresh_tokens(user_id, is_revoked)`: 유효 토큰 조회

### 6.5 Enum 관리

모든 Enum은 `libs/core/src/enums/`에 정의하며 DB 컬럼은 `text` 타입으로 저장한다. TypeORM의 `enum` 컬럼 타입 대신 `text`를 사용하되 application 레벨에서 validation을 적용한다. Enum 값 변경은 반드시 migration으로 처리한다.

정의된 Enum:
- `AnalysisRunStatus`: `QUEUED | IN_PROGRESS | COMPLETED | FAILED`
- `AnalysisStage`: `REPO_LIST | FOLDER_STRUCTURE | FILE_DETAIL | SUMMARY | QUESTION_GENERATION`
- `LlmMessageRole`: `SYSTEM | USER | ASSISTANT`
- `GeneratedQuestionCategory`: `SKILL | CULTURE_FIT`

> `analysis_runs.current_stage`와 `llm_messages.stage` 모두 `SUMMARY`를 포함하는 것으로 확정한다. api-spec과 ERD의 `analysis_runs.current_stage` 컬럼 주석도 이에 맞춰 수정이 필요하다.

### 6.6 저장 및 보존 고려사항

- `llm_messages.content`는 LLM에 전달하는 전체 프롬프트 + 응답을 저장한다. **MVP 단계에서는 영구 보존**한다. 운영 확장 시 보존 기간 정책 수립.
- `repository_files.raw_analysis_report`는 선택 파일의 원문을 저장한다. 개별 파일 content는 **최대 100KB**로 제한한다. 초과 파일은 잘라내거나 건너뛴다.
- `code_analysis.raw_analysis_report`는 LLM의 최종 분석 결과 전문이다.
- `refresh_tokens`: 만료 및 폐기된 토큰은 주기적으로 cleanup이 필요하다. `apps/worker/src/schedulers/cleanup.scheduler.ts`에서 처리.

---

## 7. API 설계 원칙

### 7.1 인증 예외 엔드포인트

아래 3개 엔드포인트는 인증 없이 접근 가능하다. 나머지 모든 엔드포인트는 `Authorization: Bearer {accessToken}` 헤더 필수.

- `POST /v1/users/sign-up`
- `POST /v1/users/sign-in`
- `POST /v1/users/refresh-token`

### 7.2 공통 응답 형식

모든 응답은 다음 구조를 따른다.

성공 응답:
```json
{
  "data": { ... } | [...] | null,
  "meta": {
    "request_id": "uuid",
    "page": 1,
    "size": 20,
    "total": 0
  },
  "error": null
}
```

실패 응답:
```json
{
  "data": null,
  "meta": { "request_id": "uuid" },
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

`meta.request_id`는 모든 응답에 포함된다. 페이지네이션 응답에는 `page`, `size`, `total`도 포함한다.

### 7.3 URL 구조 원칙

- Base URL: `/v1`
- 리소스 중심 URL 구조 사용
- 소유 관계는 경로에 표현: `/applicants/{applicantId}/questions`
- 컬렉션은 복수형 명사: `/groups`, `/applicants`, `/analysis-runs`

### 7.4 페이지네이션 및 정렬

- 페이지네이션: `page`(1부터 시작), `size`(기본값 20) 쿼리 파라미터
- 정렬: `sort`(필드명), `order`(`asc` | `desc`) 쿼리 파라미터
- 응답 `meta`에 `total`을 포함하여 클라이언트가 전체 건수를 파악 가능하도록 함

### 7.5 에러 코드 체계

공통:
- `VALIDATION_ERROR`: 요청 파라미터/바디 유효성 오류
- `UNAUTHORIZED`: 인증 토큰 미제공 또는 무효
- `FORBIDDEN_RESOURCE_ACCESS`: 타인의 리소스 접근 시도
- `INTERNAL_SERVER_ERROR`: 서버 내부 오류

인증:
- `USER_EMAIL_CONFLICT`: 이메일 중복
- `AUTH_INVALID_CREDENTIALS`: 이메일/비밀번호 불일치
- `AUTH_TOKEN_INVALID`: 토큰 형식 오류
- `AUTH_TOKEN_EXPIRED`: Access Token 만료
- `AUTH_REFRESH_TOKEN_REVOKED`: Refresh Token 폐기됨

도메인 (HTTP 응답 error.code):
- `GROUP_NOT_FOUND`
- `APPLICANT_NOT_FOUND`
- `ANALYSIS_RUN_NOT_FOUND`
- `ANALYSIS_RUN_ALREADY_COMPLETED`: 해당 지원자의 모든 저장소에 이미 COMPLETED 분석이 존재하여 재분석 요청이 거부됨

> `GITHUB_REPOSITORY_ACCESS_DENIED`, `GITHUB_RATE_LIMIT_EXCEEDED`, `LLM_RESPONSE_PARSE_FAILED`는 GitHub API 및 LLM 호출이 Worker 비동기 파이프라인에서만 발생하므로 HTTP 응답 error.code로는 사용되지 않는다. 이 값들은 `analysis_runs.failure_reason`의 접두어로 사용되는 파이프라인 내부 식별자다. 상세 내용은 §8.4 참고.
>
> 예외: `applicant_repositories` 등록 시 URL 검증 단계에서 저장소 접근성을 사전 확인하는 설계를 선택한다면, `GITHUB_REPOSITORY_ACCESS_DENIED`는 HTTP 에러 코드로도 사용될 수 있다. 이 경우 명시적으로 api-spec에 추가해야 한다. (오픈 이슈)

### 7.6 인증 / 인가 원칙

- 인증: JWT Access Token을 `Authorization: Bearer` 헤더로 전달. `JwtAuthGuard`가 `jwt-access.strategy`를 통해 검증.
- 인가: 리소스 소유자 확인은 Service 레이어에서 처리. Guard는 인증 여부만 확인.
- Refresh Token: Body로 전달. `jwt-refresh.strategy`가 DB 조회 후 `is_revoked`, `expires_at` 검증.
- Refresh Token 재발급 시 기존 토큰 폐기 후 신규 발급을 권장 (Rotation 정책).

---

## 8. 분석 파이프라인 상세 설계

### 8.1 분석 요청 진입 흐름

클라이언트가 `POST /v1/applicants/{applicantId}/questions`를 호출하면:

1. `JwtAuthGuard`가 Access Token 검증
2. `ApplicantsService`에서 `applicantId` 존재 여부 및 `applicant.group.userId === currentUserId` 검증
3. `GitHubService`로 `applicant.github_url`의 `owner`에 대한 공개 저장소 목록 조회. 최근 수정 기준 상위 `MAX_REPO_SELECTION_COUNT`개 선택.
4. 선택된 저장소별로 `applicant_repositories` upsert (이 시점에 `repository_id`가 확정됨).
5. 각 저장소에 대해 **재분석 여부 확인**: `(applicantId, repositoryId)` 조합으로 COMPLETED 상태의 `analysis_run`이 존재하면 해당 저장소에 대한 분석 요청을 건너뛴다. 모든 저장소가 이미 COMPLETED 상태이면 에러 반환 (`ANALYSIS_RUN_ALREADY_COMPLETED`).
6. 재분석 대상이 아닌 저장소에 대해 `analysis_runs` 레코드 생성:
   - `status: QUEUED`
   - `applicantId`, `repositoryId`, `requestedByUserId` 설정
   - `startedAt`, `completedAt`, `failureReason`은 null
7. `AnalysisRunPublisher`를 통해 저장소별로 RabbitMQ에 메시지 발행
8. API는 `{ success: true, analysisRunIds: ["uuid1", "uuid2", ...] }` 즉시 반환

### 8.2 RabbitMQ 메시지 구조

```json
{
  "analysisRunId": "uuid",
  "applicantId": "uuid",
  "repositoryId": "uuid",
  "requestedByUserId": "uuid",
  "requestedAt": "2026-04-12T10:00:00Z"
}
```

Exchange: `code-ray.analysis`
Queue: `analysis.run.requested`

### 8.3 Worker 처리 흐름

Worker의 `analysis-run.processor`가 메시지를 수신하면 다음 순서로 처리한다.

#### 단계 0: 중복 실행 방지

```
Redis SETNX analysis:lock:{repositoryId} {analysisRunId} EX 600
```

Lock 획득 실패 시(이미 해당 저장소에 대한 분석이 진행 중) 메시지를 reject하고 `FAILED` 처리한다.

#### 단계 1: 분석 실행 상태 업데이트

```
analysis_runs.status = IN_PROGRESS
analysis_runs.startedAt = now()
```

#### 단계 2: GitHub 저장소 기본 정보 조회 (REPO_LIST) — `github-repository.processor`

`analysis_runs.current_stage = REPO_LIST`

- `github-repository.processor.getRepoInfo(repoFullName)` 호출
- 캐시 확인: `redis.get('github:repo:{repoFullName}')` → 없으면 GitHub API 호출 후 캐시 저장
- 반환값: `default_branch`, `language` 등
- `applicant_repositories.default_branch` 업데이트

#### 단계 3: 파일 트리 조회 (FOLDER_STRUCTURE) — `github-repository.processor`

`analysis_runs.current_stage = FOLDER_STRUCTURE`

- `github-repository.processor.getFileTree(repoFullName, branch)` 호출
- 캐시 확인: `redis.get('github:tree:{repoFullName}:{branch}')` → 없으면 호출 후 캐시 저장
- 전체 파일 경로 목록을 반환 (LLM 호출은 이 단계에서 수행하지 않음)

#### 단계 3.5: 핵심 파일 선별 (FOLDER_STRUCTURE 단계 내 LLM 호출) — `llm-analysis.processor`

`current_stage`는 FOLDER_STRUCTURE 유지 (별도 stage 전환 없음)

- `llm-analysis.processor.selectFiles(filePaths, groupContext)` 호출
- 활성 프롬프트 템플릿(`purpose = 'file_selection'`, `is_active = true`) 조회
- 파일 경로 목록 + 그룹 기술 스택 컨텍스트를 LLM에 전달
- LLM이 분석해야 할 핵심 파일 경로 목록을 반환:
  ```json
  ["src/service/UserService.ts", "src/repository/UserRepository.ts", ...]
  ```
- 선별 파일 수가 `MAX_ANALYSIS_FILES`를 초과하는 경우 상위 N개만 사용
- 선별 기준: 진입점 파일, 서비스/도메인 계층 파일, 크기 100KB 이하, 바이너리 파일 제외
- `llm_messages` 저장 (stage: FOLDER_STRUCTURE, role: USER + ASSISTANT)

#### 단계 4: 핵심 파일 raw content 수집 및 저장 (FILE_DETAIL) — `github-repository.processor`

`analysis_runs.current_stage = FILE_DETAIL`

- `github-repository.processor.getFileContents(repoFullName, branch, selectedPaths)` 호출
- 선별된 파일 경로별로 GitHub API raw content 조회
- 파일별로 `repository_files` 레코드 저장 (`path`, `raw_analysis_report`에 파일 원문 저장)

#### 단계 5: 종합 코드 분석 (SUMMARY) — `llm-analysis.processor`

`analysis_runs.current_stage = SUMMARY`

- `llm-analysis.processor.analyzeCode(fileContents, groupContext)` 호출
- 활성 프롬프트 템플릿(`purpose = 'code_summary'`) 조회
- 수집된 파일 내용 전체를 LLM에 전달하여 최종 코드 분석 요청
- `llm_messages` 저장 (SUMMARY 단계, role: USER + ASSISTANT)
- `code_analysis` 레코드 저장: `raw_analysis_report = LLM 응답`

#### 단계 6: 질문 생성 (QUESTION_GENERATION) — `llm-analysis.processor`

`analysis_runs.current_stage = QUESTION_GENERATION`

- `llm-analysis.processor.generateQuestions(codeAnalysis, groupContext)` 호출
- 그룹의 `tech_stacks`, `culture_fit_priority` 조회
- `code_analysis.raw_analysis_report` 조회
- 활성 프롬프트 템플릿(`purpose = 'question_generation'`) 조회
- LLM에 질문 생성 요청
- `llm_messages` 저장 (QUESTION_GENERATION 단계)
- LLM 응답을 JSON 파싱:
  ```json
  [
    { "category": "SKILL", "questionText": "...", "intent": "...", "priority": 1 },
    { "category": "CULTURE_FIT", "questionText": "...", "intent": "...", "priority": 2 }
  ]
  ```
- `generated_questions` 레코드 저장 (analysisRunId + applicantId 포함)

#### 단계 7: 완료 처리

```
analysis_runs.status = COMPLETED
analysis_runs.completedAt = now()
analysis_runs.current_stage = QUESTION_GENERATION (마지막 완료 단계)
```

Redis lock 해제: `DEL analysis:lock:{repositoryId}`

### 8.4 실패 처리

파이프라인의 어느 단계에서든 예외가 발생하면:

```
analysis_runs.status = FAILED
analysis_runs.failureReason = "단계명: 에러 메시지"
```

Redis lock은 반드시 해제한다 (finally 블록에서 처리).

`failure_reason` 기록 형식은 `"{파이프라인 오류 식별자}: {상세 메시지}"`로 작성한다.

파이프라인 오류 식별자 목록:
- `GITHUB_REPOSITORY_ACCESS_DENIED`: 저장소 없음, private 저장소, 접근 거부
- `GITHUB_RATE_LIMIT_EXCEEDED`: GitHub API 호출 한도 초과
- `LLM_RESPONSE_PARSE_FAILED`: LLM 응답 JSON 파싱 실패

`failure_reason` 기록 예시:
- `"GITHUB_RATE_LIMIT_EXCEEDED: rate limit remaining 0, resets at 2026-04-12T12:00:00Z"`
- `"GITHUB_REPOSITORY_ACCESS_DENIED: repository not found or is private"`
- `"LLM_RESPONSE_PARSE_FAILED: unexpected token at position 42"`

이 식별자들은 HTTP 응답 error.code가 아니라 `analysis_runs.failure_reason` 내에서만 사용된다.

### 8.5 상태 전이 규칙

```
QUEUED
  └──(Worker consume)──▶ IN_PROGRESS
                              ├──(모든 단계 성공)──▶ COMPLETED
                              └──(어느 단계든 실패)──▶ FAILED
```

`current_stage` 전이 순서: `REPO_LIST` → `FOLDER_STRUCTURE` → `FILE_DETAIL` → `SUMMARY` → `QUESTION_GENERATION`

단계 3.5(파일 선별 LLM 호출)는 `current_stage = FOLDER_STRUCTURE` 내에서 처리되며 별도 단계 전환이 없다.

각 단계 진입 시 `current_stage` 업데이트 후 처리를 시작한다. 실패 시 해당 단계의 `current_stage`가 유지된 상태로 `status = FAILED`가 된다.

**재분석 거부**: API 계층(§8.1 Step 5)에서 저장소별로 COMPLETED 상태의 `analysis_run`이 이미 존재하는지 확인한다. 모든 저장소가 이미 COMPLETED 상태이면 `ANALYSIS_RUN_ALREADY_COMPLETED` 에러를 반환한다. Worker 레벨에서 별도 중복 검사는 수행하지 않는다.

### 8.6 재시도 및 Dead-Letter 처리

- RabbitMQ 소비자는 메시지 처리 실패 시 최대 **2회** 재시도 (`RABBITMQ_MAX_RETRY=2`)
- 재시도는 `analysis.run.retry` 큐를 통해 처리
- 재시도 초과 시 `analysis.run.deadletter` 큐로 이동
- Dead-letter 큐에서는 수동 개입 또는 별도 알림 처리
- 재시도 시 `analysis_runs` 상태를 다시 `IN_PROGRESS`로 전환하기 전에 기존 레코드 처리 여부를 확인해야 함 (멱등성 보장 필요)

### 8.7 진행 상태 캐시

`analysis:progress:{analysisRunId}` 키에 현재 단계 정보를 저장하여 DB 조회를 줄일 수 있다.

```
redis.set('analysis:progress:{analysisRunId}', JSON.stringify({
  status: 'IN_PROGRESS',
  currentStage: 'FILE_DETAIL'
}), 'EX', 3600)
```

`GET /analysis-runs/{id}` 호출 시 Redis에 데이터가 있으면 캐시에서 반환하고, 없으면 DB에서 조회한다. (설계 제안)

---

## 9. 외부 연동 설계

### 9.1 GitHub 연동

#### 위치

`libs/integrations/src/github/`

#### URL 파싱

`repository-url-parser.service.ts`에서 처리한다.

- 허용 형식: `https://github.com/{owner}` (프로필 URL만 허용)
- `owner` 추출 후 GitHub API 호출에 사용
- 저장소 URL 형식(`https://github.com/{owner}/{repo}`)은 지원하지 않으며, 등록 시 즉시 `VALIDATION_ERROR` 반환

#### 저장소 조회 흐름

`github.client.ts`는 Octokit 또는 HTTP 클라이언트로 GitHub REST API를 직접 호출한다.
`github.service.ts`는 클라이언트 호출 + 캐시 처리 + 예외 변환을 담당한다.
`mappers/`에서 GitHub API 응답을 내부 DTO로 변환하여 서비스 레이어에 노출한다.

주요 호출 대상:
- `GET /users/{owner}/repos?sort=updated&direction=desc&type=public&per_page={MAX_REPO_SELECTION_COUNT}`: 사용자 공개 저장소 목록 (최근 수정 기준, API 및 Worker 공통 사용)
- `GET /repos/{owner}/{repo}`: 저장소 기본 정보 (default_branch 포함)
- `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`: 파일 트리
- `GET /repos/{owner}/{repo}/contents/{path}`: 파일 raw content

#### Rate Limit 처리

- GitHub API 응답 헤더(`X-RateLimit-Remaining`, `X-RateLimit-Reset`)를 모니터링
- 잔여 호출 수가 기준 미만이면 대기 또는 실패 처리
- 실패 시 `GITHUB_RATE_LIMIT_EXCEEDED` 파이프라인 오류 식별자 사용

#### 예외 구분

- `404`: 저장소 없음 또는 비공개. `GITHUB_REPOSITORY_ACCESS_DENIED`
- `403`: Rate limit 초과 또는 접근 거부. 원인에 따라 구분
- private 저장소: MVP에서는 지원하지 않는다. 공개 저장소만 조회하므로 감지 시 무시하거나 `GITHUB_REPOSITORY_ACCESS_DENIED` 반환

---

### 9.2 LLM 연동

#### 위치

`libs/integrations/src/llm/`

#### Provider Adapter 구조

`llm.client.ts`는 LLM provider에 독립적인 인터페이스를 정의한다. MVP에서는 단일 provider(예: OpenAI)를 구현하되, 다른 provider로 교체 가능한 구조를 유지한다.

```
LlmClientInterface (추상)
  └── OpenAILlmClient (구현체)
```

#### 프롬프트 템플릿 사용

`prompt-builder/`에서 `PromptTemplate`의 `template_text`에 변수를 주입하여 최종 프롬프트 문자열을 생성한다.

```
template_text: "다음 저장소 구조를 분석해 주세요:\n{{folder_structure}}\n기술 스택: {{tech_stacks}}"
variables_json: { "folder_structure": "string", "tech_stacks": "string" }
```

`prompt-builder`는 `variables_json`에 정의된 키를 기반으로 변수 치환을 수행한다.

#### Structured Output 처리

LLM은 JSON 형식의 구조화된 응답을 반환하도록 프롬프트에 지시한다.

`parsers/`에서 LLM 응답 문자열을 파싱하여 내부 DTO로 변환한다.

파싱 실패 처리:
- JSON 파싱 오류 시 `LLM_RESPONSE_PARSE_FAILED` 예외 발생
- 파이프라인 전체가 `FAILED` 처리됨
- `failure_reason`에 파싱 오류 상세 기록

#### 질문 생성 결과 정규화

LLM 응답의 각 질문 항목을 다음 규칙으로 정규화한다:
- `category`가 `SKILL` 또는 `CULTURE_FIT`가 아닌 경우 해당 항목 무시
- `questionText`가 비어 있는 경우 해당 항목 무시
- `priority`가 없는 경우 기본값 0 설정
- 정규화 후 유효한 항목만 `generated_questions`에 저장

---

### 9.3 RabbitMQ

#### Exchange / Queue 구조

- Exchange: `code-ray.analysis` (direct 또는 topic)
- Queue: `analysis.run.requested` ← API가 발행, Worker가 consume
- Queue: `analysis.run.retry` ← 재시도 대상 메시지
- Queue: `analysis.run.deadletter` ← 최대 재시도 초과 메시지

> **[server-spec 편차 명시 — 큐 구조]** `server-spec.md` §11.1은 `question.generation.requested` 큐를 별도로 정의하고 있다. 그러나 tech-spec에서는 이 큐를 사용하지 않는다. 그 이유는 `analysis-run.processor`가 파이프라인 전체를 오케스트레이션하며, `llm-analysis.processor`를 내부 메서드 호출로 직접 위임하기 때문이다. 별도 큐를 추가하면 파이프라인 상태 추적과 실패 처리가 복잡해지므로 MVP에서는 단일 큐 기반 설계를 선택한다. `analysis.run.deadletter`는 server-spec에 명시되지 않았으나 재시도 초과 메시지 격리를 위해 추가한다. `server-spec.md` §11.1의 큐 목록을 이 설계에 맞춰 수정하는 것이 필요하다.
>
> **[server-spec 편차 명시 — 디렉토리 구조]** `server-spec.md` §3의 디렉토리 구조에 `apps/worker/src/processors/question-generation.processor.ts`가 기재되어 있다. tech-spec v1.1에서 이 파일은 `llm-analysis.processor.ts`로 이름이 변경되었다. `server-spec.md` §3 및 §5.3의 파일명을 수정해야 한다.

#### Publisher (`apps/api`)

`analysis-run.publisher.ts`는 `libs/integrations/src/rabbitmq/publishers/`의 RabbitMQ 클라이언트를 사용하여 `analysis.run.requested` 큐에 메시지를 발행한다.

발행 실패 시:
- DB에 생성된 `analysis_runs` 레코드를 `FAILED` 처리
- 클라이언트에 오류 반환 (내부 서버 오류)

#### Consumer (`apps/worker`)

`libs/integrations/src/rabbitmq/consumers/`에서 메시지를 수신하고 `analysis-run.processor`에 전달한다.

메시지 ack 정책:
- 처리 성공: ack
- 비즈니스 오류(재시도 가능): nack + requeue or 재시도 큐로 라우팅
- 치명적 오류(재시도 불필요): nack + dead-letter 이동

#### 중복 실행 방지

Redis lock(`analysis:lock:{repositoryId}`)으로 동일 저장소의 동시 분석을 방지한다.

- Lock TTL: 10분 (파이프라인 최대 실행 시간 기준 설정)
- Lock 획득 실패: 메시지를 즉시 reject하고 `analysis_runs.status = FAILED`, `failureReason = "Concurrent analysis in progress"`

---

### 9.4 Redis

#### 역할별 키 전략

GitHub API 캐시:
- `github:repo:{repoFullName}` TTL 1시간
- `github:tree:{repoFullName}:{branch}` TTL 30분

분석 Lock:
- `analysis:lock:{repositoryId}` TTL 10분

분석 진행 상태 캐시 (설계 제안):
- `analysis:progress:{analysisRunId}` TTL 1시간

#### 캐시 무효화

저장소 메타데이터 캐시는 분석 재실행 시 자동 만료(TTL)로 관리한다. 명시적 무효화는 MVP에서 제공하지 않는다.

---

## 10. 프롬프트 및 질문 생성 정책

### 10.1 PromptTemplate 사용 원칙

Worker의 각 분석 단계는 DB의 `prompt_templates` 테이블에서 `purpose`로 해당 단계의 활성 템플릿을 조회하여 사용한다.

```
purpose 정의:
  - 'file_selection': 폴더 트리를 기반으로 분석할 핵심 파일 선별 요청 (FOLDER_STRUCTURE 단계)
  - 'code_summary': 선별된 파일 내용 전체를 종합하여 코드 분석 요약 요청 (SUMMARY 단계)
  - 'question_generation': 코드 분석 결과와 그룹 컨텍스트를 기반으로 질문 생성 요청 (QUESTION_GENERATION 단계)
```

각 `purpose`는 독립된 템플릿으로 관리하며, 하나의 `purpose`에는 `is_active = true`인 템플릿이 반드시 1개만 존재해야 한다.

### 10.2 활성 버전 관리

`version`과 `is_active`로 템플릿 버전을 관리한다.

- 새 버전 활성화 시: 기존 활성 템플릿의 `is_active = false` 처리 후 새 레코드 `is_active = true`
- 롤백 필요 시: 이전 버전 레코드의 `is_active`를 `true`로 변경
- 동일 `purpose`에 `is_active = true`가 복수 존재하면 Worker가 잘못된 템플릿을 사용할 수 있으므로 DB unique 제약 또는 애플리케이션 레벨 검증이 필요하다 (설계 제안)

### 10.3 목적별 템플릿 분리

분석 파이프라인의 각 단계는 별도 `purpose`의 템플릿을 사용한다. 하나의 범용 프롬프트를 재사용하지 않는다. 이는 단계별로 LLM에게 다른 역할과 출력 형식을 부여하기 위함이다.

### 10.4 질문 카테고리 정책

`SKILL` 카테고리:
- 코드에서 관찰된 기술적 결정, 패턴, 구조에 대한 질문
- 그룹의 `tech_stacks`를 기준으로 평가 관점 제공
- 예: "이 서비스에서 트랜잭션 처리를 이렇게 설계한 이유는?"

`CULTURE_FIT` 카테고리:
- 협업 방식, 코드 리뷰 성향, 문서화 습관 등 행동 특성 관련 질문
- 그룹의 `culture_fit_priority`를 기준으로 강조 관점 제공
- 예: "이 프로젝트에서 협업 시 가장 중요하게 생각한 기준은?"

### 10.5 질문 우선순위 관리

`priority` 값은 LLM이 직접 부여한다. 낮은 숫자일수록 높은 우선순위를 의미한다.

API 응답 시 `priority` 오름차순을 기본 정렬로 제공한다. 클라이언트는 `sort`/`order` 파라미터로 정렬 변경 가능.

### 10.6 질문 품질 기준 (LLM 프롬프트 지시 방향)

- 질문은 코드에서 실제로 관찰된 근거를 바탕으로 생성해야 한다 (hallucination 방지)
- 지원자가 실제로 작성한 코드에 대해 설명을 요구하는 형식
- 면접관이 추가 질문 없이 바로 사용할 수 있을 만큼 구체적으로 작성
- 하나의 질문에 여러 개념을 혼합하지 않음

### 10.7 중복/정렬 원칙

- 동일 `analysisRunId` 내에서 동일한 `questionText`가 중복 저장되지 않도록 LLM 프롬프트에서 지시한다.
- `generated_questions` 저장 시 애플리케이션 레벨에서 `questionText` 중복 체크를 추가로 수행한다 (설계 제안).

---

## 11. 보안 설계

### 11.1 JWT 인증 구조

- Access Token: 짧은 만료 시간(기본 1시간). JWT payload에 `{ sub: userId, email }` 포함.
- Refresh Token: 긴 만료 시간(기본 14일). DB(`refresh_tokens`)에 저장.
- Access Token은 stateless이므로 DB 조회 없이 서명 검증만으로 인증 가능.
- Refresh Token은 DB에 저장되어 있으므로 폐기(revoke) 처리가 가능.

### 11.2 Refresh Token 저장 및 폐기

로그인 시:
- `refresh_tokens` 레코드 생성 (`token_value`, `expires_at`, `is_revoked = false`)

재발급 시:
- 요청된 Refresh Token을 DB에서 조회
- `is_revoked = true`이거나 `expires_at`이 지난 경우 `AUTH_REFRESH_TOKEN_REVOKED` 반환
- 검증 성공 시 기존 토큰 폐기(`is_revoked = true`) 후 신규 Refresh Token 발급 (Rotation 정책)

> 로그아웃 기능(Refresh Token 강제 폐기)은 MVP 범위 외다. 클라이언트 측에서 토큰을 삭제하는 방식으로 처리한다.

### 11.3 그룹 소유권 기반 접근 제어

모든 리소스 접근은 Service 레이어에서 `group.userId === jwtPayload.sub` 검증을 수행한다.

접근 제어 경로:
- `groups` 직접 조회: `group.userId` 검증
- `applicants` 조회: `applicant.group.userId` 검증
- `applicant_repositories` 조회: `repository.applicant.group.userId` 검증
- `analysis_runs` 조회: `analysis_run.requested_by_user_id === currentUserId` 검증
- `generated_questions` 조회: `question.applicant.group.userId` 검증

검증 실패 시 `403 FORBIDDEN_RESOURCE_ACCESS` 반환.

### 11.4 비밀번호 해싱

- bcrypt 사용. salt rounds는 환경변수 또는 설정값으로 관리 (기본 10 이상 권장).
- 원문 비밀번호는 어떤 저장소에도 저장하지 않는다.
- 로그에 비밀번호 원문이 포함되지 않도록 DTO에 `@Exclude()` 적용.

### 11.5 외부 API 키 관리

- `GITHUB_TOKEN`, `LLM_API_KEY`는 환경변수로만 관리
- `.env` 파일은 git에 커밋하지 않음
- 로그에 API 키 값이 출력되지 않도록 설정 값을 직접 로깅하는 코드 금지

### 11.6 민감 정보 로깅 금지

- 비밀번호, JWT 토큰, API 키, Refresh Token 값은 로그에 포함하지 않는다.
- `llm_messages.content`에는 실제 코드 내용이 포함될 수 있으므로 외부 로그 서비스로 전송 시 주의가 필요하다.

---

## 12. 성능 및 운영 고려사항

### 12.1 GitHub API 호출 최소화

- 저장소 기본 정보와 파일 트리는 Redis에 캐시한다. TTL은 저장소 변경 가능성을 고려하여 설정한다.
- 동일 저장소에 대한 중복 분석 실행 시 캐시된 파일 트리를 재사용한다.
- 파일 content 조회는 선별된 핵심 파일만 대상으로 한다. 전체 파일을 조회하지 않는다.

### 12.2 대형 저장소 처리 제약

- 파일 트리가 너무 큰 경우 LLM 프롬프트 토큰 한도 초과 가능.
- 핵심 파일 선별 시 LLM이 선택할 수 있는 최대 파일 수를 환경변수 `MAX_ANALYSIS_FILES`로 제한한다. 이 값을 프롬프트에 명시하여 LLM이 초과 선별하지 않도록 지시한다.
- `repository_files` 저장 시 개별 파일 content 크기 제한은 **최대 100KB**로 확정한다. 초과 파일은 잘라내거나 건너뛴다.
- 분석 대상 저장소 수는 `MAX_REPO_SELECTION_COUNT`로 제한한다.

### 12.3 Redis 캐시 운영 방향

- 캐시 키는 `libs/integrations/src/redis/cache-keys.ts`에서 중앙 관리한다.
- TTL 기반 자동 만료로 캐시 무효화를 관리하며, 명시적 캐시 삭제는 MVP에서 제공하지 않는다.
- Redis 장애 시 캐시 미스로 처리하고 GitHub API를 직접 호출하는 fallback을 구현한다.

### 12.4 로그 / Trace ID 전략

- 모든 HTTP 요청에 `X-Request-ID` 헤더를 통해 `requestId`를 부여한다. 없으면 서버에서 UUID를 생성한다.
- `requestId`는 응답의 `meta.request_id`로 반환된다.
- Worker에서는 `analysisRunId`를 trace ID로 사용하여 모든 파이프라인 로그에 포함한다.
- `libs/shared/src/logger/`에서 공통 로거를 구현하며, `analysisRunId`를 로그 컨텍스트로 포함하는 구조를 지원한다.

### 12.5 분석 실행 단위 관찰 가능성

- `analysis_runs.current_stage` 업데이트로 현재 진행 단계를 DB에서 조회 가능
- `analysis:progress:{analysisRunId}` Redis 키로 실시간 진행 상태 캐시 (설계 제안)
- 실패 시 `failure_reason`으로 어느 단계에서 어떤 오류가 발생했는지 기록
- `llm_messages` 테이블로 각 단계의 LLM 입력/출력 재현 가능

### 12.6 Worker 운영 고려사항

- Worker 인스턴스 수를 조절하여 병렬 처리 규모 제어 가능
- 분석 실행당 GitHub API 호출 수를 운영 로그에서 추적
- Dead-letter 큐에 쌓인 메시지는 알림 또는 수동 검토 대상

---

## 13. 테스트 전략

### 13.1 단위 테스트

대상:
- `auth.service.ts`: 비밀번호 해싱, JWT 발급, Refresh Token 검증 로직
- `repository-url-parser.service.ts`: 다양한 GitHub URL 형식 파싱 결과 검증
- `prompt-builder`: 변수 치환 및 템플릿 완성 결과 검증
- `analysis-run.publisher.ts`: 발행 payload 구조 검증
- `llm parsers/`: JSON 파싱 성공/실패 케이스 검증
- 각 Service의 소유자 검증 로직

Mock 대상:
- TypeORM Repository
- GitHub 클라이언트
- LLM 클라이언트
- Redis 클라이언트
- RabbitMQ 클라이언트

### 13.2 통합 테스트

대상:
- TypeORM Repository + 실제 테스트 DB: 쿼리 결과, 관계 조회, 제약 조건 위반 케이스
- `github.service.ts`: GitHub API 응답 mock + 캐시 동작 검증
- RabbitMQ publisher/consumer: 실제 메시지 발행 및 수신 흐름 (테스트 RabbitMQ 사용)
- 분석 파이프라인 단위: 단계별 DB 상태 변화 검증

실제 검증 대상 (mock 미사용):
- DB 관계 및 cascade 동작
- TypeORM migration 적용 결과

Mock 대상 (통합 테스트에서도):
- 외부 GitHub API (실제 호출 금지)
- 외부 LLM API (실제 호출 금지)

### 13.3 E2E 테스트

주요 시나리오:
```
회원가입 → 로그인 → 그룹 생성 → 지원자 등록(GitHub 프로필 URL 포함)
  → GitHub 저장소 목록 조회(GET /applicants/{id}/github-repos) [선택]
  → 분석 요청(POST /applicants/{id}/questions)
      ↳ 내부: GitHub 저장소 자동 선택 → applicant_repositories 생성 → analysis_runs 생성 → RabbitMQ 발행
  → 분석 상태 폴링(GET /analysis-runs/{id})
  → 질문 조회(GET /applicants/{id}/questions)
```

E2E에서 mock 처리해야 하는 항목:
- GitHub API: 미리 정의된 fixture 데이터로 mock
- LLM API: 고정 응답 fixture로 mock

실제 인프라를 사용하는 항목:
- PostgreSQL (테스트 DB 또는 Docker)
- Redis (테스트 인스턴스)
- RabbitMQ (테스트 인스턴스)

---

## 14. 구현 순서 및 마일스톤

### Phase 1: 기반 인프라 및 인증 (1~2주)

1. NestJS monorepo 초기 셋업 (`apps/api`, `apps/worker`, `libs/*`)
2. Docker Compose 환경 구성 (PostgreSQL, Redis, RabbitMQ)
3. TypeORM 설정 및 전체 Entity 정의 (`libs/database/src/entities/`)
4. Migration 생성 및 실행
5. 환경변수 validation 설정
6. `auth` 모듈 구현 (회원가입, 로그인, JWT 발급, Refresh Token)
7. 공통 예외 필터, 응답 형식 인터셉터 구현

### Phase 2: 도메인 CRUD API (1주)

1. `users` 모듈
2. `groups` 모듈 (소유자 기반 접근 제어 포함)
3. `applicants` 모듈
4. `applicant-repositories` 모듈 (URL 파싱 포함)

### Phase 3: 분석 요청 및 큐 연동 (1주)

1. `analysis-runs` 모듈 (생성, 상태 조회, 목록 조회)
2. RabbitMQ publisher 구현 (`analysis-run.publisher.ts`)
3. Worker App 기반 셋업 (RabbitMQ consumer 연결)
4. Redis 연동 (캐시 키 관리)

### Phase 4: 분석 파이프라인 Worker 구현 (2주)

1. GitHub 연동 (`libs/integrations/src/github/`): 프로필 저장소 목록 조회, 파일 트리, raw content
2. `github-repository.processor`: GitHub API 전담 (REPO_LIST, FOLDER_STRUCTURE, FILE_DETAIL)
3. LLM 연동 (`libs/integrations/src/llm/`)
4. `prompt-builder`, `parsers` 구현
5. `llm-analysis.processor`: 파일 선별 LLM 호출, 코드 분석(SUMMARY), 질문 생성(QUESTION_GENERATION)
6. `analysis-run.processor`: 전체 파이프라인 오케스트레이션
7. 실패 처리 및 Dead-letter 큐 연동

### Phase 5: 부가 기능 및 마무리 (1주)

1. `prompt-templates` 모듈 CRUD
2. `generated-questions` 조회 API
3. `health` 모듈
4. 단위 테스트 작성
5. 통합 테스트 작성
6. E2E 테스트 시나리오 검증
7. 로깅 및 Trace ID 정비

---

## 15. 결정 사항 및 잔여 이슈

이 섹션은 설계 과정에서 결정된 항목과 향후 추가 논의가 필요한 사항을 기록한다.

### 15.1 결정: 분석 요청 응답에 analysisRunId 포함

`POST /applicants/{applicantId}/questions` 응답에 `analysisRunIds` 배열을 포함한다. 클라이언트는 이를 통해 즉시 폴링 URL을 구성할 수 있다.

```json
{ "success": true, "analysisRunIds": ["uuid1", "uuid2"] }
```

api-spec 수정 필요.

### 15.2 결정: GitHub 프로필 URL 전용 + 자동 저장소 선택

- `applicants.github_url`은 GitHub 프로필 URL만 허용한다 (`https://github.com/{owner}`).
- 분석 요청 시 GitHub API로 공개 저장소를 최근 수정 기준으로 자동 조회하여 상위 N개 선택.
- 선택 최대 개수: 환경변수 `MAX_REPO_SELECTION_COUNT` (기본값 3).
- `applicant_repositories`는 이 과정에서 내부적으로 자동 생성된다.

### 15.3 결정: 핵심 파일 선별 기준

LLM이 파일 선별을 담당하며, 다음 기준을 프롬프트에 명시한다:
- 진입점 파일 (main.ts, App.java, index.ts 등)
- 서비스/도메인 계층 파일
- 파일 크기 100KB 이하
- 바이너리 파일 제외
- 선별 파일 수 상한: 환경변수 `MAX_ANALYSIS_FILES`

### 15.4 결정: 재분석 불허

동일 지원자/저장소 조합에 이미 `COMPLETED` 상태의 `analysis_run`이 존재하면 새 분석 요청을 거부한다. API 계층에서 검증하며 에러를 반환한다.

### 15.5 결정: 질문 재생성 불허

기존 `analysis_run`의 질문 재생성은 MVP에서 지원하지 않는다.

### 15.6 결정: Public 저장소만 지원

Private 저장소는 MVP에서 지원하지 않는다. GitHub API 공개 저장소 조회만 사용한다.

### 15.7 결정: 프롬프트 템플릿 일반 사용자 접근 불가

`prompt_templates`의 CRUD 엔드포인트는 일반 인증 사용자에게 노출하지 않는다. 내부 운영 담당자가 직접 DB를 통해 관리하거나, 별도 내부망 전용 인터페이스로 접근한다.

### 15.8 결정: AnalysisStage에 SUMMARY 추가 확정

`analysis_runs.current_stage`와 `llm_messages.stage` 모두 `SUMMARY` 단계를 포함한다. api-spec과 ERD의 `analysis_runs.current_stage` 컬럼 주석을 수정해야 한다.

### 15.9 결정: Worker 장애 복구용 Cleanup Scheduler 구현

`apps/worker/src/schedulers/cleanup.scheduler.ts`에서 일정 시간(예: 30분) 이상 `IN_PROGRESS` 상태를 유지하는 `analysis_runs` 레코드를 `FAILED` 처리하는 스케줄러를 구현한다.

### 15.10 결정: applicant_repositories 내부 자동 생성

`applicant_repositories`는 분석 요청 시 GitHub API 조회를 통해 내부적으로 자동 생성된다. 수동 등록 API는 제공하지 않는다. 조회 API(`GET /applicants/{applicantId}/repositories`)는 생성된 레코드 목록 반환 용도로 추가한다 (api-spec 추가 필요).

---

### 잔여 이슈 (문서 수정 필요)

다음 항목은 tech-spec v1.1에서 결정된 내용이 아직 관련 문서에 반영되지 않은 상태다.

- **api-spec `githubUrl` 설명 수정**: `POST /applicants` 의 `githubUrl` 필드 설명이 현재 "GitHub 프로필 또는 대표 저장소 URL"로 되어 있으나 "GitHub 프로필 URL"만 허용하도록 수정 필요.
- **api-spec `analysisRunIds` 응답 추가**: `POST /applicants/{applicantId}/questions` 성공 응답에 `analysisRunIds` 배열 추가 명세 필요.
- **api-spec 신규 엔드포인트 명세 추가**: `GET /applicants/{applicantId}/github-repos`, `GET /applicants/{applicantId}/repositories` 엔드포인트 명세 추가 필요.
- **ERD `applicants.github_url` 주석 수정**: `// 지원자 GitHub 프로필 또는 대표 repo URL` → `// 지원자 GitHub 프로필 URL (https://github.com/{owner} 형식만 허용)`.
- **ERD `analysis_runs` 블록 주석 수정**: `동일 지원자/레포에 대해 재실행 가능` → 재분석 불허 결정 반영 필요.
- **ERD `analysis_runs.current_stage` 컬럼 주석 수정**: `SUMMARY` 단계 추가.
- **ERD `prompt_templates.purpose` 주석 수정**: `'code analysis, extraction folder structure, summarization'` → `'file_selection, code_summary, question_generation'`.
- **server-spec §3 디렉토리 구조 수정**: `question-generation.processor.ts` → `llm-analysis.processor.ts`.
- **server-spec §5.3 수정**: `question-generation.processor`의 책임 기술을 `llm-analysis.processor` 기준으로 갱신 및 큐 목록(§11.1) 수정.

### 확정된 운영 정책

- **분석 동시 실행 제한**: Redis lock TTL **10분**, 최대 재시도 횟수 **2회** (`RABBITMQ_MAX_RETRY=2`)
- **파일 content 크기 상한**: 개별 파일 원문 최대 **100KB** (`MAX_FILE_SIZE_KB=100`). 초과 파일은 잘라내거나 건너뜀
- **`llm_messages` 보존 기간**: MVP 단계에서 **영구 보존**. 운영 확장 시 아카이빙 정책 별도 수립
