# LearnMate AI

## Software Requirements Specification (SRS)

**Document Version:** 1.0  
**Date:** November 10, 2026  
**Project Type:** Full-Stack AI-Powered Educational Technology Platform  
**Status:** Baseline Product Specification

---

# 1. Introduction

## 1.1 Purpose

LearnMate AI is a personalized, AI-powered educational platform designed to help students learn academic subjects, understand concepts, practice examinations, prepare study materials, and manage their academic preparation through a unified application.

The platform will use OpenRouter's free AI models to provide AI-generated explanations, learning materials, quizzes, flashcards, study guidelines, and personalized preparation roadmaps.

The application will combine:

- AI tutoring and question answering.
- Subject-wise and topic-wise learning.
- AI-generated learning resources.
- Quiz and examination management.
- Flashcard-based revision.
- Personalized study planning.
- Document-based learning using RAG.
- Learning analytics and adaptive recommendations.
- Administrative curriculum and platform management.

The system must be modular, scalable, maintainable, responsive, and extensible to different education systems.

## 1.2 Product Vision

**One platform for learning, practicing, revising, and preparing for examinations with an AI-powered personal learning assistant.**

Initially, the application should prioritize the Bangladesh education system, particularly SSC, HSC, university-level education, and competitive examinations such as university admission and BCS.

However, the underlying architecture must support other countries, curricula, educational institutions, and examination systems without major architectural changes.

## 1.3 Project Objectives

1. Provide contextual AI assistance based on the student's selected subject, chapter, and topic.
2. Make learning resources accessible through AI-generated explanations, summaries, notes, and guidelines.
3. Automatically generate structured quizzes and practice examinations.
4. Improve memorization through personalized flashcards and spaced repetition.
5. Generate realistic study roadmaps based on examination dates and available study hours.
6. Track student performance and identify knowledge gaps.
7. Allow students to learn from their own documents and uploaded materials.
8. Give administrators complete control over curriculum structures, generated content, AI configurations, and platform management.
9. Maintain an affordable architecture that initially operates using free AI models.

## 1.4 Target Users

- School students.
- College and HSC students.
- University students.
- University admission candidates.
- BCS and other competitive examination candidates.
- Independent learners.
- Teachers and educational content managers.
- Platform administrators.

## 1.5 Terminology

| Term          | Definition                                    |
| ------------- | --------------------------------------------- |
| Curriculum    | An organized educational syllabus             |
| Subject       | An academic subject                           |
| Chapter       | A subdivision of a subject                    |
| Topic         | An individual learning concept                |
| AI Tutor      | Context-aware AI question-answering assistant |
| RAG           | Retrieval-Augmented Generation                |
| Flashcard     | A question-and-answer revision card           |
| Mastery       | Estimated understanding of a topic            |
| Study Roadmap | Personalized preparation schedule             |
| Generation    | AI-generated educational content              |

---

# 2. Product Scope

## 2.1 In Scope

The complete system will include:

1. Public website and product landing page.
2. Registration, authentication, and account management.
3. Student onboarding and personalization.
4. Education-system and curriculum management.
5. Subject, chapter, and topic management.
6. AI-powered subject-wise question answering.
7. AI-generated learning materials.
8. AI quiz generator and examination system.
9. Flashcard creation and spaced repetition.
10. Personalized study planner and preparation roadmap.
11. Student progress and performance analytics.
12. Document upload and RAG-based question answering.
13. Mock examination functionality.
14. Notifications and learning reminders.
15. Gamification and learning streaks.
16. Administrative dashboard.
17. AI usage monitoring and model configuration.
18. User and content management.
19. Responsive design and Bangla/English localization.

## 2.2 Out of Scope for Initial Releases

These features may be introduced after the core application is complete:

- Native Android and iOS applications.
- Live classes and video conferencing.
- Real-time teacher-student classroom management.
- Payment gateway and subscription billing.
- Social networking and public discussion forums.
- Automatic OCR of complex handwritten documents.
- Proctored examinations and anti-cheating surveillance.
- Dedicated fine-tuned proprietary AI models.

The architecture must not prevent these features from being introduced later.

---

# 3. User Roles and Permissions

## 3.1 Guest

Permissions:

- Access public landing pages.
- Explore public product information.
- Register or sign in.

## 3.2 Student

Permissions:

- Manage personal profile and learning preferences.
- Select education systems, subjects, and topics.
- Use AI tutoring.
- Generate and save learning materials.
- Generate and attempt quizzes.
- Create and revise flashcards.
- Create and manage preparation roadmaps.
- Upload personal study materials.
- View analytics and performance history.
- Manage notifications and preferences.
- Delete personal account data.

## 3.3 Content Manager / Educator

Permissions:

- Manage assigned curriculum content.
- Create and update educational resources.
- Review flagged AI-generated content.
- Manage published learning materials.
- View content-related reports.

## 3.4 Administrator

Permissions:

- Manage users and roles.
- Manage education systems and curricula.
- Manage subjects, chapters, and topics.
- Manage examinations and educational metadata.
- Manage AI model configurations.
- Manage prompt templates.
- Review AI generation logs and usage.
- Manage reports and user feedback.
- Configure application-level settings.
- Review audit logs.

Role-based access must be checked on the server, not just hidden in the frontend.

---

# 4. Functional Requirements

## 4.1 Authentication and User Management

**FR-AUTH-001:** The system shall support user registration.

**FR-AUTH-002:** The system shall support secure sign-in and sign-out.

**FR-AUTH-003:** The system shall support email verification and password recovery.

**FR-AUTH-004:** The system shall maintain user profiles containing:

- Full name.
- Email address.
- Profile image.
- Preferred language.
- Country.
- Education system.
- Education level.
- Academic institution (optional).
- Learning preferences.
- Time zone.
- Daily study availability.

**FR-AUTH-005:** The system shall support role-based access control.

**FR-AUTH-006:** Students shall be able to update their profile and privacy preferences.

**FR-AUTH-007:** Users shall be able to request account deletion and associated personal data deletion.

## 4.2 Student Onboarding

**FR-ONB-001:** First-time students shall complete an onboarding process.

**FR-ONB-002:** Students shall select their country and education system.

**FR-ONB-003:** Students shall select their education level or target examination.

**FR-ONB-004:** Students shall select the subjects they want to study.

**FR-ONB-005:** Students shall specify their preferred learning language.

**FR-ONB-006:** Students shall specify their approximate daily study availability.

**FR-ONB-007:** Students shall be able to select learning preferences such as:

- Simple explanations.
- Detailed explanations.
- Conceptual learning.
- Exam-focused learning.
- Problem-solving practice.

**FR-ONB-008:** Students shall be able to change their onboarding preferences later.

## 4.3 Curriculum and Academic Structure

The application shall maintain the following hierarchical structure:

**Education System → Education Level → Examination → Subject → Chapter → Topic**

For example:

Bangladesh → HSC → HSC 2027 → Physics → Mechanics → Newton's Laws of Motion.

**FR-CUR-001:** Students shall browse available education systems.

**FR-CUR-002:** Students shall browse subjects by education level and examination.

**FR-CUR-003:** Students shall browse chapters within subjects.

**FR-CUR-004:** Students shall browse individual topics within chapters.

**FR-CUR-005:** Each topic may contain:

- Name and description.
- Learning objectives.
- Prerequisite topics.
- Difficulty level.
- Estimated learning duration.
- Important concepts.
- Associated learning resources.
- Curriculum references.
- Importance or priority metadata, when supported by reliable syllabus information.

**FR-CUR-006:** The system shall support administrator-controlled curriculum creation and modification.

**FR-CUR-007:** Curriculum structures must be independent of generated AI content.

**FR-CUR-008:** Students shall be able to save topics to their personal learning lists.

**FR-CUR-009:** Administrators shall be able to import and export curriculum data using validated JSON or CSV formats.

## 4.4 AI Subject Tutor

**FR-TUTOR-001:** Students shall be able to ask questions related to a selected subject, chapter, or topic.

**FR-TUTOR-002:** The AI Tutor shall receive the student's educational context.

**FR-TUTOR-003:** The tutor shall support contextual follow-up conversations.

**FR-TUTOR-004:** The tutor shall generate:

- Concept explanations.
- Step-by-step solutions.
- Examples.
- Definitions.
- Comparisons.
- Practical applications.
- Revision guidance.
- Follow-up questions.

**FR-TUTOR-005:** Students shall be able to select explanation difficulty:

- Beginner.
- Intermediate.
- Advanced.

**FR-TUTOR-006:** Students shall be able to choose Bangla or English responses.

**FR-TUTOR-007:** The tutor shall preserve conversation history.

**FR-TUTOR-008:** Students shall be able to create, rename, and delete conversations.

**FR-TUTOR-009:** The system shall support streamed responses where supported by the selected model.

**FR-TUTOR-010:** The tutor shall provide document-based answers when the student explicitly selects an uploaded knowledge source.

**FR-TUTOR-011:** Where educational sources are available, the tutor should provide relevant source references.

**FR-TUTOR-012:** The interface shall clearly identify AI-generated content and communicate uncertainty when appropriate.

## 4.5 AI Learning Materials Generator

**FR-MAT-001:** Students shall generate learning materials from a selected topic.

**FR-MAT-002:** The system shall support the following material types:

- Topic explanations.
- Chapter summaries.
- Detailed notes.
- Quick revision notes.
- Important definitions.
- Formula sheets.
- Key concepts.
- Examples.
- Learning guidelines.
- Exam preparation guidelines.
- Common mistakes.
- Frequently asked conceptual questions.

**FR-MAT-003:** Students shall select the education level and explanation depth.

**FR-MAT-004:** Students shall save generated materials to their personal library.

**FR-MAT-005:** Students shall edit, organize, and delete personal notes.

**FR-MAT-006:** Students shall be able to regenerate materials using different instructions.

**FR-MAT-007:** Generated materials shall retain their associated subject, chapter, topic, language, AI model, and creation timestamp.

## 4.6 AI Quiz Generator and Examination System

**FR-QUIZ-001:** Students shall generate quizzes from:

- A complete subject.
- An individual chapter.
- A specific topic.
- Selected multiple topics.
- Uploaded documents.
- Saved study notes.

**FR-QUIZ-002:** The system shall support question formats:

- Single-answer MCQ.
- Multiple-answer MCQ.
- True/false.
- Short-answer questions.

**FR-QUIZ-003:** Students shall configure:

- Number of questions.
- Difficulty level.
- Question types.
- Topic selection.
- Time limit.
- Negative marking, when applicable.
- Whether explanations are shown immediately or after completion.

**FR-QUIZ-004:** Generated questions shall be validated before being saved.

**FR-QUIZ-005:** Every objective question shall have a defined correct answer and explanation.

**FR-QUIZ-006:** The system shall provide an interactive examination interface.

**FR-QUIZ-007:** Timed examinations shall display a countdown.

**FR-QUIZ-008:** Students shall be able to navigate between questions.

**FR-QUIZ-009:** The system shall automatically calculate objective-question scores.

**FR-QUIZ-010:** Short answers may be evaluated using AI against an explicit rubric. These results must be labelled as AI-assisted evaluations.

**FR-QUIZ-011:** The system shall save attempts and results.

**FR-QUIZ-012:** Students shall view correct answers, explanations, and performance summaries after submission.

**FR-QUIZ-013:** Students shall be able to retry quizzes.

**FR-QUIZ-014:** The system shall support mock examinations with configurable subject coverage and examination duration.

**FR-QUIZ-015:** Results shall identify weak topics and recommend relevant revision materials.

## 4.7 Smart Flashcards

**FR-FLASH-001:** Students shall generate flashcards using topics, chapters, notes, or uploaded documents.

**FR-FLASH-002:** Students shall create personal flashcard decks.

**FR-FLASH-003:** Each flashcard shall contain a front and back.

**FR-FLASH-004:** The interface shall support card flipping.

**FR-FLASH-005:** Students shall be able to edit and delete their cards.

**FR-FLASH-006:** Students shall review flashcards using spaced repetition.

**FR-FLASH-007:** Students shall rate each reviewed card:

- Again.
- Hard.
- Good.
- Easy.

**FR-FLASH-008:** The system shall calculate the next review date.

**FR-FLASH-009:** Students shall see due, upcoming, mastered, and difficult cards.

**FR-FLASH-010:** The system shall maintain review history.

A defined spaced-repetition algorithm, such as an SM-2-inspired scheduling implementation, shall be used consistently.

## 4.8 Personalized Study Planner and Preparation Roadmap

**FR-PLAN-001:** Students shall create preparation plans for examinations or personal learning goals.

**FR-PLAN-002:** Students shall specify:

- Target examination or goal.
- Examination date or target completion date.
- Selected subjects.
- Available daily study hours.
- Available study days.
- Preferred study schedule.
- Current proficiency estimates.

**FR-PLAN-003:** The system shall analyze the selected syllabus.

**FR-PLAN-004:** The system shall generate a preparation roadmap containing:

- Subjects and chapters.
- Topic-wise learning tasks.
- Daily study goals.
- Weekly milestones.
- Revision sessions.
- Practice sessions.
- Mock examinations.
- Final revision schedule.

**FR-PLAN-005:** Students shall view their schedules in list, calendar, and roadmap formats.

**FR-PLAN-006:** Students shall mark tasks as completed, skipped, or rescheduled.

**FR-PLAN-007:** Students shall manually edit the generated roadmap.

**FR-PLAN-008:** The system shall recalculate the schedule when the examination date or study availability changes.

**FR-PLAN-009:** Student performance shall influence future study recommendations.

**FR-PLAN-010:** The system shall prioritize weak topics and overdue revision activities.

**FR-PLAN-011:** The system shall not invent official examination weightings when reliable curriculum metadata is unavailable.

The roadmap must use deterministic scheduling rules for date allocation and feasibility. AI may assist with prioritization and explanations, but must not be the sole source of scheduling logic.

## 4.9 Document Upload and Personal Knowledge Base

**FR-DOC-001:** Students shall upload supported learning documents.

**FR-DOC-002:** Initial supported formats should include PDF, TXT, and DOCX.

**FR-DOC-003:** The system shall validate file type, file size, and upload permissions.

**FR-DOC-004:** Uploaded materials shall be associated with the user's account.

**FR-DOC-005:** The system shall extract readable text from uploaded documents.

**FR-DOC-006:** The system shall split extracted text into searchable chunks.

**FR-DOC-007:** The application shall support retrieval-based question answering.

**FR-DOC-008:** Students shall generate summaries, notes, quizzes, and flashcards from uploaded materials.

**FR-DOC-009:** Source references should identify relevant document pages or sections when available.

**FR-DOC-010:** The system shall support document deletion and corresponding content-index cleanup.

**FR-DOC-011:** The system shall isolate each user's private document collection.

For retrieval, implement an abstraction that supports keyword retrieval initially and semantic/vector retrieval when a compatible embedding model and MongoDB Atlas Vector Search configuration are available.

The system must not claim semantic retrieval is active when embedding configuration is missing.

## 4.10 Learning Analytics and Adaptive Learning

**FR-ANALYTICS-001:** Students shall have a personal learning analytics dashboard.

**FR-ANALYTICS-002:** The system shall track:

- Total study time where measurable.
- Completed topics.
- Quiz attempts.
- Quiz accuracy.
- Subject-wise performance.
- Topic-wise mastery.
- Flashcard review activity.
- Preparation plan completion.
- Learning streaks.

**FR-ANALYTICS-003:** The dashboard shall display performance trends.

**FR-ANALYTICS-004:** The system shall identify strong and weak topics.

**FR-ANALYTICS-005:** The system shall recommend relevant learning activities.

**FR-ANALYTICS-006:** The adaptive learning system shall use verified quiz results, completion history, and revision performance.

**FR-ANALYTICS-007:** Students shall be able to inspect the basis of major learning recommendations.

**FR-ANALYTICS-008:** Mastery scores shall be estimates and not presented as definitive assessments of student ability.

## 4.11 Notifications and Gamification

**FR-NOTIFY-001:** The platform shall support in-app notifications.

**FR-NOTIFY-002:** Notification types shall include:

- Study reminders.
- Upcoming revision activities.
- Due flashcards.
- Upcoming examinations.
- Missed study tasks.
- Learning milestones.

**FR-NOTIFY-003:** Students shall manage notification preferences.

**FR-GAME-001:** The application shall support learning streaks.

**FR-GAME-002:** The application may award points for meaningful study activities.

**FR-GAME-003:** The application may introduce badges and milestones.

**FR-GAME-004:** Gamification shall encourage learning rather than reward meaningless repeated actions.

## 4.12 Administrative Dashboard

**FR-ADMIN-001:** Administrators shall have a dedicated dashboard.

**FR-ADMIN-002:** Administrators shall view platform statistics.

**FR-ADMIN-003:** Administrators shall manage students and user permissions.

**FR-ADMIN-004:** Administrators shall manage education systems, examinations, subjects, chapters, and topics.

**FR-ADMIN-005:** Administrators shall review and manage flagged generated content.

**FR-ADMIN-006:** Administrators shall manage AI prompt templates.

**FR-ADMIN-007:** Administrators shall configure permitted OpenRouter model IDs for different tasks.

**FR-ADMIN-008:** Administrators shall view AI usage, token consumption, error rates, and model availability information when provided by the API.

**FR-ADMIN-009:** Administrators shall configure application-level generation limits.

**FR-ADMIN-010:** Administrators shall review feedback and user reports.

**FR-ADMIN-011:** Administrators shall view security-sensitive administrative audit logs.

**FR-ADMIN-012:** Administrators shall manage published educational content.

All administrative actions must be protected by server-side authorization and recorded where appropriate.

## 4.13 AI Usage and Reliability Management

**FR-AI-001:** All model requests shall pass through a centralized AI service.

**FR-AI-002:** The OpenRouter API key shall remain server-side.

**FR-AI-003:** Each AI task shall have a dedicated prompt template and configurable generation settings.

**FR-AI-004:** Model configuration shall be managed centrally.

**FR-AI-005:** The system shall support model fallback and failure handling.

**FR-AI-006:** The system shall validate structured AI outputs using schemas.

**FR-AI-007:** The system shall limit repeated generation attempts.

**FR-AI-008:** The system shall cache reusable generated content when appropriate.

**FR-AI-009:** The system shall implement per-user and platform-level usage controls.

**FR-AI-010:** The system shall record request status, model identifier, timestamps, latency, token information when available, and sanitized error metadata.

**FR-AI-011:** The application shall degrade gracefully if free AI models are unavailable or rate-limited.

---

# 5. System Architecture

## 5.1 Technology Stack

| Component        | Technology                                  |
| ---------------- | ------------------------------------------- |
| Frontend         | Next.js App Router                          |
| Language         | TypeScript                                  |
| Backend runtime  | Node.js                                     |
| API layer        | Next.js Route Handlers                      |
| Architecture     | Controller / Service / Repository           |
| Database         | MongoDB Atlas                               |
| ODM              | Mongoose                                    |
| AI Gateway       | OpenRouter                                  |
| UI framework     | Tailwind CSS                                |
| UI components    | shadcn/ui                                   |
| Icons            | Lucide                                      |
| Forms            | React Hook Form                             |
| Validation       | Zod                                         |
| Authentication   | Maintained Next.js-compatible auth solution |
| Document Storage | Vercel Blob / S3-compatible adapter         |
| Charts           | Recharts                                    |
| Testing          | Vitest and Playwright                       |
| Deployment       | Vercel                                      |
| Version Control  | Git                                         |

## 5.2 Application Architecture

The application shall use a modular monolithic architecture for its initial release.

Frontend modules shall communicate with backend API endpoints. Backend business logic shall not be implemented directly inside React components.

Recommended architecture:

```text
learnmate-ai/
│
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   ├── (auth)/
│   │   ├── (student)/
│   │   ├── admin/
│   │   └── api/
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── shared/
│   │   └── features/
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── onboarding/
│   │   ├── curriculum/
│   │   ├── tutor/
│   │   ├── materials/
│   │   ├── quizzes/
│   │   ├── flashcards/
│   │   ├── planner/
│   │   ├── documents/
│   │   ├── analytics/
│   │   ├── notifications/
│   │   └── admin/
│   │
│   ├── lib/
│   │   ├── ai/
│   │   ├── auth/
│   │   ├── database/
│   │   ├── storage/
│   │   ├── security/
│   │   └── validators/
│   │
│   ├── models/
│   ├── services/
│   ├── repositories/
│   ├── hooks/
│   ├── types/
│   └── config/
│
├── docs/
├── scripts/
├── tests/
├── public/
├── .agents/
├── Context.md
├── .env.example
└── README.md
```

The final structure may be adjusted during architecture design, but module boundaries and separation of concerns must be preserved.

## 5.3 Backend Responsibilities

The backend shall handle:

- Authentication and authorization.
- Database access.
- Business logic.
- Input validation.
- AI orchestration.
- Prompt management.
- Document processing.
- Usage management.
- Learning progress calculations.
- Notification management.
- API error handling.

## 5.4 Frontend Responsibilities

The frontend shall handle:

- Page layouts and navigation.
- Student and administrator dashboards.
- Interactive learning interfaces.
- Forms and client-side validation.
- Chat and streaming interfaces.
- Quiz and flashcard interactions.
- Study calendar and roadmaps.
- Charts and progress visualizations.
- Loading, empty, success, and error states.
- Responsive design and accessibility.

---

# 6. Database Requirements

MongoDB Atlas shall be the primary database.

Use Mongoose schemas with appropriate validation, timestamps, indexes, and relationship management.

## 6.1 Required Collections

| Collection        | Main responsibility                  |
| ----------------- | ------------------------------------ |
| users             | Student and administrator accounts   |
| educationSystems  | Country and education system         |
| educationLevels   | SSC, HSC, university, etc.           |
| examinations      | Examination definitions and metadata |
| subjects          | Academic subjects                    |
| chapters          | Subject chapters                     |
| topics            | Individual learning topics           |
| conversations     | AI tutoring conversations            |
| messages          | Conversation messages                |
| generatedContents | AI materials and generation metadata |
| quizzes           | Quiz and examination definitions     |
| questions         | Question bank                        |
| quizAttempts      | Student quiz submissions             |
| flashcardDecks    | Student flashcard collections        |
| flashcards        | Individual flashcards                |
| reviewLogs        | Spaced-repetition activity           |
| studyPlans        | Preparation plans                    |
| studyTasks        | Individual preparation tasks         |
| uploadedMaterials | Uploaded document metadata           |
| documentChunks    | Extracted and indexed content        |
| progressRecords   | Student learning progress            |
| notifications     | User notifications                   |
| aiUsageLogs       | AI request and usage records         |
| promptTemplates   | Centralized AI prompts               |
| appSettings       | Platform configuration               |
| feedbackReports   | Reported issues and feedback         |
| auditLogs         | Administrative activity records      |

## 6.2 Database Design Rules

1. Do not embed unlimited histories or large collections inside a single user document.
2. Use references for independently managed entities.
3. Use embedding for small bounded records where it improves query performance.
4. Add indexes for frequently queried fields.
5. Add compound indexes for user ownership and chronological retrieval.
6. Ensure user-owned records include ownership information.
7. Ensure every user-facing query checks ownership.
8. Add database pagination to large lists.
9. Avoid N+1 database query patterns.
10. Never store uploaded document binaries directly inside MongoDB documents.
11. Use connection pooling and reuse database connections across warm Node.js function instances.
12. Add indexes and validation for unique constraints.

---

# 7. AI Integration Requirements

## 7.1 OpenRouter

OpenRouter shall act as the central AI gateway.

Use:

```text
https://openrouter.ai/api/v1
```

Default routing can use:

```text
openrouter/free
```

However, the actual model identifiers must be configurable.

Do not assume a particular free model will always remain available, free, or suitable for every task.

The AI service must support:

- Chat completion.
- Streaming responses where available.
- Structured output where supported.
- Model configuration.
- Timeout handling.
- Retry policies.
- Fallback routing.
- Usage logging.
- Request caching.
- Rate limiting.

## 7.2 AI Task Categories

| AI service            | Responsibility                       |
| --------------------- | ------------------------------------ |
| tutorService          | Student question answering           |
| explanationService    | Topic explanations                   |
| materialService       | Notes and summaries                  |
| quizGenerationService | Quiz question generation             |
| quizEvaluationService | Rubric-based short-answer evaluation |
| flashcardService      | Flashcard generation                 |
| plannerService        | Study-plan suggestions               |
| documentQAService     | Document-grounded question answering |
| recommendationService | Learning recommendations             |

All these services must use a shared OpenRouter client and centralized configuration.

## 7.3 Structured Output Validation

AI-generated structured data must be validated before database persistence.

Examples:

- Quiz questions.
- Answer keys.
- Flashcards.
- Study-plan tasks.
- Learning materials metadata.

Use Zod schemas or an equivalent validation mechanism.

If parsing fails, apply a limited repair/regeneration process. Do not endlessly retry.

## 7.4 AI Content Reliability

The platform must:

- Avoid presenting unsupported AI-generated statements as verified facts.
- Avoid inventing references or citations.
- Distinguish general AI explanations from document-grounded answers.
- Preserve source metadata when available.
- Allow users to report incorrect answers.
- Log model failures and malformed outputs.
- Provide graceful messages when AI service limits are reached.

---

# 8. API Requirements

The backend shall expose versioned, documented endpoints.

Suggested endpoint groups:

| Endpoint                  | Purpose                        |
| ------------------------- | ------------------------------ |
| `/api/v1/auth/*`          | Authentication                 |
| `/api/v1/users/*`         | Profile and preferences        |
| `/api/v1/onboarding/*`    | Student onboarding             |
| `/api/v1/curriculum/*`    | Education systems and subjects |
| `/api/v1/topics/*`        | Topic details                  |
| `/api/v1/tutor/*`         | AI chat                        |
| `/api/v1/materials/*`     | Learning material generation   |
| `/api/v1/quizzes/*`       | Quiz creation and management   |
| `/api/v1/attempts/*`      | Quiz submissions               |
| `/api/v1/flashcards/*`    | Flashcard management           |
| `/api/v1/reviews/*`       | Flashcard review scheduling    |
| `/api/v1/study-plans/*`   | Preparation roadmaps           |
| `/api/v1/study-tasks/*`   | Study task management          |
| `/api/v1/documents/*`     | Document upload and retrieval  |
| `/api/v1/analytics/*`     | Learning analytics             |
| `/api/v1/notifications/*` | Notification operations        |
| `/api/v1/admin/*`         | Administrative operations      |

Requirements:

- Use consistent HTTP status codes.
- Validate all request bodies and query parameters.
- Apply authentication and authorization middleware.
- Provide standardized response structures.
- Implement pagination where necessary.
- Return safe, non-sensitive error messages.
- Never expose internal stack traces or secret configuration.

---

# 9. User Interface and Experience Requirements

## 9.1 Design Principles

The product should feel like a polished, modern EdTech SaaS application.

It should be:

- Professional.
- Minimal and visually consistent.
- Responsive.
- Accessible.
- Intuitive for students.
- Comfortable for extended study sessions.
- Consistent across student and administrator interfaces.

## 9.2 UI Requirements

1. Use shadcn/ui components for available interface primitives.
2. Do not create unnecessary hardcoded replacements for existing shadcn/ui components.
3. Build reusable domain-specific components by composing shadcn/ui primitives.
4. Implement dark and light themes.
5. Provide a theme toggle.
6. Support mobile, tablet, laptop, and desktop screens.
7. Provide collapsible responsive navigation.
8. Use consistent spacing, typography, and component styling.
9. Use tooltips for complex or verbose administrative information.
10. Provide skeleton loading states.
11. Provide empty states and meaningful error states.
12. Use accessible labels, keyboard navigation, and appropriate contrast.
13. Support both Bangla and English interfaces.
14. Implement proper Unicode and Bangla font rendering.
15. Provide a consistent design system for all application pages.

## 9.3 Main Navigation

Student navigation:

- Dashboard.
- My Learning.
- AI Tutor.
- Study Materials.
- Quiz Center.
- Flashcards.
- Study Planner.
- My Documents.
- Analytics.
- Notifications.
- Settings.

Administrator navigation:

- Overview.
- Users.
- Education Systems.
- Examinations.
- Subjects and Chapters.
- Topics.
- Content Management.
- AI Configuration.
- Prompt Management.
- Usage Logs.
- Reports and Feedback.
- Audit Logs.
- Settings.

---

# 10. Non-Functional Requirements

## 10.1 Performance

**NFR-PERF-001:** Common application pages should render efficiently on typical mobile and desktop devices.

**NFR-PERF-002:** API endpoints shall use pagination for large datasets.

**NFR-PERF-003:** Database queries shall use suitable indexes.

**NFR-PERF-004:** Reusable AI content shall be cached where appropriate.

**NFR-PERF-005:** Streaming responses shall be supported for applicable AI operations.

**NFR-PERF-006:** Expensive document processing shall not block ordinary application requests.

## 10.2 Security

**NFR-SEC-001:** All secrets shall be maintained through environment variables.

**NFR-SEC-002:** API keys shall never be exposed to the browser.

**NFR-SEC-003:** All sensitive administrative operations shall require server-side permission checks.

**NFR-SEC-004:** User-owned data shall be isolated by ownership checks.

**NFR-SEC-005:** Validate and sanitize untrusted data.

**NFR-SEC-006:** Implement request rate limiting.

**NFR-SEC-007:** Validate uploaded file type, size, and ownership.

**NFR-SEC-008:** Prevent unauthorized access to uploaded files.

**NFR-SEC-009:** Protect authentication and session data.

**NFR-SEC-010:** Record important administrative actions.

**NFR-SEC-011:** Prevent prompt injection from uploaded documents from overriding system instructions.

**NFR-SEC-012:** Never execute AI-generated code or arbitrary AI-generated database queries.

## 10.3 Reliability

- The application must handle database connection failures.
- AI failures must not crash the application.
- Repeated requests must not create duplicated records unintentionally.
- Document-processing jobs must support retry and idempotency.
- Failed operations must produce useful error messages.
- User progress must be saved reliably.

## 10.4 Scalability

- Use modular services.
- Avoid tightly coupled feature implementations.
- Support additional education systems.
- Support additional AI model providers in the future.
- Support higher usage through configurable limits and caching.
- Use a background-job abstraction for work that exceeds a request's safe execution time.

## 10.5 Accessibility and Compatibility

- Responsive across supported screen sizes.
- Keyboard accessible.
- Screen-reader-friendly labels.
- Sufficient color contrast.
- Modern Chrome, Firefox, Edge, and Safari support.
- Bangla and English language support.

---

# 11. File Storage and Background Processing

MongoDB shall store metadata, not large binary files.

An object storage adapter shall support Vercel Blob or another compatible provider.

The application shall store:

- File metadata.
- Storage keys.
- Owner ID.
- Processing status.
- Extraction status.
- Chunking status.
- Error information.
- Deletion status.

For document ingestion and other expensive operations:

1. Upload the document to object storage.
2. Create a processing job record.
3. Process it through a suitable queue, scheduled processor, or supported background workflow.
4. Save extracted text and document chunks.
5. Update the job status.
6. Retry recoverable failures safely.

Do not assume that a Vercel request handler behaves like a permanent background worker. Select an appropriate deployment-compatible processing strategy during implementation.

---

# 12. Deployment and Configuration

The platform shall deploy to Vercel.

MongoDB shall be hosted using MongoDB Atlas.

Required environment configuration:

```env
# Application
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# MongoDB
MONGODB_URI=

# Authentication
AUTH_SECRET=

# OpenRouter
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_DEFAULT_MODEL=openrouter/free
OPENROUTER_SITE_URL=
OPENROUTER_APP_NAME=LearnMate AI

# Object Storage
BLOB_READ_WRITE_TOKEN=

# Background Processing
CRON_SECRET=

# Logging
LOG_LEVEL=info
```

Only the necessary variables should be required for each enabled feature.

Provide `.env.example` with no real credentials.

The deployment process shall support:

- Local development.
- Preview deployment.
- Production deployment.
- Environment-specific configuration.
- Production build verification.
- Database connectivity verification.
- AI provider health checks.

---

# 13. Testing and Quality Assurance

## 13.1 Unit Testing

Test:

- Business logic.
- Validation schemas.
- Scheduling algorithms.
- Spaced repetition.
- Mastery calculations.
- AI response parsers.
- Permission checks.

## 13.2 Integration Testing

Test:

- MongoDB operations.
- Authentication.
- API endpoints.
- AI provider abstraction.
- Content generation and persistence.
- Quiz evaluation.
- Document ingestion.
- User data ownership.

## 13.3 End-to-End Testing

Test complete workflows:

1. Register and sign in.
2. Complete onboarding.
3. Select a subject and topic.
4. Ask the AI tutor a question.
5. Generate learning materials.
6. Generate and attempt a quiz.
7. Review flashcards.
8. Generate a study roadmap.
9. Upload a document and ask a document-based question.
10. View learning analytics.
11. Verify administrative operations.

## 13.4 Quality Gates

No implementation state shall be considered complete unless:

- TypeScript type checking passes.
- Linting passes.
- Relevant tests pass.
- Production build succeeds.
- Main user flows work.
- Authentication and authorization are verified.
- Responsive design is checked.
- No critical security issue remains unresolved.
- Documentation and `Context.md` are updated.

---

# 14. Acceptance Criteria

The complete application shall be accepted when:

1. Users can register and manage their accounts.
2. Students can configure their education profiles.
3. Administrators can manage curriculum structures.
4. Students can navigate from subjects to individual topics.
5. The AI Tutor provides context-aware answers.
6. Students can generate and save learning materials.
7. Students can generate, attempt, and review quizzes.
8. Students can generate and revise flashcards.
9. The flashcard review system schedules subsequent reviews.
10. Students can generate and modify preparation roadmaps.
11. Progress and performance analytics are available.
12. Students can upload documents and ask source-grounded questions.
13. The admin panel manages AI configuration and platform content.
14. The system handles rate limits and AI failures gracefully.
15. The application works responsively in dark and light modes.
16. Bangla and English language options are available.
17. All important workflows have automated tests.
18. Production deployment and configuration documentation are complete.

---

# 15. Project Delivery Strategy

The system shall be implemented through controlled development states.

| State | Description                                                         |
| ----- | ------------------------------------------------------------------- |
| 00    | Environment, Antigravity skills and plugins, project initialization |
| 01    | Architecture, database design, development conventions              |
| 02    | Application scaffold and design system                              |
| 03    | Authentication, authorization and onboarding                        |
| 04    | Education systems, curriculum and admin CMS                         |
| 05    | OpenRouter integration and AI infrastructure                        |
| 06    | AI Tutor and learning materials                                     |
| 07    | Quiz generation and examination system                              |
| 08    | Flashcards and spaced repetition                                    |
| 09    | Document upload and RAG                                             |
| 10    | Personalized study planner                                          |
| 11    | Analytics, notifications and gamification                           |
| 12    | Integration, security, accessibility and optimization               |
| 13    | Deployment and production readiness                                 |

Each state shall be completed, tested, documented, and recorded before proceeding to the next state.

The project shall use a persistent root-level `Context.md` document to maintain implementation progress and resume work across separate Antigravity conversations.

**The complete application, rather than a limited MVP, is the final delivery target.**
