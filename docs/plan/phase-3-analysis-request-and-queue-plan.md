# 구현 플랜: Phase 3 분석 요청 및 큐 연동

Source: [tech-spec.md](../tech-spec.md), [server-spec.md](../server-spec.md), [api-spec.md](../api-spec.md)

Scope: `docs/tech-spec.md`의 `### Phase 3: 분석 요청 및 큐 연동` 범위를 코딩 에이전트가 그대로 따라 구현하거나 정리할 수 있도록 작업 단위로 분해한다. 현재 저장소에는 `analysis-runs`, RabbitMQ, Redis, Worker 뼈대가 일부 구현되어 있으므로, 본 문서는 "신규 도입"이 아니라 "명세 대비 Phase 3 완료"를 기준으로 남은 작업을 정의한다.

Out of scope: GitHub 파일 수집 세부 로직 완성, LLM 분석/질문 생성 품질 개선, Prompt Template 운영 확장, `generated-questions` 조회 API 구현, 재분석 정책 변경, 광범위한 리팩터링.

## Overview

Phase 3의 목표는 `POST /applicants/{applicantId}/questions` 요청이 지원자 소유권 검증, GitHub 공개 저장소 선택, `applicant_repositories` 내부 생성, `analysis_runs` 생성, RabbitMQ 발행까지 일관되게 수행하고, Worker가 메시지를 받아 안전하게 실행을 시작하며, 클라이언트가 `GET /analysis-runs/{id}` 및 `GET /analysis-runs`로 상태를 확인할 수 있게 만드는 것이다. 현재 코드는 이 범위를 일부 구현했지만, Worker가 이미 Phase 4 오케스트레이션까지 포함하고 있고, retry/dead-letter 의미도 불명확하므로, 계획은 Phase 3 경계를 다시 명확히 하면서 테스트와 문서 정합성까지 닫는 데 초점을 둔다.

## Current State

- `apps/api/src/modules/analysis-runs`에는 생성, 단건 조회, 목록 조회 서비스와 publisher가 이미 존재한다.
- `apps/api/src/modules/applicants/applicants.controller.ts`에는 `POST /applicants/{applicantId}/questions` 라우트가 연결되어 있다.
- `libs/contracts/src/queue/analysis-request.payload.ts`와 `libs/integrations/src/rabbitmq`에는 기본 queue contract와 topology가 존재한다.
- `apps/worker/src/jobs/analysis-run.job.ts`는 Redis lock과 진행 상태 캐시를 일부 구현했다.
- `apps/worker/src/processors/analysis-run.processor.ts`는 이미 GitHub/LLM 단계까지 호출하고 있어 Phase 3와 Phase 4의 경계가 섞여 있다.
- `docs/tech-spec.md`의 Phase 3 정의는 "분석 요청 및 큐 연동"이지만, 현재 코드와 일부 문서 문맥은 retry/dead-letter, 파이프라인 상세 단계까지 선반영되어 있다.

## Phase 3 Boundary (Fixed By Task 1)

### Included in Phase 3

- API: `POST /applicants/{applicantId}/questions`가 소유권 검증, GitHub 공개 저장소 선택, `applicant_repositories` 내부 생성, `analysis_runs` 생성, RabbitMQ 발행까지 수행한다.
- API: `GET /analysis-runs/{id}`와 `GET /analysis-runs`가 DB 기준으로 상태 조회를 제공한다.
- Queue: `AnalysisRequestPayload` 계약, request exchange/queue/routing key, API publisher와 Worker consumer의 연결을 확정한다.
- Worker: 메시지 consume, Redis lock 획득, `QUEUED -> IN_PROGRESS` 전이, 시작 시점 progress cache 저장, 예외 시 `FAILED` 처리까지를 완료 기준으로 본다.

### Deferred to Phase 4

- `analysis-run.processor`의 GitHub 저장소 정보 조회, 파일 트리 수집, 핵심 파일 선별, raw content 저장, 코드 분석, 질문 생성 오케스트레이션
- `github-repository.processor`의 `REPO_LIST`, `FOLDER_STRUCTURE`, `FILE_DETAIL` 상세 책임 검증
- `llm-analysis.processor`의 `SUMMARY`, `QUESTION_GENERATION` 단계 검증
- 단계별 재시도 정책, dead-letter 운영, 파이프라인 세분화에 따른 consumer 분리 여부
- Redis progress cache 우선 조회 같은 상태 조회 최적화

### Explicit Exclusions Confirmed For This Phase

- 이번 Phase 3 마감 기준에서는 Worker가 "분석을 시작했다"는 사실을 안전하게 기록하는 것까지만 요구한다.
- 현재 코드에 Phase 4 오케스트레이션이 일부 존재하더라도, 이번 계획의 완료 판정은 해당 로직의 완성도에 의존하지 않는다.
- retry/dead-letter topology는 존재 여부와 무관하게 이번 Task 묶음에서 필수 완료 조건으로 취급하지 않는다.

## Architecture Decisions

- Phase 3의 완료 기준은 "요청 등록 + 큐 발행 + Worker 시작 + 상태 조회 가능"으로 본다.
- Worker는 Phase 3에서 분석 실행의 시작 책임까지만 확정하고, GitHub/LLM 상세 파이프라인은 Phase 4 책임으로 분리한다.
- `analysis-runs` 목록 조회 API는 명세에 이미 포함되어 있으므로 Phase 3 범위에 유지하되, 새 기능 확장 없이 검증과 정합성 확보만 수행한다.
- RabbitMQ retry/dead-letter topology는 이번 Phase 3 마감 범위에 포함하지 않고, 기본 request queue 발행/소비 경로만 안정화한다.
- `analysis-run.processor`는 tech spec의 Phase 4 작업이 아직 완료되지 않은 현재 상태를 기준으로, Phase 3에서는 "consumer 진입점 + 실행 시작 책임"만 남기고 GitHub/LLM 오케스트레이션은 후속 Phase 4로 분리하는 방향을 기본 구현안으로 사용한다.
- `GET /analysis-runs/{id}`는 DB 기준 조회를 유지하고, Redis progress cache 우선 조회는 이번 범위에 포함하지 않는다.

## Rules

- Use `- [ ]` before a task is done, then change it to `- [x]`.
- Keep each task to one logical purpose.
- Read nearby code before editing and preserve current NestJS module boundaries.
- Do not pull Phase 4 scope forward unless the task explicitly says to do so.
- After each implementation task, request a review if subagent delegation is allowed in that execution context; if not allowed, record that the review step was blocked by execution policy.
- If a task grows beyond 5 touched files or starts spanning independent concerns, split the task and update this plan first.

## Task List

### Phase 3A. 경계 확정과 계약 정리

- [x] Task 1: Phase 3 구현 경계와 현재 코드 상태를 문서 기준으로 정렬한다.

**Description:** 현재 구현이 어디까지 Phase 3에 포함되는지 명확히 정리하고, Phase 4에 속하는 Worker 오케스트레이션 책임을 문서와 계획 상에서 분리한다. 이 task는 실제 코드 변경보다 "무엇을 이번 작업에서 고칠지"를 고정하는 작업이다.

**Acceptance criteria:**
- [x] Phase 3 범위에 포함할 API, queue, worker 책임이 명시된다.
- [x] Phase 4로 미루는 GitHub/LLM 상세 작업이 목록으로 분리된다.
- [x] 이번 계획에서 확정한 제외 범위와 후속 범위가 문서에 반영된다.

**Verification:**
- [x] 계획 문서의 scope, out-of-scope, architecture decisions가 현재 코드와 충돌하지 않는다.
- [x] 수작업 검토: `docs/tech-spec.md`의 Phase 3/4 구분과 본 문서가 함께 읽혔을 때 구현 순서가 혼동되지 않는다.

**Dependencies:** None

**Files likely touched:**
- `docs/plan/phase-3-analysis-request-and-queue-plan.md`
- `docs/tech-spec.md`

**Estimated scope:** Small

- [x] Task 2: 분석 요청 API 계약과 queue payload 계약을 Phase 3 기준으로 확정한다.

**Description:** `POST /applicants/{applicantId}/questions`, `GET /analysis-runs/{id}`, `GET /analysis-runs`와 `AnalysisRequestPayload`가 실제 코드, 테스트, 문서에서 동일한 의미를 갖도록 맞춘다. 이미 구현된 필드와 응답 구조를 기준으로 누락/과잉 항목을 정리한다.

**Acceptance criteria:**
- [x] `analysisRunIds` 응답 구조가 문서와 DTO에서 일치한다.
- [x] queue payload 필드가 `analysisRunId`, `applicantId`, `repositoryId`, `requestedByUserId`, `requestedAt`로 고정된다.
- [x] Exchange/queue/routing key 명칭이 코드와 문서에서 일치한다.

**Verification:**
- [x] 관련 DTO/spec/unit test가 동일한 payload shape를 검증한다.
- [x] 수작업 검토: `docs/api-spec.md`, `docs/tech-spec.md`, publisher/test가 같은 예시를 사용한다.

**Dependencies:** Task 1

**Files likely touched:**
- `docs/api-spec.md`
- `docs/tech-spec.md`
- `apps/api/src/modules/analysis-runs/dto/*`
- `apps/api/src/modules/analysis-runs/publishers/analysis-run.publisher.ts`
- `libs/contracts/src/queue/analysis-request.payload.ts`
- `libs/integrations/src/rabbitmq/constants.ts`

**Estimated scope:** Medium

### Checkpoint: 계약 정렬 완료

- [x] 계획상 Phase 3와 Phase 4 경계가 명확하다.
- [x] API 응답과 queue payload shape가 문서/코드/테스트에서 일치한다.
- [x] 사용자 결정이 필요한 항목이 별도 목록으로 정리된다.

### Phase 3B. API 요청 등록 플로우 안정화

- [x] Task 3: `AnalysisRunsService`의 저장소 선택 및 실행 생성 플로우를 안정화한다.

**Description:** 지원자 소유권 검증, GitHub owner 파싱, 공개 저장소 조회, `applicant_repositories` upsert, 완료된 분석 제외, `analysis_runs` 생성, 발행 실패 시 실패 처리까지 한 흐름으로 정리한다. 이미 있는 구현을 유지하되 예외 코드, 부분 실패 처리, repository 경계가 명확하도록 보강한다.

**Acceptance criteria:**
- [x] 지원자 미존재, 소유권 없음, GitHub URL 형식 오류, 공개 저장소 없음, 전부 완료됨 케이스가 각각 명시적 예외로 처리된다.
- [x] 부분 발행 실패 시 실패한 run만 `FAILED` 처리되고, 이미 성공적으로 발행된 run은 유지된다.
- [x] 저장소 선택 수가 `MAX_REPO_SELECTION_COUNT`를 넘지 않는다.

**Verification:**
- [x] Tests pass: `npm test -- --runInBand apps/api/src/modules/analysis-runs/analysis-runs.service.spec.ts`
- [x] 수작업 검토: `POST /applicants/{applicantId}/questions`가 tech spec 8.1 순서와 일치한다.

**Dependencies:** Task 2

**Files likely touched:**
- `apps/api/src/modules/analysis-runs/analysis-runs.service.ts`
- `apps/api/src/modules/analysis-runs/analysis-runs.service.spec.ts`
- `apps/api/src/modules/analysis-runs/repositories/analysis-runs.repository.ts`
- `apps/api/src/modules/applicants/applicants.facade.ts`
- `apps/api/src/modules/applicants/applicants.controller.ts`

**Estimated scope:** Medium

- [x] Task 4: `analysis-runs` 조회 API를 Phase 3 기준으로 검증하고 보강한다.

**Description:** 단건 상태 조회와 목록 조회가 `requested_by_user_id` 기준 인가를 지키고, 클라이언트가 폴링에 필요한 최소 상태를 안정적으로 받을 수 있게 정리한다. 새 조회 기능을 늘리기보다, 현재 구현의 DTO/테스트/예외를 닫는다.

**Acceptance criteria:**
- [x] `GET /analysis-runs/{id}`는 요청자 소유 실행만 조회할 수 있다.
- [x] `GET /analysis-runs`는 `applicantId` 필터와 기본 pagination을 유지한다.
- [x] 응답 필드가 `status`, `current_stage`, `started_at`, `completed_at`, `failure_reason`를 포함한다.

**Verification:**
- [x] Tests pass: `npm test -- --runInBand apps/api/src/modules/analysis-runs/analysis-runs.service.spec.ts`
- [x] 수작업 검토: DTO와 controller 응답이 `docs/api-spec.md`와 일치한다.

**Dependencies:** Task 2

**Files likely touched:**
- `apps/api/src/modules/analysis-runs/analysis-runs.controller.ts`
- `apps/api/src/modules/analysis-runs/analysis-runs.facade.ts`
- `apps/api/src/modules/analysis-runs/analysis-runs.service.ts`
- `apps/api/src/modules/analysis-runs/dto/*`
- `apps/api/src/modules/analysis-runs/repositories/analysis-runs.repository.ts`

**Estimated scope:** Medium

### Checkpoint: API Phase 3 완료

- [x] `POST /applicants/{applicantId}/questions`가 Phase 3 계약대로 동작한다.
- [x] `GET /analysis-runs/{id}`와 `GET /analysis-runs`가 요청자 기준으로 안전하게 조회된다.
- [x] API 레이어 테스트가 주요 성공/실패 경로를 커버한다.

### Phase 3C. Worker 시작 경로와 큐/Redis 정리

- [x] Task 5: RabbitMQ topology와 발행/소비 책임을 Phase 3 기준으로 정리한다.

**Description:** queue 선언, binding, publish, consume의 최소 책임을 재점검하고, retry/dead-letter 사용 여부에 따라 topology를 단순화하거나 정책 주석/테스트를 추가한다. 이 task의 핵심은 "메시지가 어디로 들어가고 누가 처리하는가"를 분명히 만드는 것이다.

**Acceptance criteria:**
- [x] 분석 요청용 exchange/queue/routing key가 일관되게 선언된다.
- [x] API publisher와 Worker consumer가 같은 계약을 사용한다.
- [x] retry/dead-letter가 이번 범위 밖이라는 점이 코드 또는 문서에 명시된다.

**Verification:**
- [x] Tests pass: `npm test -- --runInBand libs/integrations/src/rabbitmq/rabbitmq.service.spec.ts apps/api/src/modules/analysis-runs/publishers/analysis-run.publisher.spec.ts apps/worker/src/processors/analysis-run.processor.spec.ts`
- [x] 수작업 검토: `rabbitmq.service.ts`와 `tech-spec`의 topology 설명이 충돌하지 않는다.

**Dependencies:** Task 2

**Files likely touched:**
- `libs/integrations/src/rabbitmq/constants.ts`
- `libs/integrations/src/rabbitmq/rabbitmq.service.ts`
- `libs/integrations/src/rabbitmq/rabbitmq.service.spec.ts`
- `apps/api/src/modules/analysis-runs/publishers/analysis-run.publisher.ts`
- `apps/api/src/modules/analysis-runs/publishers/analysis-run.publisher.spec.ts`
- `docs/tech-spec.md`

**Estimated scope:** Medium

- [x] Task 6: `AnalysisRunJob`의 Redis lock, 진행 상태 캐시, 실패 처리를 Phase 3 범위로 닫는다.

**Description:** Worker가 메시지를 받아 중복 실행을 막고, `QUEUED -> IN_PROGRESS` 전이를 수행하며, 진행 상태 캐시를 저장하고, 예외 시 `FAILED`로 전환하는 최소 실행 시작 경로를 확정한다. lock 해제 시점과 실패 메시지 규칙을 명확히 한다.

**Acceptance criteria:**
- [x] lock key와 progress key가 상수 기반으로 일관되게 생성된다.
- [x] lock 획득 실패, run 미존재, 이미 처리된 상태 케이스가 테스트된다.
- [x] `markInProgress`와 `markFailed`가 Phase 3 책임 범위에서 충분하다.

**Verification:**
- [x] Tests pass: `npm test -- --runInBand apps/worker/src/jobs/analysis-run.job.spec.ts`
- [x] 수작업 검토: `analysis-run.job.ts`가 tech spec 8.3 단계 0-1과 직접 대응된다.

**Dependencies:** Task 5

**Files likely touched:**
- `apps/worker/src/jobs/analysis-run.job.ts`
- `apps/worker/src/jobs/analysis-run.job.spec.ts`
- `apps/worker/src/repositories/analysis-runs.repository.ts`
- `libs/integrations/src/redis/cache-keys.ts`

**Estimated scope:** Small

- [x] Task 7: `analysis-run.processor`를 Phase 3 경계에 맞게 정리한다.

**Description:** Worker consumer 진입점이 `AnalysisRunJob` 결과를 받고, Phase 3에서 보장할 책임까지만 수행하도록 정리한다. 이번 계획에서는 `analysis-run.processor`를 "실행 시작 전담"으로 축소하고, 현재 섞여 있는 GitHub/LLM 오케스트레이션은 tech spec의 Phase 4 작업으로 분리한다.

**Acceptance criteria:**
- [x] consumer 등록과 메시지 처리 진입점이 테스트 가능하게 유지된다.
- [x] Phase 3 범위와 Phase 4 범위가 코드 구조 또는 주석/문서에서 분리된다.
- [x] processor 테스트가 실제 책임 범위를 반영하도록 갱신된다.

**Verification:**
- [x] Tests pass: `npm test -- --runInBand apps/worker/src/processors/analysis-run.processor.spec.ts`
- [x] Build succeeds: `npm run build`
- [x] 수작업 검토: Worker가 Phase 3 범위를 넘는 책임을 가진 경우 그 이유와 후속 작업이 문서화된다.

**Dependencies:** Task 6

**Files likely touched:**
- `apps/worker/src/processors/analysis-run.processor.ts`
- `apps/worker/src/processors/analysis-run.processor.spec.ts`
- `docs/tech-spec.md`
- `docs/plan/phase-4-llm-integration-plan.md`

**Estimated scope:** Medium

### Checkpoint: 큐 및 Worker 시작 경로 완료

- [x] 메시지 발행과 소비 경로가 일관되게 동작한다.
- [x] Redis lock과 상태 전이가 테스트로 보장된다.
- [x] Worker 책임 경계가 다음 Phase와 섞이지 않게 정리된다.

### Phase 3D. 최종 검증과 문서 동기화

- [x] Task 8: Phase 3 관련 테스트, 빌드, 문서를 최종 동기화한다.

**Description:** 앞선 작업에서 수정한 API, queue, worker 경로를 한 번에 검증하고, 구현에 직접 영향을 주는 문서 차이만 최소 범위로 정리한다. 이 task는 기능 추가보다 "코딩 에이전트가 다음 작업을 착수할 때 헷갈리지 않게 만드는 마감 작업"이다.

**Acceptance criteria:**
- [x] Phase 3 관련 단위 테스트가 통과한다.
- [x] 전체 빌드가 통과한다.
- [x] `tech-spec`, `api-spec`, plan 문서가 현재 코드와 직접 충돌하지 않는다.

**Verification:**
- [x] Tests pass: `npm run test`
- [x] Build succeeds: `npm run build`
- [x] Lint succeeds: `npm run lint`
- [x] 수작업 검토: plan 문서의 각 task가 완료 여부를 판정 가능한 상태다.

**Dependencies:** Task 3, Task 4, Task 5, Task 6, Task 7

**Files likely touched:**
- `docs/tech-spec.md`
- `docs/api-spec.md`
- `docs/plan/phase-3-analysis-request-and-queue-plan.md`
- Phase 3에서 실제 수정된 테스트/구현 파일 일체

**Estimated scope:** Medium

### Checkpoint: Phase 3 Complete

- [x] 분석 요청 API가 실행 생성과 큐 발행까지 안정적으로 동작한다.
- [x] 상태 조회 API가 폴링 요구사항을 만족한다.
- [x] Worker가 메시지를 받아 중복 실행 방지와 시작 상태 전이를 수행한다.
- [x] Phase 3와 Phase 4 책임 경계가 문서와 코드에서 모두 설명 가능하다.
- [x] `npm run lint`, `npm run test`, `npm run build` 결과가 기록된다.

## Dependency Graph

1. Task 1 -> Task 2
2. Task 2 -> Task 3, Task 4, Task 5
3. Task 5 -> Task 6
4. Task 6 -> Task 7
5. Task 3, Task 4, Task 5, Task 6, Task 7 -> Task 8

병렬화 가능 구간:

- Task 3과 Task 4는 Task 2 완료 후 병렬 진행 가능
- Task 5는 Task 2 완료 후 병렬 진행 가능
- Task 8은 선행 task 종료 전까지 착수하지 않음

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Worker가 이미 Phase 4 로직을 포함해 변경 범위가 커질 수 있음 | High | Task 1에서 Phase 3 경계를 먼저 확정하고, Task 7에서 축소 또는 유지 중 하나를 명시적으로 선택 |
| retry/dead-letter 정책이 불명확해 큐 topology 수정이 반복될 수 있음 | High | 사용자 결정을 먼저 받고, 결정 전에는 publisher/request queue 안정화까지만 진행 |
| `GET /analysis-runs/{id}`의 Redis 캐시 우선 조회를 함께 넣으면 범위가 커짐 | Medium | 기본 계획은 DB 기준 유지, 캐시 조회는 별도 결정 시에만 포함 |
| 부분 발행 실패 처리와 재시도 정책이 상충할 수 있음 | Medium | 실패 시점별 기대 상태를 테스트로 먼저 고정 |
| 현재 테스트가 Phase 4 오케스트레이션을 전제로 하고 있을 수 있음 | Medium | Task 7에서 책임 범위를 다시 반영해 테스트를 재작성 |

## Open Questions

- 없음. 사용자 결정이 반영되었으며, 본 문서는 해당 결정을 기준으로 실행한다.

## Recommended Default

사용자 결정에 따라 아래 기준으로 진행한다.

- dead-letter/retry는 이번 Phase 3 구현 마감 범위에서 제외하고, 기본 request queue 발행/소비만 안정화한다.
- `analysis-run.processor`는 consumer 진입점과 실행 시작 책임까지만 남기고, GitHub/LLM 오케스트레이션은 Phase 4 작업으로 분리한다.
- `GET /analysis-runs/{id}`는 DB 기준 조회를 유지하고 Redis progress cache는 후속 개선으로 미룬다.
