# Node.js + TypeScript Code Convention

**Version 1.0**

---

# Table of Contents

1. Purpose
2. Environment Standards
3. Core Principles
4. File & Naming Rules
5. Code Style
6. import / export Rules
7. Function Rules
8. Async Code Rules
9. Error Handling
10. Logging Rules
11. Configuration & Env Rules
12. Testing Rules
13. Comments & Documentation
14. Security Rules
15. AI Coding Agent Rules
16. ESLint / Formatter Standards

---

# 1. Purpose

This document defines **mandatory coding standards** for a Node.js + TypeScript project.

Applies to:

* Developers
* AI coding agents
* All code generation/modification tasks

Goals:

* Consistent code quality
* Predictable structure
* Safe runtime behavior
* AI-friendly codebase

---

# 2. Environment Standards

## 2.1 Runtime

* Node.js **24 LTS (MUST)**

## 2.2 Language

* TypeScript **required (MUST)**
* `strict: true`

## 2.3 Module System

* ESM only

```json
{
  "type": "module"
}
```

## 2.4 Build

* Run compiled code only (`dist/`)
* `ts-node` = dev only

---

# 3. Core Principles

1. **Explicit over implicit**
2. **Single responsibility**
3. **Predictability**
4. **Minimal side effects**
5. **AI-friendly structure**

---

# 4. File & Naming Rules

## 4.1 File Names

* kebab-case

```
user-service.ts
create-order-handler.ts
```

## 4.2 Identifiers

| Type                | Rule                    |
| ------------------- | ----------------------- |
| variables/functions | camelCase               |
| classes/types       | PascalCase              |
| constants           | UPPER_SNAKE_CASE        |
| boolean             | is / has / can / should |

## 4.3 Types

```
CreateUserInput
CreateUserResult
```

## 4.4 Forbidden

* vague names (`data`, `tmp`)
* excessive abbreviations
* redundant naming

---

# 5. Code Style

* indent: 2 spaces
* semicolons: required
* quotes: single
* trailing comma: allowed
* max line: 100~120

## Control Flow

* always use `{}`

## Ternary

* simple only
* no nesting

## Return Types (MUST)

```ts
function getUser(): Promise<User> {}
```

---

# 6. import / export Rules

## 6.1 Order

1. Node built-in
2. external libs
3. internal modules

```ts
import fs from 'node:fs/promises';
import express from 'express';
import { service } from '@/service';
```

## 6.2 node: prefix

```ts
import test from 'node:test';
```

## 6.3 Export

* named export (default)
* avoid default export

---

# 7. Function Rules

## 7.1 Naming

* use verbs: create, get, update, validate

## 7.2 Input

```ts
function createUser(input: CreateUserInput)
```

## 7.3 Pure Functions preferred

## 7.4 Size

* split if >40 lines

## 7.5 Explicit Return

---

# 8. Async Code Rules

## 8.1 Use async/await

## 8.2 Parallel

```ts
await Promise.all([...]);
```

## 8.3 No missing await

## 8.4 No silent async

```ts
void sendEvent();
```

---

# 9. Error Handling

## 9.1 Do not swallow errors

## 9.2 Custom errors

```ts
class NotFoundError extends Error {}
```

## 9.3 Explicit return types

```
Promise<User | null>
```

## 9.4 Throw at correct layer

---

# 10. Logging Rules

## 10.1 No console.log (prod)

## 10.2 Structured logging

```ts
logger.info({ userId, action: 'login' });
```

## Levels

* debug
* info
* warn
* error

## 10.4 No sensitive data

---

# 11. Configuration & Env Rules

## 11.1 Central config

```ts
export const config = {
  port: Number(process.env.PORT ?? 3000),
};
```

## 11.2 No direct env access

## 11.3 Typed config

---

# 12. Testing Rules

## 12.1 Runner

* `node:test`

## 12.2 File

```
*.test.ts
```

## 12.3 Structure

* Given / When / Then

## 12.4 Example

```ts
test('should fail on invalid input', async () => {
  await assert.rejects(() => createUser({}), /invalid/);
});
```

---

# 13. Comments & Documentation

## 13.1 Explain "why"

## 13.2 Use JSDoc

```ts
/**
 * Create user
 */
```

## 13.3 Avoid redundant comments

---

# 14. Security Rules

* always validate input
* never trust external data
* avoid raw query strings
* limit error exposure

---

# 15. AI Coding Agent Rules

## 15.1 Respect existing structure

## 15.2 Limit scope of changes

## 15.3 Preserve contracts

* types
* return values
* error behavior

## 15.4 No unnecessary dependencies

## 15.5 Forbidden

* TODO-only code
* guess-based logic
* swallowing errors
* large refactors without request

---

# 16. ESLint / Formatter Standards

## Required

* ESLint
* Prettier
* EditorConfig

## Core Rules

* no-unused-vars
* eqeqeq
* curly
* prefer-const
* no-console

## TypeScript

* strict mode (MUST)
* avoid `any`
