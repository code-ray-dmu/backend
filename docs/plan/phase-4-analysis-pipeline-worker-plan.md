# 구현 플랜: Phase 4 분석 파이프라인 Worker

Source: [tech-spec.md](../tech-spec.md), [server-spec.md](../server-spec.md), [phase-3-analysis-request-and-queue-plan.md](./phase-3-analysis-request-and-queue-plan.md), [prompt-templates-v1.md](../../libs/integrations/src/llm/docs/prompt-templates-v1.md)

Scope: `docs/tech-spec.md`의 `### Phase 4: 분석 파이프라인 Worker 구현` 범위를 기준으로, 코딩 에이전트가 현재 저장소 상태를 읽고 순차적으로 구현할 수 있도록 작업을 작게 분해한다. 현재 저장소에는 `github-repository.processor`, `llm-analysis.processor`, `prompt-builder`, `parser`, 일부 테스트가 이미 존재하므로, 본 문서는 "신규 도입"보다 "명세 대비 Phase 4 완료"를 목표로 한다.

Out of scope: `prompt-templates` CRUD API, `generated-questions` 조회 API, 광범위한 리팩터링, private 저장소 지원, 재분석 정책 변경, 운영 대시보드 구축.

## Overview

Phase 4의 목표는 Worker가 `analysis.run.requested` 메시지를 받아 `REPO_LIST -> FOLDER_STRUCTURE -> FILE_DETAIL -> SUMMARY -> QUESTION_GENERATION -> COMPLETED` 흐름을 실제로 끝까지 수행하고, 단계별 산출물을 DB에 저장하며, 실패 시 명시적인 `failure_reason`과 복구 경로를 남기도록 만드는 것이다. 현재 코드에는 GitHub/LLM processor와 parser/prompt-builder의 기본 골격이 이미 있으므로, 이번 작업은 오케스트레이션 완성, 저장 규칙 확정, 예외/운영 정책 보강, 테스트와 문서 정합성 확보에 집중한다.

## Current State

- `apps/worker/src/processors/analysis-run.processor.ts`는 현재 Phase 3 경계로 축소되어 있고, 실제 파이프라인 오케스트레이션은 아직 없다.
- `apps/worker/src/jobs/analysis-run.job.ts`는 lock 획득, `IN_PROGRESS`, progress cache 저장까지 수행하지만, lock을 즉시 해제하므로 Phase 4의 전체 파이프라인 락 수명과 맞지 않는다.
- `apps/worker/src/processors/github-repository.processor.ts`에는 저장소 메타데이터 조회, 파일 트리 조회, 선택 파일 저장 메서드가 이미 있다.
- `apps/worker/src/processors/llm-analysis.processor.ts`에는 파일 선별, 코드 분석, 질문 생성과 `llm_messages`/`code_analysis`/`generated_questions` 저장이 이미 있다.
- `libs/integrations/src/llm/prompt-builder/`와 `libs/integrations/src/llm/parsers/`에는 템플릿 검증과 JSON 파서가 구현되어 있다.
- `apps/worker/src/schedulers/cleanup.scheduler.ts`와 `apps/worker/src/jobs/llm-analysis.job.ts`는 아직 비어 있다.
- `docs/tech-spec.md`는 Dead-letter 큐 연동을 Phase 4 항목으로 올려두었지만, 이번 계획에서는 DB 실패 처리와 cleanup scheduler까지만 Phase 4 범위로 확정하고, RabbitMQ retry/dead-letter 소비 정책 구현은 후속 Phase로 분리한다.

## Dependency Graph

1. 파이프라인 경계와 실패 규칙 확정
2. GitHub 단계 저장 규칙 확정
3. LLM 단계 입력/출력 계약 고정
4. `analysis-run.processor` 오케스트레이션 연결
5. cleanup/retry 운영 정책 반영
6. 테스트와 문서 동기화

## Architecture Decisions

- `analysis-run.job`은 Phase 4에서 "시작 전 준비"가 아니라 "락 획득/해제와 최종 성공·실패 마감"까지 포함하는 상위 실행 경계로 승격한다.
- `analysis-run.processor`는 RabbitMQ consumer 진입점과 파이프라인 orchestration 호출만 담당한다.
- GitHub 세부 호출과 DB 저장은 `github-repository.processor`, LLM 호출과 파싱 및 산출물 저장은 `llm-analysis.processor`에 유지한다.
- `current_stage` 갱신은 오케스트레이터가 책임지고, 각 하위 processor는 자신의 입력/출력과 저장에 집중한다.
- 실패 포맷은 `"{파이프라인 오류 식별자}: {상세 메시지}"`를 유지한다.
- retry/dead-letter는 "예약 토폴로지 유지"까지만 다루고, 실제 재시도 소비 정책 구현은 후속 Phase로 분리한다.
- 기본 `prompt_templates` 3종은 seed 또는 migration 기반 초기 데이터로 제공하는 것을 전제로 한다.
- 100KB 초과 파일은 잘라서 저장하지 않고 분석 대상에서 제외한다.
- `prompt_templates`의 `purpose + is_active=true` 유일성은 DB 제약으로 보장하는 것을 기본안으로 사용한다.

## Rules

- Use `- [ ]` before a task is done, then change it to `- [x]`.
- 각 task는 하나의 구현 목적만 가진다.
- 기존 NestJS module / processor / job 책임을 유지한다.
- `analysis-run.job`과 `analysis-run.processor`의 책임이 겹치면 job에 실행 경계를, processor에 consumer 진입점을 둔다.
- DB 스키마 변경이 필요하면 migration, entity, spec 영향을 함께 점검한다.
- 작업 중 결정이 필요한 항목이 나오면 이 문서의 `Open Questions`를 먼저 갱신한 뒤 구현한다.

## Task List

### Phase 4A. 실행 경계와 계약 고정

- [x] Task 1: Phase 4 Worker 실행 경계와 단계 전이 책임을 고정한다.

**Description:** `analysis-run.job`, `analysis-run.processor`, `github-repository.processor`, `llm-analysis.processor` 사이의 책임을 다시 정리한다. 목표는 lock 수명, `current_stage` 변경 주체, 성공/실패 마감 지점을 하나로 고정해 이후 task가 같은 경계를 기준으로 구현되게 만드는 것이다.

**Acceptance criteria:**
- [x] `analysis-run.job`과 `analysis-run.processor` 중 누가 lock 획득/해제, stage 전이, 완료/실패 마감을 담당하는지 문서와 코드에서 일관된다.
- [x] `REPO_LIST`, `FOLDER_STRUCTURE`, `FILE_DETAIL`, `SUMMARY`, `QUESTION_GENERATION` 전이 순서가 코드 진입점 기준으로 명시된다.
- [x] Phase 3에서 즉시 해제되던 Redis lock이 Phase 4 전체 파이프라인 수명과 맞게 조정된다.

**Verification:**
- [x] 수작업 검토: `docs/tech-spec.md` §8.3 단계 2 이후 설명과 구현 계획이 충돌하지 않는다.
- [x] Tests pass: `npm test -- --runInBand apps/worker/src/processors/analysis-run.processor.spec.ts apps/worker/src/jobs/analysis-run.job.spec.ts`

**Dependencies:** None

**Files likely touched:**
- `apps/worker/src/processors/analysis-run.processor.ts`
- `apps/worker/src/jobs/analysis-run.job.ts`
- `apps/worker/src/processors/analysis-run.processor.spec.ts`
- `apps/worker/src/jobs/analysis-run.job.spec.ts`
- `docs/plan/phase-4-analysis-pipeline-worker-plan.md`

**Estimated scope:** Medium

- [x] Task 2: Prompt template 사용 계약과 활성 템플릿 검증 전략을 고정한다.

**Description:** `file_selection`, `code_summary`, `question_generation` 템플릿이 없거나 둘 이상 active일 때 파이프라인이 어떻게 실패해야 하는지 확정한다. 기본 템플릿 3종은 seed 또는 migration으로 제공하는 전제를 코드와 문서에 반영한다.

**Acceptance criteria:**
- [x] 세 `purpose`에 대한 활성 템플릿 조회 실패/중복 실패가 예측 가능한 오류 식별자로 귀결된다.
- [x] prompt-builder와 processor 테스트가 템플릿 부재/중복 케이스를 검증한다.
- [x] 템플릿 공급 방식이 seed 또는 migration 기반 초기 데이터로 명시된다.

**Verification:**
- [ ] Tests pass: `npm test -- --runInBand libs/integrations/src/llm/prompt-builder/prompt-builder.service.spec.ts apps/worker/src/processors/llm-analysis.processor.spec.ts`
- [x] 수작업 검토: `docs/tech-spec.md` §10.1~§10.2, `libs/integrations/src/llm/docs/prompt-templates-v1.md`와 구현 계획이 일치한다.

**Dependencies:** Task 1

**Files likely touched:**
- `apps/worker/src/processors/llm-analysis.processor.ts`
- `apps/worker/src/processors/llm-analysis.processor.spec.ts`
- `libs/integrations/src/llm/prompt-builder/prompt-builder.service.ts`
- `libs/integrations/src/llm/prompt-builder/prompt-builder.service.spec.ts`
- `docs/tech-spec.md`

**Estimated scope:** Medium

### Checkpoint: 실행 경계 확정

- [x] Worker 실행 경계와 stage 전이 주체가 고정된다.
- [x] 템플릿 부재/중복 실패 정책이 명확하다.
- [x] 구현 전에 사용자 결정이 필요한 항목이 `Open Questions`에 반영된다.

### Phase 4B. GitHub 수집 슬라이스

- [x] Task 3: `REPO_LIST`와 `FOLDER_STRUCTURE` 단계를 실제 오케스트레이션에 연결한다.

**Description:** `analysis-run.processor`가 저장소 메타데이터 조회와 파일 트리 조회를 수행하고, 단계별 `current_stage` 업데이트 및 `applicant_repositories.default_branch` 반영을 끝낸다. 이 task의 완료 시점에는 GitHub에서 분석 대상 파일 경로 목록을 안정적으로 얻을 수 있어야 한다.

**Acceptance criteria:**
- [x] `REPO_LIST` 단계에서 저장소 메타데이터 조회와 `default_branch` 업데이트가 수행된다.
- [x] `FOLDER_STRUCTURE` 단계에서 파일 트리 조회 결과가 LLM 파일 선별 입력으로 전달될 수 있는 string path 배열로 정규화된다.
- [x] GitHub not-found / forbidden / rate-limit 오류가 파이프라인 오류 식별자와 함께 실패 처리된다.

**Verification:**
- [x] Tests pass: `npm test -- --runInBand apps/worker/src/processors/github-repository.processor.spec.ts libs/integrations/src/github/github.service.spec.ts`
- [x] 수작업 검토: `analysis_runs.current_stage`가 `REPO_LIST` 후 `FOLDER_STRUCTURE`로 이동한다.

**Dependencies:** Task 1

**Files likely touched:**
- `apps/worker/src/processors/analysis-run.processor.ts`
- `apps/worker/src/processors/github-repository.processor.ts`
- `apps/worker/src/processors/github-repository.processor.spec.ts`
- `libs/integrations/src/github/github.service.ts`
- `libs/integrations/src/github/github.service.spec.ts`

**Estimated scope:** Medium

- [x] Task 4: `FILE_DETAIL` 단계의 파일 수집 및 `repository_files` 저장 규칙을 완성한다.

**Description:** 파일 선별 결과를 바탕으로 raw content를 수집하고, 저장 가능한 파일만 `repository_files`에 기록한다. 파일 크기 상한과 바이너리/비텍스트 처리 전략을 코드로 고정해야 한다. 100KB 초과 파일은 truncate하지 않고 제외한다.

**Acceptance criteria:**
- [x] 선별된 파일 경로별 raw content 조회가 수행된다.
- [x] `repository_files.path`, `raw_analysis_report` 저장 규칙이 일관되고, 기존 데이터 교체 범위가 명확하다.
- [x] 100KB 초과 파일은 skip, 비텍스트 파일은 제외하는 정책이 구현과 문서에 반영된다.

**Verification:**
- [x] Tests pass: `npm test -- --runInBand apps/worker/src/processors/github-repository.processor.spec.ts libs/integrations/src/github/github.client.spec.ts`
- [x] 수작업 검토: `repository_files`에는 LLM에 실제 전달할 파일만 남는다.

**Dependencies:** Task 3

**Files likely touched:**
- `apps/worker/src/processors/github-repository.processor.ts`
- `apps/worker/src/processors/github-repository.processor.spec.ts`
- `libs/integrations/src/github/github.service.ts`
- `libs/database/src/entities/repository-files.entity.ts`
- `docs/tech-spec.md`

**Estimated scope:** Medium

### Checkpoint: GitHub 수집 완료

- [x] GitHub 메타데이터, 파일 트리, raw content 수집이 이어진다.
- [x] `repository_files` 저장 규칙이 결정되었다.
- [x] GitHub 오류가 예측 가능한 실패 메시지로 변환된다.

### Phase 4C. LLM 분석 슬라이스

- [x] Task 5: `FOLDER_STRUCTURE` 단계의 파일 선별 LLM 호출을 완성한다.

**Description:** 파일 트리 목록과 그룹 컨텍스트를 이용해 `selectFiles`를 실행하고, `llm_messages` 저장과 파싱 실패 처리를 확정한다. 이 task의 완료 시점에는 `FILE_DETAIL` 단계의 입력 경로가 안정적으로 준비되어야 한다.

**Acceptance criteria:**
- [x] `purpose = 'file_selection'` 활성 템플릿을 사용해 prompt가 생성된다.
- [x] USER/ASSISTANT 메시지가 `stage = FOLDER_STRUCTURE`로 저장된다.
- [x] 파서 결과가 0건이거나 JSON 형식이 잘못되면 `LLM_RESPONSE_PARSE_FAILED` 계열 failure reason으로 실패 처리된다.

**Verification:**
- [x] Tests pass: `npm test -- --runInBand apps/worker/src/processors/llm-analysis.processor.spec.ts libs/integrations/src/llm/parsers/parser.service.spec.ts`
- [x] 수작업 검토: 선별 결과가 `MAX_ANALYSIS_FILES`를 넘지 않는다.

**Dependencies:** Task 2, Task 3

**Files likely touched:**
- `apps/worker/src/processors/llm-analysis.processor.ts`
- `apps/worker/src/processors/llm-analysis.processor.spec.ts`
- `libs/integrations/src/llm/parsers/parser.service.ts`
- `libs/integrations/src/llm/parsers/parser.service.spec.ts`

**Estimated scope:** Small

- [x] Task 6: `SUMMARY` 단계의 코드 분석과 `code_analysis` 저장을 완성한다.

**Description:** 선별 파일 content를 바탕으로 `code_summary` 프롬프트를 실행하고, structured output을 파싱한 뒤 원문 JSON을 `code_analysis.raw_analysis_report`에 저장한다. 이 단계는 질문 생성의 직접 입력 계약을 결정하므로 저장 포맷을 바꾸지 않도록 고정해야 한다.

**Acceptance criteria:**
- [x] `purpose = 'code_summary'` 템플릿으로 prompt가 생성된다.
- [x] USER/ASSISTANT 메시지가 `stage = SUMMARY`로 저장된다.
- [x] `code_analysis.raw_analysis_report`에는 LLM 원문 JSON 문자열이 저장된다.

**Verification:**
- [x] Tests pass: `npm test -- --runInBand apps/worker/src/processors/llm-analysis.processor.spec.ts libs/integrations/src/llm/parsers/parser.service.spec.ts`
- [x] 수작업 검토: 질문 생성 단계는 파싱된 객체가 아니라 저장된 raw JSON 문자열을 재사용한다.

**Dependencies:** Task 4, Task 5

**Files likely touched:**
- `apps/worker/src/processors/llm-analysis.processor.ts`
- `apps/worker/src/processors/llm-analysis.processor.spec.ts`
- `libs/database/src/entities/code-analysis.entity.ts`
- `docs/tech-spec.md`

**Estimated scope:** Small

- [x] Task 7: `QUESTION_GENERATION` 단계와 `generated_questions` 저장을 완성한다.

**Description:** `code_analysis.raw_analysis_report`, 그룹 컨텍스트, 질문 수 상한을 바탕으로 질문 생성 호출을 수행하고 저장한다. 중복 질문 제거, priority 기준 상위 N개 선택, 기존 질문 교체 정책까지 닫는다.

**Acceptance criteria:**
- [x] `purpose = 'question_generation'` 템플릿으로 prompt가 생성된다.
- [x] USER/ASSISTANT 메시지가 `stage = QUESTION_GENERATION`으로 저장된다.
- [x] `generated_questions`는 중복 제거 후 `MAX_QUESTIONS_PER_ANALYSIS_RUN` 이내로 저장된다.

**Verification:**
- [x] Tests pass: `npm test -- --runInBand apps/worker/src/processors/llm-analysis.processor.spec.ts libs/integrations/src/llm/parsers/parser.service.spec.ts`
- [x] 수작업 검토: priority 오름차순으로 잘린 결과만 저장된다.

**Dependencies:** Task 6

**Files likely touched:**
- `apps/worker/src/processors/llm-analysis.processor.ts`
- `apps/worker/src/processors/llm-analysis.processor.spec.ts`
- `libs/database/src/entities/generated-questions.entity.ts`
- `docs/tech-spec.md`

**Estimated scope:** Small

### Checkpoint: LLM 분석 완료

- [x] 파일 선별, 코드 분석, 질문 생성이 각 단계별 저장 규칙과 함께 동작한다.
- [x] `llm_messages`, `code_analysis`, `generated_questions` 저장 형식이 고정된다.
- [x] LLM 파싱 실패가 일관되게 실패 처리된다.

### Phase 4D. 오케스트레이션과 운영 안정성

- [x] Task 8: `analysis-run.processor`에 단계 2 이후 전체 파이프라인 오케스트레이션을 연결한다.

**Description:** GitHub 단계와 LLM 단계를 실제 순서대로 연결하고, 단계 시작 전 `current_stage`를 갱신하며, 성공 시 `COMPLETED`와 `completedAt`을 기록한다. 실패 시 `FAILED`와 `failure_reason`을 저장하고 lock 및 progress cache를 정리한다.

**Acceptance criteria:**
- [x] `current_stage`가 `REPO_LIST -> FOLDER_STRUCTURE -> FILE_DETAIL -> SUMMARY -> QUESTION_GENERATION` 순서로 전이되고, 마지막에 `status = COMPLETED`로 마감된다.
- [x] 성공 시 `analysis_runs.status = COMPLETED`, `completed_at`이 기록된다.
- [x] 실패 시 lock 해제와 `FAILED` 처리가 보장된다.

**Verification:**
- [x] Tests pass: `npm test -- --runInBand apps/worker/src/processors/analysis-run.processor.spec.ts apps/worker/src/jobs/analysis-run.job.spec.ts`
- [x] 수작업 검토: 한 `analysisRunId` 기준 로그/상태 추적이 가능하다.

**Dependencies:** Task 3, Task 4, Task 5, Task 6, Task 7

**Files likely touched:**
- `apps/worker/src/processors/analysis-run.processor.ts`
- `apps/worker/src/processors/analysis-run.processor.spec.ts`
- `apps/worker/src/jobs/analysis-run.job.ts`
- `apps/worker/src/repositories/analysis-runs.repository.ts`
- `docs/tech-spec.md`

**Estimated scope:** Medium

- [x] Task 9: cleanup scheduler와 실패 복구 정책을 구현한다.

**Description:** 장시간 `IN_PROGRESS` 상태로 멈춘 실행을 `FAILED`로 정리하는 scheduler를 구현하고, stale run 정리 규칙을 문서화한다. RabbitMQ retry/dead-letter는 예약 토폴로지만 유지하고 실제 소비 정책 구현은 후속 Phase로 넘긴다.

**Acceptance criteria:**
- [x] 일정 시간 이상 `IN_PROGRESS`인 실행을 조회하고 `FAILED`로 전환하는 scheduler가 동작한다.
- [x] stale run 정리 시 `failure_reason`이 식별 가능하다.
- [x] retry/dead-letter가 이번 Phase 4 범위 밖이라는 점이 문서에 반영된다.

**Verification:**
- [x] Tests pass: `npm test -- --runInBand apps/worker/src/schedulers/cleanup.scheduler.spec.ts`
- [x] 수작업 검토: cleanup 대상 기준 시간과 배치 주기가 설정값으로 관리된다.

**Dependencies:** Task 8

**Files likely touched:**
- `apps/worker/src/schedulers/cleanup.scheduler.ts`
- `apps/worker/src/schedulers/cleanup.scheduler.spec.ts`
- `apps/worker/src/repositories/analysis-runs.repository.ts`
- `apps/worker/src/app.module.ts`
- `docs/tech-spec.md`

**Estimated scope:** Medium

### Checkpoint: Worker 완료 경로 확정

- [x] 성공 시 `COMPLETED`, 실패 시 `FAILED`와 복구 경로가 모두 존재한다.
- [x] stale `IN_PROGRESS` 정리 전략이 구현되었다.
- [x] retry/dead-letter 구현 여부가 사용자 결정과 일치한다.

### Phase 4E. 검증과 문서 동기화

- [x] Task 10: Phase 4 전체 테스트와 문서 정합성을 닫는다.

**Description:** Worker 단계별 단위 테스트, processor/job orchestration 테스트, 필요한 통합 테스트, 관련 spec 문서를 함께 정리한다. 구현자가 다음 작업에서 문서와 코드 사이를 역추적하지 않아도 되도록 Phase 4 결과를 명확히 남긴다.

**Acceptance criteria:**
- [x] Worker 핵심 경로 성공/실패 테스트가 존재한다.
- [x] `tech-spec`, 필요한 범위의 `server-spec`, `api-spec` 문서 차이가 정리된다.
- [x] 남은 운영 정책 미결정 사항이 있으면 문서에 명시된다.

**Verification:**
- [x] Tests pass: `npm run lint`
- [x] Tests pass: `npm run test`
- [x] Build succeeds: `npm run build`

**Dependencies:** Task 8, Task 9

**Files likely touched:**
- `docs/tech-spec.md`
- `docs/server-spec.md`
- `docs/api-spec.md`
- `apps/worker/src/**/*.spec.ts`
- `libs/integrations/src/**/*.spec.ts`

**Estimated scope:** Medium

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Redis lock이 Stage 0-1 방식으로 너무 일찍 해제됨 | High | Task 1에서 lock 수명을 파이프라인 전체 기준으로 재정의한다 |
| 활성 prompt template가 없거나 복수 active 상태임 | High | Task 2에서 실패 규칙과 공급 방식을 고정한다 |
| GitHub raw content 크기/형식이 일정하지 않음 | High | Task 4에서 파일 크기, 텍스트 여부, 저장 정책을 코드로 고정한다 |
| retry/dead-letter 요구가 문서마다 다름 | High | 이번 Phase 4에서는 cleanup scheduler까지만 구현하고 retry/dead-letter 소비 정책은 후속 Phase로 분리한다고 명시한다 |
| 현재 테스트는 processor 단위에 치우쳐 orchestration 회귀를 놓칠 수 있음 | Medium | Task 8, Task 10에서 end-to-end에 가까운 worker 경로 테스트를 추가한다 |
| `repository_files`가 `repository_id` 기준 저장이라 미래 재분석 시 덮어쓰기 위험이 있음 | Medium | MVP에서는 재분석 불허 전제를 문서에 유지하고, 정책 변경 시 schema 재검토를 명시한다 |

## Fixed Decisions

- [x] Dead-letter / retry queue 실제 소비 정책 구현은 이번 Phase 4 범위에 포함하지 않는다. DB 실패 처리와 `cleanup.scheduler`까지만 구현한다.
- [x] 기본 prompt template 3종은 seed 또는 migration 기반 초기 데이터로 제공한다.
- [x] 100KB 초과 파일은 truncate하지 않고 skip으로 고정한다.
- [x] `prompt_templates`의 `purpose + is_active=true` 유일성은 DB 제약으로 보장한다.

## Recommended Execution Order

1. Task 1
2. Task 2
3. Task 3
4. Task 5
5. Task 4
6. Task 6
7. Task 7
8. Task 8
9. Task 9
10. Task 10

## Handoff Notes For Coding Agents

- 현재 저장소에는 GitHub/LLM processor의 골격이 이미 있으므로, 새 abstraction을 만들기보다 기존 파일을 확장하는 쪽이 안전하다.
- `analysis-run.job`의 lock 해제 시점과 `analysis-run.processor`의 orchestration 책임이 이번 Phase 4의 핵심 리스크다. 여기부터 먼저 닫아야 한다.
- `Fixed Decisions`는 구현 착수 기준으로 확정된 전제다. 이후 구현 task는 이 결정을 다시 열지 않고 진행한다.
