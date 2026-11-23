# LearnMate AI — Remediation Context

## Current Status
CURRENT_PHASE: 02
STATUS: COMPLETE

> **Baseline Note:** Original SRS States 00–12 are COMPLETE at commit `d83eee5`. Original **State 13 (Deployment and Production Readiness)** will execute immediately after Remediation Phases `01`–`09` complete.

## Permanent Specification
- Requirements: [docs/PROJECT_SRS.md](docs/PROJECT_SRS.md)
- Architecture & ADRs: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DECISIONS.md](docs/DECISIONS.md)

## Remediation Audit
[docs/REMEDIATION_AUDIT.md](docs/REMEDIATION_AUDIT.md)

## Remediation Plan
[docs/REMEDIATION_PLAN.md](docs/REMEDIATION_PLAN.md)

## Current Issues
1. **Fragmented AI Orchestration**: `ai-service.ts` lacks `AIHarnessManager`, capability-aware `ModelRouter`, `TaskRouter`, `ToolRegistry`, persisted `userHarnessSettings`, and durable MongoDB `aiJobs` worker (scheduled for **Phase 03**).
2. **AI Tutor Lacks Web Research & AI Elements**: Lacks external web search adapter, SSRF-safe webpage fetcher, verifiable external citations, `Sources`/`InlineCitation`/`Tool` AI Elements, and stop/regenerate controls (scheduled for **Phase 04**).
3. **Workflow Polish Gaps**: Study Materials (`/materials`), Flashcards (`/flashcards`), and Study Planner (`/planner`) need guided wizards, 3D card flip/real review timer, and harness integration (scheduled for **Phases 05–07**).
4. **Vercel-Incompatible RAG Pipeline**: Client `file.text()` + JSON upload, missing `@vercel/blob` storage adapter, regex extraction, inline sync processing, and embedding env mismatch (scheduled for **Phase 08**).

## Completed Phases
- **Original SRS States 00–12 (COMPLETE — `d83eee5`)**: Next.js 15 App Router baseline, Auth/RBAC, Global Curriculum CMS, OpenRouter gateway, Tutor/Materials, Quizzes, SM-2 Flashcards, Documents/RAG baseline, Deterministic Planner, Analytics/Notifications, Error hardening.
- **Phase 00 — Existing Project Audit and Remediation Planning (COMPLETE — `9f57417`)**: Full codebase & official docs audit (`docs/REMEDIATION_AUDIT.md`, `docs/REMEDIATION_PLAN.md`).
- **Phase 01 — Custom Education System and Data Architecture (COMPLETE — `56b6349`)**:
  - Extended schemas in `src/types/domain.ts`, `src/lib/database/schema-registry.ts`, and `src/modules/curriculum/seed-data.ts` across all 6 curriculum collections (`scope: 'global' | 'custom'`, `ownerUserId`, `isArchived`, flexible optional `educationLevelId`, custom system/exam/subject/chapter fields) plus 28th collection `educationLabelConfigs`.
  - Created client-safe terminology/hierarchy presets (`src/config/education-presets.ts`) decoupling UI labels from entity records.
  - Built idempotent migration helper & CLI script (`src/lib/database/migrations/custom-education-migration.ts`, `scripts/migrate-custom-education.ts`) and executed against live MongoDB Atlas.
  - Implemented `src/lib/validators/custom-education.ts`, `src/modules/curriculum/custom-education-service.ts`, and 14 API endpoints (`/api/v1/education/*`) with strict ownership isolation & safe cascade/unlink rules.
  - Integrated custom systems, exams, and subjects across Curriculum Browse, Onboarding (`Option A: Standard` / `Option B: Custom`), AI Tutor, Materials, Quizzes, Flashcards, Study Planner, Documents, Analytics, Settings (`/settings/education` studio), `useEducationLabels` hook, and `/my-learning`.
- **Phase 02 — Academic Navigation, Notifications and Global UI (COMPLETE)**:
  - Installed missing shadcn/ui primitives (now 23 components under `src/components/ui/`), added Tailwind v4 `@theme inline` tokens in `src/app/globals.css`, created `src/lib/ui/toast.ts` (`notify` + `sanitizeToastError`), mounted global `<Toaster position="bottom-right" richColors closeButton />` in `AppProviders`, built reusable `ConfirmDialog` (`src/components/shared/confirm-dialog.tsx`) & `InlineAlert` (`src/components/shared/page-states.tsx`), and wired them into Settings (`/settings`), Onboarding (`/onboarding`), and Custom Education Studio.
  - Extended Notifications backend (`src/types/domain.ts`, `src/config/notifications-catalog.ts`, `src/modules/auth/user-repository.ts`, `src/lib/validators/analytics-notifications.ts`, `src/modules/analytics/analytics-repository.ts`, `src/modules/analytics/analytics-service.ts`, `src/app/api/v1/notifications/route.ts`) with categories (`study`, `quiz_exam`, `flashcards`, `ai_documents`, `system`), `all|unread|read` status filtering, `mark_unread`, `dismiss`, `clear_read`, pagination (`hasMore`), `DELETE` endpoint, and 7 notification preference toggles.
  - Redesigned `/notifications` with `NotificationCenter` (`src/components/notifications/notification-center.tsx`) and added live header `HeaderNotificationBell` (`src/components/notifications/header-notification-bell.tsx`) in `AppShell`, keeping MongoDB notifications strictly separated from transient Sonner UI toasts.
  - Redesigned `/my-learning` with `AcademicWorkspace` (`src/components/learning/academic-workspace.tsx`, `<Suspense>` wrapper, and pure helpers in `src/lib/learning/navigation-helpers.ts`): replaced permanent 6-dropdown filter bar with compact Breadcrumb + Switch Context `Dialog`, Subject overview cards with completion `Progress`, desktop `Collapsible` chapter sidebar + mobile `Sheet` drawer, `Previous` / `Next` chapter controls, topic completion toggles (`POST /api/v1/analytics`), bookmarking (`POST /api/v1/topics/saved`), 1-click learning tool links, and dynamic custom education labels.
  - Added verification tests in `tests/phase-02-notifications-nav.test.ts` (5 passing tests).

## Current Phase
- **Objective**: Phase 02 implemented, reviewed, and verified with 58/58 passing tests and clean production build.
- **Files Created/Updated**: shadcn/ui primitives & `globals.css` theme tokens, `src/lib/ui/toast.ts`, `ConfirmDialog`, `InlineAlert`, `HeaderNotificationBell`, `notifications-catalog.ts`, extended notification service/API/preferences, `NotificationCenter` (`/notifications`), `AcademicWorkspace` (`/my-learning`, `src/lib/learning/navigation-helpers.ts`), Settings/Onboarding/Education Studio feedback wiring, `tests/phase-02-notifications-nav.test.ts`.

## Education Architecture
- **Current Schemas**: 28 compiled collections (`27` SRS collections + `educationLabelConfigs`) with owner-partitioned unique indexes on `educationSystems`, `educationLevels`, `examinations`, `subjects`.
- **Custom Education Support**: ACTIVE — Standard global catalog preserved; students can create/edit/duplicate/archive/delete personal education systems, custom labels/hierarchies, custom examinations, custom subjects, chapters, and topics.
- **Migration Status**: COMPLETE & VERIFIED IDEMPOTENT against live MongoDB Atlas in Phase 01 (`0` pending updates on `--dry-run`).

## AI Harness
- **Orchestrator / Worker / Tools**: Baseline OpenRouter gateway active; centralized `AIHarnessManager` & durable `aiJobs` queue scheduled for **Phase 03**.
- **Model Configuration**: `OPENROUTER_API_KEY` active in `.env.local`, default `openrouter/free`.
- **Search Provider Status**: Not yet implemented (**Phase 04**).

## RAG
- **Storage / Extraction / Embeddings / Worker**: Baseline keyword RAG active cleanly with custom subject/topic ownership guards; Vercel Blob + binary extractors + durable `aiJobs` rework scheduled for **Phase 08**.

## UI/UX
- **Installed shadcn/ui Primitives (23)**: `alert`, `alert-dialog`, `badge`, `button`, `card`, `checkbox`, `collapsible`, `dialog`, `dropdown-menu`, `hover-card`, `input`, `label`, `progress`, `scroll-area`, `select`, `separator`, `sheet`, `skeleton`, `sonner`, `switch`, `tabs`, `textarea`, `tooltip`.
- **Phase 02 Additions**: Global `<Toaster />` (`AppProviders`), `src/lib/ui/toast.ts`, `ConfirmDialog`, `InlineAlert`, `HeaderNotificationBell` (`AppShell`), SaaS `NotificationCenter` (`/notifications`), progressive `AcademicWorkspace` (`/my-learning`).

## Testing
- **Commands Executed (Phase 02 Verification)**: `npm run typecheck && npm run lint && npm test && npm run build`
- **Passed**: TypeScript `0` errors; Lint `0` violations across `179` source files; Vitest `58/58` passing across `14` suites (`state-01`..`12` + `phase-01-custom-education.test.ts` + `phase-02-notifications-nav.test.ts`); `next build` production bundle compiled with 0 errors.
- **Failed**: None.
- **Outstanding Tests**: `phase-03`..`phase-09` test suites and Playwright E2E + Vercel Preview RAG verification.

## Blockers
- None blocking **Phase 03**.
- Future external config needed ahead of later phases: Web Search API key (`TAVILY_API_KEY` or `BRAVE_SEARCH_API_KEY`) before Phase 04; `BLOB_READ_WRITE_TOKEN` & Vercel preview before Phase 08.

## User Feedback
- Keep `.gitignore` accurate, commit and push changes to GitHub (`origin main`) after every completed phase.
- Complete **one phase per user invocation** (`Continue from Context.md`) and stop after outputting the report.

## Next Action
- **Exact Next Phase**: **Phase 03 — Centralized Agentic AI Harness and Durable Worker Infrastructure**.
- **First Tasks**:
  1. Add `userHarnessSettings` & `aiJobs` collections and extend `aiUsageLogs` (`toolsInvoked`, `jobId`) in `src/lib/database/schema-registry.ts`, `src/models/index.ts`, and `src/types/domain.ts`.
  2. Build core harness modules under `src/modules/ai/harness/` (`model-router.ts`, `task-router.ts`, `tool-registry.ts`, `harness-manager.ts`, `job-worker.ts`).
  3. Expose `/api/v1/ai/harness-settings` (`GET`, `PUT`) and `/api/v1/jobs`, `/api/v1/jobs/[jobId]`, `/api/v1/jobs/process`; migrate existing AI callers (`quiz-service.ts`, `flashcard-service.ts`, `planner-service.ts`, `analytics-service.ts`, `tutor-materials-service.ts`, `document-service.ts`) onto `AIHarnessManager`; add `tests/phase-03-ai-harness.test.ts`.
- **Key Files to Inspect First**: `Context.md`, `docs/REMEDIATION_PLAN.md`, `src/modules/ai/ai-service.ts`, `src/modules/ai/ai-repository.ts`, `src/lib/database/schema-registry.ts`, `src/modules/tutor/tutor-materials-service.ts`, `src/modules/quizzes/quiz-service.ts`.
