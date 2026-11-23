# LearnMate AI — Remediation Context

## Current Status
CURRENT_PHASE: 01
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
1. **Academic & Chapter Navigation Clutter**: `src/app/(student)/my-learning/page.tsx` now reflects custom labels and tags, but still renders the 6-column filter bar without Subject/Chapter workspace panels or mobile drawer navigation (scheduled for **Phase 02**).
2. **Notifications & Missing Global Toast System**: `/notifications` lacks `read` filter, category grouping, dismiss/delete, pagination, and rendered timestamps; `sonner` and shared shadcn dialog/sheet/switch/progress primitives are scheduled for **Phase 02**.
3. **Fragmented AI Orchestration**: `ai-service.ts` lacks `AIHarnessManager`, capability-aware `ModelRouter`, `TaskRouter`, `ToolRegistry`, persisted `userHarnessSettings`, and durable MongoDB `aiJobs` worker (scheduled for **Phase 03**).
4. **AI Tutor Lacks Web Research & AI Elements**: Lacks external web search adapter, SSRF-safe webpage fetcher, verifiable external citations, `Sources`/`InlineCitation`/`Tool` AI Elements, and stop/regenerate controls (scheduled for **Phase 04**).
5. **Workflow Polish Gaps**: Study Materials (`/materials`), Flashcards (`/flashcards`), and Study Planner (`/planner`) need guided wizards, 3D card flip/real review timer, and harness integration (scheduled for **Phases 05–07**).
6. **Vercel-Incompatible RAG Pipeline**: Client `file.text()` + JSON upload, missing `@vercel/blob` storage adapter, regex extraction, inline sync processing, and embedding env mismatch (scheduled for **Phase 08**).

## Completed Phases
- **Original SRS States 00–12 (COMPLETE — `d83eee5`)**: Next.js 15 App Router baseline, Auth/RBAC, Global Curriculum CMS, OpenRouter gateway, Tutor/Materials, Quizzes, SM-2 Flashcards, Documents/RAG baseline, Deterministic Planner, Analytics/Notifications, Error hardening.
- **Phase 00 — Existing Project Audit and Remediation Planning (COMPLETE — `9f57417`)**: Full codebase & official docs audit (`docs/REMEDIATION_AUDIT.md`, `docs/REMEDIATION_PLAN.md`).
- **Phase 01 — Custom Education System and Data Architecture (COMPLETE)**:
  - Extended schemas in `src/types/domain.ts`, `src/lib/database/schema-registry.ts`, and `src/modules/curriculum/seed-data.ts` across all 6 curriculum collections (`scope: 'global' | 'custom'`, `ownerUserId`, `isArchived`, flexible optional `educationLevelId`, custom system/exam/subject/chapter fields) plus 28th collection `educationLabelConfigs`.
  - Created client-safe terminology/hierarchy presets (`src/config/education-presets.ts`) decoupling UI labels from entity records.
  - Built idempotent migration helper & CLI script (`src/lib/database/migrations/custom-education-migration.ts`, `scripts/migrate-custom-education.ts`).
  - Implemented `src/lib/validators/custom-education.ts`, `src/modules/curriculum/custom-education-service.ts`, and 14 API endpoints (`/api/v1/education/*`) with strict ownership isolation & safe cascade/unlink rules.
  - Integrated custom systems, exams, and subjects across Curriculum Browse, Onboarding (`Option A: Standard` / `Option B: Custom`), AI Tutor, Materials, Quizzes, Flashcards, Study Planner, Documents, Analytics, Settings (`/settings/education` studio), `useEducationLabels` hook, and `/my-learning`.

## Current Phase
- **Objective**: Phase 01 implemented and verified with 53/53 passing tests and clean production build.
- **Files Created/Updated**: Schema registry, custom education service & validators, idempotent migration script, `/api/v1/education/*` routes, `CustomEducationStudio` UI (`/settings/education`), updated Onboarding/Settings/My Learning, cross-module ownership enforcement, `tests/phase-01-custom-education.test.ts`.

## Education Architecture
- **Current Schemas**: 28 compiled collections (`27` SRS collections + `educationLabelConfigs`) with owner-partitioned unique indexes on `educationSystems`, `educationLevels`, `examinations`, `subjects`.
- **Custom Education Support**: ACTIVE — Standard global catalog preserved; students can create/edit/duplicate/archive/delete personal education systems, custom labels/hierarchies, custom examinations, custom subjects, chapters, and topics.
- **Migration Status**: COMPLETE & VERIFIED IDEMPOTENT — Executed `scripts/migrate-custom-education.ts` against live MongoDB Atlas (`educationSystems: 3`, `educationLevels: 5`, `examinations: 4`, `subjects: 6`, `chapters: 6`, `topics: 9` backfilled, 4 legacy single-tenant unique indexes replaced, 7 collections index-synced, follow-up `--dry-run` confirmed `0` pending updates).

## AI Harness
- **Orchestrator / Worker / Tools**: Baseline OpenRouter gateway active; centralized `AIHarnessManager` & durable `aiJobs` queue scheduled for **Phase 03**.
- **Model Configuration**: `OPENROUTER_API_KEY` active in `.env.local`, default `openrouter/free`.
- **Search Provider Status**: Not yet implemented (**Phase 04**).

## RAG
- **Storage / Extraction / Embeddings / Worker**: Baseline keyword RAG active cleanly with custom subject/topic ownership guards; Vercel Blob + binary extractors + durable `aiJobs` rework scheduled for **Phase 08**.

## UI/UX
- **Installed shadcn/ui Primitives (8)**: `badge`, `button`, `card`, `input`, `separator`, `skeleton`, `tabs`, `tooltip`.
- **Phase 01 Additions**: `CustomEducationStudio` (`/settings/education`), Option A/B onboarding track, dynamic custom label resolution in `my-learning`.
- **Upcoming Phase 02**: Install `sonner`, `alert`, `alert-dialog`, `dialog`, `sheet`, `select`, `switch`, `progress`, etc.; redesign Notifications Center & Academic/Chapter Navigation.

## Testing
- **Commands Executed (Phase 01 Verification)**: `npm run typecheck && npm run lint && npm test && npm run build`
- **Passed**: TypeScript `0` errors; Lint `0` violations across 157 source files; Vitest `53/53` passing across 13 suites (`state-01`..`12` + `phase-01-custom-education.test.ts`); `next build` production bundle compiled with 0 errors.
- **Failed**: None.
- **Outstanding Tests**: `phase-02`..`phase-09` test suites and Playwright E2E + Vercel Preview RAG verification.

## Blockers
- None blocking **Phase 02** or **Phase 03**.
- Future external config needed ahead of later phases: Web Search API key (`TAVILY_API_KEY` or `BRAVE_SEARCH_API_KEY`) before Phase 04; `BLOB_READ_WRITE_TOKEN` & Vercel preview before Phase 08.

## User Feedback
- Keep `.gitignore` accurate, commit and push changes to GitHub (`origin main`) after every completed phase.
- Complete **one phase per user invocation** (`Continue from Context.md`) and stop after outputting the report.

## Next Action
- **Exact Next Phase**: **Phase 02 — Academic Navigation, Notifications and Global UI**.
- **First Tasks**:
  1. Add missing shadcn/ui primitives via CLI (`sonner`, `alert`, `alert-dialog`, `dialog`, `sheet`, `select`, `switch`, `progress`, `dropdown-menu`, `hover-card`, `collapsible`, `scroll-area`, `textarea`, `label`, `checkbox`, `slider`) and mount `<Toaster />` + `src/lib/ui/toast.ts` in `AppProviders`.
  2. Extend notifications schema/API (`NOTIFICATION_TYPES` categories, `all|unread|read`, category filters, pagination, delete/dismiss, preferences) and redesign `src/app/(student)/notifications/page.tsx` cleanly separated from transient Sonner toasts.
  3. Redesign `src/app/(student)/my-learning/page.tsx` to eliminate the redundant 6-dropdown filter bar in favor of a progressive Subject & Chapter workspace with desktop collapsible sidebar, mobile `Sheet` drawer, Previous/Next chapter navigation, and dynamic custom labels.
- **Key Files to Inspect First**: `Context.md`, `docs/REMEDIATION_PLAN.md`, `src/app/(student)/notifications/page.tsx`, `src/app/api/v1/notifications/route.ts`, `src/modules/analytics/analytics-repository.ts`, `src/app/(student)/my-learning/page.tsx`, `src/components/providers/app-providers.tsx`.
