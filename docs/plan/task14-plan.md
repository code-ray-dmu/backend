# Auth API 구현 플랜

## 목적
`docs/tech-spec.md` 5.1 API 모듈의 `auth` 범위를 구현해 회원가입, 로그인, JWT Access Token 발급, Refresh Token 회전 재발급을 동작하게 만든다. 구현 기준은 `docs/api-spec.md`의 `/v1/users/...` 경로와 확정된 정책인 “refresh token rotation + 새 refresh token 반환 + 최소 DB 마이그레이션 + refresh token 해시 저장”이다.

## 완성조건
- `POST /v1/users/sign-up`: 이메일 중복을 방지하고 bcrypt로 비밀번호를 해시한 뒤 `users`를 생성한다.
- `POST /v1/users/sign-in`: 이메일/비밀번호 검증 후 access token과 refresh token을 발급하고, refresh token 해시를 `refresh_tokens`에 저장한다.
- `POST /v1/users/refresh-token`: refresh token 유효성/만료/revoke 여부를 검증하고 기존 토큰을 revoke한 뒤 새 access token과 새 refresh token을 반환한다.
- `JwtAuthGuard`, `JwtRefreshGuard`, access/refresh strategies가 실제 secret, expiresIn, payload `{ sub, email }` 기준으로 동작한다.
- `users.email` unique 제약과 refresh token 저장 정책에 필요한 최소 마이그레이션이 포함된다.
- 관련 unit test와 최소 API 흐름 테스트가 추가되고, 가능하면 `npm run lint`, `npm run test`, `npm run build`를 실행한다.
- 각 작업 단위 완료 후 subagent 리뷰를 받고, 피드백을 반영하거나 반영하지 않은 이유를 기록한다.
- 작업 브랜치/커밋이 필요하면 Notion task ID `TASK-14`를 사용한다.

## 해야할 범위
- Auth 모듈: controller, facade, service, DTO, guards, strategies, payload interface 구현.
- Users 모듈: auth에서 필요한 사용자 조회/생성 repository/service 메서드만 구현.
- Database: `users.email` unique 제약, refresh token 해시 저장에 맞춘 최소 엔티티/마이그레이션 반영.
- App wiring: 현재 전역 prefix `api`를 `/v1` 기준으로 정정하고, TypeORM 연결이 앱에 등록되어 있지 않으므로 `TypeOrmModule.forRootAsync(typeOrmConfig)`를 API 앱에 연결한다.
- Error handling: auth에 필요한 `USER_EMAIL_CONFLICT`, `AUTH_INVALID_CREDENTIALS`, `AUTH_TOKEN_INVALID`, `AUTH_TOKEN_EXPIRED`, `AUTH_REFRESH_TOKEN_REVOKED` 응답을 일관되게 반환한다.
- Tests: 회원가입 성공/중복, 로그인 성공/실패, refresh 성공/만료/revoke/rotation, JWT strategy payload 검증을 다룬다.

## 하면 안되는 범위
- OAuth/social login, logout API, 관리자 기능은 구현하지 않는다.
- groups/applicants/analysis-runs 등 다른 도메인 CRUD를 함께 구현하지 않는다.
- 전체 공통 응답/로그/trace-id 프레임워크를 대규모로 리팩터링하지 않는다. auth 성공/실패 응답을 만족하는 데 필요한 최소 공통 유틸만 허용한다.
- RabbitMQ, Redis, GitHub, LLM worker 흐름은 건드리지 않는다.
- broad rename, ESM/CommonJS 전환 같은 전역 빌드 구조 변경은 하지 않는다.

## 작업 순서
1. 기반 연결 정리
- 필요 시 브랜치는 `feature/TASK-14-auth`로 생성한다.
- API 앱에 TypeORM root 설정을 연결하고 auth/users 모듈에서 필요한 entities를 `forFeature`로 주입한다.
- 전역 prefix를 `/v1`로 맞춘다.
- 완료 후 subagent 리뷰: 앱 부팅/DI/라우팅 영향 중심.

2. DB와 repository 구현
- `users.email` unique 제약 마이그레이션을 추가한다.
- refresh token은 원문 대신 해시를 저장하고, token 검증에 필요한 조회 범위를 설계한다.
- `UsersRepository`와 auth용 refresh token repository 또는 service 메서드를 구현한다.
- 완료 후 subagent 리뷰: 스키마 영향, 동시성, 토큰 원문 저장 여부 중심.

3. Auth 비즈니스 로직 구현
- 회원가입, 로그인, refresh rotation을 `AuthService`/`AuthFacade`에 구현한다.
- bcrypt hash/compare, JWT sign, expiresIn 계산, revoke 처리, 예외 코드를 구현한다.
- 완료 후 subagent 리뷰: 보안, 만료 처리, rotation 실패 케이스 중심.

4. Controller/DTO/Strategy/Guard 완성
- `/users/sign-up`, `/users/sign-in`, `/users/refresh-token` 경로와 DTO validation을 구현한다.
- access/refresh strategy가 secret fallback 없이 ConfigService 값을 사용하도록 정리한다.
- refresh token 입력 방식은 body 기반으로 처리하고, guard는 보호 라우트용으로 유지한다.
- 완료 후 subagent 리뷰: API contract, validation, route prefix 중심.

5. 테스트와 최종 검증
- auth service unit test와 최소 controller/API 흐름 테스트를 추가한다.
- `npm run lint`, `npm run test`, `npm run build`를 실행한다.
- 실패 시 원인과 미해결 리스크를 기록하고, 최종 subagent 리뷰를 한 번 더 받아 피드백을 반영한다.
- 커밋이 필요하면 메시지는 `feat: [TASK-14] Add auth API` 형식을 사용한다.

## 결정된 사항
- public base path는 `/v1` 기준으로 구현한다.
- refresh token 재발급은 rotation 방식으로 구현하고 새 access token과 새 refresh token을 함께 반환한다.
- 최소 DB 마이그레이션을 포함하고 refresh token은 해시로 저장한다.
- Notion task ID는 `TASK-14`다.
- refresh 응답의 최종 필드명은 기존 `api-spec`의 snake_case 흐름에 맞춰 `access_token`, `refresh_token`으로 둔다.
