# LearnMate AI — API Specification

## 1. API Conventions

- **Base Path**: `/api/v1`
- **Runtime**: Node.js (`export const runtime = 'nodejs'`)
- **Authentication**: HTTP-only signed session cookies (`learnmate_session`) or `Authorization: Bearer <token>` validated on the server via `resolveActorFromHeaders()`.
- **Validation**: All request bodies, query parameters, and route params are validated via Zod schemas before service execution.

## 2. Standardized Response Envelopes

### Success Response (`200 OK`, `201 Created`)
```json
{
  "success": true,
  "data": {},
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error Response (`400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`, `503`)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error summary",
    "details": []
  }
}
```

## 3. Implemented Endpoints (Through State 08)

| Method & Route | Auth | Description |
| :--- | :--- | :--- |
| `GET /api/v1/health` | Public | Service status, registered collection count (27), and AI task count (9). |
| `POST /api/v1/auth/register` | Public (Rate-limited) | Registers a new student (`role: 'student'` strictly enforced), sets `learnmate_session` cookie, issues verification token. |
| `POST /api/v1/auth/login` | Public (Rate-limited) | Authenticates email/password with `scrypt` timing-safe check and sets `learnmate_session` cookie. |
| `POST /api/v1/auth/logout` | Public / Auth | Clears `learnmate_session` HTTP-only cookie. |
| `GET /api/v1/auth/me` | Authenticated | Returns the current user's public profile (`passwordHash` omitted). |
| `POST /api/v1/auth/verify-email` | Public | Verifies email address using a signed `verify_email` action token. |
| `POST /api/v1/auth/forgot-password` | Public (Rate-limited) | Initiates password recovery without leaking account existence. |
| `POST /api/v1/auth/reset-password` | Public (Rate-limited) | Resets password using a signed `reset_password` token. |
| `GET /api/v1/users/profile` | Authenticated | Returns full student/admin profile and study preferences. |
| `PATCH /api/v1/users/profile` | Authenticated | Updates fullName, institution, country, preferredLanguage (`en`/`bn`), timezone, dailyStudyMinutes, learningPreferences, and notificationPreferences. |
| `DELETE /api/v1/users/profile` | Authenticated | Deletes the user account and purges personal data across all 16 user-owned collections (`FR-AUTH-007`). |
| `GET /api/v1/onboarding` | Authenticated | Returns current user onboarding state and `ONBOARDING_CURRICULUM_CATALOG`. |
| `POST /api/v1/onboarding` | Authenticated | Saves country, education system/level, target exam, selected subjects, language, daily study minutes, learning styles, timezone, and marks `onboardingCompleted = true`. |
| `GET /api/v1/curriculum` | Authenticated | Browses the 6-tier syllabus (`educationSystems`, `educationLevels`, `examinations`, `subjects`, `chapters`, paginated `topics`) and returns student `savedTopicIds`. |
| `GET /api/v1/topics` | Authenticated | Lists paginated curriculum topics with `subjectId`, `chapterId`, `difficulty`, `search`, and `savedOnly` filters. |
| `GET /api/v1/topics/[topicId]` | Authenticated | Returns topic details, parent subject & chapter, resolved prerequisite topics, and saved status. |
| `GET /api/v1/topics/saved` | Authenticated | Lists all topics saved to the authenticated student's personal learning list (`FR-CUR-008`). |
| `POST /api/v1/topics/saved` | Authenticated | Toggles a `topicId` in the authenticated student's personal learning list (`FR-CUR-008`). |
| `GET /api/v1/admin/curriculum` | Admin / Content Mgr | Returns full 6-tier curriculum CMS snapshot (including inactive records) and recent `auditLogs`. |
| `POST /api/v1/admin/curriculum` | Admin / Content Mgr | Creates a new curriculum entity (`educationSystem`..`topic`) with referential integrity validation and `auditLogs` recording. |
| `PATCH /api/v1/admin/curriculum` | Admin / Content Mgr | Updates an existing curriculum entity and records an audit log. |
| `DELETE /api/v1/admin/curriculum` | Admin / Content Mgr | Deletes a curriculum entity (blocking deletion if child records exist) and records an audit log. |
| `GET /api/v1/admin/curriculum/import-export` | Admin / Content Mgr | Exports the curriculum hierarchy as a JSON bundle or CSV topic sheet (`FR-CUR-009`). |
| `POST /api/v1/admin/curriculum/import-export` | Admin / Content Mgr | Imports validated JSON bundles or CSV topic rows and records an audit log (`FR-CUR-009`). |
| `GET /api/v1/admin/users` | Admin (`admin:users`) | Lists platform users with role, status, search, and pagination filters (`FR-ADMIN-003`). |
| `PATCH /api/v1/admin/users` | Admin (`admin:users`) | Updates user `role` or `status` (preventing self-demotion/self-suspension) and logs to `auditLogs`. |
| `GET /api/v1/admin/ai/config` | Admin (`admin:ai_config`) | Returns active OpenRouter default/task/fallback models, student daily quotas, caching flag, and key status (`FR-ADMIN-007`). |
| `PATCH /api/v1/admin/ai/config` | Admin (`admin:ai_config`) | Updates OpenRouter model routing, fallback models, daily request/token quotas, and response caching (`FR-ADMIN-009`). |
| `GET /api/v1/admin/ai/prompts` | Admin (`admin:prompts`) | Lists versioned prompt templates across all 9 AI task types (`FR-ADMIN-006`). |
| `POST /api/v1/admin/ai/prompts` | Admin (`admin:prompts`) | Publishes a new versioned prompt template for an AI task and records an audit log. |
| `GET /api/v1/admin/ai/usage` | Admin (`admin:usage_logs`) | Returns paginated `aiUsageLogs` and aggregate token, latency, cache, and error telemetry (`FR-ADMIN-008`, `FR-AI-010`). |
| `GET /api/v1/tutor/conversations` | Authenticated | Lists the authenticated student's AI Tutor conversations (`FR-TUTOR-002`). |
| `POST /api/v1/tutor/conversations` | Authenticated | Starts a new contextual AI Tutor conversation bound to a curriculum topic/chapter/subject, optionally executing an initial message turn (`FR-TUTOR-001`, `FR-TUTOR-003`). |
| `GET /api/v1/tutor/conversations/[conversationId]` | Authenticated (Owner) | Returns conversation metadata and chronological message history (`FR-TUTOR-002`). |
| `PATCH /api/v1/tutor/conversations/[conversationId]` | Authenticated (Owner) | Renames, archives, or updates language/depth settings on a tutor conversation (`FR-TUTOR-008`). |
| `DELETE /api/v1/tutor/conversations/[conversationId]` | Authenticated (Owner) | Deletes a tutor conversation and cascades deletion across its messages (`FR-TUTOR-008`). |
| `POST /api/v1/tutor/conversations/[conversationId]/messages` | Authenticated (Owner) | Sends a student question with pedagogical response style (`step_by_step`, `examples`, etc.), attaches curriculum `sourceReferences`, and returns JSON or `text/event-stream` SSE (`FR-TUTOR-004..011`). |
| `POST /api/v1/tutor/messages/[messageId]/feedback` | Authenticated (Owner) | Rates a tutor message (`helpful`, `unhelpful`, `flagged`) and records a `feedbackReports` entry when flagged (`FR-TUTOR-012`). |
| `GET /api/v1/materials` | Authenticated | Lists paginated study materials in the student's personal library with `subjectId`, `topicId`, `materialType`, `language`, and `savedOnly` filters (`FR-MAT-005`). |
| `POST /api/v1/materials` | Authenticated | Generates structured study notes across all 12 `MaterialType` entries, reusing cached personal notes unless `regenerate: true` is specified (`FR-MAT-002..006`). |
| `GET /api/v1/materials/[materialId]` | Authenticated (Owner) | Retrieves a single generated study material record (`FR-MAT-005`). |
| `PATCH /api/v1/materials/[materialId]` | Authenticated (Owner) | Updates personal study note title, Markdown content, library save status, or flags for review (`FR-MAT-005`). |
| `DELETE /api/v1/materials/[materialId]` | Authenticated (Owner) | Deletes a generated study material from the student's personal library (`FR-MAT-005`). |
| `GET /api/v1/admin/content` | Admin / Content Mgr (`content:review`) | Lists flagged and recently generated AI study materials for moderation (`FR-ADMIN-005`, `FR-ADMIN-012`). |
| `PATCH /api/v1/admin/content` | Admin / Content Mgr (`content:review`) | Clears flags or publishes reviewed AI study materials (`FR-ADMIN-005`). |
| `GET /api/v1/quizzes` | Authenticated | Lists paginated practice quizzes and mock examinations with attempt counts and best accuracy (`FR-QUIZ-011`). |
| `POST /api/v1/quizzes` | Authenticated | Generates a schema-validated quiz or timed mock exam across 4 question types (`single_mcq`, `multiple_mcq`, `true_false`, `short_answer`) and starts an initial attempt (`FR-QUIZ-001..005`, `FR-QUIZ-014`). |
| `GET /api/v1/quizzes/[quizId]` | Authenticated (Owner) | Returns quiz metadata, active/solution questions (`includeSolutions=true` after submission), and attempt history (`FR-QUIZ-006`, `FR-QUIZ-012`). |
| `POST /api/v1/attempts` | Authenticated (Owner) | Starts a new or retry examination attempt for an existing quiz (`FR-QUIZ-013`). |
| `GET /api/v1/attempts/[attemptId]` | Authenticated (Owner) | Retrieves attempt status, responses, questions, and weak-topic diagnostics (`FR-QUIZ-011`, `FR-QUIZ-015`). |
| `POST /api/v1/attempts/[attemptId]` | Authenticated (Owner) | Submits attempt answers, auto-scores objective items with negative marking, evaluates short answers via AI rubric, and identifies weak topics & recommended revision materials (`FR-QUIZ-009..015`). |
| `GET /api/v1/flashcards` | Authenticated | Lists personal flashcard decks with due, upcoming, mastered, and difficult counts (`FR-FLASH-002`, `FR-FLASH-009`). |
| `POST /api/v1/flashcards` | Authenticated | Creates a manual flashcard deck (`mode: 'manual'`) or generates an AI active-recall deck from topics/notes (`mode: 'ai'` — `FR-FLASH-001..003`). |
| `GET /api/v1/flashcards/[id]` | Authenticated (Owner) | Retrieves a flashcard deck, its cards, and category summary (`FR-FLASH-002`). |
| `POST /api/v1/flashcards/[id]` | Authenticated (Owner) | Appends a new flashcard to an existing deck (`FR-FLASH-003`). |
| `PATCH /api/v1/flashcards/[id]` | Authenticated (Owner) | Edits a flashcard's front, back, or hint (`FR-FLASH-005`). |
| `DELETE /api/v1/flashcards/[id]` | Authenticated (Owner) | Deletes a flashcard or entire deck (`?type=deck` — `FR-FLASH-005`). |
| `GET /api/v1/reviews` | Authenticated | Returns spaced-repetition card queue (`filter=due|upcoming|mastered|difficult|all`), summary counts, and recent `reviewLogs` (`FR-FLASH-009`, `FR-FLASH-010`). |
| `POST /api/v1/reviews` | Authenticated (Owner) | Submits an SM-2 card rating (`again`, `hard`, `good`, `easy`), updates `nextReviewAt` & `masteryState`, and records a `reviewLogs` entry (`FR-FLASH-006..010`). |

## 4. Planned Endpoint Groups (States 04–12)

| Group | Base Route | Access | Primary Responsibilities |
| :--- | :--- | :--- | :--- |
| **Curriculum** | `/api/v1/curriculum/*` | Authenticated | Browse education systems, levels, examinations, subjects, chapters |
| **Topics** | `/api/v1/topics/*` | Authenticated | Topic details, prerequisites, saved personal topic list |
| **AI Tutor** | `/api/v1/tutor/*` | Student | Conversation CRUD, contextual message send/stream, Bangla/English & depth controls |
| **Materials** | `/api/v1/materials/*` | Student | Generate 12 material types from topics/notes, save, edit, regenerate, delete |
| **Quizzes** | `/api/v1/quizzes/*` | Student | Generate & validate quizzes/mock exams, fetch active exam questions (without answer keys) |
| **Attempts** | `/api/v1/attempts/*` | Student | Submit quiz answers, auto-score objective items, rubric-grade short answers, review results |
| **Flashcards** | `/api/v1/flashcards/*` | Student | Deck & card CRUD, AI flashcard generation from topics/notes/documents |
| **Reviews** | `/api/v1/reviews/*` | Student | Fetch due queue, submit SM-2 rating (`again`, `hard`, `good`, `easy`), review history |
| **Study Plans** | `/api/v1/study-plans/*` | Student | Create/recalculate exam preparation roadmaps, calendar/list/milestone views |
| **Study Tasks** | `/api/v1/study-tasks/*` | Student | Mark tasks completed/skipped/rescheduled, manual task edits |
| **Documents** | `/api/v1/documents/*` | Student | Upload PDF/TXT/DOCX, check extraction status, grounded RAG Q&A with citations, delete |
| **Analytics** | `/api/v1/analytics/*` | Student | Study time, quiz accuracy, topic mastery estimates, streaks, adaptive recommendations |
| **Notifications** | `/api/v1/notifications/*` | Student | List notifications, mark read, update notification preferences |
| **Admin** | `/api/v1/admin/*` | Admin / Content Mgr | Users & roles, curriculum CMS & import/export, AI models & prompts, usage logs, reports, audit logs |
