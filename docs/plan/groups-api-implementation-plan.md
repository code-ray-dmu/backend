# Groups API Implementation Plan

Source:
- [docs/tech-spec.md](../tech-spec.md)
- [docs/api-spec.md](../api-spec.md)
- [docs/server-spec.md](../server-spec.md)
- [docs/conventions/work-flow-convention.md](../conventions/work-flow-convention.md)

Target branch:
- `feature/TASK-15-groups-api-plan`

## 목적

`apps/api/src/modules/groups`에 MVP 기준의 그룹 생성/조회 API를 구현한다.
이 작업은 인증된 사용자가 자신의 그룹을 생성하고, 자신의 그룹 목록과 상세를 조회할 수 있도록 만드는 것을 목표로 한다.
또한 이후 `applicants`, `analysis-runs`, Worker가 참조할 수 있는 그룹 컨텍스트의 기준 구현을 마련한다.

## 완성 조건

- `POST /groups`가 인증된 사용자 기준으로 그룹을 생성한다.
- `GET /groups`가 현재 사용자 소유 그룹만 페이지네이션 기준으로 반환하고, 정렬 정책은 사전 결정된 기준에 맞게 구현된다.
- `GET /groups/{groupId}`가 현재 사용자 소유 그룹 상세를 반환한다.
- 타 사용자 소유 그룹 접근 시 `403 FORBIDDEN_RESOURCE_ACCESS`를 반환한다.
- 존재하지 않는 그룹 조회 시 `404 GROUP_NOT_FOUND`를 반환한다.
- DTO 검증, 인증 연동, DB 조회/저장, 응답 매핑이 연결된다.
- 응답은 `docs/api-spec.md`의 `data/meta/error` envelope를 따른다.
- `groups` 모듈 구현 후 관련 테스트가 추가되고 `npm run lint`, `npm run test`, `npm run build` 검증 결과가 확인된다.
- 각 작업 단위가 끝날 때마다 subagent 리뷰를 받고 피드백을 반영하거나 미반영 사유를 기록한다.

## 해야 할 범위

### 1. Groups 모듈 구현

- `groups.controller.ts`, `groups.service.ts`, `repositories/groups.repository.ts`를 실제 동작하도록 구현한다.
- `groups.facade.ts`는 현재 코드베이스에 이미 존재하므로 유지 여부를 먼저 결정하고, 유지 시에는 단순 orchestration 책임만 부여한다.
- `dto/` 아래에 생성 요청 DTO, 목록 조회 query DTO, 응답 DTO 또는 매핑용 타입을 추가한다.
- `GroupsEntity`를 기준으로 그룹 생성, 목록 조회, 상세 조회 로직을 구현한다.

### 2. 인증 및 인가 연결

- 모든 `groups` 엔드포인트에 `JwtAuthGuard`를 적용한다.
- JWT payload의 `sub`를 현재 사용자 식별자로 사용한다.
- 현재 사용자 정보를 컨트롤러에서 읽기 위한 최소 공통 장치를 추가한다.
- `group.userId === currentUserId` 기준 소유자 검증을 일관되게 구현한다.

### 3. DB 연동 기반 연결

- `GroupsModule`에 TypeORM repository 주입 구성을 추가한다.
- 필요 시 `GroupsEntity`를 주입받는 repository/provider 구성을 정리한다.
- `groups` 구현에 필요한 최소한의 DB import 구성을 추가한다.

### 4. 요청/응답 및 오류 계약 정렬

- `docs/api-spec.md` 기준으로 `POST /groups`, `GET /groups`, `GET /groups/{groupId}` 계약을 구현한다.
- `techStacks`는 plain object, `cultureFitPriority`는 non-empty string 기준으로 검증한다.
- 목록 조회 기본값 중 `page=1`, `size=20`은 고정한다.
- `sort`, `order`의 허용값과 기본값은 문서에 고정되어 있지 않으므로 사용자 결정이 필요한 항목으로 분리한다.
- `GROUP_NOT_FOUND`, `FORBIDDEN_RESOURCE_ACCESS`, `VALIDATION_ERROR`, `UNAUTHORIZED` 시나리오를 맞춘다.
- 응답 envelope 자체는 필수 요구사항으로 고정하고, 구현 방식만 `groups` 로컬 적용 또는 재사용 가능한 최소 공통 장치 중 하나로 정한다.

### 5. 테스트 및 검증

- 서비스 단위 테스트를 추가한다.
- 가능하면 컨트롤러 또는 통합 성격 테스트로 인증/응답 형태를 확인한다.
- 아래 기본 검증을 수행한다.
  - `npm run lint`
  - `npm run test`
  - `npm run build`

## 하면 안 되는 범위

- `groups` 외 다른 도메인 기능 구현
- `GroupsEntity` 스키마 변경
- 문서에 없는 그룹 수정/삭제 API 추가
- `cultureFitPriority` enum 강제 도입
- `techStacks` 상세 schema 강제 도입
- 인증 시스템 전체 재설계
- 전역 응답 시스템 전체 리팩터링
- unrelated 모듈 리팩터링 또는 광범위한 네이밍 변경
- Worker, GitHub, LLM 기능 구현 착수

## 작업 순서

### Task 1. 선행 결정 확정

- API prefix 기준, 응답 envelope 구현 범위, 목록 정렬 정책, facade 유지 여부, 테스트 수준을 먼저 확정한다.
- 이 단계가 끝나기 전에는 public contract에 영향을 주는 구현을 시작하지 않는다.
- 산출물: 확정된 결정사항과 기본 가정 업데이트
  - 현재 런타임 구현 기준 prefix와 canonical prefix 확인 필요 항목
  - 응답 envelope 구현 방식
  - `GET /groups` 정렬 정책
  - facade 유지 여부
  - 최소 필수 테스트 스위트
- 리뷰 포인트: 구현 중간에 재결정이 필요 없는지 확인
- 종료 후 subagent에게 구조/범위 리뷰를 요청한다.

#### Task 1 결정 결과

- 현재 런타임 구현 기준 prefix: 현재 런타임 기준은 `docs/api-spec.md`와 동일한 `/v1`로 정렬되었다.
  - 반영 메모: `apps/api/src/main.ts`의 global prefix를 `/v1`로 맞춰 published contract와 runtime mismatch를 해소했다.
- 응답 envelope 구현 기준: `groups` 로컬 하드코딩이 아니라 `apps/api/src/common`에 두는 최소 공통 장치를 우선 검토한다.
  - 근거: `docs/api-spec.md`와 `docs/tech-spec.md`는 `data/meta/error` + `meta.request_id`를 공통 응답 규약으로 정의한다.
  - 스펙 충돌 메모: `docs/server-spec.md`의 예외 처리 명세는 `timestamp/path/code/message` 형식을 제시하고 있어 문서 간 충돌이 존재한다.
  - 범위 제한: 이번 작업에서는 `groups` 구현이 바로 사용할 최소 공통 유틸 또는 interceptor/filter 수준까지만 추가 후보로 두고, 최종 오류 응답 형태는 사용자 결정 후 확정한다.
- `GET /groups` 정렬 정책: `sort`는 `createdAt` 또는 `name`, `order`는 `asc` 또는 `desc`만 허용하고, 기본값은 `createdAt desc`로 고정한다.
  - 근거: 생성 직후 최근 그룹이 먼저 보여야 실사용성이 높고, `name`은 보조 정렬 요구를 수용할 수 있는 최소 필드다.
  - API 매핑 메모: 외부 query는 `createdAt`/`name`을 받되 DB 정렬 컬럼은 엔티티 필드명에 맞춰 매핑한다.
- facade 처리 방침: 현재 코드베이스의 스캐폴드를 존중해 `GroupsFacade`를 호환 계층으로 남길 수 있으나, 유지하더라도 orchestration 전용으로만 사용한다.
  - 근거: `auth`, `analysis-runs`, `applicants`, `generated-questions`도 facade 파일을 이미 보유하고 있어, `groups`만 제거하면 현재 스캐폴드와의 일관성이 깨질 수 있다.
  - 제한: facade 유지 여부는 구현 세부 선택으로 두되, 비즈니스 로직과 DB 접근은 각각 service/repository에 둔다.
- 최소 필수 테스트 스위트: service 단위 테스트를 기본으로 하고, public contract 보호가 필요하면 app-level integration test를 추가한다.
  - 포함 범위: service에서 생성/목록/상세/소유자 검증 분기를 검증한다.
  - 확장 범위: 인증 적용, global validation pipe, 응답 envelope 형태는 plain controller unit test가 아니라 Nest app bootstrap 기반 integration test에서 확인한다.
  - 제외 범위: 외부 인프라를 띄우는 full e2e는 이번 작업 기본 범위에 포함하지 않는다.

#### Task 1 기본 가정 업데이트

- `groups` 구현은 현재 런타임/문서 기준(`/v1`)을 따른다.
- 공통 응답 규약은 `groups` 구현에 필요한 최소 범위만 공통화 후보로 두고, 오류 응답 형태는 문서 우선순위 결정 후 확정한다.
- 정렬 기본값은 `createdAt desc`이며, 허용 정렬 필드는 `createdAt`, `name` 두 가지로 제한한다.
- facade를 유지하더라도 orchestration 외 책임은 추가하지 않는다.
- 테스트는 service unit test를 기본으로 하고, 필요 시 app-level integration test를 추가한다.

#### Task 1 후속 메모

- `docs/api-spec.md`/`docs/tech-spec.md`와 `docs/server-spec.md`의 오류 응답 형식 충돌은 구현 전 정리하거나 우선순위를 명시해야 한다.
- 다른 모듈까지 공통 응답 envelope를 일괄 적용하는 리팩터링은 이번 범위에 포함하지 않는다.
- 목록 정렬 필드 확장은 실제 요구가 생길 때 추가한다.

### Task 2. Groups 모듈/provider wiring

- `GroupsModule`에 필요한 import/provider 구성을 추가한다.
- `GroupsEntity` repository 주입 구조를 연결한다.
- facade를 유지하기로 결정한 경우 provider 등록만 먼저 정리한다.
- 이 단계에서는 controller/service/facade의 실제 비즈니스 구현을 시작하지 않는다.
- 산출물: DI와 TypeORM 주입이 가능한 모듈 wiring
- 리뷰 포인트: spec과 어긋나는 불필요한 provider/계층 추가 여부
- 종료 후 subagent에게 모듈 wiring 리뷰를 요청한다.

### Task 3. Service/controller 기본 골격 정리

- `groups.service.ts`, `groups.controller.ts`, `repositories/groups.repository.ts`의 역할 경계를 정리한다.
- facade를 유지하기로 결정한 경우 `groups.facade.ts`는 단순 orchestration 책임만 가지도록 고정한다.
- 이 단계의 목적은 각 파일이 어떤 책임을 가질지 컴파일 가능한 골격을 만드는 것이다.
- 산출물: 역할이 분명한 `groups` 모듈 파일 골격
- 리뷰 포인트: facade 포함 여부가 문서와 코드 상태를 함께 만족하는지 확인
- 종료 후 subagent에게 모듈 구조 리뷰를 요청한다.

### Task 4. 공통 인증/현재 사용자 접근 장치 추가

- `JwtAuthGuard`를 `groups` 엔드포인트에 적용한다.
- JWT payload의 `sub`를 현재 사용자 식별자로 읽기 위한 최소 장치를 추가한다.
- 필요 시 request typing 또는 decorator를 추가하되 `groups` 구현 범위 안에서만 도입한다.
- 산출물: 컨트롤러에서 현재 사용자 ID를 안전하게 사용할 수 있는 인증 기반
- 리뷰 포인트: 인증 컨텍스트가 다른 모듈 확장을 강제하지 않는지 확인
- 종료 후 subagent에게 인증 연결 리뷰를 요청한다.

### Task 5. 응답/예외 계약 정렬

- Task 1에서 정리한 현재 런타임 prefix 기준과 응답 envelope 결정 사항을 바탕으로 `groups` 모듈의 출력 계약을 먼저 고정한다.
- `data/meta/error` envelope와 `GROUP_NOT_FOUND`, `FORBIDDEN_RESOURCE_ACCESS`, `VALIDATION_ERROR`, `UNAUTHORIZED` 표현 방식을 구현한다.
- `groups` 구현에 필요한 범위까지만 공통 응답/예외 코드를 추가한다.
- Task 6-10은 이 단계가 끝나기 전까지 시작하지 않는다.
- 산출물: 이후 API 구현이 그대로 사용할 수 있는 응답/오류 계약 기반
- 리뷰 포인트: 로컬 구현과 공통 구현의 경계가 과하지 않은지 확인
- 종료 후 subagent에게 응답 계약 리뷰를 요청한다.

### Task 6. 조회용 DTO와 repository 조회 메서드 구현

- 선행조건: Task 1에서 공식 정렬 정책이 확정되어 있어야 한다.
- 목록 조회 query DTO를 추가한다.
- `page`, `size` 기본값과 사전 합의된 정렬 정책을 repository 조회 조건에 반영한다.
- 목록 조회와 단건 조회에 필요한 repository 메서드를 구현한다.
- 산출물: 현재 사용자 기준 목록/상세 조회를 지원하는 DB 접근 계층
- 리뷰 포인트: 소유자 범위가 query 수준에서 충분히 제한되는지 확인
- 종료 후 subagent에게 조회 데이터 접근 리뷰를 요청한다.

#### Task 6 반영 사항

- `GetGroupsQueryDto`를 추가해 `page=1`, `size=20`, `sort=createdAt`, `order=desc` 기본값과 허용 필드를 코드로 고정했다.
- 조회용 타입(`GroupsListQuery`, `GroupsListResult`, 읽기 DTO 타입)을 추가해 이후 Task 7에서 응답 매핑 기준으로 재사용할 수 있게 했다.
- `GroupsRepository`에 아래 조회 메서드를 구현했다.
  - `findGroupById(groupId)`
  - `findGroupByIdAndUserId(groupId, userId)`
  - `getGroups({ userId, page, size, sort, order })`
- 목록 조회는 `findAndCount` 기반으로 구현했고, `where.userId`를 통해 현재 사용자 범위를 query 수준에서 제한한다.
- 정렬은 현재 합의된 허용 필드(`createdAt`, `name`)만 repository 내부에서 DB order 조건으로 매핑한다.

### Task 7. 조회 API 구현

- 선행조건: Task 1의 prefix/envelope/정렬 정책과 Task 5의 응답 계약 정렬이 완료되어 있어야 한다.
- `GET /groups`와 `GET /groups/{groupId}` 컨트롤러, 서비스, 필요 시 facade 흐름을 구현한다.
- 그룹 존재 여부와 소유자 검증을 일관되게 처리한다.
- 문서 기준 상세 응답 필드를 매핑하고, Task 5에서 정한 envelope로 바로 반환한다.
- 산출물: 그룹 목록/상세 조회 API
- 리뷰 포인트: `GROUP_NOT_FOUND`와 `FORBIDDEN_RESOURCE_ACCESS`의 분기 기준 확인
- 종료 후 subagent에게 인가/조회 흐름 리뷰를 요청한다.

### Task 8. 생성용 DTO와 저장 메서드 구현

- 생성 요청 DTO를 추가한다.
- `techStacks`와 `cultureFitPriority` 검증 규칙을 반영한다.
- 그룹 생성 repository 메서드와 저장 후 조회 또는 응답 매핑에 필요한 로직을 구현한다.
- 산출물: 문서 계약을 만족하는 생성용 입력/저장 계층
- 리뷰 포인트: `userId`가 body가 아니라 JWT에서만 주입되는지 확인
- 종료 후 subagent에게 생성 데이터 접근 리뷰를 요청한다.

#### Task 8 반영 사항

- `CreateGroupDto`를 추가해 `name`, `techStacks`, `cultureFitPriority` 필수 검증과 `description` 선택 입력을 반영했다.
- 생성 입력은 `CreateGroupInput`으로 분리하고 `userId`를 body가 아닌 별도 입력으로만 받도록 고정했다.
- 생성 성공 응답 준비를 위해 `CreateGroupResultDto`와 mapper를 추가했다.
- `GroupsRepository.createGroup(...)`은 `GroupsEntity`를 생성/저장하고, service/facade는 이를 문서 응답 형태(`group_id`, `name`, `created_at`)로 변환해 반환하도록 연결했다.

### Task 9. 생성 API 구현

- 선행조건: Task 1의 prefix/envelope 정책과 Task 5의 응답 계약 정렬이 완료되어 있어야 한다.
- `POST /groups` 컨트롤러, 서비스, 필요 시 facade 흐름을 구현한다.
- 생성 성공 응답을 Task 5에서 정한 envelope와 문서 필드 구조에 맞게 반환한다.
- 산출물: 그룹 생성 API
- 리뷰 포인트: 요청 검증 실패와 인증 실패가 올바른 계층에서 처리되는지 확인
- 종료 후 subagent에게 생성 API 계약 리뷰를 요청한다.

### Task 10. 테스트 추가

- 선행조건: Task 1에서 최소 필수 테스트 스위트가 확정되어 있어야 한다.
- 최소 필수 테스트는 서비스 단위 테스트를 기본으로 한다.
- 추가 범위는 Task 1에서 결정된 경우에만 컨트롤러 또는 통합 성격 테스트를 포함한다.
- 인증 실패, 검증 실패, 소유자 검증, 생성 성공, 목록/상세 성공 시나리오를 포함한다.
- 산출물: `groups` 동작을 검증하는 자동화 테스트
- 리뷰 포인트: public contract를 보호하는 테스트가 충분한지 확인
- 종료 후 subagent에게 테스트 범위 리뷰를 요청한다.

#### Task 10 반영 사항

- `groups.service.spec.ts`를 추가해 생성 성공, 목록 조회 매핑, 상세 조회 성공, `GROUP_NOT_FOUND`, `FORBIDDEN_RESOURCE_ACCESS` 분기를 검증했다.
- `groups.controller.spec.ts`를 추가해 `JwtAuthGuard`/response interceptor/filter 메타데이터와 `POST /groups`, `GET /groups`, `GET /groups/{groupId}`의 pre-interceptor body shape를 검증했다.
- `groups.repository.spec.ts`를 추가해 목록/상세 조회 query가 `userId` 조건을 포함하도록 검증했다.
- `dto/groups.dto.spec.ts`를 추가해 생성 요청 검증(`name`, `techStacks`, `cultureFitPriority`)과 목록 조회 기본값(`page=1`, `size=20`, `sort=createdAt`, `order=desc`)을 검증했다.
- `api-exception.filter.spec.ts`를 추가해 `BadRequestException`과 `UnauthorizedException`이 `VALIDATION_ERROR`/`UNAUTHORIZED` + `request_id` envelope로 매핑되는지 filter 단위에서 검증했다.
- 현재 테스트는 service/repository/DTO/controller/filter 단위 검증까지 포함하며, `JwtAuthGuard`와 `ValidationPipe`를 실제 HTTP 요청 경로로 통과시키는 app-level integration test는 아직 추가하지 않았다.
- 실행 결과: `npm test -- --runInBand apps/api/src/modules/groups/groups.service.spec.ts apps/api/src/modules/groups/groups.controller.spec.ts apps/api/src/modules/groups/repositories/groups.repository.spec.ts apps/api/src/modules/groups/dto/groups.dto.spec.ts apps/api/src/common/filters/api-exception.filter.spec.ts` 통과.

### Task 11. 검증 및 최종 리뷰

- `npm run lint`, `npm run test`, `npm run build`를 실행한다.
- 실패 또는 스킵 항목이 있으면 원인과 영향 범위를 기록한다.
- 마지막으로 subagent에게 최종 코드 리뷰를 요청하고 피드백을 반영하거나 미반영 사유를 정리한다.
- 산출물: 최종 검증 결과와 리뷰 반영 내역

## 테스트 시나리오

- 인증 없이 `POST /groups`, `GET /groups`, `GET /groups/{groupId}` 호출 시 인증 실패
- 유효한 body로 `POST /groups` 성공
- `name` 누락 시 생성 실패
- `techStacks`가 객체가 아니면 생성 실패
- `cultureFitPriority`가 빈 문자열이면 생성 실패
- 사용자 A가 만든 그룹만 사용자 A의 목록에 노출
- `GET /groups` 기본값 미지정 시 `page=1`, `size=20`이 적용되고, 정렬은 사전 합의된 정책을 따른다.
- 존재하지 않는 `groupId` 조회 시 `GROUP_NOT_FOUND`
- 사용자 B가 사용자 A의 그룹 상세 조회 시 `FORBIDDEN_RESOURCE_ACCESS`
- 상세 응답에 `group_id`, `name`, `description`, `tech_stacks`, `culture_fit_priority`가 포함

## 결정이 필요한 질문 목록

### 1. API prefix 정렬

문서 기준과 현재 코드는 모두 `/v1`로 정렬되었다.
이전 blocking decision은 `apps/api/src/main.ts`의 global prefix를 `/v1`로 맞추는 방식으로 해소했다.

#### 권장안

추가 조치 없음.

### 2. 공통 응답 envelope 적용 범위

`docs/api-spec.md`와 `docs/tech-spec.md`는 `data/meta/error` 구조를 사용하지만, `docs/server-spec.md`는 `timestamp/path/code/message` 오류 형식을 제시한다.
현재 공통 interceptor 또는 response builder는 없다.
결정이 필요한 부분은 어떤 문서를 우선 기준으로 볼지, 그리고 `groups` 내부 로컬 매핑으로 구현할지 아니면 다른 모듈이 재사용 가능한 최소 공통 응답 체계로 구현할지다.

#### 권장안

`apps/api/src/common`에 두는 최소 공통 장치로 구현하되, 실제 적용은 이번 작업 범위 안의 `groups`까지만 우선 제한한다.

### 3. 목록 정렬 정책

`docs/api-spec.md`는 `sort`, `order`를 optional로만 두고 허용 필드와 기본값을 고정하지 않았다.
이번 작업에서 허용할 정렬 필드와 기본 정렬 방향을 확정해야 한다.

#### 권장안

허용 필드는 `createdAt`, `name`, 기본 정렬은 `createdAt desc`로 고정한다.

### 4. facade 유지 여부

`docs/server-spec.md`의 `groups` 구조에는 facade가 없지만 현재 코드베이스에는 `groups.facade.ts`가 이미 있다.
이번 작업에서 기존 스캐폴드를 존중해 facade를 유지할지, 아니면 spec 기준으로 facade를 범위에서 제외할지 결정이 필요하다.

#### 권장안

이번 작업에서는 facade를 호환 계층으로 유지하되 orchestration 전용으로 제한하는 쪽을 권장한다.

### 5. 테스트 수준

이번 작업의 검증을 서비스 단위 테스트 중심으로 할지, 컨트롤러 또는 e2e 성격 테스트까지 포함할지 결정이 필요하다.

#### 권장안

service 단위 테스트를 기본으로 하고, contract 확인이 필요하면 Nest app bootstrap 기반 integration test를 추가하며, full e2e는 이번 작업 기본 범위에서 제외한다.

## 기본 가정

- 새 작업 브랜치는 `main`에서 파생한다. `feature/TASK-6-github-api`의 변경은 `groups` 구현에 직접 선행 조건이 아니다.
- `groups` 구현에 필요한 최소 공통 코드 추가는 허용된다.
- 필드 검증은 현재 기준에서 느슨하게 유지한다.
- 구현 중 각 단계 종료 후 subagent 리뷰를 반드시 수행한다.
