# LearnMate AI — Comprehensive Project Reconnaissance & Root-Cause Remediation Audit

**Audit Date:** 2026-11-23  
**Repository Baseline:** Commit `d83eee5` (`main`, SRS States 00–12 complete)  
**Scope:** Existing Next.js App Router codebase, Mongoose schemas, API handlers, AI orchestration, RAG pipeline, shadcn/ui component layer, and Vercel deployment compatibility.

---

## 1. Executive Summary & Repository Baseline

LearnMate AI is implemented as a TypeScript Next.js `15.3.0` (App Router, Node.js runtime) + React `19.1.0` + MongoDB/Mongoose `8.13.1` + OpenRouter modular monolith (`package.json`, `docs/ARCHITECTURE.md`). Across SRS States 00–12, core authentication, curriculum CMS seeding, AI Tutor/Materials, Quizzes, Flashcards, Documents/RAG, Study Planner, Analytics, Notifications, and error normalization were implemented with **27 registered collections** (`src/lib/database/schema-registry.ts`), **38 API Route Handlers** under `src/app/api/v1/`, and **47 passing Vitest unit/integration tests across 12 test files**.

However, deep code inspection reveals fundamental architectural, UX, and deployment-readiness gaps that prevent the application from meeting production SaaS expectations:

1. **Rigid Global-Only Academic Hierarchy**: All 6 curriculum collections (`educationSystems`, `educationLevels`, `examinations`, `subjects`, `chapters`, `topics`) are strictly administrator-managed (`ownershipScope: 'curriculum_cms'`). Students cannot create custom education systems, custom label terminologies, flexible hierarchies, custom examinations, or custom subjects, and `src/app/(student)/my-learning/page.tsx` exposes a dense 6-dropdown cascading filter bar on the primary screen.
2. **Disconnected Feature AI Pipelines & Unconfigured Web Research**: `src/modules/ai/ai-service.ts` provides low-level OpenRouter calls (`executeAITask`, `executeStructuredAITask`, `streamAITask`), while each feature service (`tutor-materials-service.ts`, `quiz-service.ts`, `flashcard-service.ts`, `document-service.ts`, `planner-service.ts`, `analytics-service.ts`) independently builds context, prompts, and fallback logic. There is no Agentic AI Harness Manager, Task/Model Router with provider capability metadata, Tool Registry, persisted per-user Harness Settings, external Web Search / SSRF-safe Fetcher, or shadcn AI Elements UI.
3. **Vercel-Incompatible RAG Pipeline**: `src/app/(student)/documents/page.tsx` calls `file.text()` on binary PDF/DOCX files in the browser, posts raw text inside a JSON request body to `POST /api/v1/documents`, never uses `StorageAdapter.putObject()` (`src/lib/storage/adapter.ts` has no Vercel Blob implementation), uses trivial regex parsing instead of binary PDF/DOCX extractors, runs extraction inline in a single serverless request, lacks durable job persistence (`src/lib/jobs/processor.ts` only contains status transition helpers), and checks mismatched embedding env vars (`AI_EMBEDDING_MODEL` in `.env.example` vs `OPENROUTER_EMBEDDING_MODEL` in `src/modules/documents/rag-engine.ts`).
4. **Notification & Feedback Layer Deficits**: Notifications lack read/category filtering (`read`, `quiz_exam`, `ai_generation`, `document_processing`, `system`), dismissal/deletion, pagination, timestamps on cards, and a separate global transient feedback layer (`sonner` is not installed; `src/components/ui/` contains only 8 primitives).
5. **Underdeveloped Interactive Workflows**: Study Materials, Flashcards, and Study Planner work functionally in dev/tests but rely on dense monolithic forms or basic CRUD layouts rather than guided step-by-step creation workflows, smooth flip/review ergonomics, or full custom-education integration.

### 1.1 Installed Stack, UI Primitives & Integration Inventory

| Category | Observed State in Repository |
|---|---|
| **Framework & Runtime** | Next.js `15.3.0`, React `19.1.0`, TypeScript `5.8.3`, Tailwind CSS `v4.1.3`, `components.json` (`new-york`, RSC, Lucide icons) |
| **Installed Packages (`package.json`)** | `@hookform/resolvers`, `class-variance-authority`, `clsx`, `framer-motion`, `lucide-react`, `mongoose`, `next-themes`, `react-hook-form`, `recharts`, `tailwind-merge`, `zod`, `vitest` |
| **Present UI Primitives (`src/components/ui/`)** | `badge.tsx`, `button.tsx`, `card.tsx`, `input.tsx`, `separator.tsx`, `skeleton.tsx`, `tabs.tsx`, `tooltip.tsx` (8 primitives total) |
| **Missing shadcn/ui Primitives Needed** | `sonner` (+ `sonner` npm pkg), `alert`, `alert-dialog`, `dialog`, `sheet`, `select`, `switch`, `progress`, `dropdown-menu`, `hover-card`, `collapsible`, `scroll-area`, `textarea`, `label`, `checkbox`, `slider` |
| **AI Elements (`src/components/ai-elements/`)** | Not yet implemented (0 files) |
| **Database (`Context.md` + `schema-registry.ts`)** | `MONGODB_URI` configured in `.env.local`; 27 SRS collections active (`COLLECTION_NAMES`) |
| **OpenRouter AI** | `OPENROUTER_API_KEY` configured in `.env.local`; default `OPENROUTER_DEFAULT_MODEL=openrouter/free` |
| **Object Storage** | Interface + validator only (`src/lib/storage/adapter.ts`); `@vercel/blob` not installed; `BLOB_READ_WRITE_TOKEN` unset |
| **Background Worker** | Pure state-transition validator only (`src/lib/jobs/processor.ts`); no MongoDB `aiJobs` collection or step runner |
| **Web Search / Embeddings / Vercel** | No external web search adapter; `OPENROUTER_EMBEDDING_MODEL` / `ATLAS_VECTOR_INDEX_NAME` unset; no `vercel.json` |

---

## 2. Detailed Feature & Architecture Audit (10 Problem Areas)

---

### Area 1 — Notifications System

#### Existing Implementation
- **UI**: [`src/app/(student)/notifications/page.tsx`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/app/%28student%29/notifications/page.tsx)
- **API**: [`src/app/api/v1/notifications/route.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/app/api/v1/notifications/route.ts) (`GET`, `PATCH`)
- **Service & Repo**: [`src/modules/analytics/analytics-service.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/modules/analytics/analytics-service.ts), [`src/modules/analytics/analytics-repository.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/modules/analytics/analytics-repository.ts), [`src/lib/validators/analytics-notifications.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/lib/validators/analytics-notifications.ts)
- **Types & Schema**: `NOTIFICATION_TYPES` in [`src/types/domain.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/types/domain.ts#L87-L95) and `notifications` in [`src/lib/database/schema-registry.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/lib/database/schema-registry.ts#L676-L698)

#### Observed Functional & UX Problems
1. **Incomplete Filtering & Missing Categories**: `filterMode` only offers `'all'`, `'unread'`, and 6 raw enum values (`study_reminder`, `upcoming_revision`, `due_flashcards`, `upcoming_exam`, `missed_task`, `learning_milestone`). There is **no `read` filter**, and there are **no categories or notification types** for quiz/examination events, AI generation completion/failure, document processing completion/failure, or system notices.
2. **Missing Dismiss / Delete & Pagination**: `AnalyticsRepository` exposes `markNotificationRead` and `markAllNotificationsRead`, with **no delete/dismiss method** and **no pagination** (hardcoded `limit = 50` in `listNotificationsByUser`, no `skip`/`cursor` or incremental "Load more").
3. **Missing Timestamp & Visual Hierarchy**: `NotificationItem` receives `createdAt`, yet lines 337–385 of `notifications/page.tsx` never render relative or formatted timestamps, category icons, or clean unread indicator dots.
4. **Heavy Top Preferences Card**: The 4-toggle Preferences card (`Notification Preferences (FR-NOTIFY-003)`) is permanently expanded above the filter bar on every visit, pushing actual notifications down the viewport. Preferences also lack granularity for new categories (AI/document jobs, quizzes, system).
5. **Conflated Feedback Model**: Because the app lacks a global toast system, several pages show temporary success/error banners inline (`statusMessage` / `errorMessage`), blurring persistent notification state with transient API feedback.

#### Root Causes
- `NOTIFICATION_TYPES` was scoped narrowly during State 11 to analytics reminders synced on GET, without integrating async AI/document job events or quiz completion events.
- `notifications` API (`GET`/`PATCH`) was implemented as a single non-paginated array response without `DELETE`, query filters, or `limit`/`page` metadata.

#### Security / Data Concerns
- Ensure `deleteNotification` and `markNotificationRead` strictly filter by authenticated `userId` (`_id` + `userId`) and validate ObjectIds to prevent IDOR.

#### Proposed Solution
1. Extend `NOTIFICATION_TYPES` and `notifications` schema/metadata (preserving backward compatibility with existing records) to cover: Study reminders, Quiz & examination events, Flashcard reminders, AI generation & document-processing updates, and System notifications, plus optional `metadata` / `isDismissed` (or safe hard delete owned by user).
2. Add `GET /api/v1/notifications` query params (`status: 'all' | 'unread' | 'read'`, `category`, `page`, `limit`), `PATCH` (`mark_read`, `mark_all_read`, `update_preferences`), and `DELETE /api/v1/notifications` (`dismiss` / `clear_read`).
3. Redesign `/notifications` as a modern SaaS Notification Center using shadcn `Tabs`, `Sheet`/`Dialog` for Preferences, category icons, formatted relative + exact tooltips for timestamps, read/unread visual state, action navigation links, pagination / "Load More", and clean empty/loading/error states.
4. Keep persistent MongoDB notifications strictly separated from transient `Sonner` toasts.

#### Dependencies
- Global `Sonner` + `Dialog`/`Sheet`/`Switch` primitives (Phase 02). AI/document notification emitters hook in during Phases 03 & 08.

#### Acceptance Criteria
- Filters work cleanly for All, Unread, Read, and all 5 SaaS categories.
- Mark individual read, mark all read, dismiss/delete, pagination, and preference toggles persist in MongoDB across reloads.
- Clicking notification CTA navigates directly to the target page/resource.
- Zero conflation between persistent notifications and transient Sonner toasts.

---

### Area 2 — Education System, Custom Labels, Hierarchy, Examinations & Subjects

#### Existing Implementation
- **Schemas**: [`src/lib/database/schema-registry.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/lib/database/schema-registry.ts#L66-L245) (`users`, `educationSystems`, `educationLevels`, `examinations`, `subjects`, `chapters`, `topics`)
- **Service & Repo**: [`src/modules/curriculum/curriculum-service.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/modules/curriculum/curriculum-service.ts), `src/modules/curriculum/curriculum-repository.ts`
- **Onboarding UI**: [`src/app/(student)/onboarding/page.tsx`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/app/%28student%29/onboarding/page.tsx)

#### Observed Functional & UX Problems
1. **Strict Admin-Only Curriculum**: Every curriculum collection uses `ownershipScope: 'curriculum_cms'`. Writes in `curriculum-service.ts` require `curriculum:write` permission (`admin` / `content_manager`). Students cannot create or manage personal education systems, examinations, subjects, chapters, or topics.
2. **Rigid Hardcoded 6-Tier Naming & Structure**: The hierarchy `Education System → Education Level → Examination → Subject → Chapter → Topic` is hardcoded across TypeScript interfaces, repository queries, and UI labels. Students in University systems (`University → Program → Year → Semester → Course → Unit`), Coaching/Certification paths, or Self-Learning paths cannot customize hierarchy tiers or display labels (`Subject` → `Course`/`Module`, `Chapter` → `Unit`/`Section`).
3. **Onboarding Custom Subjects Are Dead Ends**: `onboarding/page.tsx` lets students type a `customSubject` string into `selectedSubjects`, which only stores raw display strings or fails ID-based linking — it never creates a real `subjects` document usable across AI Tutor, Materials, Quizzes, Flashcards, Planner, Documents, and Analytics.
4. **Insufficient Custom Metadata on Exams & Subjects**: `examinations` only stores `code`, `name`, `description`, `examDate`; it lacks `syllabusCoverage`, `totalMarks`, `durationMinutes`, `preparationGoals`, `topicPriorities`, and `isArchived`. `subjects` lacks `color`, `icon`, `difficultyLevel`, and `learningObjectives`.

#### Root Causes
- Initial State 01/04 modeling treated curriculum as a single global catalog owned exclusively by administrators, with unique indexes like `{ code: 1 }` on `educationSystems` and `{ educationLevelId: 1, code: 1 }` on `subjects` that assume flat global uniqueness without an owner partition.

#### Security / Data Concerns
- Allowing students to create custom curriculum entities introduces multi-tenant isolation requirements: a student's custom education system/exam/subject/chapter/topic must NEVER be readable, editable, or linkable by another student, while `'global'` admin-seeded records remain readable by all authenticated users and immutable to students.
- Changing UI labels in `educationLabelConfigs` must ONLY affect presentation metadata and must never mutate or corrupt underlying entity documents or foreign keys.
- Existing `educationSystems`, `educationLevels`, `examinations`, `subjects`, `chapters`, `topics`, and `users` records in MongoDB must continue working identically via idempotent backfill (`scope: 'global'`).

#### Proposed Solution
1. Extend curriculum models cleanly and backward-compatibly:
   - Add `scope: 'global' | 'custom'` (default `'global'`), `ownerUserId?: ObjectId`, `isArchived: Boolean` (default `false`) across `educationSystems`, `educationLevels`, `examinations`, `subjects`, `chapters`, `topics`.
   - Extend `educationSystems` with `educationType` (`standard`, `school`, `university`, `competitive`, `certification`, `self_learning`, `custom`), `preferredLanguage`, `academicYear`, `hierarchyLevels` (validated ordered levels with `key`, `singularLabel`, `pluralLabel`, `required`, `allowMultiple`), and `labelConfig` (singular/plural overrides for standard academic terms without mutating entity records).
   - Add dedicated `educationLabelConfigs` (or embedded + standalone user-scoped label preset support) separating label terminology from entity records cleanly.
   - Extend `examinations` with custom fields (`syllabusCoverage`, `totalMarks`, `durationMinutes`, `preparationGoals`, `topicPriorities`, optional `educationLevelId`, plus duplicate/archive support).
   - Extend `subjects` with `color`, `icon`, `difficultyLevel`, `learningObjectives`, optional `educationLevelId`.
   - Update unique indexes cleanly with sparse/partial or owner-scoped compound keys (`{ scope: 1, ownerUserId: 1, code: 1 }`) so user custom codes never collide with global codes or other users' custom codes, plus idempotent migration script `scripts/migrate-custom-education.ts`.
2. Build user-scoped CRUD + duplicate/archive API endpoints (`/api/v1/education/systems`, `/api/v1/education/labels`, `/api/v1/education/examinations`, `/api/v1/education/subjects`, `/api/v1/education/chapters`, `/api/v1/education/topics`) that enforce `scope === 'custom' && ownerUserId === actor.userId` for student mutations while merging global + user's custom items seamlessly in `/api/v1/curriculum`.

#### Dependencies
- Must complete in **Phase 01** first because Academic Navigation (Phase 02), AI Tutor Context (Phase 04), Study Materials (Phase 05), Flashcards (Phase 06), Study Planner (Phase 07), and RAG document tagging (Phase 08) all consume unified curriculum IDs and custom labels.

#### Acceptance Criteria
- All existing seeded global records (`BD-NCTB`, `SSC`, `HSC`, etc.) backfill safely to `scope: 'global'` with zero data loss.
- Students can choose Standard vs Custom systems, customize academic labels (with instant preview and consistent UI reflection across pages), configure hierarchy levels, and create/edit/duplicate/archive/delete custom exams, subjects, chapters, and topics.
- Cross-user access to private custom records returns `403`/`404`.
- Custom subjects and exams appear cleanly in Tutor, Quizzes, Flashcards, Materials, Planner, Documents, and Analytics.

---

### Area 3 — Subjects, Chapters & Topic Navigation UI

#### Existing Implementation
- [`src/app/(student)/my-learning/page.tsx`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/app/%28student%29/my-learning/page.tsx) (lines 217–734)

#### Observed Functional & UX Problems
1. **Dense 6-Dropdown Filter Bar (`lines 270–350`)**: Screen 1 immediately displays a 6-column `<select>` grid (`1. Education System`, `2. Education Level`, `3. Examination`, `4. Subject`, `5. Chapter`, `6. Difficulty`) even when a student already selected their education system and subjects during onboarding. Selecting a system resets 4 dependent dropdowns.
2. **Flat Topic Dump Instead of Subject & Chapter Workspaces**: Users must manually pull down dropdowns just to see which chapters belong to Physics or move from Chapter 1 to Chapter 2. There is no structured Subject workspace showing chapter cards with topic counts and mastery/completion progress, no persistent Chapter navigation panel (collapsible desktop sidebar + mobile `Sheet`), and no Previous/Next chapter navigation.
3. **Static Labels**: Always renders hardcoded `Education System`, `Level`, `Examination`, `Subject`, `Chapter`, `Topic` instead of honoring the student's configured custom education labels (from Phase 01).

#### Root Causes
- `my-learning/page.tsx` was constructed directly as a 1:1 query-parameter UI mirror over `GET /api/v1/curriculum?educationSystemId=...&chapterId=...` rather than an interactive academic workspace.

#### Proposed Solution
1. Keep the full backend relational chain (`System -> [Custom Levels/Exam] -> Subject -> Chapter -> Topic`), while replacing the 6-dropdown grid with a **Progressive Academic Workspace**:
   - **Active Context Header & Breadcrumbs**: Displays the user's current System / Level / Exam / Subject / Chapter using configured **custom education labels**, with a compact **"Switch Context" Sheet/Dialog** for changing systems/exams when needed (instead of keeping 6 `<select>` boxes open constantly).
   - **Subject View (`/my-learning` subject overview or `/my-learning?subjectId=...`)**: Shows enrolled & custom subjects as rich color/icon-tagged cards with progress indicators, plus an expandable/clickable **Chapter List** displaying chapter numbers, descriptions, topic counts, and completion ratios — zero dropdowns required to pick a chapter.
   - **Chapter & Topic Workspace**: Collapsible left Chapter Navigation Sidebar on desktop (and responsive shadcn `Sheet` on mobile), prominent active Chapter header + learning objectives + Previous/Next Chapter controls, structured Topic cards/list showing completion status, difficulty, time estimate, and one-click launchers to **AI Tutor**, **Study Materials**, **Quiz**, or **Flashcards** for that topic.

#### Dependencies
- **Phase 01** (custom systems, labels, custom exams, custom subjects/chapters/topics) + progress data from `/api/v1/analytics`.

#### Acceptance Criteria
- No redundant 6-dropdown filter row cluttering screen 1.
- Students can always tell where they are, what they are studying, what chapter/topic is next, and their completion progress.
- Full chapter/topic switching works smoothly on 375px mobile (via `Sheet`) and desktop (collapsible sidebar).

---

### Area 4 — AI Tutor & Web Research + shadcn AI Elements

#### Existing Implementation
- **UI**: [`src/app/(student)/tutor/page.tsx`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/app/%28student%29/tutor/page.tsx) (1,441 lines; upgraded visually in State 12 with collapsible sidebar, topic selector, custom prompt presets, and `MarkdownRenderer`)
- **Service & API**: [`src/modules/tutor/tutor-materials-service.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/modules/tutor/tutor-materials-service.ts), `src/app/api/v1/tutor/conversations/*`, [`src/components/shared/markdown-renderer.tsx`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/components/shared/markdown-renderer.tsx)

#### Observed Functional & UX Problems
1. **No Live Web Search or Webpage Verification**: OpenRouter chat models (`openrouter/free`, etc.) do not supply reliable external web search out of the box. There is no search provider adapter, no webpage content retrieval, and no distinction between curriculum knowledge, uploaded documents, inspected web pages, and search snippets.
2. **No Verifiable Citations / Sources UX**: `messages.sourceReferences` currently stores `{ title, locator? }` strings only for syllabus textbook titles — no URLs, publisher names, publication dates, excerpts, retrieval timestamps, clickable inline citations (`[1]`), or interactive `Sources` drawer/panel.
3. **Not Built on shadcn AI Elements**: `tutor/page.tsx` uses a hand-rolled message loop inside a single 1,441-line monolithic component. It lacks AI Elements components (`Message`, `PromptInput`, `Sources`, `InlineCitation`, `Tool`/`Trace`, `ModelSelector`), stop-generation cancellation (`AbortController`), response regeneration, and tool execution activity badges ("Understanding your question", "Searching relevant websites", "Reviewing your study materials").
4. **No Persisted Harness Customization**: `customSystemPrompt` is per-conversation only; students cannot save default assistant modes (`General Tutor`, `Exam Prep`, `Concept Explainer`, `Research Assistant`, `Problem Solver`, `Document Assistant`), explanation depth, web search toggle, uploaded-document grounding toggle, or citation requirements across sessions.

#### Root Causes
- State 06 & State 12 implemented Tutor directly over `streamAITask()` and a single `page.tsx` without an agentic tool-use loop, external search adapter, SSRF-safe HTTP fetcher, or modular shadcn AI Elements component folder.

#### Security Concerns (Critical for Web Research)
- Server-side webpage fetching introduces **SSRF risks** if arbitrary URLs returned or redirected to point to `localhost`, `127.0.0.1`, `::1`, RFC1918 private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local/cloud metadata (`169.254.169.254`), or non-HTTP(S) schemes (`file://`, `ftp://`, `javascript:`).
- Fetched webpage HTML/text is **untrusted external data** and must be stripped of scripts/styles, size-capped, and wrapped inside prompt-injection-resistant delimiters before entering any LLM prompt.
- Zero fabricated URLs, titles, or publication dates: citations may only reference verified tool outputs persisted on the server message record.

#### Proposed Solution
1. Implement `src/components/ai-elements/*` built cleanly atop installed shadcn/ui primitives (`Message`, `MessageScroller`, `PromptInput`, `Tool`/`Trace`, `Sources`, `InlineCitation`, `ModelSelector`, `Confirmation`).
2. Refactor `/tutor` into modular subcomponents consuming the **Phase 03 AI Harness** and **Web Search + Safe Fetcher**:
   - Research-capable flow: classify whether external search is needed -> execute search provider adapter (Tavily / Brave adapter) -> safely fetch top URLs if deeper verification needed -> emit compact user-facing `Tool`/`Trace` phase events via SSE -> stream final response with structured citation markers linked to persisted `sourceReferences`.
   - Include Stop Generation (`AbortController`), Regenerate, Copy, Feedback, Model Selector (filtered by admin allowlist), and **Customize Assistant (`Sheet`)** wired to persisted `userHarnessSettings`.

#### Dependencies
- **Phase 03** (Centralized AI Harness, Tool Registry, Model Router, `userHarnessSettings`) and **User Decision** on external search provider API key (Tavily / Brave Search / Exa; fallback mode when unconfigured must honestly disable web search and notify the user clearly).

#### Acceptance Criteria
- Research queries execute real search tools, stream visible phase/tool trace cards without leaking CoT, and render clickable inline citations opening verified `Sources` with title, domain/publisher, URL, excerpt, snippet-vs-fetched status, and timestamp.
- Localhost/private-IP/metadata/redirect SSRF attempts fail safely in automated tests.
- Stop generation, regenerate, copy, feedback, custom system context (including custom subjects/exams), and persistent harness customization all work cleanly.

---

### Area 5 — Centralized Agentic AI Harness & Infrastructure

#### Existing Implementation
- [`src/lib/ai/config.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/lib/ai/config.ts) (`AI_TASK_REGISTRY`)
- [`src/lib/ai/openrouter-client.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/lib/ai/openrouter-client.ts)
- `src/lib/ai/prompt-templates.ts`
- [`src/modules/ai/ai-service.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/modules/ai/ai-service.ts) (`executeAITask`, `executeStructuredAITask`, `streamAITask`)
- `src/modules/ai/ai-repository.ts` (`promptTemplates`, `aiUsageLogs`, `appSettings`)
- [`src/lib/jobs/processor.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/lib/jobs/processor.ts) (37 lines: pure status transition helper only)

#### Observed Functional & Architectural Problems
1. **Fragmented Orchestration Across Modules**: Feature services manually construct `variables` objects, load syllabus/document context themselves, catch parsing edge cases locally (e.g., `tutor-materials-service.ts` wrote custom Markdown fallback logic outside the core pipeline), and duplicate retry/context code.
2. **Capability-Blind `ModelRouter`**: `buildCandidateModelChain` treats all models identically (`openrouter/free`), without tracking capability metadata (`supportsTools`, `supportsStructuredOutput`, `supportsStreaming`, `contextWindow`, `maxOutputTokens`) or validating model allowlists cleanly.
3. **Missing `ToolRegistry` & Agent Loop**: There is no centralized registry mapping approved tools (`web_search`, `fetch_webpage`, `lookup_curriculum`, `search_uploaded_documents`, `lookup_topic_detail`, etc.) per `AITaskType` with schema validation and server-side RBAC enforcement.
4. **No Persisted User Harness Settings**: Preferences cannot be customized globally per user and bounded by admin platform constraints.
5. **No Durable Job Queue / Execution Worker**: `src/lib/jobs/processor.ts` only contains `canTransitionDocumentStatus` and empty interfaces (`BackgroundJobProcessor`). There is **no MongoDB `aiJobs` collection**, no stateful job progress tracking (`pending`, `processing`, `completed`, `failed`, `retry_scheduled`), and no Vercel-compatible resumable execution path for long-running material generation or document ingestion.

#### Root Causes
- Early SRS design focused on single-shot prompt template interpolation (`ai-service.ts`) rather than an extensible multi-tool, user-customizable agentic harness backed by durable job state.

#### Security Concerns
- User-supplied harness instructions (`customInstructions`, allowed tools, model choice) must NEVER override server-enforced system safety constraints, rate limits, admin model allowlists, or per-task tool allowlists.
- Trace events streamed to clients must NEVER expose raw API keys, internal prompt secrets, or hidden chain-of-thought.

#### Proposed Solution
Implement `src/modules/ai/harness/` cleanly preserving existing `ai-repository.ts`, `openrouter-client.ts`, and `aiUsageLogs`:
1. **`AIHarnessManager`**: Creates execution contexts (`userId`, `taskType`, `userHarnessSettings`, `adminConfig`), intersects user toggles with server/admin policy caps (user customization never overrides system restrictions), logs usage & progress, and delegates to orchestrator or durable worker.
2. **`TaskRouter`**: Formalizes task profiles (`tutor`, `materials`, `quiz_generation`, `quiz_evaluation`, `flashcards`, `planner`, `document_qa`, `recommendations`, `document_ingestion`) with approved tool lists, streaming/structured policies, and sensible defaults.
3. **`ModelRouter`**: Adds capability registry (`supportsStructuredOutput`, `supportsTools`, `supportsStreaming`, `timeoutMs`) and safe capability-aware fallback chains (e.g., disabling `response_format` or tool calls automatically when falling back to a model without that capability).
4. **`ToolRegistry`**: Unified typed tool definitions + Zod argument validation + execution wrappers + compact human-readable trace descriptions ("Understanding your question", "Reviewing your study materials", etc.).
5. **`PromptRegistry` & `userHarnessSettings` + `aiJobs` Collections**: Add MongoDB models + repositories for persisted user harness customization (`mode`, `customInstructions`, `language`, `depth`, `responseFormat`, `preferredModelId`, `enableWebSearch`, `useUploadedDocs`, `citationStyle`) and durable `aiJobs` records with progress/retry states and step-runner execution.
6. Migrate Quizzes, Flashcards, Materials, Planner, Tutor, Document Q&A, and Analytics Recommendations onto `AIHarnessManager`.

#### Dependencies
- Required before **Phase 04** (AI Tutor & Web Search), **Phase 05** (Study Materials), **Phase 06** (Flashcards), **Phase 07** (Planner), and **Phase 08** (RAG durable worker).

#### Acceptance Criteria
- Every AI generation endpoint invokes `AIHarnessManager`.
- Admin restrictions always clamp user harness overrides in security tests.
- Structured output validation, capability-aware fallback, tool execution traces, and `aiJobs` persistence pass integration tests.

---

### Area 6 — Study Materials

#### Existing Implementation
- **UI**: [`src/app/(student)/materials/page.tsx`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/app/%28student%29/materials/page.tsx) (1,182 lines; improved studio + Markdown library in State 12)
- **Service & Schema**: [`src/modules/tutor/tutor-materials-service.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/modules/tutor/tutor-materials-service.ts), `generatedContents` in [`src/lib/database/schema-registry.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/lib/database/schema-registry.ts#L301-L337)

#### Observed Functional & UX Problems
1. **Incomplete Workspace Organization**: While State 12 added search & type filtering, there are **no workspace views** for `My Materials`, `Create New Material`, `Saved Materials`, `Recently Generated`, `Material Templates`, and `Favorite Materials` (`generatedContents` lacks `isFavorite`, `templateId`, and `customOptions`).
2. **Limited Source & Customization Inputs**: Students cannot select multiple sources together (e.g., Custom/Standard Subject + Chapter + Topic + Uploaded Document + Existing Saved Material) nor customize `detailLevel`, `length`, `formattingStyle`, `examFocus`, `includeExamples`, `sourceRestriction`, and `citationRequirement` cleanly via a progressive guided wizard.
3. **Missing Section-Level Regeneration & Duplication**: `PATCH /api/v1/materials/[materialId]` only edits title/markdown/saved state or regenerates the entire document; students cannot duplicate a material, regenerate just one section, export cleanly (Markdown/Print view), or save reusable custom templates.
4. **Separate Orchestration Logic**: Material generation logic lives inside `tutor-materials-service.ts` with bespoke Markdown fallback formatting rather than flowing through the shared AI Harness.

#### Proposed Solution
1. Extend `generatedContents` cleanly (`isFavorite`, `templateId`, `sourceRefs`, `generationOptions`, `conceptComparison` / template presets; plus user/system `materialTemplates` support).
2. Route all generation & section-regeneration through **Phase 03 AI Harness** (`materials` profile, optional RAG doc retrieval tool & citation validation, progress tracking).
3. Redesign `/materials` cleanly around Workspace Tabs (`My Materials`, `Create New`, `Saved`, `Recently Generated`, `Templates`, `Favorites`), a 4-step Guided Creation Wizard (1. Multi-source selector -> 2. Format & template -> 3. Customization with collapsed Advanced Settings -> 4. Live harness progress -> Review & Edit), plus section regeneration, duplication, favorite toggling, Markdown export, and Print layout.

#### Dependencies
- **Phase 01** (custom subjects/exams), **Phase 02** (Sonner/Dialog/Tabs primitives), **Phase 03** (AI Harness & durable/progress execution), **Phase 08/hooked RAG chunks** for uploaded-doc grounding.

#### Acceptance Criteria
- Multi-source selection (including custom curriculum + uploaded documents + saved materials) generates tailored materials through the AI Harness.
- Favorites, Templates, Duplication, Section Regeneration, Editing, Export/Print, and Search/Filter all persist cleanly.

---

### Area 7 — Flashcards

#### Existing Implementation
- **UI**: [`src/app/(student)/flashcards/page.tsx`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/app/%28student%29/flashcards/page.tsx) (879 lines)
- **Service & Repo**: [`src/modules/flashcards/flashcard-service.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/modules/flashcards/flashcard-service.ts), `src/modules/flashcards/flashcard-repository.ts`

#### Observed Functional & UX Problems
1. **Utilitarian Layout Without Clear Study CTA**: Shows queue filters, inline create/generate forms, and cards in a dense stacked page rather than a focused **Flashcards Dashboard** highlighting Today's Review, Due Cards, Mastery progress, Deck Collections, Recent Activity, and a clear **"Start Reviewing"** hero button.
2. **Flat Card Flip UX & Hardcoded Timing**: Flipping swaps front/back text without smooth CSS 3D card-flip choreography (`prefers-reduced-motion` compliant) or keyboard shortcuts (`Space` to flip, `1`/`2`/`3`/`4` for Again/Hard/Good/Easy). Line 247 of `flashcards/page.tsx` also sends a hardcoded `durationMs: 4200` on every rating instead of measuring real view time!
3. **Incomplete Deck Management**: Supports deck creation and editing cards, but lacks **deck duplication**, **collection/tag organization**, **subject/topic filter search**, and **`AlertDialog` confirmation** before destructive deck deletion.
4. **Disconnected AI Generation**: AI flashcard generation calls `executeStructuredAITask` directly rather than the centralized AI Harness.

#### Proposed Solution
1. Preserve and keep the verified deterministic SM-2 scheduler (`computeNextSM2Schedule` in `flashcard-service.ts`).
2. Extend `flashcardDecks` optionally with `collectionName` / custom education links (`subjectId` supporting custom subjects), add deck duplicate/edit/delete-confirm API support, and route AI deck generation (from curriculum, custom subjects, notes, or documents) through `AIHarnessManager`.
3. Redesign `/flashcards` into a clean SaaS experience: Overview Dashboard + "Start Reviewing" CTA, rich Deck Cards with mastery bars/badges & collection filters, Dialog-based Create/AI-Generate Deck + Card Editor, `AlertDialog` delete confirmation, and a distraction-free **3D Flip Review Stage** (mobile touch + desktop keyboard shortcuts + measured review timer + SM-2 interval preview per button + `prefers-reduced-motion` support).

#### Dependencies
- **Phase 01** (custom subjects/topics), **Phase 02** (Sonner, AlertDialog, Dialog, Progress), **Phase 03** (AI Harness).

#### Acceptance Criteria
- Existing SM-2 tests continue passing; real review durations & ratings persist accurately to `reviewLogs`.
- Smooth flip UX works on desktop (keyboard) & mobile (touch) and respects `prefers-reduced-motion`.
- Deck create, edit, duplicate, search/filter, collection organization, and confirmed delete all persist.

---

### Area 8 — Study Planner

#### Existing Implementation
- **UI**: [`src/app/(student)/planner/page.tsx`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/app/%28student%29/planner/page.tsx) (1,239 lines)
- **Service & Engine**: [`src/modules/planner/planner-service.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/modules/planner/planner-service.ts), `src/modules/planner/scheduler-engine.ts`

#### Observed Functional & UX Problems
1. **Overwhelming Monolithic Form**: `showCreateForm` renders plan title, exam selector, target date, daily minutes, days-of-week pills, subject checkboxes, and per-subject proficiency dropdowns all in one complex screen.
2. **Clunky Task & Schedule Management**: Adding/editing tasks relies on inline state rows (`editingTaskId` + raw inputs); lacks clean tabbed separation of **Today's Focus**, **Weekly Calendar**, **Subject-Wise Roadmap**, and **Timeline**; lacks clean priority adjustment & skip/reschedule actions via Dialog/Sheet.
3. **Missing Custom Education Integration**: Only loads standard seeded exams and subjects (`GET /api/v1/curriculum`), and doesn't allow custom examinations, personal learning goals without a formal exam, syllabus chapter/topic selection, or existing schedule commitments.
4. **Disconnected AI Advisor**: Calls `executeStructuredAITask({ taskType: 'planner' })` directly instead of routing through `AIHarnessManager`.

#### Proposed Solution
1. Keep the deterministic feasibility & time-budget engine (`scheduler-engine.ts` and `FR-PLAN-011` honest syllabus weighting rule), extending inputs cleanly to support custom examinations, personal learning goals, optional chapter/topic subsets, weekly commitments, and task `priorityRank` / `durationMinutes` edits.
2. Build a **5-Step Guided Plan Creation Wizard** inside `/planner`:
   - Step 1: Goal / Existing Exam / Custom Exam / Personal Target
   - Step 2: Subjects & Chapter/Topic Coverage
   - Step 3: Target Date, Daily Minutes, Preferred Days & Commitments
   - Step 4: Difficulty, Current Confidence & Revision Preferences
   - Step 5: Deterministic Schedule Preview + AI Harness Strategy Summary
3. Redesign Planner Dashboard with clean Summary Cards (Today's Tasks, Upcoming Exams, Missed Tasks Banner with 1-click Reschedule Recommendation, Completion Progress) + shadcn `Tabs` (`Today & Tasks`, `Weekly Calendar`, `Subject Roadmap`, `Timeline`) + Dialog/Sheet task editor.

#### Dependencies
- **Phase 01** (custom examinations/subjects/topics), **Phase 02** (Sonner, Dialog, Sheet, Tabs, Progress, Alert), **Phase 03** (AI Harness).

#### Acceptance Criteria
- Deterministic scheduler never creates impossible schedules exceeding daily capacity or past completed history.
- Custom exams & custom subjects integrate seamlessly into plan generation, roadmap, and analytics.

---

### Area 9 — Document Management & RAG System (Critical Vercel Breakage Audit)

#### Existing Implementation
- **UI**: [`src/app/(student)/documents/page.tsx`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/app/%28student%29/documents/page.tsx) (657 lines)
- **API**: [`src/app/api/v1/documents/route.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/app/api/v1/documents/route.ts), `src/app/api/v1/documents/[documentId]/route.ts`
- **Service, Repo & Engine**: [`src/modules/documents/document-service.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/modules/documents/document-service.ts), [`src/modules/documents/document-repository.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/modules/documents/document-repository.ts), [`src/modules/documents/rag-engine.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/modules/documents/rag-engine.ts)
- **Storage & Jobs**: [`src/lib/storage/adapter.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/lib/storage/adapter.ts), [`src/lib/jobs/processor.ts`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/lib/jobs/processor.ts)

#### Critical Root Causes of Local vs Vercel Production Failures

| Layer | What Current Code Actually Does | Why It Fails in Real Use / Vercel Deployment |
|---|---|---|
| **1. Client Upload** | `documents/page.tsx` line 138 runs `await file.text()` on PDF & DOCX binaries and posts `rawContent` inside JSON `POST /api/v1/documents`. | **(a)** `file.text()` corrupts binary PDF/DOCX bytes into UTF-8 replacement chars (`\uFFFD`). **(b)** Vercel Serverless Functions reject JSON bodies **> 4.5 MB** (`MAX_UPLOAD_BYTES` is 15 MB, so real uploads fail with HTTP `413`). |
| **2. Object Storage** | `src/lib/storage/adapter.ts` only defines the TypeScript `StorageAdapter` interface. `document-service.ts` line 109 invents a string `storageKey` (`users/...`) **without ever calling `putObject()`** or storing the actual file bytes! | Actual uploaded PDF/DOCX bytes never reach Vercel Blob (`@vercel/blob` isn't installed). Retrying extraction fails because there is no persisted file anywhere (and local `/tmp` disappears between Vercel invocations). |
| **3. Text Extraction** | `rag-engine.ts` lines 78–115 only run trivial regexes (`<w:t>` for DOCX, `(...) Tj` for PDF) on already-corrupted `rawContent` text. | Real PDFs use compressed `FlateDecode` streams, CID fonts, tables, and XRef objects; real `.docx` files are ZIP archives containing `word/document.xml`. Both produce garbage or empty text with current regexes. |
| **4. Processing Lifecycle** | `document-service.ts` lines 131–190 run extraction and chunking synchronously inside the single `POST /api/v1/documents` request. `processor.ts` has no database queue. | Large multi-page PDFs + chunk embedding generation exceed Vercel Hobby/Pro serverless request timeouts, or leave orphaned `extracting` documents if terminated mid-request. |
| **5. Fingerprint / Dedupe** | No SHA-256 hash stored on `uploadedMaterials`. | Re-uploading the same file wastes storage, embeddings, and creates duplicate searchable chunks. |
| **6. Embedding & Vector Retrieval** | `.env.example` line 35 declares `AI_EMBEDDING_MODEL=`, while `rag-engine.ts` line 222 reads `process.env.OPENROUTER_EMBEDDING_MODEL`! Also OpenRouter defaults differ across chat vs embeddings, and `document-repository.ts` has **no MongoDB Atlas `$vectorSearch` query** (only linear in-memory keyword TF ranking over `listChunksByMaterial`). | Env var name mismatch guarantees vector mode never activates even if configured; OpenRouter chat endpoint (`openrouter/free`) cannot automatically generate embeddings; no real Atlas Vector Search aggregation pipeline exists. |
| **7. Deployment Testing** | Never deployed or verified on Vercel (`Context.md` shows `Storage: NOT_CONFIGURED`, `Vercel: NOT_CONFIGURED`). | Local-only tests passed mocked strings (`rawContent`) in-memory, hiding binary upload/Blob/timeout failures. |

#### Security / Data Concerns
- `@vercel/blob/client` `handleUpload` token generation endpoint (`onBeforeGenerateToken`) MUST authenticate the session, validate MIME/size (`validateUploadDescriptor`), and scope pathname to `users/${userId}/...` so one user cannot overwrite or read another user's blobs.
- Extracted chunks remain untrusted data and MUST keep `<untrusted_document_chunk>` sandboxing (`wrapUntrustedDocumentChunk` / `sanitizeUntrustedChunkText`).
- Delete (`DELETE /api/v1/documents/[documentId]`) must clean up: (1) Vercel Blob object, (2) `documentChunks` records, (3) pending `aiJobs`, and (4) mark `uploadedMaterials` deleted.
- **No false claims**: If embedding provider credentials or `ATLAS_VECTOR_INDEX_NAME` are absent or unreachable, `getActiveRetrievalMode()` MUST truthfully report `'keyword'` (and never pretend semantic vector search ran).

#### Proposed Solution
1. **Direct Client-to-Blob Upload**: Install `@vercel/blob`, implement concrete `VercelBlobStorageAdapter` + test-friendly local/memory adapter in `src/lib/storage/adapter.ts`, create authenticated `/api/v1/documents/upload-token` (`handleUpload` from `@vercel/blob/client`) + `/api/v1/documents/complete` (or unified workflow) supporting files up to 15 MB without hitting Vercel's 4.5 MB function body limit.
2. **Real Binary Server Extraction**: Install lightweight pure-JS server-compatible extractors (`unpdf` or `pdf-parse` verified for Next.js Node serverless + `mammoth` or `jszip` XML parser for `.docx`) tested directly on real PDF/DOCX/TXT binary buffers fetched from storage, detecting encrypted/empty/corrupted files cleanly.
3. **SHA-256 Fingerprinting & Duplicate Detection**: Compute file hash on registration/worker intake, return duplicate awareness/reuse option cleanly.
4. **Durable MongoDB `aiJobs` Processing**: Enqueue ingestion job (`pending -> extracting -> chunking -> embedding -> indexing -> completed | failed | retry_scheduled`), drive steps via idempotent `/api/v1/jobs/process` (authenticated by user session trigger or `CRON_SECRET`) + UI polling/status cards (`Progress` component + Sonner notification when ready) — zero long-lived in-memory background loops.
5. **Explicit Embedding Provider Abstraction & Hybrid Retrieval**: Unify env var naming (`AI_EMBEDDING_MODEL` / `AI_EMBEDDING_PROVIDER` + optional `OPENAI_API_KEY` or dedicated OpenRouter/compatible embedding endpoint), implement Atlas `$vectorSearch` pipeline in `MongooseDocumentRepository` when `ATLAS_VECTOR_INDEX_NAME` + embeddings are active, and clearly display active mode (`vector_hybrid` vs `keyword` fallback) in `/documents`.
6. **Multi-Document / Custom-Subject RAG Grounding**: Allow linking documents to **custom subjects/chapters/topics**, selecting one or multiple ready documents in Q&A & AI Tutor, clearly distinguishing document-grounded evidence vs general AI knowledge vs external web search.

#### Dependencies
- **Phase 01** (custom subjects/topics linking), **Phase 03** (AI Harness + durable `aiJobs` model & worker), plus **User Provisioning** of `BLOB_READ_WRITE_TOKEN` (and optional embedding key / Vercel Preview deployment) for live Phase 08 production verification.

#### Acceptance Criteria
- Real PDF, DOCX, and TXT files (>1MB / up to 15MB) upload directly to Vercel Blob, extract readable page/heading text cleanly, chunk with overlap, persist chunks + optional embeddings to MongoDB, answer grounded questions with exact page/section citations through AI Harness, retry failures idempotently, enforce cross-user isolation, and delete cleanly across Blob + MongoDB on an actual Vercel preview deployment.

---

### Area 10 — Shared UI Feedback, shadcn/ui Primitives & Responsive Ergonomics

#### Existing Implementation
- Root layout & providers: [`src/app/layout.tsx`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/app/layout.tsx), [`src/components/providers/app-providers.tsx`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/components/providers/app-providers.tsx)
- Installed components: `src/components/ui/` (8 files: `badge`, `button`, `card`, `input`, `separator`, `skeleton`, `tabs`, `tooltip`), [`src/components/shared/page-states.tsx`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/components/shared/page-states.tsx)
- Shell: `src/components/shared/app-shell.tsx`

#### Observed Functional & UX Problems
1. **No Global Toast System (`Sonner`)**: `sonner` is absent from `package.json` and `<Toaster />` is not mounted in `AppProviders` or `RootLayout`. Feedback across Tutor, Materials, Flashcards, Planner, Documents, and Settings is fragmented across ad-hoc inline `<div>` banners (`statusMessage` / `statusBanner` / `errorMessage`).
2. **Missing Core shadcn/ui Dialog, Sheet, Switch & Progress Primitives**: Interactive forms, destructive delete actions, mobile drawers, and async job statuses lack accessible Radix-backed `AlertDialog`, `Dialog`, `Sheet`, `Switch`, `Alert`, `Progress`, `HoverCard`, `DropdownMenu`, and `Select`. Pages use raw `<select>` HTML tags and miss confirmation steps on destructive operations.
3. **High First-Screen Cognitive Load**: Multiple student pages (`my-learning`, `planner`, `notifications`, `flashcards`) present configuration chrome, raw selectors, and management controls all at once instead of using progressive disclosure (`Sheet` / `Dialog` / `Tabs`).

#### Proposed Solution
1. Install official shadcn/ui primitives via CLI (`sonner`, `alert`, `alert-dialog`, `dialog`, `sheet`, `select`, `switch`, `progress`, `dropdown-menu`, `hover-card`, `collapsible`, `scroll-area`, `textarea`, `label`, `checkbox`, `slider`) matching `components.json` (`new-york`, Tailwind v4, Lucide).
2. Mount global theme-aware `<Toaster />` in [`src/components/providers/app-providers.tsx`](file:///Users/mdshahadathossain/Downloads/LEARNMATE-AI/src/components/providers/app-providers.tsx) and expose a centralized feedback utility (`src/lib/ui/toast.ts`) supporting `success`, `error` (sanitized), `warning`, `info`, `loading`, and `promise` helpers with toast deduplication (`id`).
3. Standardize empty (`PageEmptyState`), error (`Alert` / `PageErrorState`), destructive confirmations (`AlertDialog`), and async job progress (`Progress`) across every route, verifying all viewports (`375px`, `430px`, `768px`, `1024px`, `1440px`).

---

## 3. Official Platform & Library Documentation Research Findings

Verified against current official documentation during Phase 00 reconnaissance:

1. **shadcn AI Elements (`https://ui.shadcn.com/docs/ai-elements`)**:
   - AI Elements is NOT a single opaque npm component library; it is a **collection of composable React components built from shadcn/ui primitives and copied directly into the project** (e.g., `src/components/ai-elements/`).
   - Core patterns relevant to LearnMate AI: `Message` (avatar + markdown bubble + action bar), `MessageScroller` (auto-scroll + scroll-to-bottom trigger), `PromptInput` (textarea + attachment/context toolbar + submit/stop actions), `Tool` / `Task` (collapsible step/tool badge showing inputs/status without exposing hidden CoT), `Sources` (stacked publisher chips + expandable list), `InlineCitation` (`[n]` trigger with `HoverCard` excerpt preview), and `ModelSelector`.
   - Fully compatible with Next.js 15 App Router (`'use client'`), React 19, Tailwind v4, and OpenRouter SSE streams.

2. **shadcn Sonner (`https://ui.shadcn.com/docs/components/radix/sonner`)**:
   - Installed via `npx shadcn@latest add sonner` (installs `sonner` + `src/components/ui/sonner.tsx` integrated with `next-themes`).
   - `<Toaster />` renders once at the application root (`AppProviders`), and all toast feedback routes through a single utility module (`src/lib/ui/toast.ts`) enforcing sanitized errors, dedupe IDs, and promise lifecycle feedback without mixing transient toasts into MongoDB `notifications`.

3. **External Web Search & Secure Fetching**:
   - OpenRouter does **not** automatically furnish verified live web search or embeddings across arbitrary free models. A dedicated **provider-independent `WebSearchAdapter`** (supporting **Tavily Search API** or **Brave Search API** via server-side env credentials, configurable timeout & result limit, normalized fields: `{ title, url, publisher, snippet, publishedAt }`) must be called explicitly by the AI Harness `ToolRegistry`.
   - Webpage inspection requires a dedicated **SSRF-safe HTTP fetcher** validating URL protocol (`https:`/`http:`), resolving DNS before connecting, blocking loopback (`127.0.0.0/8`, `::1`), RFC1918 private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local / AWS/GCP/Azure metadata (`169.254.169.254`), disabling automatic blind redirects (re-validating every hop), enforcing response size caps (e.g., 1.5 MB) and timeouts (8s), stripping executable HTML/scripts, and wrapping text as untrusted data.

4. **Vercel Serverless & Durable RAG Constraints**:
   - **Body Payload Limit**: Vercel Serverless Functions enforce a **4.5 MB request body limit**. Uploading PDF/DOCX up to 15 MB requires `@vercel/blob/client` direct browser-to-Blob upload (`upload()` calling an authenticated `handleUpload` token route `/api/v1/documents/upload-token`).
   - **Stateless Execution Timeouts**: Vercel functions have finite execution durations (Hobby defaults ~10s, configurable/Pro higher, never permanent background daemons). Long-running document extraction + chunking + embedding MUST persist state cleanly in a MongoDB `aiJobs` collection and advance idempotently via bounded step execution (`/api/v1/jobs/process` invoked on upload completion / retry / Vercel Cron / frontend polling), cleanly surviving cold starts.
   - **MongoDB Atlas Vector Search vs Keyword Fallback**: Vector retrieval uses `$vectorSearch` aggregation in MongoDB Atlas **only** when a compatible embedding provider + `ATLAS_VECTOR_INDEX_NAME` are verified configured; otherwise `getActiveRetrievalMode()` reports `'keyword'` transparently and performs indexed keyword/TF retrieval cleanly.

---

## 4. Dependency Summary Across Remediation Phases

```text
Phase 01 (Custom Education Data Model & APIs)
   └──> Phase 02 (Notifications Center + Simplified Academic Navigation + Global Sonner/UI Primitives)
           └──> Phase 03 (Centralized AI Harness, Model/Task/Tool/Prompt Registries & Durable aiJobs Worker)
                   ├──> Phase 04 (AI Tutor + AI Elements + Web Search + SSRF-Safe Citations)
                   ├──> Phase 05 (Study Materials Workspace + Multi-Source + Harness)
                   ├──> Phase 06 (Flashcards Dashboard + 3D Review + Harness)
                   ├──> Phase 07 (Study Planner Guided Wizard + Roadmap + Harness)
                   └──> Phase 08 (Vercel Blob + Binary Extraction + Embeddings/RAG + Harness Worker + Preview Verification)
                           └──> Phase 09 (Cross-Module E2E, Security, Responsive & Performance QA)
                                   └──> Original SRS State 13 (Final Vercel & Atlas Production Deployment Readiness)
```
