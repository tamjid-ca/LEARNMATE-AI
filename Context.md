# LearnMate AI — Implementation Context

## Project

Name: LearnMate AI
Stack: Next.js + TypeScript + Node.js + MongoDB + Mongoose
AI: OpenRouter
Deployment: Vercel

## Current State

CURRENT_STATE: 07
STATUS: COMPLETE
LAST_COMPLETED_STATE: 07

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
- **State 06 — AI Tutor and Learning Materials**:
  - Implemented strict Zod schemas (`src/lib/validators/tutor-materials.ts`) and client-safe bilingual catalog (`src/config/learning-materials-catalog.ts`) covering all 12 `MaterialType` entries and 8 pedagogical tutor response styles.
  - Implemented `MongooseTutorMaterialsRepository` and `InMemoryTutorMaterialsRepository` (`src/modules/tutor/tutor-materials-repository.ts`) persisting `conversations`, `messages`, `generatedContents`, and `feedbackReports`.
  - Implemented `tutor-materials-service.ts` (`src/modules/tutor/tutor-materials-service.ts`) providing curriculum-contextual tutor conversations, multi-turn conversation history, SSE streaming, curriculum `sourceReferences` attachment (`FR-TUTOR-011`), message feedback & flagging (`FR-TUTOR-012`), 12-type structured learning material generation with personal library caching & regeneration (`FR-MAT-002`, `FR-MAT-006`), personal note editing/deletion (`FR-MAT-005`), strict user ownership isolation, and admin content moderation (`FR-ADMIN-005`).
  - Built `/api/v1/tutor/conversations`, `/api/v1/tutor/conversations/[conversationId]`, `/api/v1/tutor/conversations/[conversationId]/messages`, `/api/v1/tutor/messages/[messageId]/feedback`, `/api/v1/materials`, `/api/v1/materials/[materialId]`, and `/api/v1/admin/content`.
  - Built interactive Student AI Subject Tutor (`/tutor`) and 12-Type AI Learning Materials Generator & Personal Study Library (`/materials`) UI pages.
- **State 07 — Quiz and Examination System**:
  - Implemented strict Zod schemas (`src/lib/validators/quiz.ts`) for quiz/mock-exam generation across all 4 question types (`single_mcq`, `multiple_mcq`, `true_false`, `short_answer`), timed exams, negative marking, feedback timing (`after_submission`, `immediate`), and attempt submission.
  - Implemented `MongooseQuizRepository` and `InMemoryQuizRepository` (`src/modules/quizzes/quiz-repository.ts`) persisting `quizzes`, `questions`, and `quizAttempts`.
  - Implemented `quiz-service.ts` (`src/modules/quizzes/quiz-service.ts`) enforcing server-side answer-key stripping before submission (`sanitizeQuestionForDelivery`), deterministic objective question auto-scoring with negative marking (`FR-QUIZ-009`), AI rubric-grounded short-answer grading labeled `[AI-Assisted Rubric Evaluation]` (`FR-QUIZ-010`), weak-topic identification (`<60%` topic accuracy) with prerequisite & revision material recommendations (`FR-QUIZ-015`), and retry attempt creation (`FR-QUIZ-013`).
  - Built `/api/v1/quizzes`, `/api/v1/quizzes/[quizId]`, `/api/v1/attempts`, and `/api/v1/attempts/[attemptId]` Route Handlers, plus the interactive Student Quiz & Mock Examination UI (`/quizzes`).

## Current Implementation

- Completed State 07 (Quiz and Examination System).
- Ready to transition to State 08 (Flashcards and Spaced Repetition) upon user instruction.

## Technical Decisions

- **ADR-001..007**: Modular monolith on Next.js App Router, `npm`, 27 normalized Mongoose collections, OpenRouter gateway, hybrid RAG, deterministic SM-2/scheduler, pluggable storage.
- **State 07 Quiz & Exam Architecture**: Active exam questions delivered via `sanitizeQuestionForDelivery` never expose `correctOptionIds`, `expectedShortAnswerRubric`, or `explanation` until `attempt.status === 'submitted'` (unless the student explicitly configured `feedbackTiming: 'immediate'` for practice mode). Objective items are scored deterministically with configurable negative marking, whereas `short_answer` items invoke `executeStructuredAITask('quiz_evaluation')` and tag responses with `isAiEvaluated: true`.

## Database Status

- Completed collections: All 27 collections compiled into Mongoose models (`src/models/index.ts`); active repositories implemented for `users`, `educationSystems`, `educationLevels`, `examinations`, `subjects`, `chapters`, `topics`, `promptTemplates`, `aiUsageLogs`, `appSettings`, `auditLogs`, `conversations`, `messages`, `generatedContents`, `feedbackReports`, `quizzes`, `questions`, and `quizAttempts`.
- Pending collections: `flashcardDecks`, `flashcards`, `reviewLogs` (State 08); `uploadedMaterials`, `documentChunks` (State 09); `studyPlans`, `studyTasks` (State 10); `progressRecords`, `notifications` (State 11).
- Required indexes and migrations: All compound indexes registered in `SCHEMA_REGISTRY` and compiled onto Mongoose schemas.

## Integrations

- MongoDB: CONFIGURED (`.env.local` `MONGODB_URI` present; active repositories for Auth, Curriculum, AI, Tutor/Materials, and Quizzes/Exams)
- OpenRouter: CONFIGURED (`.env.local` `OPENROUTER_API_KEY` present; centralized gateway active in `src/lib/ai/openrouter-client.ts` & `src/modules/ai/ai-service.ts`)
- Storage: NOT_CONFIGURED (`BLOB_READ_WRITE_TOKEN` empty; local disk adapter used in dev)
- Vercel: NOT_CONFIGURED

## Tests

- Commands executed:
  - `npm run typecheck` (`tsc --noEmit`)
  - `npm run lint` (`node scripts/lint.mjs`)
  - `npm test` (`vitest run`)
  - `npm run build` (`next build`)
- Passed tests: 32/32 unit & integration tests across `state-01-architecture.test.ts` (6), `state-02-scaffold.test.ts` (3), `state-03-auth-onboarding.test.ts` (6), `state-04-curriculum-cms.test.ts` (5), `state-05-ai-infrastructure.test.ts` (5), `state-06-tutor-materials.test.ts` (4), and `state-07-quizzes-exams.test.ts` (3); 0 lint or typecheck errors; production build succeeded across all 58 routes.
- Failed tests: None.
- Unresolved issues: None.

## Known Issues

- None blocking State 08.

## User Feedback

- Add `.gitignore` according to the project structure.
- Commit and push changes to GitHub (`origin main`) after finishing each state.

## Next Action

- Exact next implementation state: **State 08 — Flashcards and Spaced Repetition**.
- First task to execute: Implement repositories, deterministic SM-2 spaced repetition scheduling service (`again`, `hard`, `good`, `easy`), Zod validators, and Route Handlers for `/api/v1/flashcards/*` and `/api/v1/reviews/*` (deck & card CRUD, AI flashcard generation from topics/notes, timezone-safe due queue, and `reviewLogs`), plus the interactive Student `/flashcards` flip & review UI page.
- Relevant files to inspect: `Context.md`, `docs/PROJECT_SRS.md` (Section 4.7), `src/lib/validators/ai.ts`, `src/modules/ai/ai-service.ts`.
