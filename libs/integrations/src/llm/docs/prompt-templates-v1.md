# Prompt Templates v1

이 문서는 `code-ray-server` MVP 분석 파이프라인에서 사용하는 LLM 프롬프트 템플릿 초안을 정리한다.

기준 문서:
- `docs/tech-spec.md`
- `docs/server-spec.md`

공통 원칙:
- 템플릿은 `prompt_templates` 테이블의 `purpose` 단위로 분리한다.
- 모든 단계는 structured output(JSON)을 강제한다.
- 응답 JSON 파싱 실패 시 `LLM_RESPONSE_PARSE_FAILED`로 처리한다.
- 템플릿 본문은 `prompt-builder/`에서 변수 치환 후 최종 프롬프트로 사용한다.
- 변수명은 `variables_json` 키와 일치해야 한다.
- `template_text` 초안은 토큰 절약을 위해 영어로 작성한다.
- 응답 스키마 예시는 한국어 기준으로 작성한다. 단, JSON 키 이름은 파서 계약 유지를 위해 영문을 유지하고, 서술형 값은 한국어로 작성하도록 지시한다.

## 1. file_selection

### 목적
- 저장소 파일 트리에서 실제 코드 이해에 중요한 핵심 파일 경로만 선별한다.
- 출력은 경로 배열만 사용한다.

### 사용 단계
- `FOLDER_STRUCTURE`

### 저장 목적
- `llm_messages`에 USER / ASSISTANT 메시지 저장
- 이후 `FILE_DETAIL` 단계에서 raw content 수집 대상 경로로 사용

### 권장 변수

```json
{
  "repo_full_name": "string",
  "default_branch": "string",
  "tech_stacks": "string",
  "file_tree": "string",
  "max_analysis_files": "number"
}
```

### 응답 JSON 스키마

```json
[
  "src/main.ts",
  "src/modules/users/users.service.ts"
]
```

### 설계 메모
- 경로 배열만 반환한다.
- `max_analysis_files`를 절대 초과하지 않도록 지시한다.
- 바이너리 파일, lock 파일, 이미지, 빌드 산출물, vendored dependency는 제외한다.
- 진입점 파일, 서비스/도메인 계층, 핵심 설정 파일을 우선한다.

### template_key 예시
- `file-selection-v1`

### template_name 예시
- `MVP File Selection v1`

### template_text 초안

```text
You are a code-file selection system that analyzes a GitHub repository file tree and chooses the most informative files for interview-question generation.

Goal:
- Select only the files that best reveal implementation intent and core business logic.
- Return file path strings only.
- Return at most {{max_analysis_files}} paths.

Repository:
- repo: {{repo_full_name}}
- branch: {{default_branch}}

Group tech stacks:
{{tech_stacks}}

File tree:
{{file_tree}}

Selection rules:
1. Prioritize entry-point files such as main.ts, index.ts, and app.module.ts.
2. Prioritize service, domain, business-logic, API entry, and core configuration files.
3. Exclude style-only files, images, binaries, lock files, generated files, and build artifacts.
4. Include test files only when they are necessary to understand core implementation intent.
5. If many files have similar responsibility, prefer the most representative ones.
6. Return only paths that actually exist in the provided file tree.
7. Never return more than {{max_analysis_files}} items.

Output rules:
- Return exactly one JSON array with no explanation, markdown, or code fences.
- Keep JSON syntax strict and valid.
- Path strings must remain exactly as they appear in the repository.

Output JSON schema:
["string"]
```

## 2. code_summary

### 목적
- 선별된 핵심 파일 내용을 바탕으로 질문 생성에 직접 사용할 구조화된 코드 분석 결과를 생성한다.

### 사용 단계
- `SUMMARY`

### 저장 목적
- `llm_messages` 저장
- `code_analysis.raw_analysis_report`에 구조화된 JSON 문자열 그대로 저장

### 권장 변수

```json
{
  "repo_full_name": "string",
  "default_branch": "string",
  "tech_stacks": "string",
  "selected_files": "string",
  "file_contents": "string"
}
```

### 응답 JSON 스키마

```json
{
  "summary": "저장소 전반 요약",
  "architecture": {
    "pattern": "예: 계층형 아키텍처",
    "evidence": [
      "src/app.module.ts에서 모듈 분리",
      "src/modules/users/users.service.ts에서 비즈니스 로직 집중"
    ]
  },
  "technicalDecisions": [
    {
      "topic": "의존성 주입 사용",
      "assessment": "NestJS 표준 패턴을 일관되게 사용한다",
      "evidence": [
        "UsersService 생성자 주입 사용"
      ]
    }
  ],
  "strengths": [
    {
      "point": "책임 분리가 비교적 명확하다",
      "evidence": [
        "controller와 service 분리"
      ]
    }
  ],
  "risks": [
    {
      "point": "예외 처리 일관성이 약할 수 있다",
      "evidence": [
        "서비스 레이어에서 예외 매핑이 제한적임"
      ]
    }
  ],
  "collaborationSignals": [
    {
      "signal": "모듈 구조를 일관되게 유지하려는 성향",
      "evidence": [
        "디렉토리 구조와 파일 책임이 반복적으로 일관됨"
      ]
    }
  ],
  "recommendedQuestionAreas": {
    "skill": [
      "핵심 서비스 로직 설계 의도",
      "데이터 접근 계층 분리 이유"
    ],
    "cultureFit": [
      "협업을 위한 구조화 습관",
      "문서화 및 유지보수 기준"
    ]
  }
}
```

### 설계 메모
- 자연어 보고서가 아니라 JSON 객체를 반환한다.
- 모든 판단에는 파일 내용 기반 근거를 포함한다.
- 질문 생성 단계가 그대로 재사용할 수 있도록 기술적 근거와 협업 신호를 분리한다.
- 근거가 약한 추정은 넣지 않는다.
- Worker는 이 JSON 객체를 문자열 그대로 `code_analysis.raw_analysis_report`에 저장하고, 질문 생성 단계 입력으로 재사용한다.

### template_key 예시
- `code-summary-v1`

### template_name 예시
- `MVP Code Summary v1`

### template_text 초안

```text
You are a code analysis system for interview-question generation.
Using only the provided files, produce a structured JSON summary of the repository's architecture, technical decisions, strengths, risks, and collaboration signals.

Repository:
- repo: {{repo_full_name}}
- branch: {{default_branch}}

Group tech stacks:
{{tech_stacks}}

Selected files:
{{selected_files}}

File contents:
{{file_contents}}

Analysis rules:
1. Use only facts grounded in the provided file contents.
2. Exclude weak guesses, exaggeration, and generic advice.
3. Keep `summary` concise but information-dense.
4. Put the most representative structural characteristic in `architecture.pattern`.
5. Every item in `technicalDecisions`, `strengths`, `risks`, and `collaborationSignals` must include an `evidence` array.
6. Evidence must reference observable file paths, code structure, or implementation patterns.
7. `recommendedQuestionAreas` must suggest useful follow-up themes for interview questions by category.
8. Return exactly one JSON object with no explanation, markdown, or code fences.
9. Keep JSON keys in English exactly as defined by the schema.
10. Write all descriptive string values in Korean.

Output JSON schema:
{
  "summary": "string",
  "architecture": {
    "pattern": "string",
    "evidence": ["string"]
  },
  "technicalDecisions": [
    {
      "topic": "string",
      "assessment": "string",
      "evidence": ["string"]
    }
  ],
  "strengths": [
    {
      "point": "string",
      "evidence": ["string"]
    }
  ],
  "risks": [
    {
      "point": "string",
      "evidence": ["string"]
    }
  ],
  "collaborationSignals": [
    {
      "signal": "string",
      "evidence": ["string"]
    }
  ],
  "recommendedQuestionAreas": {
    "skill": ["string"],
    "cultureFit": ["string"]
  }
}
```

## 3. question_generation

### 목적
- 구조화된 코드 분석 결과와 그룹 컨텍스트를 바탕으로 면접관이 바로 사용할 수 있는 질문을 생성한다.

### 사용 단계
- `QUESTION_GENERATION`

### 저장 목적
- `llm_messages` 저장
- `generated_questions` 저장

### 권장 변수

```json
{
  "repo_full_name": "string",
  "tech_stacks": "string",
  "culture_fit_priority": "string",
  "code_analysis_json": "string",
  "max_questions_per_analysis_run": "number"
}
```

### 응답 JSON 스키마

```json
[
  {
    "category": "SKILL",
    "questionText": "이 서비스 계층에서 비즈니스 로직을 이렇게 분리한 이유를 설명해 주세요.",
    "intent": "서비스 책임 분리와 설계 근거를 검증",
    "priority": 1
  },
  {
    "category": "CULTURE_FIT",
    "questionText": "모듈 구조를 일관되게 유지하려고 한 기준이 있었다면 설명해 주세요.",
    "intent": "협업 시 구조화와 유지보수 기준을 확인",
    "priority": 2
  }
]
```

### 설계 메모
- 질문 개수는 `max_questions_per_analysis_run` 이하다.
- `category`는 `SKILL` 또는 `CULTURE_FIT`만 허용한다.
- 모든 질문은 코드 분석 결과의 근거를 기반으로 해야 한다.
- 면접관이 그대로 읽을 수 있는 문장형 질문이어야 한다.
- 동일 의미의 질문을 중복 생성하지 않도록 지시한다.

### template_key 예시
- `question-generation-v1`

### template_name 예시
- `MVP Question Generation v1`

### template_text 초안

```text
You are a system that generates interview questions from a candidate's GitHub repository analysis.
Return only concrete questions that an interviewer can use immediately.

Repository:
- repo: {{repo_full_name}}

Group tech stacks:
{{tech_stacks}}

Group culture-fit priority:
{{culture_fit_priority}}

Code analysis result (JSON):
{{code_analysis_json}}

Question generation rules:
1. Return at most {{max_questions_per_analysis_run}} questions.
2. `category` must be either `SKILL` or `CULTURE_FIT`.
3. Every question must be grounded in directly observed evidence from the input analysis.
4. Questions should prompt the candidate to explain real design choices, implementation intent, or collaboration habits.
5. Each question must focus on one main topic only.
6. Exclude generic textbook questions and speculative questions unrelated to the code.
7. Avoid duplicate or near-duplicate questions.
8. `intent` must describe in one sentence what the interviewer is trying to verify.
9. Lower `priority` means higher importance.
10. Return exactly one JSON array with no explanation, markdown, or code fences.
11. Keep JSON keys in English exactly as defined by the schema.
12. Write `questionText` and `intent` in Korean.

Output JSON schema:
[
  {
    "category": "SKILL | CULTURE_FIT",
    "questionText": "string",
    "intent": "string",
    "priority": 0
  }
]
```

## 4. 운영 권장사항

### 템플릿 저장 시 권장 메타데이터

| purpose | template_key | version | is_active |
| --- | --- | --- | --- |
| `file_selection` | `file-selection-v1` | 1 | true |
| `code_summary` | `code-summary-v1` | 1 | true |
| `question_generation` | `question-generation-v1` | 1 | true |

### variables_json 예시

```json
[
  {
    "purpose": "file_selection",
    "variablesJson": {
      "repo_full_name": "string",
      "default_branch": "string",
      "tech_stacks": "string",
      "file_tree": "string",
      "max_analysis_files": "number"
    }
  },
  {
    "purpose": "code_summary",
    "variablesJson": {
      "repo_full_name": "string",
      "default_branch": "string",
      "tech_stacks": "string",
      "selected_files": "string",
      "file_contents": "string"
    }
  },
  {
    "purpose": "question_generation",
    "variablesJson": {
      "repo_full_name": "string",
      "tech_stacks": "string",
      "culture_fit_priority": "string",
      "code_analysis_json": "string",
      "max_questions_per_analysis_run": "number"
    }
  }
]
```

### 후속 구현 체크포인트
- `file_selection` parser는 `string[]`를 직접 파싱해야 한다.
- `code_summary` parser는 JSON 객체를 검증한 뒤 문자열 그대로 `code_analysis.raw_analysis_report`에 저장해야 한다.
- `question_generation` parser는 `Array<{ category; questionText; intent; priority }>`를 파싱한 뒤 유효하지 않은 항목을 필터링해야 한다.
- 질문 개수 초과 시 Worker에서 `priority` 오름차순 기준으로 잘라내야 한다.
