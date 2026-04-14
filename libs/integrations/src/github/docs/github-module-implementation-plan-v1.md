# GitHub Module Implementation Plan v1

이 문서는 `libs/integrations/src/github` 모듈 구현 작업을 실제 코드 작업 단위로 나누고, 구현 중 지켜야 할 범위와 검증 기준을 정리한 실행 계획서다.

기준 문서:
- `docs/tech-spec.md`
- `docs/server-spec.md`
- `libs/integrations/src/github/docs/github-api-spec-v1.md`

## 1. 목적

- GitHub 공개 저장소 조회와 분석 파이프라인 입력 수집에 필요한 공용 연동 모듈을 완성한다.
- `libs/integrations/src/github`가 API App과 Worker App에서 공통으로 재사용 가능한 GitHub 연동 진입점이 되도록 정리한다.
- GitHub raw 응답을 직접 서비스 레이어에 노출하지 않고, 내부 DTO와 mapper를 통해 일관된 계약을 제공한다.

## 2. 완성 조건

- GitHub API 4종 호출이 구현된다.
  - 사용자 공개 저장소 목록 조회
  - 저장소 기본 정보 조회
  - 저장소 파일 트리 조회
  - 저장소 파일 content 조회
- `GitHubClient`는 HTTP 호출만 담당한다.
- `GitHubService`는 캐시 처리, 예외 변환, 응답 조합을 담당한다.
- raw GitHub 응답 DTO와 내부 반환 DTO가 분리된다.
- 저장소 기본 정보와 파일 트리 조회는 Redis 캐시를 사용한다.
- 저장소 기본 정보 캐시 TTL은 1시간, 파일 트리 캐시 TTL은 30분으로 정의된다.
- Redis 장애 시 캐시 미스로 처리하고 GitHub API 직접 호출로 fallback 한다.
- 파일 content 조회는 Base64 디코딩 결과를 포함한 내부 DTO를 반환한다.
- GitHub API 응답의 `X-RateLimit-Remaining`, `X-RateLimit-Reset` 헤더를 읽고 rate limit 상황을 처리한다.
- 관련 단위 테스트와 서비스 테스트가 추가된다.
- `npm run lint`, `npm run test`, `npm run build` 검증 결과가 확인된다.
- 각 작업 단계 종료 시 subagent 리뷰를 받고, 피드백을 반영하거나 미반영 사유를 기록한다.

## 3. 해야할 범위

- `libs/integrations/src/github` 내부 구현
- GitHub DTO, mapper, client, service 확장
- GitHub용 Redis 캐시 키 정리
- 관련 테스트 추가
- 구현 계획과 리뷰 이력 문서화

## 4. 하면 안되는 범위

- `apps/api` 엔드포인트 연결
- `apps/worker` processor 연결
- DB 엔티티나 마이그레이션 수정
- RabbitMQ, LLM, Applicant 모듈 책임 변경
- `repository-url-parser.service.ts` 위치 변경 또는 리팩터링
- private 저장소 지원, OAuth, GraphQL 전환
- 관련 없는 모듈 리팩터링

## 5. 기본 원칙

- `client = HTTP 호출`, `service = 캐시/예외 변환/조합`, `mapper = raw 응답 → 내부 DTO` 책임을 유지한다.
- 기존 `node:https` 기반 구현을 유지한다.
- 서비스 레이어 입력은 유저 공개 저장소 목록 조회 시 `owner`를 사용하고, 저장소 단위 작업은 `repoFullName` 중심으로 받아 내부에서 `owner/repo`를 분리한다.
- GitHub 응답 에러는 구현체 세부사항이 아니라 도메인 친화적인 내부 예외로 정규화한다.
- 문서에 없는 확장 동작은 이번 작업에서 추가하지 않는다.

## 6. 작업 분할

### Task 1. 설계 정렬

목표:
- `docs/tech-spec.md`와 현재 구현을 대조해 필요한 공개 메서드, DTO, 캐시 지점을 확정한다.

세부 작업:
- 현재 `GitHubClient`, `GitHubService`, `dto/`, `mappers/`의 현 상태를 정리한다.
- GitHub 모듈에서 제공할 public 메서드 목록을 확정한다.
- 캐시 대상과 비캐시 대상을 구분한다.
- 캐시 TTL, Redis fallback, rate-limit header 처리 정책을 구현 요구사항으로 잠근다.

산출물:
- 구현 대상 메서드 목록
- DTO 분리 기준
- 캐시 정책 초안

리뷰 규칙:
- Task 1 종료 후 subagent 리뷰 수행
- 누락 책임, 과도한 범위, 문서 불일치 여부를 점검

#### Task 1 결과

현재 구현 정리:
- `GitHubClient`는 `getRepositoryContent` 단일 메서드만 제공하며, 공통 GET 요청 헬퍼 안에서 상태 코드 검사와 JSON 파싱을 직접 수행한다.
- `GitHubService`는 `getRepositorySourceFile` 단일 메서드만 제공하며, 캐시 처리와 예외 정규화 없이 mapper 호출만 담당한다.
- `dto/`는 `get-repository-content.dto.ts` 단일 파일만 있고, raw GitHub 응답 DTO와 내부 반환 DTO가 같은 파일에 함께 정의되어 있다.
- `mappers/`는 `repository-content.mapper.ts`만 존재하며, Base64 newline 제거와 UTF-8 디코딩만 처리한다.
- `RedisService`는 아직 구체 구현이 없고, `REDIS_CACHE_KEYS`에는 `GITHUB_REPOSITORY`만 정의되어 있어 파일 트리 캐시 키는 추가 정리가 필요하다.

Task 1 기준 public 메서드 확정:
- `GitHubClient.listUserRepositories(owner)`
- `GitHubClient.getRepositoryMetadata(owner, repo)`
- `GitHubClient.getRepositoryTree(owner, repo, branch)`
- `GitHubClient.getRepositoryContent(owner, repo, path, ref?)`
- `GitHubService.listUserRepositories(owner)`
- `GitHubService.getRepositoryMetadata(repoFullName)`
- `GitHubService.getRepositoryTree(repoFullName, branch?)`
- `GitHubService.getRepositorySourceFile(repoFullName, path, ref?)`
- `GitHubService.getRepositoryTree`와 `GitHubService.getRepositorySourceFile`는 `branch/ref`가 생략되면 내부에서 저장소 메타데이터를 조회해 `default_branch`를 기준 ref로 사용한다.

DTO 분리 기준 확정:
- raw GitHub 응답 DTO는 API 단위로 분리한다. 예: repository-list, repository-metadata, repository-tree, repository-content.
- 서비스 외부에 노출하는 내부 DTO도 API 단위로 분리하되, raw DTO와 같은 파일에 두지 않는다.
- client 입력은 GitHub REST 호출에 맞는 `owner`, `repo`, `path`, `branch`, `ref` 중심으로 유지한다.
- service 입력은 문서 원칙대로 공개 저장소 목록 조회만 `owner`를 받고, 저장소 단위 메서드는 모두 `repoFullName`을 기본 입력으로 받는다.
- `repoFullName` 파싱은 service 내부 책임으로 두고, `owner/repo` 형식이 아닐 경우 내부 예외로 변환한다.
- 파일 content 내부 DTO는 최소 `name`, `path`, `encoding`, `content`, `decodedContent`를 유지하고, 후속 rate-limit 대응을 위해 응답 메타데이터 확장 가능성을 열어 둔다.

캐시 정책 초안 확정:
- 캐시 대상은 `getRepositoryMetadata`, `getRepositoryTree` 두 메서드로 제한한다.
- `listUserRepositories`는 최신 수정 순 정합성이 더 중요하므로 Task 1 기준 비캐시 대상으로 둔다.
- `getRepositorySourceFile`은 파일별 변경 가능성과 payload 크기를 고려해 Task 1 기준 비캐시 대상으로 둔다.
- 저장소 메타데이터 캐시 TTL은 1시간(3600초)으로 적용한다.
- 저장소 파일 트리 캐시 TTL은 30분(1800초)으로 적용한다.
- 캐시 키는 `docs/tech-spec.md` 기준에 맞춰 `github:repo:{owner}/{repo}`와 `github:tree:{owner}/{repo}:{branch}` 형식으로 정리한다.
- GitHub 캐시 키는 상수 이름만 확장하지 않고, 위 네임스페이스를 생성하는 전용 key builder 함수로 조합한다.
- Redis 읽기/쓰기 실패는 예외로 전파하지 않고 캐시 미스로 간주한 뒤 GitHub API 직접 호출로 fallback 한다.

rate-limit / 예외 처리 정책 확정:
- `GitHubClient`는 각 응답의 `X-RateLimit-Remaining`, `X-RateLimit-Reset` 헤더를 함께 추출할 수 있어야 한다.
- 인증이 필요한 호출은 `Authorization: token {GITHUB_PAT}` 헤더를 포함할 수 있어야 한다.
- `GitHubService`는 GitHub 구현 세부사항을 그대로 노출하지 않고, 최소 `not-found`, `forbidden`, `rate-limit`, `invalid-repo-full-name`, `invalid-response` 수준의 내부 예외 의미로 정규화한다.
- `403` 응답이라도 rate-limit 헤더 상 `remaining=0`이면 일반 forbidden이 아니라 rate-limit 예외로 우선 해석한다.
- `429` 응답도 rate-limit 예외로 처리한다.
- JSON 파싱 실패와 content 디코딩 실패는 `invalid-response` 계열로 다룬다.
- Base64 content는 개행 제거 후 UTF-8 문자열로 복원하는 현재 규칙을 유지한다.

Task 2 이후 구현 메모:
- DTO 파일은 raw 응답 DTO와 내부 반환 DTO를 분리해 `dto/raw/`, `dto/internal/` 형태 또는 이에 준하는 구조로 재정리한다.
- `GitHubClient` 공통 응답 타입에는 body 외에 status code와 rate-limit 메타데이터를 포함한다.
- `GitHubService`는 캐시 조회, client 호출, mapper 변환, 예외 정규화를 한 메서드 안에 과도하게 섞지 않도록 private helper를 둔다.
- `GitHubService`는 branch/ref 생략 시 metadata 조회 결과의 `default_branch`를 재사용하되, 이미 호출자가 branch/ref를 전달한 경우 추가 metadata 조회를 하지 않는다.
- GitHub 캐시 키 구현은 `docs/tech-spec.md` 네임스페이스와 일치하도록 `github:repo:*`, `github:tree:*` 계열을 우선한다.

### Task 2. 타입/계약 정리

목표:
- GitHub API별 raw 응답 DTO와 내부 반환 DTO를 분리한다.

세부 작업:
- 저장소 목록 조회 DTO 정의
- 저장소 메타데이터 조회 DTO 정의
- 파일 트리 조회 DTO 정의
- 파일 content 조회 DTO 정의
- 내부 서비스 반환용 DTO 정의
- `repoFullName` 입력 규칙과 내부 owner/repo 분해 규칙 명시
- 공개 저장소 목록 조회용 `owner` 입력 규칙 명시

산출물:
- `dto/` 구조 정리
- 서비스 메서드 시그니처 초안
- 내부 반환 계약 정의

리뷰 규칙:
- Task 2 종료 후 subagent 리뷰 수행
- DTO 경계와 메서드 시그니처 피드백 반영

#### Task 2 결과

DTO 구조 정리:
- `dto/client/`에 client 입력 DTO와 `GitHubClientResponseDto`, `GitHubRateLimitDto`를 분리했다.
- `dto/raw/`에 GitHub raw body 응답 DTO를 API 단위로 분리했다.
- `dto/internal/`에 서비스 외부 반환용 내부 DTO를 API 단위로 분리했다.
- `dto/service/`에 `repoFullName` 중심 서비스 입력 DTO를 분리했다.
- 기존 단일 파일 `get-repository-content.dto.ts`는 제거하고, barrel export는 `client`, `raw`, `internal`, `service` 기준으로 재구성했다.

서비스/클라이언트 시그니처 초안:
- Task 1에서 확정한 메서드 시그니처는 문서 기준으로 잠그되, 실제 runtime class에는 기존 content 조회 동작만 유지했다.
- `dto/service/`에 `repoFullName` 기반 서비스 입력 DTO를 추가해 후속 Task 3~4에서 service 시그니처를 안전하게 옮길 수 있게 했다.
- `dto/client/`에 metadata/tree/list/content용 client 입력 DTO를 추가해 후속 Task 3에서 client 메서드 확장 시 재사용할 계약을 먼저 고정했다.
- Task 2에서는 공개 클래스의 runtime 동작을 바꾸지 않고, 타입/파일 구조 정리에만 집중했다.

계약 규칙 명시:
- client layer는 `owner`, `repo`, `path`, `branch`, `ref`를 직접 입력으로 받는다.
- service layer는 목록 조회를 제외하면 `repoFullName`을 기본 입력으로 받는다.
- 파일 content 내부 DTO는 `decodedContent`를 포함한 기존 계약을 유지한다.
- raw DTO는 GitHub field naming(`full_name`, `default_branch`, `updated_at`)을 유지하고, internal DTO는 서버 코드 기준 camelCase 계약으로 분리했다.

### Task 3. 클라이언트 확장

목표:
- `GitHubClient`에 필요한 GitHub REST API 호출 메서드를 추가한다.

세부 작업:
- 공개 저장소 목록 조회 메서드 추가
- 저장소 기본 정보 조회 메서드 추가
- 파일 트리 조회 메서드 추가
- 파일 content 조회 메서드 보강
- 공통 헤더, 토큰 주입, 상태 코드 처리, JSON 파싱 오류 처리 정리
- `X-RateLimit-Remaining`, `X-RateLimit-Reset` 헤더 읽기 구조 추가

산출물:
- 확장된 `GitHubClient`
- 공통 request/response 처리 로직

리뷰 규칙:
- Task 3 종료 후 subagent 리뷰 수행
- 헤더 처리, 메서드 구조, 오류 처리 피드백 반영

#### Task 3 결과

클라이언트 메서드 확장:
- `GitHubClient.listUserRepositories`를 추가해 `GET /users/{owner}/repos?sort=updated&type=owner` 호출을 구현했다.
- `GitHubClient.getRepositoryMetadata`를 추가해 `GET /repos/{owner}/{repo}` 호출을 구현했다.
- `GitHubClient.getRepositoryTree`를 추가해 `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1` 호출을 구현했다.
- 기존 `GitHubClient.getRepositoryContent`는 `GitHubClientResponseDto<T>` envelope 반환 구조로 확장했다.

공통 request/response 처리 정리:
- `ConfigService`를 주입해 `github.token` 설정값을 `Authorization: token {GITHUB_TOKEN}` 헤더에 포함하도록 정리했다.
- 공통 Accept 헤더는 `application/vnd.github.v3+json`으로 고정했다.
- 공통 GET 헬퍼가 status code, response body, `X-RateLimit-Remaining`, `X-RateLimit-Reset` 헤더를 함께 읽는다.
- JSON 파싱 실패는 일반 `Error`가 아니라 GitHub 전용 client error로 감싸서 전달하도록 정리했다.

오류 처리 정리:
- HTTP status code가 없거나 400 이상이면 `GitHubClientError`를 던지도록 정리했다.
- `GitHubClientError`는 `statusCode`, `responseBody`, `rateLimit` 메타데이터를 포함해 Task 4 서비스 예외 변환에 재사용할 수 있게 했다.
- `GitHubService.getRepositorySourceFile`는 새 client envelope에서 `body`만 mapper로 전달하도록 최소 수정했다.

### Task 4. 서비스/캐시/매퍼 구현

목표:
- `GitHubService`에 실제 사용 가능한 GitHub 연동 기능을 완성한다.

세부 작업:
- 저장소 목록 조회 서비스 구현
- 저장소 메타데이터 조회 서비스 구현
- 파일 트리 조회 서비스 구현
- 파일 source 조회 서비스 구현
- Redis 캐시 hit/miss 처리 추가
- 저장소 정보 캐시 TTL 1시간 적용
- 파일 트리 캐시 TTL 30분 적용
- Redis 장애 시 direct call fallback 처리
- GitHub 응답을 내부 DTO로 매핑
- Base64 content 정규화 및 디코딩 처리
- GitHub 전용 캐시 키 상수 또는 key builder 정리
- 404/403/rate limit에 대한 내부 예외 변환 구현

산출물:
- 확장된 `GitHubService`
- mapper 구현
- 캐시 키 체계

리뷰 규칙:
- Task 4 종료 후 subagent 리뷰 수행
- 캐시 정책, DTO 반환, 예외 변환 피드백 반영

#### Task 4 결과

서비스 구현:
- `GitHubService.listUserRepositories(owner)`를 구현해 raw 저장소 목록 응답을 내부 DTO로 매핑하도록 정리했다.
- `GitHubService.getRepositoryMetadata(repoFullName)`를 구현해 `repoFullName` 파싱, metadata 조회, 내부 DTO 매핑, Redis 캐시 저장을 수행하도록 정리했다.
- `GitHubService.getRepositoryTree(repoFullName, branch?)`를 구현해 branch 생략 시 metadata 기반 `default_branch`를 사용하고, tree 조회 결과를 Redis 캐시에 저장하도록 정리했다.
- `GitHubService.getRepositorySourceFile(repoFullName, path, ref?)`를 구현해 ref 생략 시 metadata 기반 `default_branch`를 사용하고, content 응답을 내부 DTO로 매핑하도록 정리했다.

캐시/Redis 정리:
- `RedisService`를 최소 동작 가능한 JSON read/write 래퍼로 확장했다.
- GitHub metadata/tree 캐시 키 builder를 추가해 `github:repo:{owner}/{repo}`, `github:tree:{owner}/{repo}:{branch}` 규칙으로 정리했다.
- metadata 캐시 TTL은 3600초, tree 캐시 TTL은 1800초로 적용했다.
- Redis read/write 실패는 서비스에서 삼키고 cache miss/direct call로 fallback 하도록 처리했다.

매퍼/예외 정리:
- metadata/tree/user repository 전용 mapper를 추가해 raw GitHub DTO와 내부 DTO 경계를 분리했다.
- `GitHubServiceError`를 추가해 `not-found`, `forbidden`, `rate-limit`, `invalid-repo-full-name`, `invalid-response` 코드로 예외를 정규화했다.
- `GitHubClientError`의 `statusCode`, `rateLimit`를 기반으로 `404`, `403`, `429`, rate-limit 상황을 서비스 오류 코드로 변환하도록 정리했다.

### Task 5. 테스트 구현

목표:
- GitHub 모듈 핵심 동작이 테스트로 보호되도록 한다.

세부 작업:
- mapper 테스트 작성
- client 테스트 작성
- service 테스트 작성
- cache hit/miss 테스트 작성
- 404/403/rate limit 처리 테스트 작성
- rate-limit header 처리 테스트 작성
- Redis 장애 fallback 테스트 작성
- Base64 newline 제거와 디코딩 테스트 작성

산출물:
- GitHub 모듈 테스트 코드

리뷰 규칙:
- Task 5 종료 후 subagent 리뷰 수행
- 누락 테스트와 약한 검증 포인트 피드백 반영

#### Task 5 결과

추가한 테스트:
- `github.client.spec.ts`
  - 저장소 목록 조회 URL/쿼리/공통 헤더 검증
  - tree branch/path 인코딩 검증
  - content path/ref 인코딩 검증
  - 비정상 status code 시 `GitHubClientError` 반환 검증
  - JSON 파싱 실패 시 `GitHubClientError` 반환 검증
  - transport error 시 `GitHubClientError` 반환 검증
- `github.service.spec.ts`
  - metadata cache hit 시 client 미호출 검증
  - metadata cache miss 시 client 호출과 TTL 3600 저장 검증
  - tree cache hit/miss 및 TTL 1800 저장 검증
  - branch/ref 생략 시 `default_branch` 재사용 검증
  - Redis read/write 실패 fallback 검증
  - `invalid-repo-full-name`, `not-found`, `forbidden`, `rate-limit`, `invalid-response` 정규화 검증
- `mappers/github-mappers.spec.ts`
  - Base64 newline 제거 및 UTF-8 디코딩 검증
  - metadata/tree/user-repository mapper 변환 검증

검증 결과:
- targeted Jest: GitHub 관련 22개 테스트 통과
- `npm run test` 통과
- `npx eslint "libs/integrations/src/github/**/*.ts"` 통과

### Task 6. 검증 및 마무리

목표:
- 구현 결과를 기본 품질 게이트로 검증하고 최종 리뷰 상태를 남긴다.

세부 작업:
- `npm run lint`
- `npm run test`
- `npm run build`
- 실패 시 원인, 영향 범위, 후속 조치 기록
- 최종 subagent 리뷰 수행

산출물:
- 검증 결과
- 최종 리뷰 반영 상태

리뷰 규칙:
- 최종 결과에 대해 subagent 리뷰 수행
- 반영 완료 또는 미반영 사유 명시

#### Task 6 결과

기본 품질 게이트:
- `npm run lint` 통과
- `npm run test` 통과
- `npm run build` 통과

최종 상태:
- GitHub DTO/client/service/mapper/Redis cache key/test 구성이 모두 구현 계획 범위 안에서 정리되었다.
- Task 1 ~ Task 5에서 누적된 subagent 피드백은 모두 반영했다.
- Task 6에서는 전체 변경분에 대한 최종 subagent 리뷰를 추가로 수행했다.

## 7. 테스트 기준

- mapper
  - raw GitHub 응답이 내부 DTO로 올바르게 변환되는지 확인
  - Base64 content의 newline 제거와 UTF-8 디코딩이 올바른지 확인
- client
  - 엔드포인트, 쿼리 파라미터, 공통 헤더가 정확히 구성되는지 확인
  - 비정상 status code와 JSON 파싱 실패를 적절히 처리하는지 확인
- service
- cache hit 시 client를 다시 호출하지 않는지 확인
- cache miss 시 조회 후 캐시에 저장하는지 확인
- 저장소 정보 TTL 1시간, 파일 트리 TTL 30분이 의도대로 적용되는지 확인
- Redis 장애 시 direct GitHub 호출 fallback이 동작하는지 확인
- 404, 403, rate limit 상황을 의도한 내부 예외로 변환하는지 확인
- rate-limit 관련 헤더를 읽어 후속 처리에 사용할 수 있는지 확인

## 8. 리뷰 이력 기록 방식

각 task 종료 후 아래 형식으로 이 문서 또는 작업 로그에 남긴다.

```md
### Review Log - Task N
- Reviewer: subagent
- Findings:
  - ...
- Applied:
  - ...
- Not Applied:
  - ... (reason)
```

### Review Log - Task 1
- Reviewer: subagent
- Findings:
  - Cache key 방향이 `docs/tech-spec.md`의 `github:repo:*`, `github:tree:*` 규칙과 어긋나 있었다.
  - `branch/ref` 생략 시 어떤 기준 브랜치를 사용할지 서비스 계약이 불명확했다.
- Applied:
  - 캐시 키 정책을 `github:repo:{owner}/{repo}`, `github:tree:{owner}/{repo}:{branch}` 기준으로 수정했다.
  - `GitHubService.getRepositoryTree`, `GitHubService.getRepositorySourceFile`가 `branch/ref` 생략 시 `default_branch`를 내부 조회해 사용한다는 규칙을 명시했다.
  - rate-limit 정책에 PAT 인증 헤더와 `429` 처리 규칙을 추가했다.
- Not Applied:
  - 없음

### Review Log - Task 2
- Reviewer: subagent
- Findings:
  - `Task 2`에서 `GitHubService.getRepositorySourceFile()` 동작이 제거되어 런타임 회귀가 발생했다.
  - `RepositoryContentMapper`가 raw DTO가 아니라 client 응답 envelope에 결합되어 DTO 경계를 흐렸다.
  - 일부 public 메서드만 새 계약으로 노출하는 과도기 상태가 공개 클래스 안정성을 해쳤다.
- Applied:
  - `GitHubService.getRepositorySourceFile()`를 기존 동작으로 복구했다.
  - `RepositoryContentMapper` 입력을 raw `GitHubRepositoryContentResponseDto`로 되돌렸다.
  - 공개 클래스는 기존 runtime 동작만 유지하고, Task 2 산출물은 DTO 구조 분리와 계약 파일 정리 중심으로 축소했다.
- Not Applied:
  - 없음

### Review Log - Task 3
- Reviewer: subagent
- Findings:
  - transport-level 오류가 raw Node error로 빠져나가 `GitHubClientError` 정규화 계약이 완전하지 않았다.
  - `owner`, `repo`, `branch`, `path` 경로 조합이 인코딩 없이 보간되어 유효한 ref/path에서 잘못된 요청을 만들 수 있었다.
- Applied:
  - `req.on('error')`를 `GitHubClientError`로 감싸 모든 client 실패가 같은 오류 타입으로 전달되게 수정했다.
  - path segment 인코딩 helper와 content path 인코딩 helper를 추가해 동적 경로를 안전하게 조합하도록 수정했다.
- Not Applied:
  - 없음

### Review Log - Task 4
- Reviewer: subagent
- Findings:
  - `contents` 응답이 실제 파일 payload인지 검증하지 않아 mapper 단계에서 비의도적 `TypeError`가 날 수 있었다.
  - Redis wrapper의 custom lazy-connect 게이트 때문에 초기 연결 실패 후 복구 가능성이 약해질 수 있었다.
- Applied:
  - `GitHubService`에서 `content`/`encoding`이 있는 file payload인지 먼저 검증하고, 아니면 `invalid-response`로 정규화하도록 수정했다.
  - `RedisService`의 custom lazy-connect 게이트를 제거해 `ioredis` 기본 연결/재연결 경로를 그대로 사용하도록 정리했다.
  - 수정 후 subagent follow-up review에서 추가 findings 없음 확인했다.
- Not Applied:
  - 없음

### Review Log - Task 5
- Reviewer: subagent
- Findings:
  - `GitHubService.listUserRepositories()` 성공/실패 경로 테스트가 빠져 있었다.
  - `429 => rate-limit` 정규화 테스트가 빠져 있었다.
  - client 테스트가 invalid JSON과 rate-limit header null 처리 규칙을 충분히 잠그지 못했다.
- Applied:
  - `GitHubService.listUserRepositories()`의 성공 매핑 테스트와 client error 정규화 테스트를 추가했다.
  - `429` 응답이 `rate-limit`으로 정규화되고 metadata를 유지하는 서비스 테스트를 추가했다.
  - invalid JSON error shape, missing/malformed rate-limit headers, array-valued header 파싱을 검증하는 client 테스트를 추가했다.
- Not Applied:
  - 없음

### Review Log - Task 6
- Reviewer: subagent
- Findings:
  - `listUserRepositories()` 쿼리 계약이 `docs/tech-spec.md`의 `direction=desc&type=public&per_page={MAX_REPO_SELECTION_COUNT}` 규칙과 어긋나 있었다.
  - content Base64 형식이 깨진 경우 `invalid-response` 정규화가 완전히 보장되지 않았다.
- Applied:
  - `GitHubClient.listUserRepositories()`에 `direction=desc`, `type=public`, `per_page=MAX_REPO_SELECTION_COUNT(default 3)` 쿼리를 반영했다.
  - `GitHubService`에서 base64 형식을 추가 검증해 깨진 payload를 `invalid-response`로 정규화하도록 수정했다.
  - 관련 client/service 테스트를 보강한 뒤 `npm run lint`, `npm run test`, `npm run build` 재통과를 확인했다.
- Not Applied:
  - 없음

## 9. 사용자 결정 필요 항목

현재 이 계획 기준으로 추가 결정이 꼭 필요한 항목은 없다.

후속 구현 중 선택이 필요해질 수 있는 후보:
- GitHub 예외 표현 방식을 커스텀 Error 클래스로 둘지, 공통 에러 코드 객체로 둘지
- Redis 캐시 키를 상수 확장 방식으로 둘지, key builder 함수로 둘지

## 10. 기본 가정

- 이번 범위는 `libs/integrations/src/github`까지만 포함한다.
- API 엔드포인트 연결과 Worker processor 연결은 후속 작업으로 분리한다.
- `repository-url-parser.service.ts`는 이번 구현 범위에 포함하지 않는다.
- 계획 문서는 한국어로 유지하고, 코드 식별자와 파일 경로는 원문 영문 표기를 사용한다.
