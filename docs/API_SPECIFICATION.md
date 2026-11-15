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

## 3. Implemented Endpoints (Through State 04)

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
