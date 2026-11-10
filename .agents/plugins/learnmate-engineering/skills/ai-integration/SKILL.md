---
name: ai-integration
description: >-
  Use this skill when implementing OpenRouter client logic, task prompt
  templates, structured output validation, streaming responses, RAG retrieval,
  or AI usage quotas and logging in LearnMate AI.
---

# AI Integration & OpenRouter Skill (LearnMate AI)

## Core Guidelines

1. **Centralized OpenRouter Gateway (`src/lib/ai/`)**:
   - Route all LLM calls through a single server-side client configured via `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, and `OPENROUTER_DEFAULT_MODEL=openrouter/free`.
   - Support task-specific model mapping (`tutor`, `explanation`, `summarization`, `quiz_generation`, `quiz_evaluation`, `flashcards`, `planner`, `document_qa`, `recommendations`) with configurable fallback models.
2. **Structured Output Validation**:
   - Parse and validate all structured generations (quiz questions, answer keys, flashcards, study tasks, structured materials) against strict Zod schemas.
   - On schema failure, perform at most 2 bounded repair/retry attempts before returning a graceful typed error.
3. **RAG & Document Grounding**:
   - Isolate chunk retrieval by `userId` and selected `materialId`.
   - Use keyword/BM25-style scored chunk retrieval by default and enable vector similarity search only when an embedding model and MongoDB Atlas Vector Search index are verified active.
   - Wrap retrieved chunks in clear untrusted-content delimiters and instruct the system prompt to ignore embedded instructions.
4. **Reliability & Quotas**:
   - Enforce per-user daily token/request quotas and log every call in `aiUsageLogs` (task, model, latency, status, token counts, sanitized error).
