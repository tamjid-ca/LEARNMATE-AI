# LearnMate AI — AI Integration & OpenRouter Architecture

## 1. Centralized OpenRouter Gateway

All AI operations pass exclusively through `src/lib/ai/` on the server.
- **Base URL**: `https://openrouter.ai/api/v1`
- **Default Model**: `openrouter/free` (with dynamic task-level overrides configured via environment variables or the Administrator AI Configuration dashboard in `appSettings`).

## 2. Task-Specific Model Routing

| Task Key | Service | Output Mode | Default Model Env Override |
| :--- | :--- | :--- | :--- |
| `tutor` | `tutorService` | Streaming / Markdown | `AI_MODEL_TUTOR` |
| `explanation` | `explanationService` | Structured JSON / Markdown | `AI_MODEL_EXPLANATION` |
| `summarization` | `materialService` | Structured JSON | `AI_MODEL_SUMMARIZATION` |
| `quiz_generation` | `quizGenerationService` | Strict Zod JSON | `AI_MODEL_QUIZ_GENERATION` |
| `quiz_evaluation` | `quizEvaluationService` | Strict Zod JSON | `AI_MODEL_QUIZ_EVALUATION` |
| `flashcards` | `flashcardService` | Strict Zod JSON | `AI_MODEL_FLASHCARDS` |
| `planner` | `plannerService` | Strict Zod JSON | `AI_MODEL_PLANNER` |
| `document_qa` | `documentQAService` | Grounded JSON / Stream | `AI_MODEL_DOCUMENT_QA` |
| `recommendations` | `recommendationService` | Strict Zod JSON | `AI_MODEL_RECOMMENDATIONS` |

## 3. Structured Output Validation & Resilience

1. **Schema Validation**: Every non-chat generation response is extracted and validated against a task-specific Zod schema (verifying required fields, valid option arrays, in-bounds correct answers, and non-empty explanations).
2. **Bounded Repair / Retry**: If a free model returns malformed JSON or fails schema validation, the gateway retries up to **2 times** (including fallback model routing) before returning a clean, user-friendly error.
3. **Quotas, Caching & Logging**:
   - Per-user daily request/token quotas prevent abuse.
   - Reusable topic explanations/materials are cached in `generatedContents`.
   - Every request records latency, model ID, token counts, and sanitized status in `aiUsageLogs`.
4. **RAG Grounding & Prompt Injection Defense**:
   - Uploaded document chunks are isolated by `userId` and wrapped in `<untrusted_document_context>` tags with explicit system instructions to ignore embedded prompt overrides.
   - Keyword retrieval works by default; semantic vector search is only advertised when `AI_EMBEDDING_MODEL` and Atlas Vector Search are active.
