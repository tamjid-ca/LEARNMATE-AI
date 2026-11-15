# LearnMate AI — Implementation Context

## Project

Name: LearnMate AI
Stack: Next.js + TypeScript + Node.js + MongoDB + Mongoose
AI: OpenRouter
Deployment: Vercel

## Current State

CURRENT_STATE: 02
STATUS: COMPLETE
LAST_COMPLETED_STATE: 02

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
  - Created `.gitignore`, finalized domain types & enums (`src/types/domain.ts`), API error/response envelopes (`src/lib/api/errors.ts`, `src/lib/api/response.ts`), server-side RBAC & ownership guards (`src/lib/auth/rbac.ts`), OpenRouter task routing (`src/lib/ai/config.ts`), storage upload validator (`src/lib/storage/adapter.ts`), durable job transitions (`src/lib/jobs/processor.ts`), and 27-collection schema registry (`src/lib/database/schema-registry.ts`).
- **State 02 — Project Scaffold and Design System**:
  - Initialized Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, Vitest, and static security/boundary linter (`scripts/lint.mjs`).
  - Built core shadcn/ui primitives (`button`, `card`, `badge`, `input`, `separator`, `skeleton`, `tabs`, `tooltip`), theme & bilingual (English / বাংলা) context provider (`src/components/providers/app-providers.tsx`), and reusable loading/empty/error states (`src/components/shared/page-states.tsx`).
  - Implemented responsive collapsible Student Workspace (all 11 SRS routes) and Administrator Console (all 13 SRS routes) via `src/config/navigation.ts` and `src/components/shared/app-shell.tsx`.
  - Built public EdTech SaaS landing page (`src/app/(public)/page.tsx`), auth shells (`/login`, `/register`), student dashboard (`/dashboard`), admin overview (`/admin`), and `/api/v1/health` endpoint.
  - Bound runtime Mongoose connection caching (`src/lib/database/mongoose.ts`) and 27 Mongoose schemas/models (`src/models/index.ts`).

## Current Implementation

- Completed State 02 (Project Scaffold and Design System).
- Ready to transition to State 03 (Authentication and Student Onboarding) upon user instruction.

## Technical Decisions

- **ADR-001**: Modular monolithic Next.js App Router application on Node.js runtime (`src/modules`, `src/services`, `src/models`, `src/lib`).
- **ADR-002**: Use `npm` (`v11.19.0`) as the package manager.
- **ADR-003**: Single-source-of-truth 27-collection schema registry (`src/lib/database/schema-registry.ts`) compiled into Mongoose models (`src/models/index.ts`) with cached serverless connection pooling (`src/lib/database/mongoose.ts`).
- **ADR-004**: Centralized server-side OpenRouter gateway (`openrouter/free` default) with per-task model routing and bounded Zod output validation.
- **ADR-005**: Hybrid RAG retrieval (keyword/text search default, upgrading to vector search only when embeddings + Atlas Vector Search are configured).
- **ADR-006**: Deterministic TypeScript algorithms for SM-2 spaced repetition and study roadmap scheduling.
- **ADR-007**: Pluggable `StorageAdapter` and durable job status state machine (`src/lib/jobs/processor.ts`).

## Database Status

- Completed collections: All 27 collections compiled into Mongoose schemas & models (`src/models/index.ts`) with `select: false` on sensitive fields and compound indexes verified by unit tests.
- Pending collections: Live CRUD repository wiring starting in State 03 (`users` auth, profile, and onboarding).
- Required indexes and migrations: Index sync helper ready on all 27 Mongoose models.

## Integrations

- MongoDB: CONFIGURED_IN_CODE (connection singleton ready; uses `.env.local` `MONGODB_URI`)
- OpenRouter: CONFIGURED_IN_CODE (task registry ready; uses `.env.local` `OPENROUTER_API_KEY`)
- Storage: NOT_CONFIGURED (awaiting `BLOB_READ_WRITE_TOKEN`; local fallback planned for dev)
- Vercel: NOT_CONFIGURED

## Tests

- Commands executed:
  - `npm run typecheck` (`tsc --noEmit`)
  - `npm run lint` (`node scripts/lint.mjs`)
  - `npm test` (`vitest run`)
  - `npm run build` (`next build`)
- Passed tests: 9/9 unit tests across `tests/state-01-architecture.test.ts` (6) and `tests/state-02-scaffold.test.ts` (3); 0 lint or typecheck errors; production build succeeded across all static & dynamic routes.
- Failed tests: None.
- Unresolved issues: None.

## Known Issues

- None blocking State 03.

## User Feedback

- Add `.gitignore` according to the project structure.
- Commit and push changes to GitHub (`origin main`) after finishing each state.

## Next Action

- Exact next implementation state: **State 03 — Authentication and Student Onboarding**.
- First task to execute: Implement password hashing, session/cookie signing & verification, `/api/v1/auth/*` (register, login, logout, me, password recovery/verification), server-side RBAC middleware, `/api/v1/users/*` profile & account deletion, `/api/v1/onboarding/*` student onboarding flow & UI, protected route guards, and auth unit/integration tests.
- Relevant files to inspect: `Context.md`, `docs/PROJECT_SRS.md` (Sections 3, 4.1, 4.2), `src/lib/auth/rbac.ts`, `src/models/index.ts`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`.
