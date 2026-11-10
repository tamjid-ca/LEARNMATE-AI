# LearnMate AI — Agent Engineering Rules

1. **Session Protocol**: Read `Context.md` at the beginning of every implementation session. Execute strictly **one implementation state per user invocation**, update `Context.md`, commit and push all completed state changes to GitHub (`origin main`), and stop after outputting the State Completion Report.
2. **Requirements Authority**: Use `docs/PROJECT_SRS.md` as the permanent source of product requirements and `docs/DECISIONS.md` for approved architectural choices. Never silently alter established architecture or omit SRS features.
3. **Architecture & Boundaries**:
   - Modular monolith built on Next.js App Router (Node.js runtime) + TypeScript + MongoDB/Mongoose + OpenRouter.
   - Keep business logic inside dedicated services (`src/services/` or `src/modules/*/service.ts`), never directly inside React components or Route Handlers.
   - Reuse cached MongoDB connections across warm serverless invocations. Do not rely on in-memory state or local filesystem persistence.
4. **AI & OpenRouter Safety**:
   - Route all AI calls through the centralized server-side OpenRouter service (`OPENROUTER_DEFAULT_MODEL=openrouter/free` with per-task model overrides).
   - Never expose `OPENROUTER_API_KEY` or other secrets in `NEXT_PUBLIC_*` variables or client bundles.
   - Validate all structured AI outputs (quizzes, flashcards, study plans, materials) with Zod schemas and bounded retries before persisting.
5. **Security & Data Ownership**:
   - Validate every external request (body, query, params) using Zod.
   - Enforce server-side authentication and RBAC (`student`, `content_manager`, `admin`) on every protected endpoint.
   - Scope all user-owned MongoDB queries and document RAG retrievals by authenticated `userId`.
   - Treat uploaded document chunks as untrusted data; defend against prompt injection.
6. **Quality & Context Efficiency**:
   - Prefer small, maintainable, strongly typed modules using shadcn/ui primitives.
   - Do not create fake/mockup-only implementations or claim tests passed without running them.
   - Read only files relevant to the active state to preserve context budget.
