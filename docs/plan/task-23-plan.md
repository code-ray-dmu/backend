# docs/plan/phase-4-llm-integration-plan.md

Source: [tech-spec.md](../tech-spec.md), [server-spec.md](../server-spec.md)

Scope: `### Phase 4: 분석 파이프라인 Worker 구현` 중 `LLM 연동` 작업을 구현하기 위한 실행 계획. 대상은 `libs/integrations/src/llm`, `prompt-builder`, `parsers`, Worker의 `llm-analysis.processor`, 그리고 `analysis-run.processor`와의 연결 지점이다.

Out of scope: Prompt Template CRUD 확장, GitHub 연동 범위 확장, 재분석 정책 변경, 질문 조회 API 변경, 멀티 provider 지원, 전체 문서 리라이팅, 실제 prompt template DB 시드 추가.

## 목적

- Worker가 문서 기준 단계(`FOLDER_STRUCTURE`, `SUMMARY`, `QUESTION_GENERATION`)에서 LLM을 안정적으로 호출할 수 있게 한다.
- `prompt_templates`의 활성 템플릿을 읽어 최종 프롬프트를 만들고, structured output을 검증 가능한 형태로 파싱한다.
- `llm_messages`, `code_analysis`, `generated_questions` 저장 흐름을 명확히 하여 분석 파이프라인의 재현성과 실패 처리를 보장한다.
- 현재 코드의 구 명칭(`question-generation`)을 문서 기준 명칭(`llm-analysis`)으로 최소 범위에서 정렬한다.

## 완성 조건

- OpenAI 기반 단일 provider 구현이 `libs/integrations/src/llm`에 추가되어 세 가지 유스케이스를 지원한다.
- `file_selection`, `code_summary`, `question_generation`용 prompt builder와 parser가 동작한다.
- `llm-analysis.processor`가 세 단계의 LLM 호출과 저장 책임을 수행한다.
- `analysis-run.processor`가 LLM 단계 호출 계약을 사용할 수 있도록 구조가 정리된다.
- 파싱 실패 시 `LLM_RESPONSE_PARSE_FAILED` 기준으로 실패 처리할 수 있다.
- 각 task 종료 후 subagent 리뷰를 받고, 피드백을 반영하거나 미반영 사유를 기록한다.
- 관련 검증을 가능한 범위에서 `npm run lint`, `npm run test`, `npm run build`로 확인한다.

## 해야할 범위

- `libs/integrations/src/llm/` 실제 구현
- OpenAI SDK 의존성 추가 및 provider adapter 구현
- `prompt-builder`, `parsers` 구현
- `question-generation.processor`를 `llm-analysis.processor` 기준으로 정리
- Worker의 LLM 단계 접점 구현
- LLM 관련 config/env 보강
- LLM 단계 단위 테스트 작성
- 직접 충돌하는 명칭과 상수만 최소 범위로 정리

## 하면 안되는 범위

- Prompt Template 데이터를 DB에 생성하는 작업
- GitHub API 로직의 신규 기능 추가
- unrelated repository/refactor 정리
- 문서 전체 정합성 정리
- API 스펙 확장
- 질문 재생성, 재분석 기능 도입
- 멀티 provider fallback 구현

## Rules

- Use `- [ ]` before a task is done, then change it to `- [x]`.
- After each task, request a subagent review.
- Apply subagent feedback before moving on, or note why feedback was not applied.
- Keep one logical purpose per task.
- If a task becomes larger than expected, split it and update this plan before implementation continues.

## Tasks

### 1. LLM integration contract 확정

- [x] `libs/integrations/src/llm`의 public contract를 구현한다.

Do:

- `provider-adapter.interface.ts`에 실제 메서드 계약 정의
- `llm.client.ts`와 `llm.service.ts`의 역할 분리
- LLM 호출 유스케이스를 아래 세 개로 고정
  - `selectFiles`
  - `summarizeCode`
  - `generateQuestions`
- 입력/출력 타입을 단계별로 명시
- OpenAI provider를 MVP 기준 구현체로 결정

Do not:

- 멀티 provider 전환 전략 구현
- Worker 저장 로직까지 이 task에 포함
- Prompt template 조회 로직 구현

Review checkpoint:

- 인터페이스가 Worker 유스케이스와 정확히 맞는지 subagent 리뷰
- provider 세부사항이 서비스 계층 밖으로 새지 않는지 확인

### 2. OpenAI provider 구현 및 설정 연결

- [x] OpenAI SDK 기반 호출 구현과 설정을 연결한다.

Do:

- `openai` 의존성 추가
- `LLM_API_KEY`, `LLM_MODEL` 기반 초기화 구현
- provider 호출 공통 에러 처리 기준 수립
- 필요 시 timeout/retry 기본 정책을 코드에 최소한으로 반영
- Worker/App module에서 주입 가능하도록 wiring 정리

Do not:

- provider별 옵션 확장
- 운영용 circuit breaker 도입
- 메시지 저장, DB 저장 책임 포함

Review checkpoint:

- 환경변수 사용 방식과 DI 구성이 안전한지 subagent 리뷰
- 외부 SDK 결합도가 과도하지 않은지 확인

### 3. Prompt builder 구현

- [x] DB 템플릿을 최종 프롬프트 문자열로 변환하는 builder를 구현한다.

Do:

- `template_text` + `variables_json` 기반 변수 치환 구현
- 필수 변수 누락 검증 추가
- `file_selection`, `code_summary`, `question_generation` purpose를 지원
- 템플릿 조회 실패/활성 템플릿 모호성 실패 기준 정의

Do not:

- 템플릿 CRUD 구현
- 템플릿 시드 추가
- 목적 외 템플릿 범용화

Review checkpoint:

- 변수 치환 규칙과 실패 조건이 문서 기준과 일치하는지 subagent 리뷰
- 템플릿 계약이 parser/processor와 자연스럽게 이어지는지 확인

### 4. Structured output parser 구현

- [x] 단계별 LLM 응답 parser를 구현한다.

Do:

- `file_selection` 배열 파서 구현
- `code_summary` 객체 파서 구현
- `question_generation` 배열 파서 구현
- invalid 항목 필터링 규칙 반영
- `MAX_ANALYSIS_FILES`, `MAX_QUESTIONS_PER_ANALYSIS_RUN` 상한 반영
- 파싱 실패를 `LLM_RESPONSE_PARSE_FAILED`로 통일

Do not:

- 프롬프트 작성 책임 포함
- DB 저장 책임 포함
- GitHub 입력 수집 책임 포함

Review checkpoint:

- malformed JSON, 빈 필드, 잘못된 category 등 negative case가 충분한지 subagent 리뷰
- 저장 전 정규화 기준이 문서와 맞는지 확인

### 5. `llm-analysis.processor` 구현

- [x] Worker의 LLM 호출 전담 processor를 구현한다.

Do:

- `question-generation.processor.ts`를 `llm-analysis.processor.ts` 기준으로 정리
- `selectFiles`, `analyzeCode`, `generateQuestions` 메서드 구현
- purpose별 활성 prompt template 조회
- `llm_messages` USER/ASSISTANT 저장
- `code_analysis.raw_analysis_report` 저장
- `generated_questions` 정규화 후 저장

Do not:

- GitHub API 호출 구현
- 전체 파이프라인 상태 전이 오케스트레이션 포함
- 큐 소비 책임 포함

Review checkpoint:

- processor 책임이 과도하게 넓어지지 않았는지 subagent 리뷰
- stage/role 저장 규칙과 DB write 흐름 검토

### 6. `analysis-run.processor`와 LLM 단계 연결

- [x] 전체 파이프라인 오케스트레이션에서 LLM 단계를 연결한다.

Do:

- `FOLDER_STRUCTURE` 단계에서 파일 선별 호출
- `SUMMARY` 단계에서 코드 요약 호출
- `QUESTION_GENERATION` 단계에서 질문 생성 호출
- stage/status/failure_reason 연결
- parser 실패 시 FAILED 처리 경로 정리
- 직접 충돌하는 Worker 명칭/상수 최소 정리

Do not:

- GitHub processor 신규 기능 추가
- RabbitMQ 아키텍처 확장
- unrelated dead-letter 구조 변경

Review checkpoint:

- 단계 전이와 실패 처리 흐름이 tech-spec과 일치하는지 subagent 리뷰
- 구 명칭 제거 범위가 과하거나 부족하지 않은지 확인

### 7. 테스트 및 검증

- [x] LLM 연동 범위에 대한 테스트와 검증을 마무리한다.

Do:

- parser 단위 테스트
- prompt-builder 단위 테스트
- `llm-analysis.processor` 단위 테스트
- `analysis-run.processor`의 LLM 단계 호출 흐름 테스트
- 가능한 범위에서 `npm run lint`, `npm run test`, `npm run build` 실행

Do not:

- E2E 전체 시나리오 확장
- GitHub 연동 통합 테스트 범위 확대
- unrelated flaky test 정리

Review checkpoint:

- 테스트가 핵심 실패 모드를 충분히 덮는지 subagent 최종 리뷰
- 남은 리스크와 미구현 항목 정리

## 구현 순서 요약

1. Contract 확정
2. OpenAI provider 및 설정 연결
3. Prompt builder 구현
4. Parser 구현
5. `llm-analysis.processor` 구현
6. `analysis-run.processor` 연결
7. 테스트 및 최종 리뷰

## Assumptions

- Provider는 OpenAI SDK를 사용한다.
- Prompt template 데이터는 수동 운영 대상으로 남기고, 이번 작업에서는 조회만 구현한다.
- 문서/명칭 정리는 직접 충돌하는 항목만 포함한다.
- DB 스키마 변경은 기본적으로 하지 않는다.
- subagent 리뷰는 각 task 종료 시점마다 반드시 수행한다.

## 사용자 결정 필요 항목

1. OpenAI 모델명을 어떤 값으로 고정할지 결정 필요
   현재 계획은 `LLM_MODEL` 환경변수로 주입받되, 기본 추천 모델명은 별도 합의가 필요함
2. 템플릿 부재 시 처리 방식을 확정할지 결정 필요
   현재 계획은 즉시 실패 처리
3. OpenAI 호출 재시도 정책을 어디까지 둘지 결정 필요
   현재 계획은 provider 내부 최소 처리만 두고, 파이프라인 재시도는 기존 RabbitMQ 정책에 위임
