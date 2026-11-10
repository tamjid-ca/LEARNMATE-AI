/**
 * LearnMate AI — Authoritative Database Schema & Index Registry (27 SRS Collections)
 * Grounded in docs/PROJECT_SRS.md Section 6.1 and Section 6.2.
 * Used both to construct Mongoose schemas and to run automated schema/index audits.
 */

import {
  ACCOUNT_STATUSES,
  AI_TASK_TYPES,
  type CollectionName,
  DIFFICULTY_LEVELS,
  DOCUMENT_FORMATS,
  DOCUMENT_PROCESSING_STATUSES,
  EXPLANATION_DEPTHS,
  FLASHCARD_RATINGS,
  LANGUAGES,
  LEARNING_STYLES,
  MATERIAL_TYPES,
  NOTIFICATION_TYPES,
  QUESTION_TYPES,
  STUDY_PLAN_STATUSES,
  STUDY_TASK_STATUSES,
  STUDY_TASK_TYPES,
  USER_ROLES,
} from '../../types/domain.ts';

export type FieldType =
  | 'ObjectId'
  | 'String'
  | 'Number'
  | 'Boolean'
  | 'Date'
  | 'StringArray'
  | 'NumberArray'
  | 'ObjectIdArray'
  | 'Subdocument'
  | 'Mixed';

export interface SchemaFieldSpec {
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  ref?: CollectionName;
  enumValues?: readonly string[];
  defaultValue?: unknown;
  sensitive?: boolean; // Excluded from default projections / logs (e.g. passwordHash, correctAnswer)
}

export interface IndexSpec {
  fields: Record<string, 1 | -1 | 'text'>;
  unique?: boolean;
  sparse?: boolean;
  description: string;
}

export interface CollectionBlueprint {
  name: CollectionName;
  ownershipScope: 'user' | 'curriculum_cms' | 'admin_system' | 'parent_quiz';
  ownerField?: string;
  timestamps: true;
  fields: Record<string, SchemaFieldSpec>;
  indexes: readonly IndexSpec[];
}

export const SCHEMA_REGISTRY: Record<CollectionName, CollectionBlueprint> = {
  users: {
    name: 'users',
    ownershipScope: 'user',
    ownerField: '_id',
    timestamps: true,
    fields: {
      fullName: { type: 'String', required: true },
      email: { type: 'String', required: true, unique: true },
      passwordHash: { type: 'String', required: true, sensitive: true },
      role: { type: 'String', required: true, enumValues: USER_ROLES, defaultValue: 'student' },
      status: { type: 'String', required: true, enumValues: ACCOUNT_STATUSES, defaultValue: 'active' },
      emailVerifiedAt: { type: 'Date' },
      profileImageUrl: { type: 'String' },
      preferredLanguage: { type: 'String', required: true, enumValues: LANGUAGES, defaultValue: 'en' },
      country: { type: 'String', defaultValue: 'BD' },
      educationSystemId: { type: 'ObjectId', ref: 'educationSystems' },
      educationLevelId: { type: 'ObjectId', ref: 'educationLevels' },
      targetExaminationId: { type: 'ObjectId', ref: 'examinations' },
      selectedSubjectIds: { type: 'ObjectIdArray', ref: 'subjects' },
      savedTopicIds: { type: 'ObjectIdArray', ref: 'topics' },
      institution: { type: 'String' },
      learningPreferences: { type: 'StringArray', enumValues: LEARNING_STYLES },
      timezone: { type: 'String', required: true, defaultValue: 'Asia/Dhaka' },
      dailyStudyMinutes: { type: 'Number', defaultValue: 120 },
      onboardingCompleted: { type: 'Boolean', required: true, defaultValue: false },
      streakCurrentDays: { type: 'Number', defaultValue: 0 },
      streakLongestDays: { type: 'Number', defaultValue: 0 },
      lastStudyDateKey: { type: 'String' },
      experiencePoints: { type: 'Number', defaultValue: 0 },
      badges: { type: 'StringArray' },
      notificationPreferences: { type: 'Subdocument' },
    },
    indexes: [
      { fields: { email: 1 }, unique: true, description: 'Unique email lookup for auth' },
      { fields: { role: 1, status: 1, createdAt: -1 }, description: 'Admin user management filtering' },
      { fields: { educationSystemId: 1, educationLevelId: 1 }, description: 'Cohort lookup by curriculum' },
    ],
  },

  educationSystems: {
    name: 'educationSystems',
    ownershipScope: 'curriculum_cms',
    timestamps: true,
    fields: {
      code: { type: 'String', required: true, unique: true },
      name: { type: 'String', required: true },
      country: { type: 'String', required: true },
      description: { type: 'String' },
      supportedLanguages: { type: 'StringArray', enumValues: LANGUAGES },
      isActive: { type: 'Boolean', required: true, defaultValue: true },
    },
    indexes: [
      { fields: { code: 1 }, unique: true, description: 'Unique education system code (e.g. BD-NCTB)' },
      { fields: { country: 1, isActive: 1 }, description: 'Active country curriculum listing' },
    ],
  },

  educationLevels: {
    name: 'educationLevels',
    ownershipScope: 'curriculum_cms',
    timestamps: true,
    fields: {
      educationSystemId: { type: 'ObjectId', required: true, ref: 'educationSystems' },
      code: { type: 'String', required: true },
      name: { type: 'String', required: true },
      description: { type: 'String' },
      order: { type: 'Number', required: true, defaultValue: 0 },
      isActive: { type: 'Boolean', required: true, defaultValue: true },
    },
    indexes: [
      {
        fields: { educationSystemId: 1, code: 1 },
        unique: true,
        description: 'Unique level code within an education system',
      },
      { fields: { educationSystemId: 1, isActive: 1, order: 1 }, description: 'Ordered level browsing' },
    ],
  },

  examinations: {
    name: 'examinations',
    ownershipScope: 'curriculum_cms',
    timestamps: true,
    fields: {
      educationSystemId: { type: 'ObjectId', required: true, ref: 'educationSystems' },
      educationLevelId: { type: 'ObjectId', required: true, ref: 'educationLevels' },
      code: { type: 'String', required: true },
      name: { type: 'String', required: true },
      description: { type: 'String' },
      examDate: { type: 'Date' },
      isActive: { type: 'Boolean', required: true, defaultValue: true },
    },
    indexes: [
      {
        fields: { educationLevelId: 1, code: 1 },
        unique: true,
        description: 'Unique examination code per education level',
      },
      { fields: { educationLevelId: 1, isActive: 1, examDate: 1 }, description: 'Active exams by level' },
    ],
  },

  subjects: {
    name: 'subjects',
    ownershipScope: 'curriculum_cms',
    timestamps: true,
    fields: {
      educationSystemId: { type: 'ObjectId', required: true, ref: 'educationSystems' },
      educationLevelId: { type: 'ObjectId', required: true, ref: 'educationLevels' },
      examinationIds: { type: 'ObjectIdArray', ref: 'examinations' },
      code: { type: 'String', required: true },
      name: { type: 'String', required: true },
      nameBn: { type: 'String' },
      description: { type: 'String' },
      order: { type: 'Number', required: true, defaultValue: 0 },
      isActive: { type: 'Boolean', required: true, defaultValue: true },
    },
    indexes: [
      {
        fields: { educationLevelId: 1, code: 1 },
        unique: true,
        description: 'Unique subject code per education level',
      },
      { fields: { educationLevelId: 1, isActive: 1, order: 1 }, description: 'Ordered subject catalog' },
      { fields: { examinationIds: 1, isActive: 1 }, description: 'Subjects mapped to target examinations' },
    ],
  },

  chapters: {
    name: 'chapters',
    ownershipScope: 'curriculum_cms',
    timestamps: true,
    fields: {
      subjectId: { type: 'ObjectId', required: true, ref: 'subjects' },
      chapterNumber: { type: 'Number', required: true },
      title: { type: 'String', required: true },
      titleBn: { type: 'String' },
      description: { type: 'String' },
      order: { type: 'Number', required: true, defaultValue: 0 },
      isActive: { type: 'Boolean', required: true, defaultValue: true },
    },
    indexes: [
      {
        fields: { subjectId: 1, chapterNumber: 1 },
        unique: true,
        description: 'Unique chapter number per subject',
      },
      { fields: { subjectId: 1, isActive: 1, order: 1 }, description: 'Ordered chapter tree per subject' },
    ],
  },

  topics: {
    name: 'topics',
    ownershipScope: 'curriculum_cms',
    timestamps: true,
    fields: {
      subjectId: { type: 'ObjectId', required: true, ref: 'subjects' },
      chapterId: { type: 'ObjectId', required: true, ref: 'chapters' },
      code: { type: 'String', required: true },
      title: { type: 'String', required: true },
      titleBn: { type: 'String' },
      description: { type: 'String' },
      learningObjectives: { type: 'StringArray' },
      prerequisiteTopicIds: { type: 'ObjectIdArray', ref: 'topics' },
      difficulty: { type: 'String', required: true, enumValues: DIFFICULTY_LEVELS, defaultValue: 'medium' },
      estimatedMinutes: { type: 'Number', required: true, defaultValue: 45 },
      keyConcepts: { type: 'StringArray' },
      curriculumReferences: { type: 'StringArray' },
      syllabusWeightVerified: { type: 'Boolean', defaultValue: false },
      syllabusPriorityScore: { type: 'Number' },
      order: { type: 'Number', required: true, defaultValue: 0 },
      isActive: { type: 'Boolean', required: true, defaultValue: true },
    },
    indexes: [
      { fields: { chapterId: 1, code: 1 }, unique: true, description: 'Unique topic code per chapter' },
      { fields: { chapterId: 1, isActive: 1, order: 1 }, description: 'Ordered topic list per chapter' },
      { fields: { subjectId: 1, isActive: 1, order: 1 }, description: 'Subject-wide topic traversal' },
      { fields: { title: 'text', description: 'text' }, description: 'Topic keyword search' },
    ],
  },

  conversations: {
    name: 'conversations',
    ownershipScope: 'user',
    ownerField: 'userId',
    timestamps: true,
    fields: {
      userId: { type: 'ObjectId', required: true, ref: 'users' },
      title: { type: 'String', required: true },
      subjectId: { type: 'ObjectId', ref: 'subjects' },
      chapterId: { type: 'ObjectId', ref: 'chapters' },
      topicId: { type: 'ObjectId', ref: 'topics' },
      uploadedMaterialId: { type: 'ObjectId', ref: 'uploadedMaterials' },
      language: { type: 'String', required: true, enumValues: LANGUAGES, defaultValue: 'en' },
      explanationDepth: {
        type: 'String',
        required: true,
        enumValues: EXPLANATION_DEPTHS,
        defaultValue: 'intermediate',
      },
      messageCount: { type: 'Number', defaultValue: 0 },
      lastMessageAt: { type: 'Date' },
      isArchived: { type: 'Boolean', defaultValue: false },
    },
    indexes: [
      { fields: { userId: 1, isArchived: 1, updatedAt: -1 }, description: 'User conversation history list' },
      { fields: { userId: 1, topicId: 1, updatedAt: -1 }, description: 'Topic-scoped tutor conversations' },
    ],
  },

  messages: {
    name: 'messages',
    ownershipScope: 'user',
    ownerField: 'userId',
    timestamps: true,
    fields: {
      conversationId: { type: 'ObjectId', required: true, ref: 'conversations' },
      userId: { type: 'ObjectId', required: true, ref: 'users' },
      role: { type: 'String', required: true, enumValues: ['user', 'assistant', 'system'] },
      content: { type: 'String', required: true },
      modelId: { type: 'String' },
      isDocumentGrounded: { type: 'Boolean', defaultValue: false },
      sourceReferences: { type: 'Subdocument' },
      feedbackRating: { type: 'String', enumValues: ['helpful', 'unhelpful', 'flagged'] },
    },
    indexes: [
      {
        fields: { conversationId: 1, createdAt: 1 },
        description: 'Chronological message retrieval in a conversation',
      },
      { fields: { userId: 1, createdAt: -1 }, description: 'User message ownership verification' },
    ],
  },

  generatedContents: {
    name: 'generatedContents',
    ownershipScope: 'user',
    ownerField: 'userId',
    timestamps: true,
    fields: {
      userId: { type: 'ObjectId', required: true, ref: 'users' },
      subjectId: { type: 'ObjectId', ref: 'subjects' },
      chapterId: { type: 'ObjectId', ref: 'chapters' },
      topicId: { type: 'ObjectId', ref: 'topics' },
      uploadedMaterialId: { type: 'ObjectId', ref: 'uploadedMaterials' },
      materialType: { type: 'String', required: true, enumValues: MATERIAL_TYPES },
      title: { type: 'String', required: true },
      contentMarkdown: { type: 'String', required: true },
      structuredSections: { type: 'Subdocument' },
      language: { type: 'String', required: true, enumValues: LANGUAGES, defaultValue: 'en' },
      explanationDepth: {
        type: 'String',
        required: true,
        enumValues: EXPLANATION_DEPTHS,
        defaultValue: 'intermediate',
      },
      modelId: { type: 'String', required: true },
      isSavedToLibrary: { type: 'Boolean', defaultValue: true },
      isPublishedByAdmin: { type: 'Boolean', defaultValue: false },
      isFlagged: { type: 'Boolean', defaultValue: false },
      cacheKey: { type: 'String' },
    },
    indexes: [
      {
        fields: { userId: 1, isSavedToLibrary: 1, materialType: 1, createdAt: -1 },
        description: 'Student personal study library filtering',
      },
      { fields: { userId: 1, topicId: 1, materialType: 1 }, description: 'Topic material lookup' },
      { fields: { cacheKey: 1 }, sparse: true, description: 'Reusable content cache lookup' },
    ],
  },

  quizzes: {
    name: 'quizzes',
    ownershipScope: 'user',
    ownerField: 'userId',
    timestamps: true,
    fields: {
      userId: { type: 'ObjectId', required: true, ref: 'users' },
      title: { type: 'String', required: true },
      mode: { type: 'String', required: true, enumValues: ['practice', 'mock_exam'], defaultValue: 'practice' },
      subjectId: { type: 'ObjectId', ref: 'subjects' },
      chapterId: { type: 'ObjectId', ref: 'chapters' },
      topicIds: { type: 'ObjectIdArray', ref: 'topics' },
      uploadedMaterialId: { type: 'ObjectId', ref: 'uploadedMaterials' },
      generatedContentId: { type: 'ObjectId', ref: 'generatedContents' },
      difficulty: { type: 'String', required: true, enumValues: DIFFICULTY_LEVELS, defaultValue: 'medium' },
      questionTypes: { type: 'StringArray', enumValues: QUESTION_TYPES },
      questionCount: { type: 'Number', required: true },
      timeLimitSeconds: { type: 'Number' },
      negativeMarkingFactor: { type: 'Number', defaultValue: 0 },
      feedbackTiming: {
        type: 'String',
        required: true,
        enumValues: ['after_submission', 'immediate'],
        defaultValue: 'after_submission',
      },
      language: { type: 'String', required: true, enumValues: LANGUAGES, defaultValue: 'en' },
      modelId: { type: 'String' },
    },
    indexes: [
      { fields: { userId: 1, mode: 1, createdAt: -1 }, description: 'Student quiz & mock exam history' },
      { fields: { userId: 1, subjectId: 1, createdAt: -1 }, description: 'Subject quiz filtering' },
    ],
  },

  questions: {
    name: 'questions',
    ownershipScope: 'parent_quiz',
    ownerField: 'userId',
    timestamps: true,
    fields: {
      quizId: { type: 'ObjectId', required: true, ref: 'quizzes' },
      userId: { type: 'ObjectId', required: true, ref: 'users' },
      topicId: { type: 'ObjectId', ref: 'topics' },
      order: { type: 'Number', required: true },
      questionType: { type: 'String', required: true, enumValues: QUESTION_TYPES },
      difficulty: { type: 'String', required: true, enumValues: DIFFICULTY_LEVELS },
      promptText: { type: 'String', required: true },
      options: { type: 'Subdocument' },
      correctOptionIds: { type: 'StringArray', sensitive: true },
      expectedShortAnswerRubric: { type: 'String', sensitive: true },
      explanation: { type: 'String', required: true, sensitive: true },
      points: { type: 'Number', required: true, defaultValue: 1 },
    },
    indexes: [
      { fields: { quizId: 1, order: 1 }, unique: true, description: 'Ordered questions within a quiz' },
      { fields: { userId: 1, topicId: 1 }, description: 'Topic question bank lookup' },
    ],
  },

  quizAttempts: {
    name: 'quizAttempts',
    ownershipScope: 'user',
    ownerField: 'userId',
    timestamps: true,
    fields: {
      quizId: { type: 'ObjectId', required: true, ref: 'quizzes' },
      userId: { type: 'ObjectId', required: true, ref: 'users' },
      status: {
        type: 'String',
        required: true,
        enumValues: ['in_progress', 'submitted'],
        defaultValue: 'in_progress',
      },
      startedAt: { type: 'Date', required: true },
      submittedAt: { type: 'Date' },
      durationSeconds: { type: 'Number' },
      responses: { type: 'Subdocument' },
      totalPointsPossible: { type: 'Number', required: true },
      scoreEarned: { type: 'Number', defaultValue: 0 },
      accuracyPercent: { type: 'Number', defaultValue: 0 },
      weakTopicIds: { type: 'ObjectIdArray', ref: 'topics' },
      recommendedTopicIds: { type: 'ObjectIdArray', ref: 'topics' },
    },
    indexes: [
      { fields: { userId: 1, quizId: 1, createdAt: -1 }, description: 'User attempts per quiz' },
      { fields: { userId: 1, status: 1, submittedAt: -1 }, description: 'Analytics submitted quiz timeline' },
    ],
  },

  flashcardDecks: {
    name: 'flashcardDecks',
    ownershipScope: 'user',
    ownerField: 'userId',
    timestamps: true,
    fields: {
      userId: { type: 'ObjectId', required: true, ref: 'users' },
      title: { type: 'String', required: true },
      description: { type: 'String' },
      subjectId: { type: 'ObjectId', ref: 'subjects' },
      chapterId: { type: 'ObjectId', ref: 'chapters' },
      topicId: { type: 'ObjectId', ref: 'topics' },
      uploadedMaterialId: { type: 'ObjectId', ref: 'uploadedMaterials' },
      cardCount: { type: 'Number', defaultValue: 0 },
      language: { type: 'String', required: true, enumValues: LANGUAGES, defaultValue: 'en' },
    },
    indexes: [
      { fields: { userId: 1, updatedAt: -1 }, description: 'User flashcard deck listing' },
      { fields: { userId: 1, subjectId: 1, topicId: 1 }, description: 'Topic/subject deck filtering' },
    ],
  },

  flashcards: {
    name: 'flashcards',
    ownershipScope: 'user',
    ownerField: 'userId',
    timestamps: true,
    fields: {
      deckId: { type: 'ObjectId', required: true, ref: 'flashcardDecks' },
      userId: { type: 'ObjectId', required: true, ref: 'users' },
      topicId: { type: 'ObjectId', ref: 'topics' },
      front: { type: 'String', required: true },
      back: { type: 'String', required: true },
      hint: { type: 'String' },
      easeFactor: { type: 'Number', required: true, defaultValue: 2.5 },
      intervalDays: { type: 'Number', required: true, defaultValue: 0 },
      repetitions: { type: 'Number', required: true, defaultValue: 0 },
      nextReviewAt: { type: 'Date', required: true },
      lastReviewedAt: { type: 'Date' },
      lastRating: { type: 'String', enumValues: FLASHCARD_RATINGS },
      masteryState: {
        type: 'String',
        required: true,
        enumValues: ['new', 'learning', 'review', 'mastered', 'difficult'],
        defaultValue: 'new',
      },
    },
    indexes: [
      { fields: { userId: 1, nextReviewAt: 1 }, description: 'Spaced-repetition due card queue' },
      { fields: { deckId: 1, userId: 1, createdAt: 1 }, description: 'Cards belonging to a deck' },
      { fields: { userId: 1, masteryState: 1, nextReviewAt: 1 }, description: 'Filter due/difficult/mastered cards' },
    ],
  },

  reviewLogs: {
    name: 'reviewLogs',
    ownershipScope: 'user',
    ownerField: 'userId',
    timestamps: true,
    fields: {
      userId: { type: 'ObjectId', required: true, ref: 'users' },
      deckId: { type: 'ObjectId', required: true, ref: 'flashcardDecks' },
      flashcardId: { type: 'ObjectId', required: true, ref: 'flashcards' },
      rating: { type: 'String', required: true, enumValues: FLASHCARD_RATINGS },
      previousIntervalDays: { type: 'Number', required: true },
      newIntervalDays: { type: 'Number', required: true },
      previousEaseFactor: { type: 'Number', required: true },
      newEaseFactor: { type: 'Number', required: true },
      nextReviewAt: { type: 'Date', required: true },
      reviewedAt: { type: 'Date', required: true },
      durationMs: { type: 'Number' },
    },
    indexes: [
      { fields: { userId: 1, reviewedAt: -1 }, description: 'User spaced-repetition review timeline' },
      { fields: { flashcardId: 1, reviewedAt: -1 }, description: 'Card-specific review history' },
    ],
  },

  studyPlans: {
    name: 'studyPlans',
    ownershipScope: 'user',
    ownerField: 'userId',
    timestamps: true,
    fields: {
      userId: { type: 'ObjectId', required: true, ref: 'users' },
      title: { type: 'String', required: true },
      targetExaminationId: { type: 'ObjectId', ref: 'examinations' },
      targetDate: { type: 'Date', required: true },
      startDate: { type: 'Date', required: true },
      subjectIds: { type: 'ObjectIdArray', required: true, ref: 'subjects' },
      dailyStudyMinutes: { type: 'Number', required: true },
      availableDaysOfWeek: { type: 'NumberArray', required: true },
      proficiencyBySubject: { type: 'Subdocument' },
      weeklyMilestones: { type: 'Subdocument' },
      aiSummary: { type: 'String' },
      status: { type: 'String', required: true, enumValues: STUDY_PLAN_STATUSES, defaultValue: 'active' },
      completionPercent: { type: 'Number', defaultValue: 0 },
    },
    indexes: [
      { fields: { userId: 1, status: 1, targetDate: 1 }, description: 'Active study plans per student' },
    ],
  },

  studyTasks: {
    name: 'studyTasks',
    ownershipScope: 'user',
    ownerField: 'userId',
    timestamps: true,
    fields: {
      studyPlanId: { type: 'ObjectId', required: true, ref: 'studyPlans' },
      userId: { type: 'ObjectId', required: true, ref: 'users' },
      subjectId: { type: 'ObjectId', ref: 'subjects' },
      chapterId: { type: 'ObjectId', ref: 'chapters' },
      topicId: { type: 'ObjectId', ref: 'topics' },
      taskType: { type: 'String', required: true, enumValues: STUDY_TASK_TYPES },
      title: { type: 'String', required: true },
      description: { type: 'String' },
      scheduledDateKey: { type: 'String', required: true },
      scheduledDate: { type: 'Date', required: true },
      durationMinutes: { type: 'Number', required: true },
      priorityRank: { type: 'Number', defaultValue: 1 },
      status: { type: 'String', required: true, enumValues: STUDY_TASK_STATUSES, defaultValue: 'pending' },
      completedAt: { type: 'Date' },
      isManuallyEdited: { type: 'Boolean', defaultValue: false },
    },
    indexes: [
      {
        fields: { userId: 1, studyPlanId: 1, scheduledDate: 1, priorityRank: 1 },
        description: 'Calendar & daily study roadmap retrieval',
      },
      { fields: { userId: 1, status: 1, scheduledDate: 1 }, description: 'Overdue and pending task queries' },
    ],
  },

  uploadedMaterials: {
    name: 'uploadedMaterials',
    ownershipScope: 'user',
    ownerField: 'userId',
    timestamps: true,
    fields: {
      userId: { type: 'ObjectId', required: true, ref: 'users' },
      subjectId: { type: 'ObjectId', ref: 'subjects' },
      chapterId: { type: 'ObjectId', ref: 'chapters' },
      topicId: { type: 'ObjectId', ref: 'topics' },
      title: { type: 'String', required: true },
      originalFilename: { type: 'String', required: true },
      format: { type: 'String', required: true, enumValues: DOCUMENT_FORMATS },
      mimeType: { type: 'String', required: true },
      byteSize: { type: 'Number', required: true },
      storageProvider: { type: 'String', required: true, enumValues: ['vercel_blob', 'local_disk'] },
      storageKey: { type: 'String', required: true },
      processingStatus: {
        type: 'String',
        required: true,
        enumValues: DOCUMENT_PROCESSING_STATUSES,
        defaultValue: 'uploaded',
      },
      extractionStatus: {
        type: 'String',
        required: true,
        enumValues: ['pending', 'completed', 'failed'],
        defaultValue: 'pending',
      },
      chunkingStatus: {
        type: 'String',
        required: true,
        enumValues: ['pending', 'completed', 'failed'],
        defaultValue: 'pending',
      },
      pageCount: { type: 'Number' },
      chunkCount: { type: 'Number', defaultValue: 0 },
      retryCount: { type: 'Number', defaultValue: 0 },
      errorMessage: { type: 'String' },
      deletedAt: { type: 'Date' },
    },
    indexes: [
      {
        fields: { userId: 1, processingStatus: 1, createdAt: -1 },
        description: 'User document library & ingestion status list',
      },
      { fields: { processingStatus: 1, updatedAt: 1 }, description: 'Background job queue polling' },
    ],
  },

  documentChunks: {
    name: 'documentChunks',
    ownershipScope: 'user',
    ownerField: 'userId',
    timestamps: true,
    fields: {
      materialId: { type: 'ObjectId', required: true, ref: 'uploadedMaterials' },
      userId: { type: 'ObjectId', required: true, ref: 'users' },
      chunkIndex: { type: 'Number', required: true },
      pageNumber: { type: 'Number' },
      sectionHeading: { type: 'String' },
      content: { type: 'String', required: true },
      tokenEstimate: { type: 'Number', required: true },
      keywords: { type: 'StringArray' },
      embedding: { type: 'NumberArray' },
      embeddingModel: { type: 'String' },
    },
    indexes: [
      {
        fields: { userId: 1, materialId: 1, chunkIndex: 1 },
        unique: true,
        description: 'User-isolated ordered chunks per uploaded document',
      },
      { fields: { content: 'text' }, description: 'Keyword RAG fallback retrieval index' },
    ],
  },

  progressRecords: {
    name: 'progressRecords',
    ownershipScope: 'user',
    ownerField: 'userId',
    timestamps: true,
    fields: {
      userId: { type: 'ObjectId', required: true, ref: 'users' },
      subjectId: { type: 'ObjectId', required: true, ref: 'subjects' },
      chapterId: { type: 'ObjectId', required: true, ref: 'chapters' },
      topicId: { type: 'ObjectId', required: true, ref: 'topics' },
      isCompleted: { type: 'Boolean', defaultValue: false },
      completedAt: { type: 'Date' },
      studyTimeMinutes: { type: 'Number', defaultValue: 0 },
      quizAttemptsCount: { type: 'Number', defaultValue: 0 },
      quizAverageAccuracy: { type: 'Number', defaultValue: 0 },
      flashcardReviewsCount: { type: 'Number', defaultValue: 0 },
      estimatedMasteryScore: { type: 'Number', defaultValue: 0 },
      masteryBand: {
        type: 'String',
        enumValues: ['unstarted', 'weak', 'developing', 'strong'],
        defaultValue: 'unstarted',
      },
      lastActivityAt: { type: 'Date' },
    },
    indexes: [
      {
        fields: { userId: 1, topicId: 1 },
        unique: true,
        description: 'One canonical progress record per (userId, topicId)',
      },
      {
        fields: { userId: 1, subjectId: 1, estimatedMasteryScore: 1 },
        description: 'Subject mastery and weak-topic identification',
      },
    ],
  },

  notifications: {
    name: 'notifications',
    ownershipScope: 'user',
    ownerField: 'userId',
    timestamps: true,
    fields: {
      userId: { type: 'ObjectId', required: true, ref: 'users' },
      notificationType: { type: 'String', required: true, enumValues: NOTIFICATION_TYPES },
      title: { type: 'String', required: true },
      message: { type: 'String', required: true },
      actionUrl: { type: 'String' },
      isRead: { type: 'Boolean', required: true, defaultValue: false },
      readAt: { type: 'Date' },
      dedupeKey: { type: 'String' },
    },
    indexes: [
      {
        fields: { userId: 1, isRead: 1, createdAt: -1 },
        description: 'Unread and chronological notifications per student',
      },
      { fields: { userId: 1, dedupeKey: 1 }, sparse: true, description: 'Prevent duplicate reminder spam' },
    ],
  },

  aiUsageLogs: {
    name: 'aiUsageLogs',
    ownershipScope: 'admin_system',
    ownerField: 'userId',
    timestamps: true,
    fields: {
      userId: { type: 'ObjectId', ref: 'users' },
      taskType: { type: 'String', required: true, enumValues: AI_TASK_TYPES },
      modelId: { type: 'String', required: true },
      fallbackUsed: { type: 'Boolean', defaultValue: false },
      status: {
        type: 'String',
        required: true,
        enumValues: ['success', 'validation_failed', 'rate_limited', 'provider_error', 'cached'],
      },
      latencyMs: { type: 'Number', required: true },
      promptTokens: { type: 'Number', defaultValue: 0 },
      completionTokens: { type: 'Number', defaultValue: 0 },
      totalTokens: { type: 'Number', defaultValue: 0 },
      sanitizedError: { type: 'String' },
    },
    indexes: [
      { fields: { userId: 1, createdAt: -1 }, description: 'Per-user daily AI quota enforcement' },
      { fields: { taskType: 1, modelId: 1, status: 1, createdAt: -1 }, description: 'Admin AI observability' },
    ],
  },

  promptTemplates: {
    name: 'promptTemplates',
    ownershipScope: 'admin_system',
    timestamps: true,
    fields: {
      taskType: { type: 'String', required: true, enumValues: AI_TASK_TYPES },
      name: { type: 'String', required: true },
      version: { type: 'Number', required: true, defaultValue: 1 },
      systemPrompt: { type: 'String', required: true },
      userPromptTemplate: { type: 'String', required: true },
      temperature: { type: 'Number', defaultValue: 0.3 },
      maxOutputTokens: { type: 'Number', defaultValue: 2000 },
      isActive: { type: 'Boolean', required: true, defaultValue: true },
      updatedByUserId: { type: 'ObjectId', ref: 'users' },
    },
    indexes: [
      {
        fields: { taskType: 1, version: -1 },
        unique: true,
        description: 'Versioned prompt template per AI task',
      },
      { fields: { taskType: 1, isActive: 1 }, description: 'Active prompt resolution' },
    ],
  },

  appSettings: {
    name: 'appSettings',
    ownershipScope: 'admin_system',
    timestamps: true,
    fields: {
      key: { type: 'String', required: true, unique: true },
      value: { type: 'Mixed', required: true },
      description: { type: 'String' },
      updatedByUserId: { type: 'ObjectId', ref: 'users' },
    },
    indexes: [
      { fields: { key: 1 }, unique: true, description: 'Singleton/keyed platform settings lookup' },
    ],
  },

  feedbackReports: {
    name: 'feedbackReports',
    ownershipScope: 'user',
    ownerField: 'userId',
    timestamps: true,
    fields: {
      userId: { type: 'ObjectId', required: true, ref: 'users' },
      targetType: {
        type: 'String',
        required: true,
        enumValues: ['message', 'generated_content', 'question', 'flashcard', 'general'],
      },
      targetId: { type: 'ObjectId' },
      reason: { type: 'String', required: true },
      details: { type: 'String' },
      status: {
        type: 'String',
        required: true,
        enumValues: ['open', 'in_review', 'resolved', 'dismissed'],
        defaultValue: 'open',
      },
      adminNotes: { type: 'String' },
      resolvedByUserId: { type: 'ObjectId', ref: 'users' },
      resolvedAt: { type: 'Date' },
    },
    indexes: [
      { fields: { status: 1, createdAt: -1 }, description: 'Admin moderation & feedback queue' },
      { fields: { userId: 1, createdAt: -1 }, description: 'Student submitted feedback history' },
    ],
  },

  auditLogs: {
    name: 'auditLogs',
    ownershipScope: 'admin_system',
    timestamps: true,
    fields: {
      actorId: { type: 'ObjectId', required: true, ref: 'users' },
      actorRole: { type: 'String', required: true, enumValues: USER_ROLES },
      action: { type: 'String', required: true },
      targetCollection: { type: 'String' },
      targetId: { type: 'String' },
      metadata: { type: 'Subdocument' },
      ipHash: { type: 'String' },
    },
    indexes: [
      { fields: { actorId: 1, createdAt: -1 }, description: 'Admin activity trace by actor' },
      { fields: { action: 1, createdAt: -1 }, description: 'Security audit filtering by action type' },
    ],
  },
};
