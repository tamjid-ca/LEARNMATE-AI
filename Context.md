# LearnMate AI — Implementation Context

## Project

Name: LearnMate AI
Stack: Next.js + TypeScript + Node.js + MongoDB + Mongoose
AI: OpenRouter
Deployment: Vercel

## Current State

CURRENT_STATE: 05
STATUS: COMPLETE
LAST_COMPLETED_STATE: 05

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
  - Implemented `MongooseCurriculumRepository` and `InMemoryCurriculumRepository` (`src/modules/curriculum/curriculum-repository.ts`), plus `curriculum-service.ts` (`src/modules/curriculum/curriculum-service.ts`) enforcing referential integrity, database pagination, RBAC permissions, and `auditLogs` recording.
  - Built `/api/v1/curriculum`, `/api/v1/topics`, `/api/v1/topics/[topicId]`, `/api/v1/topics/saved`, `/api/v1/admin/curriculum`, `/api/v1/admin/curriculum/import-export`, `/api/v1/admin/users`, Student Curriculum Explorer (`/my-learning`), and Admin CMS UI.
- **State 05 — OpenRouter and Central AI Infrastructure**:
  - Implemented structured AI output Zod schemas & JSON extractor (`src/lib/validators/ai.ts`) for materials, quizzes, short-answer evaluations, flashcards, study planner advice, recommendations, and admin AI config.
  - Created authoritative versioned prompt templates (`src/lib/ai/prompt-templates.ts`) across all 9 `AITaskType` tasks (`tutor`, `explanation`, `summarization`, `quiz_generation`, `quiz_evaluation`, `flashcards`, `planner`, `document_qa`, `recommendations`) with variable interpolation and prompt-injection defense rules.
  - Implemented `MongooseAIRepository` and `InMemoryAIRepository` (`src/modules/ai/ai-repository.ts`) persisting `promptTemplates`, `aiUsageLogs`, and `appSettings` (`ai_platform_config` & reusable response cache).
  - Implemented centralized server-side OpenRouter gateway (`src/lib/ai/openrouter-client.ts`) and AI orchestration service (`src/modules/ai/ai-service.ts`) with timeouts, secret redaction (`sanitizeProviderError`), bounded schema-repair retries (`executeStructuredAITask`), fallback model routing, per-student daily request/token quotas, reusable response caching, and SSE streaming (`streamAITask`).
  - Built `/api/v1/admin/ai/config`, `/api/v1/admin/ai/prompts`, and `/api/v1/admin/ai/usage` endpoints and live Admin AI Configuration, Prompt Template Editor, and Usage Telemetry consoles (`src/components/admin/admin-ai-console.tsx`).

## Current Implementation

- Completed State 05 (OpenRouter and Central AI Infrastructure).
- Ready to transition to State 06 (AI Tutor and Learning Materials) upon user instruction.

## Technical Decisions

- **ADR-001..007**: Modular monolith on Next.js App Router, `npm`, 27 normalized Mongoose collections, OpenRouter gateway, hybrid RAG, deterministic SM-2/scheduler, pluggable storage.
- **State 05 AI Gateway Architecture**: All LLM operations pass through `executeAITask`, `executeStructuredAITask`, or `streamAITask` in `src/modules/ai/ai-service.ts`, enforcing daily per-student request/token quotas before external calls, validating structured outputs with Zod (up to 2 repair retries), falling back across configured models on provider errors, and redacting any `sk-or-v1-*` or `Bearer` credentials before logging to `aiUsageLogs`.

## Database Status

- Completed collections: All 27 collections compiled into Mongoose models (`src/models/index.ts`); active repositories implemented for `users`, `educationSystems`, `educationLevels`, `examinations`, `subjects`, `chapters`, `topics`, `promptTemplates`, `aiUsageLogs`, `appSettings`, and `auditLogs`.
- Pending collections: `conversations`, `messages`, `generatedContents` (State 06); `quizzes`, `questions`, `quizAttempts` (State 07); `flashcardDecks`, `flashcards`, `reviewLogs` (State 08); `uploadedMaterials`, `documentChunks` (State 09); `studyPlans`, `studyTasks` (State 10); `progressRecords`, `notifications`, `feedbackReports` (State 11).
- Required indexes and migrations: All compound indexes registered in `SCHEMA_REGISTRY` and compiled onto Mongoose schemas.

## Integrations

- MongoDB: CONFIGURED (`.env.local` `MONGODB_URI` present; `MongooseUserRepository`, `MongooseCurriculumRepository`, & `MongooseAIRepository` active)
- OpenRouter: CONFIGURED (`.env.local` `OPENROUTER_API_KEY` present; centralized gateway active in `src/lib/ai/openrouter-client.ts` & `src/modules/ai/ai-service.ts`)
- Storage: NOT_CONFIGURED (`BLOB_READ_WRITE_TOKEN` empty; local disk adapter used in dev)
- Vercel: NOT_CONFIGURED

## Tests

- Commands executed:
  - `npm run typecheck` (`tsc --noEmit`)
  - `npm run lint` (`node scripts/lint.mjs`)
  - `npm test` (`vitest run`)
  - `npm run build` (`next build`)
- Passed tests: 25/25 unit & integration tests across `state-01-architecture.test.ts` (6), `state-02-scaffold.test.ts` (3), `state-03-auth-onboarding.test.ts` (6), `state-04-curriculum-cms.test.ts` (5), and `state-05-ai-infrastructure.test.ts` (5); 0 lint or typecheck errors; production build succeeded across all 51 routes.
- Failed tests: None.
- Unresolved issues: None.

## Known Issues

- None blocking State 06.

## User Feedback

- Add `.gitignore` according to the project structure.
- Commit and push changes to GitHub (`origin main`) after finishing each state.

## Next Action

- Exact next implementation state: **State 06 — AI Tutor and Learning Materials**.
- First task to execute: Implement repositories, services, Zod validators, and Route Handlers for `/api/v1/tutor/*` (contextual conversations, message history, SSE streaming, Bangla/English & explanation depth modes, message feedback) and `/api/v1/materials/*` (all 12 learning material types, personal library CRUD, regeneration, admin moderation), plus interactive Student `/tutor` and `/materials` UI pages.
- Relevant files to inspect: `Context.md`, `docs/PROJECT_SRS.md` (Section 4.4, Section 4.5), `src/modules/ai/ai-service.ts`, `src/lib/database/schema-registry.ts`.
