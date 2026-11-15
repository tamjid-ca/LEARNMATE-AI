# LearnMate AI — Implementation Context

## Project

Name: LearnMate AI
Stack: Next.js + TypeScript + Node.js + MongoDB + Mongoose
AI: OpenRouter
Deployment: Vercel

## Current State

CURRENT_STATE: 10
STATUS: COMPLETE
LAST_COMPLETED_STATE: 10

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
- **State 08 — Flashcards and Spaced Repetition**:
  - Implemented strict Zod schemas (`src/lib/validators/flashcards.ts`) for manual deck creation, AI flashcard generation (`FR-FLASH-001`), card CRUD (`FR-FLASH-003`, `FR-FLASH-005`), review queue filtering (`due`, `upcoming`, `mastered`, `difficult`, `all` — `FR-FLASH-009`), and SM-2 rating submissions (`again`, `hard`, `good`, `easy` — `FR-FLASH-007`).
  - Implemented `MongooseFlashcardRepository` and `InMemoryFlashcardRepository` (`src/modules/flashcards/flashcard-repository.ts`) persisting `flashcardDecks`, `flashcards`, and `reviewLogs`.
  - Implemented `flashcard-service.ts` (`src/modules/flashcards/flashcard-service.ts`) with the deterministic SM-2 scheduler (`computeNextSM2Schedule` — `FR-FLASH-006..008`, ADR-006), category breakdowns (`categorizeFlashcards`), AI deck generation from syllabus topics or saved study notes, card CRUD with deck count synchronization, and `reviewLogs` persistence (`FR-FLASH-010`).
  - Built `/api/v1/flashcards`, `/api/v1/flashcards/[id]`, and `/api/v1/reviews` Route Handlers, plus the interactive Student Flip-Card & Spaced-Repetition UI (`/flashcards`).
- **State 09 — Document Management and RAG**:
  - Implemented strict Zod schemas (`src/lib/validators/documents.ts`) for PDF/TXT/DOCX upload payloads (`FR-DOC-002..003`), grounded Q&A (`FR-DOC-007`), and document-to-summary/notes/quiz/flashcards generation (`FR-DOC-008`).
  - Implemented the RAG extraction, chunking, retrieval, and prompt-injection sandboxing engine (`src/modules/documents/rag-engine.ts`) with `<untrusted_document_chunk>` wrapping (`sanitizeUntrustedChunkText`, `formatSandboxedDocumentContext` — `FR-AI-008`), page & section citations (`FR-DOC-009`), and honest retrieval mode reporting (`getActiveRetrievalMode` — `FR-DOC-011`).
  - Implemented `MongooseDocumentRepository` and `InMemoryDocumentRepository` (`src/modules/documents/document-repository.ts`) persisting `uploadedMaterials` and `documentChunks`.
  - Implemented `document-service.ts` (`src/modules/documents/document-service.ts`) enforcing durable status transitions (`uploaded -> extracting -> chunking -> indexing -> ready`), strict user ownership isolation (`FR-DOC-011`), grounded Q&A, derivative generation (`summary`, `notes`, `quiz`, `flashcards`), and document deletion with chunk index cleanup (`FR-DOC-010`).
  - Built `/api/v1/documents` and `/api/v1/documents/[documentId]` Route Handlers, plus the interactive Student Document & Grounded RAG Workspace UI (`/documents`).
- **State 10 — Personalized Study Planner**:
  - Implemented strict Zod schemas (`src/lib/validators/planner.ts`) for study plan creation, configuration updates, schedule recalculation (`action: 'recalculate'`), missed-task rescheduling (`action: 'reschedule_missed'`), and manual task CRUD (`FR-PLAN-001..008`).
  - Implemented the deterministic preparation roadmap & scheduling engine (`src/modules/planner/scheduler-engine.ts`) allocating daily tasks (`learn_topic`, `revision`, `practice_quiz`, `flashcard_review`, `mock_exam`, `final_revision`) across available study days (`availableDaysOfWeek`) and `dailyStudyMinutes`, building weekly milestones, and enforcing `FR-PLAN-011` (never inventing official examination weightings when `syllabusWeightVerified` is false).
  - Implemented `MongooseStudyPlanRepository` and `InMemoryStudyPlanRepository` (`src/modules/planner/planner-repository.ts`) persisting `studyPlans` and `studyTasks`.
  - Implemented `planner-service.ts` (`src/modules/planner/planner-service.ts`) integrating verified student performance signals (`quizAttempts.weakTopicIds` and overdue/difficult `flashcards` — `FR-PLAN-009`, `FR-PLAN-010`) with AI advisor summaries (`executeStructuredAITask` for `taskType: 'planner'`).
  - Built `/api/v1/study-plans`, `/api/v1/study-plans/[planId]`, and `/api/v1/study-tasks/[taskId]` Route Handlers, plus the interactive Student Study Planner UI (`/planner`) with List, Calendar, and Roadmap/Milestones views (`FR-PLAN-005`).

## Current Implementation

- Completed State 10 (Personalized Study Planner).
- Ready to transition to State 11 (Analytics, Notifications and Gamification) upon user instruction.

## Technical Decisions

- **ADR-001..007**: Modular monolith on Next.js App Router, `npm`, 27 normalized Mongoose collections, OpenRouter gateway, hybrid RAG, deterministic SM-2/scheduler, pluggable storage.
- **State 09 Grounded RAG & Prompt-Injection Defense Architecture**: Every retrieved document chunk is sanitized (`sanitizeUntrustedChunkText`) and wrapped inside `<untrusted_document_chunk index="N" page="P" section="S">` before interpolation into the `document_qa` prompt template, preventing untrusted PDF/DOCX/TXT passages from overriding system instructions. `getActiveRetrievalMode()` reports `'keyword'` unless both `OPENROUTER_EMBEDDING_MODEL` and `ATLAS_VECTOR_INDEX_NAME` are configured (`FR-DOC-011`).
- **State 10 Deterministic Scheduling & Honest Syllabus Weighting (`FR-PLAN-011`)**: `scheduler-engine.ts` computes all calendar dates, daily minute capacities, and weekly milestones deterministically. Official syllabus priority scores are applied strictly when `topic.syllabusWeightVerified === true`; otherwise topics are ordered by topological prerequisites, verified quiz weak-topic diagnostics, due spaced-repetition flashcards, and student proficiency estimates.

## Database Status

- Completed collections: All 27 collections compiled into Mongoose models (`src/models/index.ts`); active repositories implemented for `users`, `educationSystems`, `educationLevels`, `examinations`, `subjects`, `chapters`, `topics`, `promptTemplates`, `aiUsageLogs`, `appSettings`, `auditLogs`, `conversations`, `messages`, `generatedContents`, `feedbackReports`, `quizzes`, `questions`, `quizAttempts`, `flashcardDecks`, `flashcards`, `reviewLogs`, `uploadedMaterials`, `documentChunks`, `studyPlans`, and `studyTasks`.
- Pending collections: `progressRecords`, `notifications` (State 11).
- Required indexes and migrations: All compound indexes registered in `SCHEMA_REGISTRY` and compiled onto Mongoose schemas.

## Integrations

- MongoDB: CONFIGURED (`.env.local` `MONGODB_URI` present; active repositories for Auth, Curriculum, AI, Tutor/Materials, Quizzes/Exams, Flashcards/Reviews, Documents/RAG, and Study Planner)
- OpenRouter: CONFIGURED (`.env.local` `OPENROUTER_API_KEY` present; centralized gateway active in `src/lib/ai/openrouter-client.ts` & `src/modules/ai/ai-service.ts`)
- Storage: NOT_CONFIGURED (`BLOB_READ_WRITE_TOKEN` empty; local disk metadata adapter used in dev)
- Vercel: NOT_CONFIGURED

## Tests

- Commands executed:
  - `npm run typecheck` (`tsc --noEmit`)
  - `npm run lint` (`node scripts/lint.mjs`)
  - `npm test` (`vitest run`)
  - `npm run build` (`next build`)
- Passed tests: 41/41 unit & integration tests across `state-01-architecture.test.ts` (6), `state-02-scaffold.test.ts` (3), `state-03-auth-onboarding.test.ts` (6), `state-04-curriculum-cms.test.ts` (5), `state-05-ai-infrastructure.test.ts` (5), `state-06-tutor-materials.test.ts` (4), `state-07-quizzes-exams.test.ts` (3), `state-08-flashcards-sm2.test.ts` (3), `state-09-documents-rag.test.ts` (3), and `state-10-study-planner.test.ts` (3); 0 lint or typecheck errors; production build succeeded across all 60 routes.
- Failed tests: None.
- Unresolved issues: None.

## Known Issues

- None blocking State 11.

## User Feedback

- Add `.gitignore` according to the project structure.
- Commit and push changes to GitHub (`origin main`) after finishing each state.

## Next Action

- Exact next implementation state: **State 11 — Analytics, Notifications and Gamification**.
- First task to execute: Implement repositories and services for `progressRecords` and `notifications`, calculate subject-wise performance & topic mastery estimates from verified quiz attempts, flashcard reviews, and completed study tasks, implement learning streaks, milestones, explainable adaptive recommendations, `/api/v1/analytics/*` & `/api/v1/notifications/*` endpoints, and integrate the Student `/dashboard`, `/analytics`, and `/notifications` UI pages.
- Relevant files to inspect: `Context.md`, `docs/PROJECT_SRS.md` (Sections 4.10 & 4.11), `src/app/(student)/dashboard/page.tsx`.
