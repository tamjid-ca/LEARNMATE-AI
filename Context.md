# LearnMate AI — Implementation Context

## Project

Name: LearnMate AI
Stack: Next.js + TypeScript + Node.js + MongoDB + Mongoose
AI: OpenRouter
Deployment: Vercel

## Current State

CURRENT_STATE: 04
STATUS: COMPLETE
LAST_COMPLETED_STATE: 04

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
  - Initialized Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, Vitest, shadcn/ui primitives, bilingual (English / বাংলা) & dark/light theme provider, responsive collapsible Student (11 routes) & Admin (13 routes) shell, public landing page, and Mongoose runtime model factory.
- **State 03 — Authentication and Student Onboarding**:
  - Implemented `scrypt` cryptographic password hashing (`src/lib/auth/password.ts`), stateless HMAC-SHA256 session & action tokens (`src/lib/auth/session.ts`), endpoint rate limiting (`src/lib/security/rate-limit.ts`), and strict Zod schemas (`src/lib/validators/auth.ts`).
  - Implemented `MongooseUserRepository` and `InMemoryUserRepository` (`src/modules/auth/user-repository.ts`) with cascading personal data deletion across 16 user-owned collections (`FR-AUTH-007`), and `auth-service.ts` (`src/modules/auth/auth-service.ts`).
  - Built `/api/v1/auth/*` (`register`, `login`, `logout`, `me`, `verify-email`, `forgot-password`, `reset-password`), `/api/v1/users/profile` (`GET`, `PATCH`, `DELETE`), and `/api/v1/onboarding` (`GET`, `POST`).
  - Implemented Next.js Web Crypto Edge middleware (`src/middleware.ts`) and route evaluator (`src/lib/auth/route-guard.ts`) protecting student, onboarding, and admin routes.
  - Built interactive Login (`/login`), Registration (`/register`), Password Recovery (`/forgot-password`), Multi-Step Student Onboarding (`/onboarding`), and Profile & Privacy Settings (`/settings`) UI pages.
- **State 04 — Curriculum and Administrative CMS**:
  - Implemented strict Zod schemas (`src/lib/validators/curriculum.ts`) for all 6 hierarchy levels (`educationSystem`, `educationLevel`, `examination`, `subject`, `chapter`, `topic`), saved topic toggles, JSON/CSV import-export bundles, and admin user role/status updates.
  - Created deterministic Bangladesh & International syllabus seed data (`src/modules/curriculum/seed-data.ts`) covering NCTB (`SSC`, `HSC`), Competitive (`UNIV_ADMISSION`, `BCS`), and Cambridge (`A_LEVEL`) systems, `HSC 2027` / `SSC 2027` / `BCS-47` examinations, bilingual subjects & chapters, and topics with learning objectives, key concepts, and prerequisite chains.
  - Implemented `MongooseCurriculumRepository` (with idempotent MongoDB seeding) and `InMemoryCurriculumRepository` (`src/modules/curriculum/curriculum-repository.ts`), plus `curriculum-service.ts` (`src/modules/curriculum/curriculum-service.ts`) enforcing referential integrity, database pagination, RBAC permissions (`curriculum:read`, `curriculum:write`, `admin:users`), and `auditLogs` recording.
  - Built `/api/v1/curriculum`, `/api/v1/topics`, `/api/v1/topics/[topicId]`, `/api/v1/topics/saved`, `/api/v1/admin/curriculum`, `/api/v1/admin/curriculum/import-export`, and `/api/v1/admin/users`.
  - Built interactive Student Curriculum & Syllabus Browser (`/my-learning`, `src/app/(student)/my-learning/page.tsx`) and live Administrative CMS Console (`src/components/admin/admin-cms-console.tsx`, `src/app/admin/[section]/page.tsx`).

## Current Implementation

- Completed State 04 (Curriculum and Administrative CMS).
- Ready to transition to State 05 (OpenRouter and Central AI Infrastructure) upon user instruction.

## Technical Decisions

- **ADR-001..007**: Modular monolith on Next.js App Router, `npm`, 27 normalized Mongoose collections, OpenRouter gateway, hybrid RAG, deterministic SM-2/scheduler, pluggable storage.
- **State 04 Curriculum & CMS Architecture**: Topics and curriculum hierarchy exist independently of AI-generated materials (`FR-CUR-007`), use deterministic 24-hex ObjectIds for initial Bangladesh syllabus seeds, enforce parent-child referential integrity before creation/deletion, and record every CMS or permission mutation in `auditLogs`.

## Database Status

- Completed collections: All 27 collections compiled into Mongoose models (`src/models/index.ts`); active repositories implemented for `users`, `educationSystems`, `educationLevels`, `examinations`, `subjects`, `chapters`, `topics`, and `auditLogs`.
- Pending collections: `promptTemplates`, `aiUsageLogs`, `appSettings` (State 05); `conversations`, `messages`, `generatedContents` (State 06); `quizzes`, `questions`, `quizAttempts` (State 07); `flashcardDecks`, `flashcards`, `reviewLogs` (State 08); `uploadedMaterials`, `documentChunks` (State 09); `studyPlans`, `studyTasks` (State 10); `progressRecords`, `notifications`, `feedbackReports` (State 11).
- Required indexes and migrations: All compound indexes registered in `SCHEMA_REGISTRY` and compiled onto Mongoose schemas.

## Integrations

- MongoDB: CONFIGURED (`.env.local` `MONGODB_URI` present; `MongooseUserRepository` & `MongooseCurriculumRepository` active)
- OpenRouter: CONFIGURED (`.env.local` `OPENROUTER_API_KEY` present; gateway wired in State 05)
- Storage: NOT_CONFIGURED (`BLOB_READ_WRITE_TOKEN` empty; local disk adapter used in dev)
- Vercel: NOT_CONFIGURED

## Tests

- Commands executed:
  - `npm run typecheck` (`tsc --noEmit`)
  - `npm run lint` (`node scripts/lint.mjs`)
  - `npm test` (`vitest run`)
  - `npm run build` (`next build`)
- Passed tests: 20/20 unit & integration tests across `state-01-architecture.test.ts` (6), `state-02-scaffold.test.ts` (3), `state-03-auth-onboarding.test.ts` (6), and `state-04-curriculum-cms.test.ts` (5); 0 lint or typecheck errors; production build succeeded across all routes.
- Failed tests: None.
- Unresolved issues: None.

## Known Issues

- None blocking State 05.

## User Feedback

- Add `.gitignore` according to the project structure.
- Commit and push changes to GitHub (`origin main`) after finishing each state.

## Next Action

- Exact next implementation state: **State 05 — OpenRouter and Central AI Infrastructure**.
- First task to execute: Build the centralized server-side OpenRouter gateway (`src/lib/ai/openrouter-client.ts`, `src/modules/ai/ai-service.ts`), task prompt template registry & `promptTemplates` CRUD, Zod structured output validator with bounded retries and model fallbacks, streaming SSE helper, per-user daily quotas & rate limiting, `aiUsageLogs` persistence, and `/admin/ai-config`, `/admin/prompts`, and `/admin/usage-logs` management interfaces.
- Relevant files to inspect: `Context.md`, `docs/PROJECT_SRS.md` (Section 4.13, Section 7), `src/lib/ai/config.ts`, `src/lib/database/schema-registry.ts`.
