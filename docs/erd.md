// [code-ray] MVP Database Design for AI Interview Support System
// Team: Gradle (Build Automation Style)

Table users {
  id uuid [pk]
  email text [unique, not null]
  password_hash text [not null]
  name text
  created_at timestamptz [default: `now()`]
  updated_at timestamptz [default: `now()`]
}

Table groups {
  id uuid [pk]
  user_id uuid [ref: > users.id]
  name text [not null]
  description text [null]
  tech_stacks jsonb [not null] // e.g., {"framework": "Spring", "db": "PostgreSQL"}
  culture_fit_priority text [not null]
  created_at timestamptz [default: `now()`]
  updated_at timestamptz [default: `now()`]
}

Table refresh_tokens {
  id int [pk, increment]
  user_id uuid [ref: > users.id]
  token_value text [not null]
  expires_at timestamptz [not null]
  is_revoked boolean [default: false]
}

Table applicants {
  id uuid [pk]
  group_id uuid
  name text
  email text
  github_url text // 지원자 GitHub 프로필 URL (https://github.com/{owner} 형식만 허용)
  created_at timestamptz [default: `now()`]
  updated_at timestamptz [default: `now()`]
}

/*
  실제 분석 대상 레포지토리
  - applicants.github_url만으로는 여러 repo 대응이 어려우므로 최소 분리
*/
Table applicant_repositories {
  id uuid [pk]
  applicant_id uuid [ref: > applicants.id]
  repo_name text [not null]
  repo_full_name text [not null] // e.g. "username/project"
  repo_url text [not null]
  default_branch text
  created_at timestamptz [default: `now()`]
  updated_at timestamptz [default: `now()`]
}

/*
  분석 1회 실행 단위
  - 동일 지원자/레포 조합에 COMPLETED 상태가 존재하면 재분석 불허
  - requested_by_user_id 기준으로 접근 제어
*/
Table analysis_runs {
  id uuid [pk]
  applicant_id uuid [not null]
  repository_id uuid [not null]
  requested_by_user_id uuid [ref: > users.id]
  status text [not null] // QUEUED, IN_PROGRESS, COMPLETED, FAILED
  current_stage text // REPO_LIST, FOLDER_STRUCTURE, FILE_DETAIL, SUMMARY, QUESTION_GENERATION
  started_at timestamptz
  completed_at timestamptz
  failure_reason text
  created_at timestamptz [default: `now()`]
  updated_at timestamptz [default: `now()`]
}

/*
  LLM과 단계별로 주고받은 내용
  - MVP에서는 analysis_steps 없이 이 테이블 하나로 핑퐁 기록 관리
  - "레포 목록 전달", "폴더 구조 전달", "상세 코드 전달" 모두 저장 가능
*/
Table llm_messages {
  id uuid [pk]
  analysis_run_id uuid [ref: > analysis_runs.id]
  stage text [not null] // REPO_LIST, FOLDER_STRUCTURE, FILE_DETAIL, SUMMARY, QUESTION_GENERATION
  role text [not null] // SYSTEM, USER, ASSISTANT
  content text [not null]
  created_at timestamptz [default: `now()`]
}

/*
  LLM에 실제 전달한 파일 내용 또는 GitHub에서 조회한 핵심 파일 저장
  - repository tree 전체를 정규화하지 않고 필요한 파일만 저장
*/
Table repository_files {
  id uuid [pk]
  repository_id uuid [ref: > applicant_repositories.id]
  path text [not null] // e.g. "src/main/java/.../UserService.java"
  raw_analysis_report text
  created_at timestamptz [default: `now()`]
  updated_at timestamptz [default: `now()`]
}

/*
  최종 종합 분석 결과
*/
Table code_analysis {
  id uuid [pk]
  analysis_run_id uuid [ref: > analysis_runs.id]
  applicant_id uuid [ref: > applicants.id]
  raw_analysis_report text
  created_at timestamptz [default: `now()`]
  updated_at timestamptz [default: `now()`]
}

Table generated_questions {
  id uuid [pk]
  analysis_run_id uuid [ref: > analysis_runs.id]
  applicant_id uuid [ref: > applicants.id]

  category text // "SKILL", "CULTURE_FIT"
  question_text text
  intent text
  priority int
  created_at timestamptz [default: `now()`]
}

/*
프롬프트 템플릿
*/
Table prompt_templates {
  id int [primary key]
  template_key text [not null, unique]
  template_name text [not null]
  purpose text [not null, note: 'file_selection, code_summary, question_generation']
  template_text text [not null]
  variables_json jsonb [note: '사용 변수 정의']
  version integer [not null, default: 1]
  is_active boolean [not null, default: true]
  created_at timestamptz [default: `now()`]
  updated_at timestamptz [default: `now()`]
}