/**
 * LearnMate AI — Smart Flashcards & Spaced Repetition Zod Schemas
 * Implements SRS Section 4.7 (FR-FLASH-001..010).
 */

import { z } from 'zod';
import { FLASHCARD_RATINGS, LANGUAGES } from '../../types/domain.ts';

export const FLASHCARD_MASTERY_STATES = [
  'new',
  'learning',
  'review',
  'mastered',
  'difficult',
] as const;
export type FlashcardMasteryState = (typeof FLASHCARD_MASTERY_STATES)[number];

export const REVIEW_QUEUE_FILTERS = [
  'due',
  'upcoming',
  'mastered',
  'difficult',
  'all',
] as const;
export type ReviewQueueFilter = (typeof REVIEW_QUEUE_FILTERS)[number];

export const flashcardInputItemSchema = z
  .object({
    front: z.string().trim().min(1).max(2000),
    back: z.string().trim().min(1).max(4000),
    hint: z.string().trim().max(500).optional(),
  })
  .strict();

export const createFlashcardDeckSchema = z
  .object({
    mode: z.literal('manual').default('manual'),
    title: z.string().trim().min(2).max(180),
    description: z.string().trim().max(600).optional(),
    subjectId: z.string().trim().min(2).max(64).optional(),
    chapterId: z.string().trim().min(2).max(64).optional(),
    topicId: z.string().trim().min(2).max(64).optional(),
    uploadedMaterialId: z.string().trim().min(2).max(64).optional(),
    language: z.enum(LANGUAGES).default('en'),
    cards: z.array(flashcardInputItemSchema).max(50).default([]),
  })
  .strict();

export const generateFlashcardsSchema = z
  .object({
    mode: z.literal('ai').default('ai'),
    deckId: z.string().trim().min(2).max(64).optional(),
    title: z.string().trim().min(2).max(180).optional(),
    subjectId: z.string().trim().min(2).max(64).optional(),
    chapterId: z.string().trim().min(2).max(64).optional(),
    topicId: z.string().trim().min(2).max(64).optional(),
    generatedContentId: z.string().trim().min(2).max(64).optional(),
    uploadedMaterialId: z.string().trim().min(2).max(64).optional(),
    cardCount: z.coerce.number().int().min(1).max(30).default(6),
    language: z.enum(LANGUAGES).default('en'),
    customInstructions: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine(
    (data) =>
      Boolean(
        data.topicId ||
          data.chapterId ||
          data.subjectId ||
          data.generatedContentId ||
          data.uploadedMaterialId ||
          data.customInstructions,
      ),
    {
      message:
        'At least one flashcard generation source (topicId, chapterId, subjectId, generatedContentId, uploadedMaterialId, or customInstructions) is required',
    },
  );

export const createFlashcardItemSchema = z
  .object({
    deckId: z.string().trim().min(2).max(64),
    topicId: z.string().trim().min(2).max(64).optional(),
    front: z.string().trim().min(1).max(2000),
    back: z.string().trim().min(1).max(4000),
    hint: z.string().trim().max(500).optional(),
  })
  .strict();

export const updateFlashcardItemSchema = z
  .object({
    front: z.string().trim().min(1).max(2000).optional(),
    back: z.string().trim().min(1).max(4000).optional(),
    hint: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one card field (front, back, hint) must be provided',
  });

export const submitFlashcardReviewSchema = z
  .object({
    flashcardId: z.string().trim().min(2).max(64),
    rating: z.enum(FLASHCARD_RATINGS),
    durationMs: z.coerce.number().int().min(0).max(600_000).optional(),
  })
  .strict();

export const reviewQueueQuerySchema = z.object({
  deckId: z.string().trim().max(64).optional(),
  filter: z.enum(REVIEW_QUEUE_FILTERS).default('due'),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
