# code-ray API Specification v1.1

## 공통 안내

### 인증
모든 API는 인증이 필요합니다.

인증 예외:
- `POST /v1/users/sign-up`
- `POST /v1/users/sign-in`
- `POST /v1/users/refresh-token`

### Content-Type
`application/json`

### Authorization
`Bearer {token}`

### HTTP Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `409`: Conflict
- `500`: Internal Server Error

### Domain Constants

#### Analysis Status
- `QUEUED`
- `IN_PROGRESS`
- `COMPLETED`
- `FAILED`

#### Analysis Stage
- `REPO_LIST`
- `FOLDER_STRUCTURE`
- `FILE_DETAIL`
- `QUESTION_GENERATION`

### Error Codes

#### Common
- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `FORBIDDEN_RESOURCE_ACCESS`
- `INTERNAL_SERVER_ERROR`

#### Auth
- `USER_EMAIL_CONFLICT`
- `AUTH_INVALID_CREDENTIALS`
- `AUTH_TOKEN_INVALID`
- `AUTH_TOKEN_EXPIRED`
- `AUTH_REFRESH_TOKEN_REVOKED`

#### Groups
- `GROUP_NOT_FOUND`

#### Applicants
- `APPLICANT_NOT_FOUND`

#### Analysis Runs
- `ANALYSIS_RUN_NOT_FOUND`

---

## 1. POST /users/sign-up

### Base URL
`/v1`

### 목적
사용자 계정을 생성한다.

---

### Request

#### Path Parameter
없음

#### Query Parameter
없음

#### Body (JSON)
- `email`: string (required)
  - 사용자 이메일
- `password`: string (required)
  - 비밀번호
- `name`: string (required)
  - 사용자 이름

---

### Request Example

```json
{
  "email": "john@example.com",
  "password": "1234",
  "name": "john"
}
```

---

### Response

#### Success Response

##### 구조

* `data`: object
  * `user_id`: string
  * `email`: string
* `meta`: object
  * `request_id`: string
* `error`: null

##### Example

```json
{
  "data": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@example.com"
  },
  "meta": {
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0001"
  },
  "error": null
}
```

#### Error Response

##### 구조

* `data`: null
* `meta`: object
  * `request_id`: string
* `error`: object
  * `code`: string
  * `message`: string

##### Example

```json
{
  "data": null,
  "meta": {
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0001"
  },
  "error": {
    "code": "USER_EMAIL_CONFLICT",
    "message": "Email already exists"
  }
}
```

---

## 2. POST /users/sign-in

### Base URL
`/v1`

### 목적
access token과 refresh token을 발급한다.

---

### Request

#### Path Parameter
없음

#### Query Parameter
없음

#### Body (JSON)
- `email`: string (required)
  - 사용자 이메일
- `password`: string (required)
  - 비밀번호

---

### Request Example

```json
{
  "email": "john@example.com",
  "password": "1234"
}
```

---

### Response

#### Success Response

##### 구조

* `data`: object
  * `access_token`: string
  * `refresh_token`: string
* `meta`: object
  * `request_id`: string
* `error`: null

##### Example

```json
{
  "data": {
    "access_token": "jwt-access-token",
    "refresh_token": "refresh-token"
  },
  "meta": {
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0002"
  },
  "error": null
}
```

#### Error Response

##### 구조

* `data`: null
* `meta`: object
  * `request_id`: string
* `error`: object
  * `code`: string
  * `message`: string

##### Example

```json
{
  "data": null,
  "meta": {
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0002"
  },
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

---

## 3. POST /users/refresh-token

### Base URL
`/v1`

### 목적
refresh token으로 access token을 재발급한다.

---

### Request

#### Path Parameter
없음

#### Query Parameter
없음

#### Body (JSON)
- `refreshToken`: string (required)
  - refresh token

---

### Request Example

```json
{
  "refreshToken": "refresh-token"
}
```

---

### Response

#### Success Response

##### 구조

* `data`: object
  * `access_token`: string
* `meta`: object
  * `request_id`: string
* `error`: null

##### Example

```json
{
  "data": {
    "access_token": "new-jwt-access-token"
  },
  "meta": {
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0003"
  },
  "error": null
}
```

#### Error Response

##### 구조

* `data`: null
* `meta`: object
  * `request_id`: string
* `error`: object
  * `code`: string
  * `message`: string

##### Example

```json
{
  "data": null,
  "meta": {
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0003"
  },
  "error": {
    "code": "AUTH_TOKEN_EXPIRED",
    "message": "Refresh token expired"
  }
}
```

---

## 4. POST /groups

### Base URL
`/v1`

### 목적
면접관 팀 정보를 생성한다.

---

### Request

#### Path Parameter
없음

#### Query Parameter
없음

#### Body (JSON)
- `name`: string (required)
  - 그룹명
- `description`: string | null (optional)
  - 그룹 설명
- `techStacks`: object (required)
  - 기술 스택 정보
- `cultureFitPriority`: string (required)
  - 문화 적합성 우선순위

---

### Request Example

```json
{
  "name": "backend-team",
  "description": "msa 기반 팀",
  "techStacks": {
    "framework": "Spring",
    "db": "PostgreSQL"
  },
  "cultureFitPriority": "HIGH"
}
```

---

### Response

#### Success Response

##### 구조

* `data`: object
  * `group_id`: string
  * `name`: string
  * `created_at`: string
* `meta`: object
  * `request_id`: string
* `error`: null

##### Example

```json
{
  "data": {
    "group_id": "550e8400-e29b-41d4-a716-446655440010",
    "name": "backend-team",
    "created_at": "2026-04-08T15:00:00Z"
  },
  "meta": {
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0010"
  },
  "error": null
}
```

#### Error Response

##### 구조

* `data`: null
* `meta`: object
  * `request_id`: string
* `error`: object
  * `code`: string
  * `message`: string

##### Example

```json
{
  "data": null,
  "meta": {
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0010"
  },
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body"
  }
}
```

---

## 5. GET /groups

### Base URL
`/v1`

### 목적
그룹 목록을 조회한다.

---

### Request

#### Path Parameter
없음

#### Query Parameter
- `page`: number | null (optional)
  - 페이지 번호
- `size`: number | null (optional)
  - 페이지 크기
- `sort`: string | null (optional)
  - 정렬 필드
- `order`: string | null (optional)
  - `asc` 또는 `desc`

#### Body (JSON)
없음

---

### Request Example

```json
{}
```

---

### Response

#### Success Response

##### 구조

* `data`: array
  * 그룹 목록
* `meta`: object
  * `page`: number
  * `size`: number
  * `total`: number
  * `request_id`: string
* `error`: null

##### Example

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "size": 20,
    "total": 0,
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0011"
  },
  "error": null
}
```

#### Error Response

##### 구조

* `data`: null
* `meta`: object
  * `request_id`: string
* `error`: object
  * `code`: string
  * `message`: string

##### Example

```json
{
  "data": null,
  "meta": {
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0011"
  },
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

---

## GET /groups/{groupId}

### Base URL
`/v1`

### 목적
특정 그룹의 상세 정보를 조회한다.

---

### Request

#### Path Parameter
- `groupId`: string (required)
  - 그룹 ID

#### Query Parameter
없음

#### Body (JSON)
없음

---

### Request Example

```json
{}
```

---

### Response

#### Success Response

##### 구조

* `data`: object
  * `group_id`: string
  * `name`: string
  * `description`: string | null
  * `tech_stacks`: object
  * `culture_fit_priority`: string
* `meta`: object
  * `request_id`: string
* `error`: null

##### Example

```json
{
  "data": {
    "group_id": "550e8400-e29b-41d4-a716-446655440010",
    "name": "backend-team",
    "description": "msa 기반 팀",
    "tech_stacks": {
      "framework": "Spring",
      "db": "PostgreSQL"
    },
    "culture_fit_priority": "HIGH"
  },
  "meta": {
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0012"
  },
  "error": null
}
```

#### Error Response

##### 구조

* `data`: null
* `meta`: object
  * `request_id`: string
* `error`: object
  * `code`: string
  * `message`: string

##### Example

```json
{
  "data": null,
  "meta": {
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0012"
  },
  "error": {
    "code": "GROUP_NOT_FOUND",
    "message": "Group not found"
  }
}
```

---

## POST /applicants

### Base URL
`/v1`

### 목적
지원자 정보를 등록한다.

---

### Request

#### Path Parameter
없음

#### Query Parameter
없음

#### Body (JSON)
- `groupId`: string (required)
  - 소속 그룹 ID
- `name`: string (required)
  - 지원자 이름
- `email`: string (required)
  - 지원자 이메일
- `githubUrl`: string (required)
  - GitHub 프로필 또는 대표 저장소 URL

---

### Request Example

```json
{
  "groupId": "550e8400-e29b-41d4-a716-446655440010",
  "name": "candidate",
  "email": "c@example.com",
  "githubUrl": "https://github.com/user"
}
```

---

### Response

#### Success Response

##### 구조

* `data`: object
  * `applicant_id`: string
* `meta`: object
  * `request_id`: string
* `error`: null

##### Example

```json
{
  "data": {
    "applicant_id": "550e8400-e29b-41d4-a716-446655440020"
  },
  "meta": {
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0020"
  },
  "error": null
}
```

#### Error Response

##### 구조

* `data`: null
* `meta`: object
  * `request_id`: string
* `error`: object
  * `code`: string
  * `message`: string

##### Example

```json
{
  "data": null,
  "meta": {
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0020"
  },
  "error": {
    "code": "GROUP_NOT_FOUND",
    "message": "Group not found"
  }
}
```

---

## GET /applicants

### Base URL
`/v1`

### 목적
지원자 목록을 조회한다.

---

### Request

#### Path Parameter
없음

#### Query Parameter
- `groupId`: string | null (optional)
  - 그룹 ID 필터
- `page`: number | null (optional)
  - 페이지 번호
- `size`: number | null (optional)
  - 페이지 크기

#### Body (JSON)
없음

---

### Request Example

```json
{}
```

---

### Response

#### Success Response

##### 구조

* `data`: array
  * 지원자 목록
* `meta`: object
  * `page`: number
  * `size`: number
  * `total`: number
  * `request_id`: string
* `error`: null

##### Example

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "size": 20,
    "total": 0,
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0021"
  },
  "error": null
}
```

#### Error Response

##### 구조

* `data`: null
* `meta`: object
  * `request_id`: string
* `error`: object
  * `code`: string
  * `message`: string

##### Example

```json
{
  "data": null,
  "meta": {
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0021"
  },
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

---

## 6. GET /applicants/{applicantId}

### Base URL
`/v1`

### 목적
특정 지원자의 상세 정보를 조회한다.

---

### Request

#### Path Parameter
- `applicantId`: string (required)
  - 지원자 ID

#### Query Parameter
없음

#### Body (JSON)
없음

---

### Request Example

```json
{}
```

---

### Response

#### Success Response

##### 구조

* `data`: object
  * `applicant_id`: string
  * `group_id`: string
  * `name`: string
  * `email`: string
  * `github_url`: string
* `meta`: object
  * `request_id`: string
* `error`: null

##### Example

```json
{
  "data": {
    "applicant_id": "550e8400-e29b-41d4-a716-446655440020",
    "group_id": "550e8400-e29b-41d4-a716-446655440010",
    "name": "candidate",
    "email": "c@example.com",
    "github_url": "https://github.com/user"
  },
  "meta": {
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0022"
  },
  "error": null
}
```

#### Error Response

##### 구조

* `data`: null
* `meta`: object
  * `request_id`: string
* `error`: object
  * `code`: string
  * `message`: string

##### Example

```json
{
  "data": null,
  "meta": {
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0022"
  },
  "error": {
    "code": "APPLICANT_NOT_FOUND",
    "message": "Applicant not found"
  }
}
```

---

## 7. GET /analysis-runs/{analysisRunId}

### Base URL
`/v1`

### 목적
분석 실행 상태와 현재 단계를 조회한다.

---

### Request

#### Path Parameter
- `analysisRunId`: string (required)
  - 분석 실행 ID

#### Query Parameter
없음

#### Body (JSON)
없음

---

### Request Example

```json
{}
```

---

### Response

#### Success Response

##### 구조

* `data`: object
  * `analysis_run_id`: string
  * `status`: string
  * `current_stage`: string
  * `started_at`: string
  * `completed_at`: string | null
* `meta`: object
  * `request_id`: string
* `error`: null

##### Example

```json
{
  "data": {
    "analysis_run_id": "550e8400-e29b-41d4-a716-446655440040",
    "status": "IN_PROGRESS",
    "current_stage": "FILE_DETAIL",
    "started_at": "2026-04-08T15:10:00Z",
    "completed_at": null
  },
  "meta": {
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0041"
  },
  "error": null
}
```

#### Error Response

##### 구조

* `data`: null
* `meta`: object
  * `request_id`: string
* `error`: object
  * `code`: string
  * `message`: string

##### Example

```json
{
  "data": null,
  "meta": {
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0041"
  },
  "error": {
    "code": "ANALYSIS_RUN_NOT_FOUND",
    "message": "Analysis run not found"
  }
}
```

---

## 8. GET /analysis-runs

### Base URL
`/v1`

### 목적
분석 실행 목록을 조회한다.

---

### Request

#### Path Parameter
없음

#### Query Parameter
- `applicantId`: string | null (optional)
  - 지원자 ID 필터
- `page`: number | null (optional)
  - 페이지 번호
- `size`: number | null (optional)
  - 페이지 크기

#### Body (JSON)
없음

---

### Request Example

```json
{}
```

---

### Response

#### Success Response

##### 구조

* `data`: array
  * 분석 실행 목록
* `meta`: object
  * `page`: number
  * `size`: number
  * `total`: number
  * `request_id`: string
* `error`: null

##### Example

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "size": 20,
    "total": 0,
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0042"
  },
  "error": null
}
```

#### Error Response

##### 구조

* `data`: null
* `meta`: object
  * `request_id`: string
* `error`: object
  * `code`: string
  * `message`: string

##### Example

```json
{
  "data": null,
  "meta": {
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0042"
  },
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

---

## 9. POST /applicants/{applicantId}/questions

### Base URL
`/v1`

### 목적
특정 지원자 기준으로 면접 질문 생성을 요청한다.

---

### Request

#### Path Parameter
- `applicantId`: string (required)
  - 지원자 ID

#### Query Parameter
없음

#### Body (JSON)
없음

---

### Request Example

```json
{}
```

---

### Response

#### Success Response

##### 구조

* `data`: object
  * `success`: boolean
* `meta`: object
  * `request_id`: string
* `error`: null

##### Example

```json
{
  "data": {
    "success": true
  },
  "meta": {
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0080"
  },
  "error": null
}
```

#### Error Response

##### 구조

* `data`: null
* `meta`: object
  * `request_id`: string
* `error`: object
  * `code`: string
  * `message`: string

##### Example

```json
{
  "data": null,
  "meta": {
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0080"
  },
  "error": {
    "code": "APPLICANT_NOT_FOUND",
    "message": "Applicant not found"
  }
}
```

---

## 10. GET /applicants/{applicantId}/questions

### Base URL
`/v1`

### 목적
특정 지원자 기준으로 생성된 면접 질문 목록을 조회한다.

---

### Request

#### Path Parameter
- `applicantId`: string (required)
  - 지원자 ID

#### Query Parameter
- `page`: number | null (optional)
  - 페이지 번호
- `size`: number | null (optional)
  - 페이지 크기
- `sort`: string | null (optional)
  - 정렬 필드
- `order`: string | null (optional)
  - `asc` 또는 `desc`

#### Body (JSON)
없음

---

### Request Example

```json
{}
```

---

### Response

#### Success Response

##### 구조

* `data`: array
  * 질문 목록
* `meta`: object
  * `page`: number
  * `size`: number
  * `total`: number
  * `request_id`: string
* `error`: null

##### Example

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "size": 10,
    "total": 0,
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0081"
  },
  "error": null
}
```

#### Error Response

##### 구조

* `data`: null
* `meta`: object
  * `request_id`: string
* `error`: object
  * `code`: string
  * `message`: string

##### Example

```json
{
  "data": null,
  "meta": {
    "request_id": "6f1d7e14-6d74-4c74-97b1-6ef7a7df0081"
  },
  "error": {
    "code": "APPLICANT_NOT_FOUND",
    "message": "Applicant not found"
  }
}
```
