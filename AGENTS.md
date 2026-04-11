# AGENTS.md

## Purpose
- This repository is the `code-ray-server` backend.
- Use `docs/server-spec.md` as the source of truth for architecture and module responsibilities.

## Read First
1. `docs/README.md`

## Working Rules
- Stay within the user request.
- Do not refactor unrelated code.
- Prefer existing patterns over new abstractions.
- Read nearby code before editing.
- After finishing code changes, get a review from a subagent when available.
- Apply the subagent's feedback before finalizing, or report why any feedback was not applied.

## Code Rules
- Use TypeScript only.
- Keep ESM.
- Prefer named exports.
- Use kebab-case for file names.
- Add explicit return types.
- Prefer `async/await`.

## Project Notes
- `apps/api`: keep NestJS module/controller/service structure.
- `apps/worker`: keep processor/job/scheduler responsibilities separate.
- `libs/database`: check schema impact before changing entities.

## Validation
- Run relevant checks after changes when possible.
- Before finalizing, complete a subagent review of the finished code when available.
- Default checks:
  - `npm run lint`
  - `npm run test`
  - `npm run build`
- If a check is skipped or fails, report it clearly.

## Git Rules
- Follow `docs/conventions/work-flow-convention.md`.
- Keep one logical purpose per commit.

## Forbidden
- Do not commit secrets.
- Do not make broad renames unless requested.
- Do not use destructive git commands unless explicitly requested.
