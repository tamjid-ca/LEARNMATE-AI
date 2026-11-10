# LearnMate AI — Implementation Context

## Project

Name: LearnMate AI
Stack: Next.js + TypeScript + Node.js + MongoDB + Mongoose
AI: OpenRouter
Deployment: Vercel

## Current State

CURRENT_STATE: 01
STATUS: COMPLETE
LAST_COMPLETED_STATE: 01

## Product Requirements

Primary specification: docs/PROJECT_SRS.md

## Architecture

Architecture: docs/ARCHITECTURE.md
Database: docs/DATABASE_SCHEMA.md
API: docs/API_SPECIFICATION.md
Decisions: docs/DECISIONS.md

## Completed

- **State 00 — Initial Environment and Agent Setup**:
  - Workspace reconnaissance, `.agents/plugins/learnmate-engineering/` plugin (6 skills, 4 agents, 1 rule file), permanent docs, and `.env.example`.
- **State 01 — Architecture and Database Design**:
  - Created `.gitignore` tailored for Next.js, TypeScript, Vitest, Playwright, Vercel, and local dev storage.
  - Finalized domain types & enums (`src/types/domain.ts`), API error/response envelopes (`src/lib/api/errors.ts`, `src/lib/api/response.ts`), server-side RBAC & ownership guards (`src/lib/auth/rbac.ts`), OpenRouter task routing & prompt-injection delimiters (`src/lib/ai/config.ts`), storage upload validator (`src/lib/storage/adapter.ts`), and durable document ingestion state transitions (`src/lib/jobs/processor.ts`).
  - Codified all 27 SRS collections, field specs, sensitive field markers, foreign-key references, and compound indexes in `src/lib/database/schema-registry.ts` and `src/models/index.ts`.
  - Verified architecture and schema invariants with 6 automated tests in `tests/state-01-architecture.test.ts`.

## Current Implementation

- Completed State 01 (Architecture and Database Design).
- Ready to transition to State 02 (Project Scaffold and Design System) upon user instruction.

## Technical Decisions

- **ADR-001**: Modular monolithic Next.js App Router application on Node.js runtime (`src/modules`, `src/services`, `src/models`, `src/lib`).
- **ADR-002**: Use `npm` (`v11.19.0`) as the package manager since `pnpm`/`corepack` are not installed on the host.
- **ADR-003**: Single-source-of-truth 27-collection schema registry (`src/lib/database/schema-registry.ts`) with cached serverless Mongoose connection pooling (`src/lib/database/mongoose.ts`) and strict `userId` ownership indexes.
- **ADR-004**: Centralized server-side OpenRouter gateway (`openrouter/free` default) with per-task model routing and bounded Zod output validation.
- **ADR-005**: Hybrid RAG retrieval (keyword/text search default, upgrading to vector search only when embeddings + Atlas Vector Search are configured).
- **ADR-006**: Deterministic TypeScript algorithms for SM-2 spaced repetition and study roadmap scheduling.
- **ADR-007**: Pluggable `StorageAdapter` and durable job status state machine (`src/lib/jobs/processor.ts`).

## Database Status

- Completed collections: All 27 collection schemas, references, sensitive fields, and compound indexes defined and validated in `src/lib/database/schema-registry.ts` and `src/models/index.ts`.
- Pending collections: Runtime Mongoose model binding once `mongoose` package is installed in State 02.
- Required indexes and migrations: Declared across all 27 collections; index creation script to run against MongoDB in State 02/04.

## Integrations

- MongoDB: NOT_CONFIGURED (awaiting `.env.local` `MONGODB_URI`)
- OpenRouter: NOT_CONFIGURED (awaiting `.env.local` `OPENROUTER_API_KEY`)
- Storage: NOT_CONFIGURED (awaiting `BLOB_READ_WRITE_TOKEN`; local fallback planned for dev)
- Vercel: NOT_CONFIGURED

## Tests

- Commands executed:
  - `node --test tests/state-01-architecture.test.ts`
  - `agy plugin validate .agents/plugins/learnmate-engineering --strict`
- Passed tests: 6/6 architecture, schema, RBAC, AI config, and upload validation tests passed; plugin strict validation passed.
- Failed tests: None.
- Unresolved issues: None.

## Known Issues

- `.env.local` with live credentials is not yet present; required before live database or OpenRouter calls.

## User Feedback

- Add `.gitignore` according to the project structure.
- Commit and push changes to GitHub (`origin main`) after finishing each state.

## Next Action

- Exact next implementation state: **State 02 — Project Scaffold and Design System**.
- First task to execute: Initialize `package.json`, TypeScript, Next.js App Router, Tailwind CSS, shadcn/ui primitives, theme provider (dark/light), responsive app shell (sidebar/header), public landing page, and shared loading/empty/error states while preserving `src/` and `tests/` from State 01.
- Relevant files to inspect: `Context.md`, `docs/PROJECT_SRS.md` (Section 9), `docs/ARCHITECTURE.md`, `src/types/domain.ts`, `src/models/index.ts`.
