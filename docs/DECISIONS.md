# LearnMate AI — Architectural & Technical Decisions

## ADR-001: Modular Monolith on Next.js App Router (Node.js Runtime)
- **Decision**: Implement both frontend UI and `/api/v1/*` backend endpoints inside a single Next.js App Router repository running on the Node.js runtime, with strict separation between Route Handlers, Domain Services (`src/services/` / `src/modules/`), and Mongoose Repositories/Models (`src/repositories/` / `src/models/`).
- **Rationale**: Satisfies SRS Section 5.2 and serverless deployment on Vercel without premature microservice or external queue complexity.

## ADR-002: Package Manager Selection (`npm`)
- **Decision**: Use `npm` (v11.19.0 installed locally with Node.js v26.7.0) with `package-lock.json` as the workspace package manager, defining standard scripts (`typecheck`, `lint`, `test`, `build`, `dev`, `seed`).
- **Rationale**: Environment reconnaissance in State 00 confirmed `npm` v11.19.0 is pre-installed while `pnpm` and `corepack` are not installed on the host machine.

## ADR-003: MongoDB Connection Reuse & 27 Normalized Collections
- **Decision**: Cache the Mongoose connection across warm invocations using a global singleton and implement all 27 SRS collections with explicit compound indexes and `userId` ownership fields rather than embedding unbounded arrays.
- **Rationale**: Prevents connection exhaustion in serverless functions and avoids the 16MB BSON document limit.

## ADR-004: Centralized OpenRouter Gateway with Zod Output Validation
- **Decision**: Route all AI requests through a single server-side OpenRouter service (`OPENROUTER_DEFAULT_MODEL=openrouter/free`) with per-task model overrides, database-backed `promptTemplates`, bounded Zod validation/repair retries (max 2), per-user quotas, and `aiUsageLogs`.
- **Rationale**: Free models on OpenRouter have dynamic availability and varying structured-output support; centralizing routing, validation, and fallback keeps features resilient.

## ADR-005: Hybrid RAG Retrieval Abstraction
- **Decision**: Implement a `DocumentRetrievalService` supporting MongoDB text/keyword scored chunk retrieval out of the box, and automatically upgrading to semantic vector search only when `AI_EMBEDDING_MODEL` and Atlas Vector Search indexes are configured.
- **Rationale**: Meets SRS Section 4.9 requirement to work reliably without claiming semantic retrieval when embeddings are unconfigured.

## ADR-006: Deterministic Algorithms for Spaced Repetition and Study Scheduling
- **Decision**: Implement SM-2 spaced repetition for flashcards and deterministic date/hour allocation for study roadmaps in pure, unit-tested TypeScript functions; use AI only for prioritization suggestions and natural-language explanations.
- **Rationale**: Ensures predictable, testable scheduling even when AI models are rate-limited or offline (SRS Sections 4.7 and 4.8).

## ADR-007: Pluggable Storage and Durable Job Processing
- **Decision**: Abstract file storage behind a `StorageAdapter` (supporting Vercel Blob in production and a local/mock adapter in development/testing) and track document ingestion via durable `uploadedMaterials` status states processed via idempotent job handlers.
- **Rationale**: Avoids storing binaries in MongoDB or relying on fire-and-forget in-memory background tasks on Vercel.
