# LearnMate AI — Remediation Context

## Current Status
CURRENT_PHASE: 00
STATUS: COMPLETE

> **Baseline Note:** Original SRS States 00–12 are COMPLETE at commit `d83eee5` (47/47 Vitest tests passing across 12 suites; typecheck, lint, and production build green). Original **State 13 (Deployment and Production Readiness)** will execute immediately after Remediation Phases `01`–`09` complete.

## Permanent Specification
- Requirements: [docs/PROJECT_SRS.md](docs/PROJECT_SRS.md)
- Architecture & ADRs: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DECISIONS.md](docs/DECISIONS.md)

## Remediation Audit
[docs/REMEDIATION_AUDIT.md](docs/REMEDIATION_AUDIT.md)

## Remediation Plan
[docs/REMEDIATION_PLAN.md](docs/REMEDIATION_PLAN.md)

## Current Issues
1. **Custom Education Missing**: All 6 curriculum collections (`educationSystems`, `educationLevels`, `examinations`, `subjects`, `chapters`, `topics`) are global admin-only (`ownershipScope: 'curriculum_cms'`); no custom systems, custom label configs (`educationLabelConfigs`), flexible hierarchies, custom exams, or custom subjects exist.
2. **Academic & Chapter Navigation Clutter**: `src/app/(student)/my-learning/page.tsx` shows a dense 6-column `<select>` filter grid without structured subject/chapter workspaces or mobile drawer navigation.
3. **Notifications & Feedback Deficits**: `/notifications` lacks `read` filter, category grouping (quizzes, AI/document jobs, system), dismiss/delete, pagination, card timestamps, and compact Preferences drawer; app lacks global shadcn `Sonner` toast system (`sonner` not installed).
4. **Fragmented AI Orchestration**: `ai-service.ts` lacks `AIHarnessManager`, capability-aware `ModelRouter`, `TaskRouter`, `ToolRegistry`, persisted `userHarnessSettings`, and durable MongoDB `aiJobs` worker (`src/lib/jobs/processor.ts` only has pure transition checks).
5. **AI Tutor Lacks Web Research & AI Elements**: No web search adapter, SSRF-safe webpage fetcher, verifiable external citations, `Sources`/`InlineCitation`/`Tool` AI Elements components, or stop/regenerate controls.
6. **Workflow Polish Gaps**: Study Materials (`/materials`), Flashcards (`/flashcards`), and Study Planner (`/planner`) need guided creation wizards, workspace organization tabs, 3D card flip/real review timer, and unified AI Harness integration.
7. **Vercel-Incompatible RAG Pipeline**: `src/app/(student)/documents/page.tsx` runs `file.text()` on PDF/DOCX binaries and posts JSON to `/api/v1/documents` (corrupting binaries & hitting Vercel's 4.5 MB limit); `src/lib/storage/adapter.ts` has no `@vercel/blob` implementation; extraction uses naive regexes; jobs run inline synchronously; `.env.example` (`AI_EMBEDDING_MODEL`) and `rag-engine.ts` (`OPENROUTER_EMBEDDING_MODEL`) diverge; Atlas `$vectorSearch` query path missing.

## Completed Phases
- **Original SRS States 00–12 (COMPLETE — commit `d83eee5`)**: Next.js 15 App Router scaffold, 27 compiled Mongoose collections, Auth/RBAC, Global Curriculum CMS seeding, OpenRouter gateway, Tutor & Materials UI overhaul, Quizzes, SM-2 Flashcards, Documents/RAG baseline, Deterministic Study Planner, Analytics/Notifications/Gamification, and error-handling hardening.
- **Phase 00 — Existing Project Audit and Remediation Planning (COMPLETE)**: Inspected repository, schemas, APIs, UI primitives, OpenRouter gateway, RAG pipeline, and Vercel constraints; researched official shadcn AI Elements, Sonner, web search security, and Vercel Blob/serverless constraints; authored `docs/REMEDIATION_AUDIT.md`, `docs/REMEDIATION_PLAN.md`, and updated `Context.md`.

## Current Phase
- **Objective**: Phase 00 audit & planning completed with zero regressions to existing codebase.
- **Files Created/Updated**: `docs/REMEDIATION_AUDIT.md`, `docs/REMEDIATION_PLAN.md`, `Context.md`.
- **Progress**: Ready to start Phase 01 on next user `Continue from Context.md`.

## Education Architecture
- **Current Schemas**: Global 6-tier `educationSystems` → `educationLevels` → `examinations` → `subjects` → `chapters` → `topics` in `src/lib/database/schema-registry.ts`.
- **Custom Education Support**: Not yet implemented (target of Phase 01: `scope: 'global' | 'custom'`, `ownerUserId`, `educationLabelConfigs`, `hierarchyLevels`, custom exam/subject metadata).
- **Migration Status**: Pending Phase 01 idempotent backfill script (`scripts/migrate-custom-education.ts`).

## AI Harness
- **Orchestrator Status**: Baseline `src/modules/ai/ai-service.ts` active (`executeAITask`, `executeStructuredAITask`, `streamAITask`); centralized `AIHarnessManager` scheduled for Phase 03.
- **Worker Status**: State transition helper only (`src/lib/jobs/processor.ts`); durable MongoDB `aiJobs` queue scheduled for Phase 03.
- **Task Profiles / Tool Registry**: Pending Phase 03 (`AI_TASK_REGISTRY` in `src/lib/ai/config.ts` covers model env overrides only).
- **Model Configuration**: `OPENROUTER_API_KEY` active in `.env.local`, default `openrouter/free`.
- **Search Provider Status**: Not yet implemented (Phase 04).

## RAG
- **Storage Provider**: Interface/validator only (`src/lib/storage/adapter.ts`); `BLOB_READ_WRITE_TOKEN` not yet configured; `@vercel/blob` not installed (Phase 08).
- **Extraction Status**: Broken client `file.text()` + naive regex fallback in `rag-engine.ts` (Phase 08 binary extraction rework needed).
- **Embedding Provider / Retrieval Strategy**: Unconfigured (`keyword` fallback active cleanly; `$vectorSearch` + env mismatch fix scheduled for Phase 08).
- **Worker/Queue & Deployment Verification**: Inline synchronous currently; durable `aiJobs` worker + Vercel Preview test scheduled for Phase 08.

## UI/UX
- **Installed shadcn/ui Primitives (8)**: `badge`, `button`, `card`, `input`, `separator`, `skeleton`, `tabs`, `tooltip`.
- **Missing Primitives**: `sonner`, `alert`, `alert-dialog`, `dialog`, `sheet`, `select`, `switch`, `progress`, `dropdown-menu`, `hover-card`, `collapsible`, `scroll-area`, `textarea`, `label`, `checkbox`, `slider` (scheduled for Phase 02).
- **AI Elements (`src/components/ai-elements/`)**: None yet (scheduled for Phase 04).

## Testing
- **Commands Executed (Phase 00 Verification)**: `npm run typecheck && npm run lint && npm test`
- **Passed**: TypeScript `0` errors; Lint `0` violations; Vitest `47/47` passing across 12 test suites (`state-01`..`state-12`).
- **Failed**: None.
- **Outstanding Tests**: `phase-01`..`phase-09` test suites and live Playwright E2E + Vercel Preview RAG tests (to be executed per phase).

## Blockers
- None blocking **Phase 01**, **Phase 02**, or **Phase 03**.
- Future external config needed ahead of later phases: Web Search API key (`TAVILY_API_KEY` or `BRAVE_SEARCH_API_KEY`) before Phase 04 live verification; Vercel Blob token (`BLOB_READ_WRITE_TOKEN`) & Vercel preview environment before Phase 08 production verification.

## User Feedback
- Keep `.gitignore` accurate, commit and push changes to GitHub (`origin main`) at the end of every completed state/phase.
- Do not rebuild from scratch; preserve working functionality, existing data, and passing tests.
- Complete **one phase per user invocation** (`Continue from Context.md`) and stop after the report.

## Next Action
- **Exact Next Phase**: **Phase 01 — Custom Education System and Data Architecture**.
- **First Tasks**:
  1. Inspect existing curriculum records in MongoDB (if accessible) and finalize additive schemas in `src/types/domain.ts` & `src/lib/database/schema-registry.ts` (`scope`, `ownerUserId`, `isArchived`, `educationLabelConfigs`, `hierarchyLevels`, custom exam/subject fields, safe compound indexes).
  2. Write idempotent migration/backfill script `scripts/migrate-custom-education.ts`.
  3. Build custom education Zod validators, repository extensions, `custom-education-service.ts`, and `/api/v1/education/*` CRUD + onboarding/curriculum integration endpoints with strict ownership guards.
  4. Build Custom Education & Label customization UI + unit/integration test suite `tests/phase-01-custom-education.test.ts`.
- **Key Files to Inspect First**: `Context.md`, `docs/REMEDIATION_PLAN.md`, `src/lib/database/schema-registry.ts`, `src/modules/curriculum/curriculum-repository.ts`, `src/modules/curriculum/curriculum-service.ts`, `src/lib/validators/curriculum.ts`.
