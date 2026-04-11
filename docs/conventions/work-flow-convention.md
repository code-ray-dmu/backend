# Development Workflow Guide

## Table of Contents

1. Purpose
2. Team Assumptions
3. Core Principles
4. Branch Strategy
5. Workflow Overview
6. Branch Naming Convention
7. Commit Rules
8. Release Strategy
9. Hotfix Process
10. Task Management (Notion)
11. AI Collaboration Rules
12. Logging & Debugging Guidelines
13. Recommended Repository Settings
14. Future Enhancements

---

## 1. Purpose

This document defines the team's standard development workflow.

The goal is to ensure that:

* collaboration remains predictable,
* code quality is protected,
* production remains stable,
* and development can move quickly without losing control.

---

## 2. Team Assumptions

This workflow is designed based on the current team context:

* Team size: **5 people**
* Roles: **separated by responsibility**
* Release cadence: **weekly**
* Environments: **local dev, production**
* AI-generated code: **always reviewed**
* Task management tool: **Notion**
* Task ID format: `TASK-number`
* Typical task size: **1 day**
* Direct hotfix to production path: **allowed through controlled process**

---

## 3. Core Principles

### 3.1 Keep `main` Deployable

The `main` branch must remain in a production-deployable state at all times.

### 3.2 Prefer Small Changes

Changes should be scoped to roughly one day of work. Large multi-purpose changes reduce review quality and increase merge risk.

### 3.3 AI Output Is Not Trusted by Default

AI can accelerate development, but all generated code must be verified by humans before merge.

---

## 4. Branch Strategy

The team uses **Trunk-Based Development with short-lived feature branches**.

### 4.1 Branch Types

* `main`: production-ready branch
* `feature/*`: normal development work
* `hotfix/*`: urgent production fixes

### 4.2 Why This Strategy

This strategy fits the team because:

* the team is small,
* work items are short-lived,
* weekly release needs stable integration,
* and AI-assisted development benefits from short branch lifetimes and fast review cycles.

### 4.3 Rules

* All work starts from `main`
* All work is developed in `feature/*` or `hotfix/*`
* Direct push to `main` is prohibited
* Branches should be short-lived and merged quickly
* Rebase or merge from `main` frequently if the branch lives more than one day

---

## 5. Workflow Overview

### 5.1 Standard Feature Flow

1. Create or confirm a task in Notion
2. Use the task ID (for example `TASK-123`)
3. Create a branch from `main`
4. Implement the change
5. Run local checks
6. Merge into `main`
7. Deploy through the weekly production release cycle

### 5.2 Hotfix Flow

1. Create a `hotfix/*` branch from `main`
2. Implement the minimal required fix
3. Merge into `main`
4. Deploy to production as needed

---

## 6. Branch Naming Convention

### 6.1 Format

```text
feature/TASK-<number>-<short-description>
hotfix/TASK-<number>-<short-description>
```

### 6.2 Examples

```text
feature/TASK-101-user-auth
feature/TASK-205-realtime-sync
hotfix/TASK-301-login-error
```

### 6.3 Rules

* The Notion task number is mandatory
* Use lowercase kebab-case for the description
* Keep the description short and meaningful
* One branch should correspond to one task

---

## 7. Commit Rules

### 7.1 Commit Message

```text
[type]: [TASK-123] description
```

### Types

* feat: Add a new feature
* fix: Fix a bug
* refactor: Refactor code (no functional changes)
* docs: Documentation changes
* style: Code style changes (formatting, semicolons, etc.)
* test: Add or modify tests
* chore: Build, configuration, dependencies, or other miscellaneous tasks

### Examples

```text
feat: [TASK-101] Add user login feature
fix: [TASK-102] Fix token expiration handling bug
docs: [TASK-103] Update API documentation
refactor: [TASK-104] Improve authentication logic structure
```

### Rules

* Each commit must have a single purpose
* Do not mix feature, bug fix, and refactoring in one commit
* The type must be specified
* TASK number must be included (`[TASK-123]`)
* Write clear and concise messages

## 8. Release Strategy

### 8.1 Default Release Model

* Production releases occur on a **weekly cadence**
* `main` is the production source branch
* Only validated code should reach release candidates

### 8.2 Release Responsibility

Before weekly deployment, the team should confirm:

* all intended changes are merged,
* no known blocker remains,
* and deployment notes are clear.

### 8.3 Recommended Weekly Release Checklist

```markdown
- [ ] All target changes merged into main
- [ ] Local validation completed on latest main
- [ ] Critical bug review completed
- [ ] Release notes summarized
- [ ] Rollback method confirmed
```

---

## 9. Hotfix Process

### 9.1 When to Use

Use the hotfix process only for:

* production outage,
* critical functional defect,
* security issue,
* or severe user-facing failure.

### 9.2 Branch Format

```text
hotfix/TASK-<number>-<short-description>
```

### 9.3 Rules

* Start from latest `main`
* Keep the change minimal
* Do not combine unrelated cleanup with the fix
* Deploy immediately when confirmed safe

### 9.4 Post-Hotfix Rule

After a hotfix, the team should document:

* root cause,
* fix summary,
* and whether any preventive action is needed.

---

## 10. Task Management (Notion)

### 10.1 Task ID Convention

All implementation work must be linked to a Notion task using:

```text
TASK-<number>
```

### 10.2 Rules

* No task, no branch
* One task should map to one primary development objective
* Large initiatives should be split into multiple daily tasks

### 10.3 Traceability Rule

The task ID must appear in:

* branch name,
* and commit message.

This ensures end-to-end traceability between planning and code delivery.

---

## 11. AI Collaboration Rules

AI is allowed across the full development lifecycle, including:

* code generation,
* refactoring,
* debugging,
* test scaffolding,
* documentation,
* and review assistance.

### 11.1 Mandatory Rules

* AI output must always be reviewed by a human
* Developers remain accountable for all merged code
* Generated code must follow team conventions
* Do not merge code that is not fully understood
* Do not assume generated code is secure or optimal

### 11.2 Expected Developer Behavior

When using AI, developers should:

* verify business logic,
* inspect hidden assumptions,
* simplify overengineered output,
* and remove unused or speculative code.

### 11.3 Relationship to Separate AI Policy

Detailed AI coding rules may be maintained in a separate document. This workflow document does not replace that policy; it only defines how AI-created changes move through the team workflow.

---

## 12. Logging & Debugging Guidelines

### 12.1 Logging

* Critical application flows should emit meaningful logs
* Errors should be traceable with enough context for debugging
* Avoid vague messages such as `something failed`

### 12.2 Debugging Discipline

* Do not leave temporary debug logging in production code
* Remove ad hoc debugging code before merge
* Prefer reproducible debugging steps over one-time fixes

---

## 13. Recommended Repository Settings

The following repository settings are strongly recommended.

### 13.1 Branch Protection for `main`

Enable branch protection with at least:

* block direct push to `main`.

### 13.2 Recommended Merge Strategy

Prefer one of the following and use it consistently:

* **Squash merge** for cleaner history
* **Rebase merge** if the team wants linear history

For this team, **Squash merge** is the simplest and safest default.

---

## 14. Future Enhancements

The following items are recommended as the team matures:

### 14.1 Formal Test Strategy

Introduce explicit standards for:

* unit tests,
* integration tests,
* and end-to-end tests.

### 14.2 Feature Toggle Strategy

Useful when unfinished features must be merged before release.

### 14.3 Rollback Strategy

Define exactly how production is restored if a release fails.

### 14.4 Environment Expansion

As the service grows, consider adding:

* staging,
* preview environments,
* or ephemeral review environments.

---

## Appendix A. Minimal Local Developer Checklist

```markdown
- [ ] Synced with latest main
- [ ] Branch created from main
- [ ] Task ID included in branch and commits
- [ ] Local lint passed
- [ ] Local type check passed
- [ ] Local build passed
```
