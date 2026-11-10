# LearnMate AI — API Specification

## 1. API Conventions

- **Base Path**: `/api/v1`
- **Runtime**: Node.js (`export const runtime = 'nodejs'`)
- **Authentication**: HTTP-only signed session cookies validated on the server.
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

## 3. Endpoint Groups (SRS Section 8)

| Group | Base Route | Access | Primary Responsibilities |
| :--- | :--- | :--- | :--- |
| **Auth** | `/api/v1/auth/*` | Public / Auth | Registration, sign-in, sign-out, password reset, email verification, session check |
| **Users** | `/api/v1/users/*` | Authenticated | Profile retrieval/update, language/timezone preferences, account & data deletion |
| **Onboarding** | `/api/v1/onboarding/*` | Student | Save/update country, education system, level/exam, subjects, daily study hours, learning style |
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

> Detailed route-by-route request/response schemas are finalized in **State 01**.
