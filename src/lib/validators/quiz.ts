/**
 * LearnMate AI — Quiz & Examination Zod Validation Schemas
 * Implements SRS Section 4.6 (FR-QUIZ-001..015).
 */

import { z } from 'zod';
import {
  DIFFICULTY_LEVELS,
  LANGUAGES,
  QUESTION_TYPES,
} from '../../types/domain.ts';

export const QUIZ_MODES = ['practice', 'mock_exam'] as const;
export type QuizMode = (typeof QUIZ_MODES)[number];

export const FEEDBACK_TIMINGS = ['after_submission', 'immediate'] as const;
export type FeedbackTiming = (typeof FEEDBACK_TIMINGS)[number];

export const generateQuizSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    mode: z.enum(QUIZ_MODES).default('practice'),
    subjectId: z.string().trim().min(2).max(64).optional(),
    chapterId: z.string().trim().min(2).max(64).optional(),
    topicIds: z.array(z.string().trim().min(2).max(64)).max(25).default([]),
    generatedContentId: z.string().trim().min(2).max(64).optional(),
    uploadedMaterialId: z.string().trim().min(2).max(64).optional(),
    difficulty: z.enum(DIFFICULTY_LEVELS).default('medium'),
    questionTypes: z
      .array(z.enum(QUESTION_TYPES))
      .min(1)
      .max(4)
      .default(['single_mcq']),
    questionCount: z.coerce.number().int().min(1).max(40).default(5),
    timeLimitSeconds: z.coerce.number().int().min(30).max(14_400).optional(),
    negativeMarkingFactor: z.coerce.number().min(0).max(1).default(0),
    feedbackTiming: z.enum(FEEDBACK_TIMINGS).default('after_submission'),
    language: z.enum(LANGUAGES).default('en'),
    customInstructions: z.string().trim().max(600).optional(),
  })
  .strict()
  .refine(
    (data) =>
      Boolean(
        data.subjectId ||
          data.chapterId ||
          data.topicIds.length > 0 ||
          data.generatedContentId ||
          data.uploadedMaterialId,
      ),
    {
      message:
        'At least one quiz source (subjectId, chapterId, topicIds, generatedContentId, or uploadedMaterialId) is required',
    },
  );

export const quizListQuerySchema = z.object({
  mode: z.enum(QUIZ_MODES).optional(),
  subjectId: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const startQuizAttemptSchema = z
  .object({
    quizId: z.string().trim().min(2).max(64),
  })
  .strict();

export const questionResponseSubmissionSchema = z
  .object({
    questionId: z.string().trim().min(2).max(64),
    selectedOptionIds: z.array(z.string().trim().min(1).max(32)).max(10).default([]),
    shortAnswerText: z.string().trim().max(4000).optional(),
  })
  .strict();

export const submitQuizAttemptSchema = z
  .object({
    durationSeconds: z.coerce.number().int().min(0).max(86_400).optional(),
    responses: z.array(questionResponseSubmissionSchema).max(100).default([]),
  })
  .strict();
