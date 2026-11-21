# LearnMate AI — Testing Strategy

## 1. Testing Pyramid & Tools

- **Static Verification**: TypeScript (`tsc --noEmit`) + ESLint.
- **Unit & Integration Testing (`Vitest`)**: 12 modular test suites (`tests/state-01-*.test.ts` through `tests/state-12-qa-security.test.ts`, 47 tests total) covering domain validators, SM-2 scheduling, deterministic study planner allocation, quiz scoring & rubric grading, RAG sandboxing, error normalization, RBAC, ownership isolation, and cross-module journeys.
- **End-to-End Testing (`Playwright`)**: Configured via `playwright.config.ts` and `tests/e2e/critical-journeys.spec.ts` (`npm run test:e2e`) across desktop Chrome and mobile Pixel 5 viewports.

## 2. Mandatory Unit Test Targets

1. **Zod Validators**: Registration, onboarding, curriculum import, quiz generation config, AI structured output schemas.
2. **Spaced Repetition (SM-2)**: Deterministic interval, ease-factor, and timezone-safe `nextReviewAt` calculations for `Again`, `Hard`, `Good`, and `Easy`.
3. **Study Planner Scheduler**: Deterministic allocation of syllabus topics across available dates, daily study hours, revision slots, and rescheduling.
4. **Quiz Scoring & Security**: Objective single/multi-MCQ and true/false scoring with negative-marking support; answer-key stripping prior to submission.
5. **Mastery & Analytics Calculations**: Weighted topic mastery estimation, streak tracking, and explainable recommendation ranking.
6. **AI Output Parser & Repair**: Handling malformed JSON, markdown code fences, and bounded retry limits.

## 3. Mandatory E2E Workflows (SRS Section 13.3)

1. Student registration, sign-in, and multi-step onboarding.
2. Curriculum navigation (Education System → Level → Subject → Chapter → Topic).
3. Contextual AI Tutor conversation (English & Bangla modes).
4. Learning material generation and personal library persistence.
5. Quiz generation, timed attempt, submission, and result review.
6. Flashcard deck creation and SM-2 card review.
7. Study roadmap generation and task completion/rescheduling.
8. Document upload, chunk ingestion, and source-grounded RAG Q&A.
9. Analytics dashboard and notification center verification.
10. Administrator CMS, AI configuration, and audit log verification.

## 4. State Quality Gates

Every state from State 02 onward must execute and record results for:
```bash
npm run typecheck
npm run lint
npm test
npm run build
```
