# 구현 플랜: `analysis-runs` + Phase 3 분석 요청/큐 연동

## 요약
- 목적: `POST /applicants/{applicantId}/questions` 요청이 `analysis_runs` 생성과 큐 발행까지 실제로 연결되고, `GET /analysis-runs/{id}`로 실행 상태를 조회할 수 있도록 Phase 3 범위를 완성한다.
- 완성조건:
  - 분석 요청 API가 지원자 소유권 검증, 대상 저장소 확보, 중복 완료 실행 차단, `analysis_runs` 생성, 큐 메시지 발행까지 수행한다.
  - Worker가 분석 요청 메시지를 consume 하고 Redis lock 기반으로 기본 상태 전이(`QUEUED -> IN_PROGRESS`)를 처리한다.
  - 실패 시 `FAILED`와 `failureReason`이 기록되고, 단건 상태 조회 API에서 확인 가능하다.
  - 관련 계약 문서(`tech-spec`, 필요한 범위의 `api-spec`/`server-spec`/ERD)와 코드가 Phase 3 기준으로 최소 일치한다.
  - 각 작업 종료 시 subagent 리뷰를 받고, 지적사항을 반영하거나 반영 불가 사유를 기록한다.

## 범위
- 해야할 범위:
  - `analysis-runs` API 모듈의 실제 동작 구현
  - 분석 요청 생성과 단건 상태 조회 API 구현
  - `AnalysisRunPublisher`와 queue payload/contract 정리
  - Worker의 RabbitMQ consumer 연결과 기본 분석 요청 처리 흐름 구현
  - Redis lock, 진행 상태 캐시 키, 기본 TTL/설정 반영
  - Phase 3에 직접 필요한 repository/service/facade/controller 테스트 추가
  - 구현에 직접 영향 주는 문서 최소 동기화
- 하면 안 되는 범위:
  - GitHub 파일 트리 조회, 파일 선택, raw content 수집, LLM 요약/질문 생성의 실제 처리
  - `generated_questions` 실데이터 생성
  - 분석 실행 목록 조회 API
  - prompt template 운영 기능 확장
  - 문서 전면 개편, unrelated refactor, broad rename

## 구현 변경
### 1. API 수직 슬라이스 완성
- `ApplicantsController/Facade`에서 `POST /applicants/{applicantId}/questions`를 `AnalysisRunsService`로 연결한다.
- `AnalysisRunsController`에 `GET /analysis-runs/{id}`를 추가한다.
- `AnalysisRunsService`에 다음 책임을 구현한다:
  - 지원자 및 소유권 검증
  - GitHub URL 기반 저장소 확보 로직 호출
  - 저장소별 기존 `COMPLETED` 실행 존재 여부 확인
  - 새 `analysis_runs` 레코드 생성
  - 큐 발행
  - `analysisRunIds` 응답 조립
- `ApplicantRepositoriesService`는 Phase 3에 필요한 범위만 구현한다:
  - GitHub owner 파싱
  - 공개 저장소 목록 조회
  - 상위 N개 저장소 upsert
- 수락 기준:
  - 요청 한 번으로 1개 이상 `analysis_runs`가 생성된다.
  - 이미 완료된 저장소는 재요청 시 명세된 예외를 반환한다.
  - 응답에 `analysisRunIds`가 포함된다.
- 작업 종료 체크:
  - subagent 코드 리뷰
  - 리뷰 반영 후 API 단위/통합 테스트 갱신

### 2. Queue 계약과 발행기 정식화
- `libs/contracts/src/queue/analysis-request.payload.ts`를 tech spec 기준 payload로 확장한다.
- RabbitMQ 상수와 queue/exchange 이름을 문서 기준으로 정리한다.
- `AnalysisRunPublisher`는 payload 생성과 publish만 담당하게 고정한다.
- `RabbitMqService`는 최소 기능만 구현한다:
  - exchange/queue 선언
  - 메시지 publish
  - consumer 등록 진입점
- 수락 기준:
  - API가 발행하는 payload가 `analysisRunId`, `applicantId`, `repositoryId`, `requestedByUserId`, `requestedAt`를 포함한다.
  - queue naming이 코드/문서에서 일관된다.
- 작업 종료 체크:
  - subagent 코드 리뷰
  - 리뷰 반영 후 queue contract 테스트 추가/갱신

### 3. Worker Phase 3 뼈대 구현
- `analysis-run.processor`를 큐 consumer 진입점으로 구현한다.
- `analysis-run.job`은 상태 전이와 예외 처리를 담당한다.
- Redis lock(`analysis:lock:{repositoryId}`) 획득 후 실행, finally에서 해제한다.
- Phase 3 범위에서는 실제 GitHub/LLM 단계 대신 기본 실행 흐름만 처리한다:
  - 메시지 수신
  - `IN_PROGRESS` 전이 및 `startedAt` 기록
  - 최소 진행상태 캐시 기록
  - 현재 범위 외 단계는 명시적으로 stub 처리하거나 Phase 4 경계 예외로 종료
- 실패 경로는 `FAILED`, `failureReason` 저장까지 구현한다.
- 수락 기준:
  - worker가 메시지를 consume 하면 DB 상태가 바뀐다.
  - lock 중복 획득이 방지된다.
  - 실패 시 조회 API에서 원인을 볼 수 있다.
- 작업 종료 체크:
  - subagent 코드 리뷰
  - 리뷰 반영 후 worker smoke/integration 테스트 갱신

### 4. 저장소/리포지토리/설정 정리
- `analysis-runs`, `applicant-repositories` 관련 repository 클래스에 실제 조회/생성/upsert 메서드를 추가한다.
- 필요한 경우 `TypeOrmModule.forFeature(...)`와 module wiring을 보강한다.
- 환경변수와 validation에 Phase 3 필수값만 반영한다:
  - `MAX_REPO_SELECTION_COUNT`
  - `RABBITMQ_MAX_RETRY`
  - `ANALYSIS_LOCK_TTL`
- 수락 기준:
  - 서비스가 더미 클래스가 아닌 실제 repository 기반으로 동작한다.
  - API/worker 양쪽 module wiring이 컴파일 가능하다.
- 작업 종료 체크:
  - subagent 코드 리뷰
  - 리뷰 반영 후 `npm run build`

### 5. 문서 최소 동기화
- 구현에 직접 영향 주는 차이만 맞춘다:
  - `POST /applicants/{applicantId}/questions` 응답의 `analysisRunIds`
  - `GET /analysis-runs/{id}` 상태 조회 범위
  - queue payload shape
  - Phase 3/4 경계와 worker 책임
- 수락 기준:
  - 구현자가 문서를 보고 잘못된 인터페이스를 만들 가능성이 없을 정도로만 정리된다.
- 작업 종료 체크:
  - subagent 리뷰는 코드 중심으로 받고, 문서 불일치 지적이 있으면 함께 반영

## 검증 계획
- 단위 테스트:
  - `AnalysisRunsService` 생성/중복 차단/예외 처리
  - `ApplicantRepositoriesService` 저장소 확보/upsert
  - `AnalysisRunPublisher` payload 검증
- 통합 테스트:
  - queue contract
  - repository query 및 상태 전이
  - worker job 실패 처리
- E2E/스모크:
  - `POST /applicants/{id}/questions`
  - `GET /analysis-runs/{id}`
  - worker 부트 및 메시지 소비 최소 경로
- 기본 실행 명령:
  - `npm run lint`
  - `npm run test`
  - `npm run build`

## 결정사항과 기본값
- 이번 범위는 `Phase 3만`으로 고정한다.
- `analysis-runs` API 범위는 `생성 + 단건 상태 조회`로 고정한다.
- 문서 정리는 `구현에 직접 영향 주는 최소 범위`만 포함한다.
- 각 작업 종료 후 subagent 리뷰를 수행하고, 피드백 반영까지 해당 작업의 완료 조건에 포함한다.
- 추가로 남은 사용자 결정 필요 항목은 현재 기준 없다.
