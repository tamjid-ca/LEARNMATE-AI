# LearnMate AI — Implementation Plan

## State Overview

| State | Name | Status | Summary |
| :--- | :--- | :--- | :--- |
| **00** | Initial Environment & Agent Setup | `COMPLETE` | Workspace reconnaissance, `.agents/plugins/learnmate-engineering` plugin & skills validated, permanent docs & `Context.md` initialized. |
| **01** | Architecture & Database Design | `COMPLETE` | Finalized module boundaries, all 27 collection schemas & indexes (`src/lib/database/schema-registry.ts`), RBAC, API envelopes, AI & storage/job contracts, and 6 automated architecture tests. |
| **02** | Project Scaffold & Design System | `NOT_STARTED` | Initialize Next.js App Router + TypeScript + Tailwind + shadcn/ui, responsive shell, dark/light themes, bilingual UI support, public landing page. |
| **03** | Authentication & Student Onboarding | `NOT_STARTED` | Registration, login, session management, server RBAC, profile settings, multi-step student onboarding, auth unit/integration tests. |
| **04** | Curriculum & Administrative CMS | `NOT_STARTED` | Full 6-tier hierarchy CRUD (`EducationSystem` → `Topic`), JSON/CSV import-export, admin CMS UI, student curriculum browser, pagination & indexes. |
| **05** | OpenRouter & Central AI Infrastructure | `NOT_STARTED` | Server-side OpenRouter gateway, model registry, prompt templates, Zod output validation, streaming, retries/fallbacks, quotas, `aiUsageLogs`, admin AI config. |
| **06** | AI Tutor & Learning Materials | `NOT_STARTED` | Contextual AI subject tutor chat, streaming, Bangla/English & depth modes, 12 learning material types, personal library CRUD, feedback. |
| **07** | Quiz & Examination System | `NOT_STARTED` | AI quiz generation (4 question types), schema validation, timed exam UI, objective auto-scoring, rubric AI short-answer grading, mock exams, weak-topic analysis. |
| **08** | Flashcards & Spaced Repetition | `NOT_STARTED` | Deck CRUD, AI flashcard generation, flip review UI, deterministic SM-2 scheduling (`Again`/`Hard`/`Good`/`Easy`), timezone-safe due queue, `reviewLogs`. |
| **09** | Document Management & RAG | `NOT_STARTED` | Validated PDF/TXT/DOCX upload, storage adapter, chunking, user-isolated keyword & optional vector retrieval, grounded Q&A with page citations, doc-to-quiz/flashcards. |
| **10** | Personalized Study Planner | `NOT_STARTED` | Target exam & study-hour config, deterministic schedule & milestone generator, AI prioritization helper, calendar/list/roadmap views, rescheduling & adaptation. |
| **11** | Analytics, Notifications & Gamification | `NOT_STARTED` | Mastery estimation, subject/topic analytics charts, explainable recommendations, streaks, milestones, in-app notifications & preferences. |
| **12** | Integration, QA & Security Hardening | `NOT_STARTED` | Cross-module integration audit, RBAC & ownership verification, prompt-injection & upload hardening, Vitest suite, Playwright E2E suite, accessibility & build check. |
| **13** | Deployment & Production Readiness | `NOT_STARTED` | Vercel config, MongoDB Atlas index/seed scripts, environment & health checks, preview deployment validation, production release checklist. |
