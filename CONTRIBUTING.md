# Contributing to LearnMate AI

## State-Driven Development Workflow

LearnMate AI is built systematically across 14 controlled states (`State 00` through `State 13`):

1. Read `Context.md` first before making any change.
2. Verify requirements in `docs/PROJECT_SRS.md` and architectural invariants in `docs/DECISIONS.md`.
3. Execute one state per session. Do not mix unrelated states or skip state verification gates.
4. Keep business logic inside modular services (`src/services/` or `src/modules/`), never directly inside React components or Route Handlers.
5. Validate all external inputs and structured AI outputs with Zod schemas.
6. Enforce server-side authentication, RBAC (`student`, `content_manager`, `admin`), and `userId` ownership checks on every query.
7. Run quality gates (`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`) and update `Context.md` before completing a state.
