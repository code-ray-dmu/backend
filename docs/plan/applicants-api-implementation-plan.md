# Applicants API Implementation Plan

Source:
- [docs/tech-spec.md](../tech-spec.md)
- [docs/api-spec.md](../api-spec.md)
- [docs/server-spec.md](../server-spec.md)
- [docs/conventions/code-convention.md](../conventions/code-convention.md)
- [docs/conventions/work-flow-convention.md](../conventions/work-flow-convention.md)

Target branch:
- `feature/TASK-16-applicants-api`

Branch base:
- `feature/TASK-15-groups-api` @ `929f51c`

## 목적

`apps/api/src/modules/applicants`에 MVP 기준의 지원자 등록/조회 API와 부모 라우트 진입점을 구현한다.
이 작업은 인증된 사용자가 자신의 그룹에 속한 지원자를 생성하고, 목록/상세를 조회하며, 이후 분석 흐름과 GitHub 공개 저장소 조회를 연결할 수 있는 API 경계를 마련하는 것을 목표로 한다.
또한 `applicants.controller.ts`를 부모 리소스 기준의 진입점으로 정리하여 `analysis-runs`, `generated-questions`, GitHub 연동이 자연스럽게 이어질 수 있도록 만든다.

## 완성 조건

- `POST /applicants`가 그룹 소유권 검증 후 지원자를 생성한다.
- `GET /applicants`가 현재 사용자 소유 그룹의 지원자만 페이지네이션 기준으로 반환한다.
- `GET /applicants/{applicantId}`가 현재 사용자 소유 지원자 상세를 반환한다.
- `GET /applicants/{applicantId}/github-repos`가 `applicants.controller.ts`에 정의되고 지원자 소유권 검증 후 GitHub 조회 서비스로 위임된다.
- `POST /applicants/{applicantId}/questions`가 `applicants.controller.ts`에 정의되고 지원자 소유권 검증 후 `AnalysisRunsService`로 위임된다.
- `GET /applicants/{applicantId}/questions`가 `applicants.controller.ts`에 정의되고 지원자 소유권 검증 후 `GeneratedQuestionsService`로 위임된다.
- `githubUrl`은 `https://github.com/{owner}` 형식만 허용하고 저장소 URL은 거부된다.
- `APPLICANT_NOT_FOUND`, `FORBIDDEN_RESOURCE_ACCESS`, `GROUP_NOT_FOUND`, `VALIDATION_ERROR`, `UNAUTHORIZED` 시나리오가 계약에 맞게 연결된다.
- 관련 단위 테스트가 추가되고 가능한 범위에서 `npm run lint`, `npm run test`, `npm run build` 검증 결과가 확인된다.
- 각 작업 단위 종료 후 subagent 리뷰를 받고, 피드백을 반영하거나 미반영 사유를 기록한다.

## 해야 할 범위

### 1. Applicants 모듈 구현

- `applicants.controller.ts`, `applicants.service.ts`, `applicants.facade.ts`, `repositories/applicants.repository.ts`를 실제 동작하도록 구현한다.
- `dto/` 아래에 생성 요청 DTO, 목록 조회 query DTO, 응답 DTO, 매퍼 함수, repository query/result 타입을 추가한다.
- `ApplicantsEntity`와 `GroupsEntity`를 기준으로 생성/목록/상세/소유권 검증 흐름을 구현한다.

### 2. 인증 및 인가 연결

- 모든 `applicants` 엔드포인트에 `JwtAuthGuard`를 적용한다.
- JWT payload의 `sub`를 현재 사용자 식별자로 사용한다.
- 그룹 생성과 지원자 접근에서 소유자 검증을 일관되게 적용한다.
- `applicant.group.userId === currentUserId` 기준 검증 메서드를 공통화한다.

### 3. 부모 라우트 위임 연결

- `/github-repos`, `POST /questions`, `GET /questions` 라우트를 `applicants.controller.ts`에 선언한다.
- 실제 처리 로직은 `AnalysisRunsService`, `GeneratedQuestionsService`, GitHub 조회용 서비스로 위임한다.
- 이번 작업에는 인접 모듈의 최소 public method 및 응답 타입 추가만 포함한다.

### 4. 요청/응답 및 오류 계약 정렬

- `docs/api-spec.md` 기준으로 applicants 관련 엔드포인트 요청/응답 계약을 구현한다.
- 응답은 기존 `data/meta/error` envelope를 따른다.
- `githubUrl` 유효성 검증은 DTO validation error로 처리한다.
- applicants 구현과 직접 연결되는 `api-spec` 불일치만 함께 정리한다.

### 5. 테스트 및 검증

- 서비스 단위 테스트를 추가한다.
- 컨트롤러 단위 테스트로 guard/filter/interceptor 메타데이터와 응답 모양을 검증한다.
- 필요 시 repository 또는 DTO 테스트를 추가한다.
- 아래 기본 검증을 수행한다.
  - `npm run lint`
  - `npm run test`
  - `npm run build`

## 하면 안 되는 범위

- `GET /applicants/{applicantId}/repositories` 구현
- `analysis-runs`, `generated-questions`, `applicant-repositories` 모듈의 전체 기능 완성
- DB 스키마 변경이나 migration 추가
- 인증 구조, 공통 응답 포맷, 예외 필터 전면 리팩터링
- 명세에 없는 applicant email/githubUrl 중복 제약 추가
- Worker 로직, RabbitMQ 처리, 분석 파이프라인 구현 착수
- unrelated 모듈 리팩터링 또는 광범위한 네이밍 변경

## Rules

- Use `- [ ]` before a task is done, then change it to `- [x]`.
- After each completed task, request a subagent review and record the feedback summary.
- If a review comment is not applied, write the reason directly under the task.
- Prefer one logical purpose per commit when actual implementation starts.

## Tasks

### 1. Applicants 계약과 모듈 경계 정리

- [x] applicants DTO, 예외, repository/service public method 목록을 고정한다. Review: `CreateApplicantDto`, `GetApplicantsQueryDto`, applicants read/result mapper 타입, `ApplicantNotFoundException`, applicants facade/service/repository public method 시그니처를 추가해 계약을 코드로 고정했다. `githubUrl`은 GitHub owner 규칙을 반영한 `https://github.com/{owner}`만 허용하고 저장소 URL 및 trailing slash는 거부하도록 DTO 테스트로 명문화했다. 소유권 검증은 후속 parent route에서 `githubUrl`을 재사용할 수 있도록 `ApplicantOwnershipResult`를 반환하는 방향으로 고정했고, `/github-repos`, `POST /questions`, `GET /questions` 위임 대상의 최소 public method도 `ApplicantGithubReposService`, `AnalysisRunsService`, `GeneratedQuestionsService`에 추가했다.
  미반영: `GET /applicants`의 `sort`/`order`와 응답 아이템 shape에 대한 `api-spec` 동기화는 `Task 8` 범위로 남겼다. 이번 `Task 1`에서는 groups 패턴을 따라 코드 계약을 먼저 고정하고, 문서 변경은 applicants 문서 정리 task에서 한 번에 반영한다.
  미반영: contract-only 단계의 stub 메서드는 아직 domain 예외를 반환하지 않는다. `Task 1`의 Do not 항목이 실제 query/비즈니스 로직 구현을 제한하고 있어, 지금은 명시적 not-implemented placeholder로 두고 `Task 4` 이후 실제 구현 시 계약에 맞는 예외로 교체한다.

Do:

- `tech-spec`와 `api-spec` 기준으로 `POST /applicants`, `GET /applicants`, `GET /applicants/{id}` 계약을 고정한다.
- 부모 라우트 3종의 controller 소유권과 위임 대상 서비스를 고정한다.
- `ApplicantNotFoundException` 추가 위치와 에러 코드 연결 방식을 정한다.
- `githubUrl` 검증 규칙을 `https://github.com/{owner}`만 허용하도록 명문화한다.

Do not:

- 실제 DB query 구현
- 인접 모듈의 전체 비즈니스 로직 구현

Exit criteria:

- DTO/예외/메서드 시그니처가 구현 중 재결정 없이 사용할 수 있는 수준으로 정리된다.
- subagent 리뷰 후 빠진 계약 항목이 없는지 확인한다.

### 2. Applicants 모듈 DI 및 파일 골격 정리

- [x] applicants 모듈에 필요한 DI wiring과 파일 책임 경계를 정리한다. Review: `ApplicantsModule`에 `TypeOrmModule.forFeature([ApplicantsEntity])`, `AuthModule`, `GroupsModule`, `AnalysisRunsModule`, `GeneratedQuestionsModule`, `GitHubModule` imports를 추가했고, `ApplicantsRepository`는 TypeORM repository 주입을 받도록 변경했다. `ApplicantsService`는 applicants/groups 도메인 의존성만 가지게 두고, `ApplicantsFacade`는 applicants ownership 확인 후 analysis-runs/generated-questions/GitHub 조회 서비스로 위임하는 orchestration 계층으로 정리했다. `ApplicantsModule` 메타데이터 테스트도 추가했다.

Do:

- `ApplicantsModule`에 TypeORM repository 주입 구성을 추가한다.
- 필요한 경우 `GroupsModule`, `AnalysisRunsModule`, `GeneratedQuestionsModule`, GitHub 관련 provider 연결 방식을 정리한다.
- `applicants.facade.ts`는 orchestration 전용 계층으로 유지한다.

Do not:

- 세부 query 조건이나 validation 구현
- 인접 모듈의 전체 wiring 재설계

Exit criteria:

- controller/service/facade/repository 간 책임이 분명하고 DI가 가능한 구조가 된다.
- subagent 리뷰 후 불필요한 계층 추가가 없는지 확인한다.

### 3. Applicants DTO 및 validation 구현

- [x] 생성/조회 DTO와 mapper, query 타입, validation 규칙을 추가한다. Review: applicants 생성/조회 DTO, paged result DTO, ownership mapper, parent-route query DTO를 정리했고 `githubUrl`, UUID, email, page/sort validation 테스트를 추가했다. `GET /applicants/{applicantId}/questions`의 기본 정렬도 tech-spec 기준 `priority asc`로 수정했다.
  미반영: `GET /applicants`의 `sort`/`order`가 현재 `docs/api-spec.md`보다 앞서 있는 부분은 `Task 8`에서 문서 동기화로 정리한다. 코드 쪽은 groups 패턴과 tech-spec 기준을 우선 유지한다.
  미반영: `dto/index.ts`에 parent-route DTO와 내부 query/result 타입이 함께 노출된 구조는 현재 service/repository import가 이미 이 배럴을 사용하고 있어, `Task 6` 계약 정리 시점에 public/internal DTO 경계를 다시 나누는 쪽으로 보류한다.

Do:

- `CreateApplicantDto`, `GetApplicantsQueryDto`, 응답 DTO, mapper 함수를 추가한다.
- `page=1`, `size=20` 기본값과 `sort`, `order` 기본값을 기존 groups 패턴에 맞춰 정한다.
- `githubUrl`이 저장소 URL이면 거부되도록 validation을 추가한다.

Do not:

- controller/service 비즈니스 분기 구현
- GitHub API 호출 구현

Exit criteria:

- applicants 입력/출력 계약이 코드로 고정된다.
- DTO 테스트가 필요하면 함께 추가한다.
- subagent 리뷰 후 validation 누락이 없는지 확인한다.

### 4. Applicants repository 구현

- [x] 지원자 생성, 목록 조회, 단건 조회, 소유권 검증용 repository 메서드를 구현한다. Review: `ApplicantsRepository`에 생성, 목록, 단건, 소유권 조회를 구현했다. 목록 조회는 `group.userId` 기반 필터와 optional `groupId`, pagination, sort를 지원하고, stable pagination을 위해 secondary `id` 정렬을 추가했다. detail/list 조회에서는 불필요한 `group` relation 로딩을 제거했고, ownership 조회는 `group.userId`만 선택적으로 읽도록 최소화했다. repository spec도 추가해 query shape를 고정했다.

Do:

- 생성 메서드와 목록 조회 메서드를 추가한다.
- `group.userId` 기준의 소유권 검증이 가능한 조회 메서드를 추가한다.
- 목록 조회는 group 필터와 pagination/sort를 지원한다.

Do not:

- service 계층의 예외 분기 구현
- 명세에 없는 unique 제약 처리

Exit criteria:

- service가 필요한 데이터를 중복 query 없이 읽을 수 있다.
- subagent 리뷰 후 query 범위와 relation 로딩이 적절한지 확인한다.

### 5. Applicants 기본 API 구현

- [x] 생성/목록/단건 조회를 service, facade, controller에 연결한다. Review: `ApplicantsController`에 `POST /applicants`, `GET /applicants`, `GET /applicants/:applicantId`를 추가하고 `JwtAuthGuard`, `ApiExceptionFilter`, `ApiResponseEnvelopeInterceptor`를 groups 패턴과 맞춰 적용했다. `ApplicantsService`는 그룹 소유권 검증 후 생성, 현재 사용자 기준 목록 조회, 상세 조회와 `GROUP_NOT_FOUND`/`APPLICANT_NOT_FOUND`/`FORBIDDEN_RESOURCE_ACCESS` 분기를 구현했다. service/controller spec도 추가했고, subagent 리뷰 후 list query 전파 검증과 interceptor/filter 응답 계약 테스트까지 보강했다.

Do:

- 그룹 소유권 검증 후 applicant 생성 로직을 구현한다.
- 현재 사용자 기준 applicants 목록 조회를 구현한다.
- applicant 상세 조회와 소유권 검증을 구현한다.
- `JwtAuthGuard`, response interceptor, exception filter를 controller에 적용한다.

Do not:

- 부모 라우트 위임 구현
- 분석 실행 로직 구현

Exit criteria:

- `POST /applicants`, `GET /applicants`, `GET /applicants/{id}`가 계약대로 동작한다.
- 서비스/컨트롤러 테스트가 추가된다.
- subagent 리뷰 후 권한/미존재 분기 누락이 없는지 확인한다.

### 6. Applicants 부모 라우트 위임 계약 추가

- [x] 인접 서비스의 최소 public method와 응답 타입을 추가한다. Review: `AnalysisRunsFacade`/`Service`에 질문 생성 시작용 입력/응답 타입과 public method를 추가했고, `GeneratedQuestionsFacade`/`Service`에도 지원자 질문 조회용 query/result 타입과 public method를 추가했다. GitHub 조회는 `ApplicantGithubReposService`를 applicants 내부 연결 지점으로 유지했고, applicants facade가 controller가 사용할 최소 응답 DTO로 위임하도록 contract를 고정했다. `ApplicantsFacade` spec을 추가해 `/github-repos`, `POST /questions`, `GET /questions` 위임 입력/응답 shape를 테스트로 고정했다.
  반영: subagent 피드백에 따라 parent-route 응답 DTO 중복을 제거하고 sibling module DTO를 canonical contract로 정리했다. 또한 applicants facade에서 ownership 검증을 마친 뒤 downstream facade/service에는 `applicantId`와 paging/sort, `githubUrl`처럼 실제로 필요한 최소 입력만 넘기도록 축소했다.
  반영: 아직 구현되지 않은 downstream public method들은 generic `Error` 대신 `NotImplementedException`을 던지도록 바꿔 경계를 더 명시적으로 만들었다.

Do:

- `AnalysisRunsService`에 질문 생성 시작용 최소 method 시그니처를 추가한다.
- `GeneratedQuestionsService`에 지원자 질문 조회용 최소 method 시그니처를 추가한다.
- GitHub 조회용 서비스 또는 기존 integration service 연결 지점을 정한다.
- applicants controller가 바로 사용할 최소 응답 DTO를 정리한다.

Do not:

- 실제 분석 실행/질문 조회/GitHub 연동 전체 구현
- applicant-repositories 모듈 전체 구현

Exit criteria:

- controller에서 호출 가능한 안정된 public contract가 마련된다.
- subagent 리뷰 후 과도한 확장 없이 최소 범위인지 확인한다.

### 7. Applicants 부모 라우트 구현

- [x] `/github-repos`, `POST /questions`, `GET /questions`를 applicants controller에 연결한다. Review: `ApplicantsController`에 `GET /applicants/:applicantId/github-repos`, `POST /applicants/:applicantId/questions`, `GET /applicants/:applicantId/questions`를 추가했고, 각 라우트가 applicants facade를 통해 ownership 검증 후 GitHub 조회/질문 생성/질문 조회로 위임되도록 연결했다. controller spec에 세 라우트의 응답 및 pagination meta 테스트를 추가했고, facade spec으로 위임 입력을 고정했다.
  반영: subagent 피드백에 따라 parent route 응답은 sibling module DTO를 그대로 노출하지 않고 applicants-owned DTO로 매핑하도록 controller/facade 경계를 정리했다.

Do:

- 공통 applicant 소유권 검증 후 각 서비스로 위임한다.
- controller 메서드와 facade/service orchestration을 구현한다.
- 각 라우트에 대한 controller/service 테스트를 추가한다.

Do not:

- 인접 모듈의 비즈니스 로직 확장
- `/repositories` 엔드포인트 구현

Exit criteria:

- 부모 라우트 3종이 `applicants.controller.ts`에 선언되고 올바른 서비스로 위임된다.
- subagent 리뷰 후 라우트 경계가 명세와 일치하는지 확인한다.

### 8. Applicants 문서 동기화

- [x] 구현에 직접 연결되는 applicants API 문서를 정리한다. Review: `docs/api-spec.md`에서 `POST /applicants`의 `githubUrl` 설명을 trailing slash 금지까지 구현과 맞췄고, `GET /applicants`에는 실제 코드 계약에 맞는 `sort`/`order` query와 목록 item shape를 추가했다. `GET /applicants/{applicantId}/questions`도 기본 정렬 `priority asc`, query 기본값, 질문 item 응답 shape로 문서화해 현재 controller/DTO 계약과 일치시켰다.

Do:

- `POST /applicants`의 `githubUrl` 설명을 구현과 일치시킨다.
- `POST /applicants/{applicantId}/questions`의 `analysisRunIds` 응답 설명을 구현 범위에 맞게 정리한다.
- applicants 부모 라우트 설명 중 이번 작업으로 고정된 계약만 반영한다.

Do not:

- 광범위한 문서 리팩터링
- `/repositories` 명세 구현 여부까지 확정하지 않은 내용 추가

Exit criteria:

- 코드와 문서의 applicants 관련 불일치가 최소화된다.
- subagent 리뷰 후 문서가 실제 구현과 충돌하지 않는지 확인한다.

### 9. 최종 검증

- [x] lint/test/build와 최종 종합 리뷰를 완료한다. Review: `npm run lint`, `npm run test`, `npm run build`를 모두 다시 실행해 통과했고, 최종 subagent 리뷰도 받았다.
  미반영: 최종 리뷰에서 `/applicants/:applicantId/github-repos`, `POST /applicants/:applicantId/questions`, `GET /applicants/:applicantId/questions`가 현재 downstream 구현 부재로 `NotImplementedException`(501)까지밖에 가지 못한다는 지적이 있었다. 이 문제는 `AnalysisRunsService`, `GeneratedQuestionsService`, `ApplicantGithubReposService`의 실제 비즈니스 구현이 필요한 범위라서, 이번 applicants API 작업 범위 안에서는 계약/라우트 연결까지만 유지하고 최종 런타임 완성도 이슈로 보고한다.
  미반영: `ApplicantsFacade.getQuestions()`의 non-empty item mapping을 직접 검증하는 테스트는 추가하지 않았다. 현재 controller/facade 성공 경로 테스트는 있으나, 필드별 매핑 고정 테스트는 후속 질문 조회 구현 시점에 보강하는 편이 범위상 적절하다고 판단했다.

Do:

- `npm run lint`
- `npm run test`
- `npm run build`
- 최종 subagent 리뷰 요청
- 최종 반영 내역과 미반영 사유 정리

Do not:

- 실패한 검증을 숨기기
- 관련 없는 정리 작업 추가

Exit criteria:

- 검증 결과와 리뷰 반영 상태를 최종 보고할 수 있다.

## 기본 가정

- applicant email/githubUrl 중복 금지 규칙은 현재 명세에 없으므로 추가하지 않는다.
- `/repositories` 조회는 별도 `applicant-repositories` 작업으로 남긴다.
- DB 엔티티 구조는 현재 정의를 그대로 사용하고 migration은 만들지 않는다.
- GitHub 연동 실패 처리 방식은 기존 integrations/common exception 패턴을 우선 따르며, applicants 작업 범위를 넘는 새 도메인 에러 코드는 추가하지 않는다.
