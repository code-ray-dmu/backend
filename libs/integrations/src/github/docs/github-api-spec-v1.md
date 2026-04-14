# GitHub API Spec v1

이 문서는 GitHub External API 명세를 구현 문서 형태 정리한 초안이다.

기준 문서:
- `libs/integrations/src/github/docs/github.md`

공통 원칙:
- 모든 요청의 Base URL은 `https://api.github.com`을 사용한다.
- 인증이 필요한 호출은 `Authorization: token {GITHUB_PAT}` 헤더를 포함한다.
- Accept 헤더는 `application/vnd.github.v3+json`을 사용한다.
- 이 문서의 응답 예시는 특별한 표시가 없으면 GitHub API의 raw 응답 필드명을 유지한다.
- 내부 DTO 매핑이 필요하면 raw 응답과 분리해서 별도 문서나 코드에서 정의한다.
- 저장소 구조 조회와 파일 본문 조회는 분석 파이프라인의 입력 데이터 수집 단계에서 사용한다.
- 파일 내용 API의 `content`는 Base64 디코딩 후 실제 UTF-8 텍스트로 복원한다.

## 1. list_user_repositories

### 목적
- 지원자 GitHub 계정의 저장소 목록을 조회한다.
- 분석 대상 저장소 후보를 최신 업데이트 순으로 노출한다.

### 사용 범주
- 저장소 및 유저 정보

### 권장 파라미터

```json
{
  "username": "string",
  "sort": "updated",
  "type": "owner"
}
```

### 응답 JSON 스키마

```json
[
  {
    "name": "my-awesome-project",
    "full_name": "username/my-awesome-project",
    "html_url": "https://github.com/username/my-awesome-project",
    "language": "JavaScript",
    "updated_at": "2026-04-12T07:00:00Z"
  }
]
```

### 엔드포인트
- `GET /users/{username}/repos?sort=updated&type=owner`

### 설계 메모
- 지원자가 직접 소유한 저장소만 조회한다.
- 화면 노출 또는 후속 선택에 필요한 핵심 필드만 정규화한다.
- `updated_at` 기준으로 최신 프로젝트를 우선 노출한다.

## 2. get_repository_metadata

### 목적
- 분석 대상 저장소의 기본 메타데이터를 조회한다.
- 기본 브랜치, 소유자, 대표 언어 같은 분석 준비 정보를 확보한다.

### 사용 범주
- 저장소 및 유저 정보

### 권장 파라미터

```json
{
  "owner": "string",
  "repo": "string"
}
```

### 응답 JSON 스키마

```json
{
  "name": "project-name",
  "default_branch": "main",
  "owner": {
    "login": "username"
  },
  "html_url": "https://github.com/username/project-name",
  "language": "Java"
}
```

### 엔드포인트
- `GET /repos/{owner}/{repo}`

### 설계 메모
- `default_branch`는 이후 트리 조회와 파일 조회의 기준 브랜치로 사용한다.
- `owner.login`은 저장소 식별자와 접근 경로 계산에 재사용한다.
- 대표 언어는 UI 표시값 또는 분석 힌트로 활용할 수 있다.

## 3. get_repository_tree

### 목적
- 저장소의 전체 파일 및 디렉토리 구조를 재귀적으로 조회한다.
- 분석 대상 파일 선별 전에 전체 구조를 파악한다.

### 사용 범주
- 구조 및 코드

### 권장 파라미터

```json
{
  "owner": "string",
  "repo": "string",
  "branch": "string",
  "recursive": 1
}
```

### 응답 JSON 스키마

```json
{
  "tree": [
    {
      "path": "src/main/java/App.java",
      "mode": "100644",
      "type": "blob",
      "sha": "file_sha_abc123"
    }
  ]
}
```

### 엔드포인트
- `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`

### 설계 메모
- `recursive=1`을 반드시 포함해야 전체 depth를 조회할 수 있다.
- `type`이 `blob`이면 파일, `tree`이면 디렉토리로 해석한다.
- 후속 분석에서는 주로 `blob` 항목의 `path`와 `sha`를 사용한다.

## 4. get_file_content

### 목적
- 선별된 개별 파일의 실제 소스 코드를 조회한다.
- 요약 분석 또는 질문 생성 입력으로 사용할 원문 파일 내용을 수집한다.

### 사용 범주
- 구조 및 코드

### 권장 파라미터

```json
{
  "owner": "string",
  "repo": "string",
  "path": "string"
}
```

### 응답 JSON 스키마

```json
{
  "name": "App.java",
  "path": "src/main/java/App.java",
  "content": "YmFja2VuZCBkZXZlbG9wZXI...",
  "encoding": "base64"
}
```

### 엔드포인트
- `GET /repos/{owner}/{repo}/contents/{path}`

### 설계 메모
- 응답의 `content`는 Base64 문자열이므로 디코딩이 필요하다.
- 디코딩 후 UTF-8 텍스트로 복원해 저장하거나 LLM 입력에 사용한다.
- 필요한 파일만 개별 호출해 API 사용량을 관리한다.

## 5. list_commit_history

### 목적
- 커밋 메시지 스타일과 작업 흐름을 분석한다.
- 개발 주기와 커밋 컨벤션 신호를 수집한다.

### 사용 범주
- 협업 패턴

### 권장 파라미터

```json
{
  "owner": "string",
  "repo": "string"
}
```

### 응답 JSON 스키마

```json
[
  {
    "commit": {
      "message": "feat: 구현 완료",
      "author": {
        "name": "john",
        "date": "2026-04-09T10:00:00Z"
      }
    }
  }
]
```

### 엔드포인트
- `GET /repos/{owner}/{repo}/commits`

### 설계 메모
- 전체 응답 중 `commit.message`, `commit.author.name`, `commit.author.date`를 우선 사용한다.
- 협업 패턴 분석이 목적이므로 저장 개수 제한이나 최근 N건 기준을 서비스 정책으로 둘 수 있다.

## 6. list_pull_requests

### 목적
- Pull Request 이력을 통해 코드 리뷰 참여도와 협업 방식을 분석한다.
- 열린 PR뿐 아니라 닫힌 PR까지 포함해 전체 협업 히스토리를 확인한다.

### 사용 범주
- 협업 패턴

### 권장 파라미터

```json
{
  "owner": "string",
  "repo": "string",
  "state": "all"
}
```

### 응답 JSON 스키마

원본 `github.md`에는 Pull Request 조회 응답 예시가 정의되어 있지 않다.

### 엔드포인트
- `GET /repos/{owner}/{repo}/pulls?state=all`

### 설계 메모
- 기본값은 열린 PR만 반환되므로 `state=all`을 명시해야 전체 이력을 볼 수 있다.
- 구현 시 필요한 필드는 실제 GitHub API 응답 계약을 확인한 뒤 별도 DTO로 정리한다.

## 7. 운영 권장사항

### 인증과 Rate Limit
- 인증 없는 요청은 시간당 60회로 제한되므로 서비스 운영에서는 PAT 인증을 기본값으로 둔다.
- 인증 요청은 시간당 5,000회 한도를 사용할 수 있다.

### 디코딩 처리
- 파일 본문 응답은 Base64 디코딩 후 UTF-8 문자열로 복원한다.
- Node.js 환경에서는 `Buffer.from(content, 'base64').toString('utf-8')` 방식으로 처리할 수 있다.

### 구조 조회 주의사항
- 트리 조회에서 `recursive=1`이 빠지면 최상위 depth만 반환된다.
- 전체 구조가 필요할 때는 항상 재귀 옵션 포함 여부를 검증한다.
