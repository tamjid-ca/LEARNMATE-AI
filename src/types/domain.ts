/**
 * LearnMate AI — Core Domain Types & Enumerations
 * Grounded in docs/PROJECT_SRS.md Sections 3, 4, 6, and 7.
 */

export const USER_ROLES = ['student', 'content_manager', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ACCOUNT_STATUSES = ['active', 'suspended', 'pending_verification', 'deleted'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const LANGUAGES = ['en', 'bn'] as const;
export type SupportedLanguage = (typeof LANGUAGES)[number];

export const EXPLANATION_DEPTHS = ['beginner', 'intermediate', 'advanced'] as const;
export type ExplanationDepth = (typeof EXPLANATION_DEPTHS)[number];

export const LEARNING_STYLES = [
  'simple_explanations',
  'detailed_explanations',
  'conceptual_learning',
  'exam_focused',
  'problem_solving',
] as const;
export type LearningStyle = (typeof LEARNING_STYLES)[number];

export const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export const MATERIAL_TYPES = [
  'topic_explanation',
  'chapter_summary',
  'detailed_notes',
  'quick_revision_notes',
  'important_definitions',
  'formula_sheet',
  'key_concepts',
  'examples',
  'learning_guidelines',
  'exam_preparation_guidelines',
  'common_mistakes',
  'conceptual_faq',
] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];

export const QUESTION_TYPES = [
  'single_mcq',
  'multiple_mcq',
  'true_false',
  'short_answer',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const FLASHCARD_RATINGS = ['again', 'hard', 'good', 'easy'] as const;
export type FlashcardRating = (typeof FLASHCARD_RATINGS)[number];

export const STUDY_PLAN_STATUSES = ['active', 'completed', 'archived'] as const;
export type StudyPlanStatus = (typeof STUDY_PLAN_STATUSES)[number];

export const STUDY_TASK_STATUSES = ['pending', 'completed', 'skipped', 'rescheduled'] as const;
export type StudyTaskStatus = (typeof STUDY_TASK_STATUSES)[number];

export const STUDY_TASK_TYPES = [
  'learn_topic',
  'revision',
  'practice_quiz',
  'flashcard_review',
  'mock_exam',
  'final_revision',
] as const;
export type StudyTaskType = (typeof STUDY_TASK_TYPES)[number];

export const DOCUMENT_FORMATS = ['pdf', 'txt', 'docx'] as const;
export type DocumentFormat = (typeof DOCUMENT_FORMATS)[number];

export const DOCUMENT_PROCESSING_STATUSES = [
  'uploaded',
  'extracting',
  'chunking',
  'indexing',
  'ready',
  'failed',
  'deleted',
] as const;
export type DocumentProcessingStatus = (typeof DOCUMENT_PROCESSING_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'study_reminder',
  'upcoming_revision',
  'due_flashcards',
  'upcoming_exam',
  'missed_task',
  'learning_milestone',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const AI_TASK_TYPES = [
  'tutor',
  'explanation',
  'summarization',
  'quiz_generation',
  'quiz_evaluation',
  'flashcards',
  'planner',
  'document_qa',
  'recommendations',
] as const;
export type AITaskType = (typeof AI_TASK_TYPES)[number];

export const COLLECTION_NAMES = [
  'users',
  'educationSystems',
  'educationLevels',
  'examinations',
  'subjects',
  'chapters',
  'topics',
  'conversations',
  'messages',
  'generatedContents',
  'quizzes',
  'questions',
  'quizAttempts',
  'flashcardDecks',
  'flashcards',
  'reviewLogs',
  'studyPlans',
  'studyTasks',
  'uploadedMaterials',
  'documentChunks',
  'progressRecords',
  'notifications',
  'aiUsageLogs',
  'promptTemplates',
  'appSettings',
  'feedbackReports',
  'auditLogs',
] as const;
export type CollectionName = (typeof COLLECTION_NAMES)[number];
