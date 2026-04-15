BEGIN;

CREATE TABLE IF NOT EXISTS prompt_templates (
  id SERIAL PRIMARY KEY,
  template_key text NOT NULL,
  template_name text NOT NULL,
  purpose text NOT NULL,
  template_text text NOT NULL,
  variables_json jsonb,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS prompt_templates_template_key_key
  ON prompt_templates (template_key);

INSERT INTO prompt_templates (
  template_key,
  template_name,
  purpose,
  template_text,
  variables_json,
  version,
  is_active
)
VALUES
  (
    'file-selection-v1',
    'MVP File Selection v1',
    'file_selection',
    $file_selection$
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
$file_selection$,
    '{"repo_full_name":"string","default_branch":"string","tech_stacks":"string","file_tree":"string","max_analysis_files":"number"}'::jsonb,
    1,
    true
  ),
  (
    'code-summary-v1',
    'MVP Code Summary v1',
    'code_summary',
    $code_summary$
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
$code_summary$,
    '{"repo_full_name":"string","default_branch":"string","tech_stacks":"string","selected_files":"string","file_contents":"string"}'::jsonb,
    1,
    true
  ),
  (
    'question-generation-v1',
    'MVP Question Generation v1',
    'question_generation',
    $question_generation$
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
$question_generation$,
    '{"repo_full_name":"string","tech_stacks":"string","culture_fit_priority":"string","code_analysis_json":"string","max_questions_per_analysis_run":"number"}'::jsonb,
    1,
    true
  )
ON CONFLICT (template_key) DO UPDATE
SET
  template_name = EXCLUDED.template_name,
  purpose = EXCLUDED.purpose,
  template_text = EXCLUDED.template_text,
  variables_json = EXCLUDED.variables_json,
  version = EXCLUDED.version,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

COMMIT;
