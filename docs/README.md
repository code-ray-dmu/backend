# Docs Guide For Coding Agents

이 문서는 `docs/` 하위 문서의 목적과 우선순위를 빠르게 파악하기 위한 진입점이다.
코딩 에이전트는 작업을 시작하기 전에 아래 표에서 현재 요청과 가장 가까운 문서를 먼저 찾고, 필요한 범위만 읽는다.

## Recommended Reading Order

1. 작업 범위를 이해하려면 `server-spec.md`
2. 코드 스타일 제약을 확인하려면 `conventions/code-convention.md`
3. 브랜치, 커밋, 협업 흐름을 확인하려면 `conventions/work-flow-convention.md`

## Document Map

| 문서 | 용도 | 먼저 읽어야 하는 경우 |
| --- | --- | --- |
| [`server-spec.md`](./server-spec.md) | 프로젝트 목표, 아키텍처, 디렉토리 구조, 모듈 책임의 기준 문서 | 새 기능을 추가하거나 구조를 해석해야 할 때 |
| [`conventions/code-convention.md`](./conventions/code-convention.md) | TypeScript/NestJS 코드 스타일과 AI 에이전트 코딩 규칙 | 파일을 수정하거나 새 코드를 생성할 때 |
| [`conventions/work-flow-convention.md`](./conventions/work-flow-convention.md) | 브랜치 전략, 커밋 규칙, 리뷰 전제, 협업 흐름 | 브랜치명, 커밋 방식, 작업 절차를 정해야 할 때 |

## Task-Based Shortcuts

### 1. 새 API 또는 모듈 추가

- `server-spec.md`에서 목표 모듈과 책임을 확인한다.
- `conventions/code-convention.md`로 파일 구조와 네이밍 규칙을 맞춘다.

### 2. 현재 구현 상태 점검

- 필요한 경우 `server-spec.md`와 비교해 누락 영역을 찾는다.

### 3. 리팩터링 또는 코드 수정

- `conventions/code-convention.md`를 먼저 읽는다.
- 구조적 영향이 있으면 `server-spec.md`를 함께 확인한다.

### 4. 브랜치/커밋/협업 규칙 확인

- `conventions/work-flow-convention.md`를 읽는다.

## Operating Rules For Agents

- 문서 간 충돌이 보이면 구조와 책임은 `server-spec.md`를 우선 기준으로 본다.
- 코드 수정 전에는 최소한 `conventions/code-convention.md`를 확인한다.
- 협업 방식이나 커밋 규칙은 `conventions/work-flow-convention.md`를 따른다.

## Quick Start

작업 요청을 받으면 아래 순서로 접근한다.

1. 요청이 구조 이해인지, 구현인지, 규칙 확인인지 분류한다.
2. 위 `Document Map`에서 해당 문서를 연다.
3. 실제 코드 변경이 필요하면 컨벤션 문서를 다시 확인한다.
