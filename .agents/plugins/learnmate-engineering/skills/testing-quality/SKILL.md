---
name: testing-quality
description: >-
  Use this skill when writing or executing Vitest unit/integration tests,
  Playwright end-to-end tests, typechecking, linting, or verifying state
  acceptance gates in LearnMate AI.
---

# Testing & Quality Verification Skill (LearnMate AI)

## Verification Protocol

1. **Unit Tests (Vitest)**:
   - Cover pure domain logic: Zod validators, SM-2 spaced-repetition scheduling, deterministic study-plan date allocation, mastery score calculation, quiz scoring, and AI JSON output parsers.
2. **Integration Tests (Vitest)**:
   - Verify API route handlers, RBAC guards, ownership isolation, and database repository operations.
3. **End-to-End Tests (Playwright)**:
   - Cover critical user journeys: auth & onboarding, curriculum browsing, AI tutor chat, material generation, quiz attempt, flashcard review, study planner, document RAG, and admin CMS.
4. **State Gate Commands**:
   - Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` before marking any implementation state `COMPLETE`.
   - Report exact commands run and actual pass/fail counts in `Context.md` and the State Completion Report.
