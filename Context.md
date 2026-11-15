# LearnMate AI — Implementation Context

## Project

Name: LearnMate AI
Stack: Next.js + TypeScript + Node.js + MongoDB + Mongoose
AI: OpenRouter
Deployment: Vercel

## Current State

CURRENT_STATE: 03
STATUS: COMPLETE
LAST_COMPLETED_STATE: 03

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

## Current Implementation

- Completed State 03 (Authentication and Student Onboarding).
- Ready to transition to State 04 (Curriculum and Administrative CMS) upon user instruction.

## Technical Decisions

- **ADR-001..007**: Modular monolith on Next.js App Router, `npm`, 27 normalized Mongoose collections, OpenRouter gateway, hybrid RAG, deterministic SM-2/scheduler, pluggable storage.
- **State 03 Auth Architecture**: Node `crypto.scrypt` password hashing + HMAC-SHA256 signed `HttpOnly` session cookies (`learnmate_session`) verified in both Node Route Handlers and Edge Middleware (`crypto.subtle`). Self-registration strictly enforces `role: 'student'` and rejects extra fields via Zod `.strict()`.

## Database Status

- Completed collections: All 27 collections compiled into Mongoose models (`src/models/index.ts`); `users` CRUD + cascading deletion across all 16 student-owned collections active in `src/modules/auth/user-repository.ts`.
- Pending collections: `educationSystems`, `educationLevels`, `examinations`, `subjects`, `chapters`, `topics`, and `auditLogs` CRUD repositories in State 04.
- Required indexes and migrations: Curriculum hierarchy compound indexes and initial Bangladesh (SSC, HSC, University Admission, BCS) syllabus seeding scheduled for State 04.

## Integrations

- MongoDB: CONFIGURED (`.env.local` `MONGODB_URI` present; `MongooseUserRepository` active)
- OpenRouter: CONFIGURED (`.env.local` `OPENROUTER_API_KEY` present; gateway wired in State 05)
- Storage: NOT_CONFIGURED (`BLOB_READ_WRITE_TOKEN` empty; local disk adapter used in dev)
- Vercel: NOT_CONFIGURED

## Tests

- Commands executed:
  - `npm run typecheck` (`tsc --noEmit`)
  - `npm run lint` (`node scripts/lint.mjs`)
  - `npm test` (`vitest run`)
  - `npm run build` (`next build`)
- Passed tests: 15/15 unit & integration tests across `state-01-architecture.test.ts` (6), `state-02-scaffold.test.ts` (3), and `state-03-auth-onboarding.test.ts` (6); 0 lint or typecheck errors; production build succeeded across all routes and middleware.
- Failed tests: None.
- Unresolved issues: None.

## Known Issues

- None blocking State 04.

## User Feedback

- Add `.gitignore` according to the project structure.
- Commit and push changes to GitHub (`origin main`) after finishing each state.

## Next Action

- Exact next implementation state: **State 04 — Curriculum and Administrative CMS**.
- First task to execute: Implement repositories, services, Zod validators, and `/api/v1/curriculum/*`, `/api/v1/topics/*`, and `/api/v1/admin/curriculum/*` endpoints for the 6-tier hierarchy (`EducationSystem` → `EducationLevel` → `Examination` → `Subject` → `Chapter` → `Topic`), JSON/CSV import-export, database pagination, Bangladesh syllabus seed data, student `/my-learning` topic browser UI, and admin curriculum management UI.
- Relevant files to inspect: `Context.md`, `docs/PROJECT_SRS.md` (Section 4.3, 4.12), `src/lib/database/schema-registry.ts`, `src/models/index.ts`.
