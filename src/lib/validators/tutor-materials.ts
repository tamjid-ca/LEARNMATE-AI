/**
 * LearnMate AI — AI Subject Tutor & Learning Materials Zod Validators
 * Implements SRS Section 4.4 (FR-TUTOR-001..012) and Section 4.5 (FR-MAT-001..007).
 */

import { z } from 'zod';
import {
  EXPLANATION_DEPTHS,
  LANGUAGES,
  MATERIAL_TYPES,
} from '../../types/domain.ts';

export const TUTOR_RESPONSE_STYLES = [
  'explanation',
  'step_by_step',
  'examples',
  'definitions',
  'comparison',
  'application',
  'revision',
  'follow_up',
] as const;

export type TutorResponseStyle = (typeof TUTOR_RESPONSE_STYLES)[number];

export const createConversationSchema = z
  .object({
    title: z.string().trim().min(2).max(160).optional(),
    subjectId: z.string().trim().max(64).optional(),
    chapterId: z.string().trim().max(64).optional(),
    topicId: z.string().trim().max(64).optional(),
    uploadedMaterialId: z.string().trim().max(64).optional(),
    language: z.enum(LANGUAGES).default('en'),
    explanationDepth: z.enum(EXPLANATION_DEPTHS).default('intermediate'),
    customSystemPrompt: z.string().trim().max(1500).optional(),
    initialMessage: z.string().trim().min(1).max(4000).optional(),
    responseStyle: z.enum(TUTOR_RESPONSE_STYLES).optional(),
  })
  .strict();

export const updateConversationSchema = z
  .object({
    title: z.string().trim().min(2).max(160).optional(),
    subjectId: z.string().trim().max(64).nullable().optional(),
    chapterId: z.string().trim().max(64).nullable().optional(),
    topicId: z.string().trim().max(64).nullable().optional(),
    language: z.enum(LANGUAGES).optional(),
    explanationDepth: z.enum(EXPLANATION_DEPTHS).optional(),
    customSystemPrompt: z.string().trim().max(1500).nullable().optional(),
    isArchived: z.boolean().optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.title !== undefined ||
      v.subjectId !== undefined ||
      v.chapterId !== undefined ||
      v.topicId !== undefined ||
      v.language !== undefined ||
      v.explanationDepth !== undefined ||
      v.customSystemPrompt !== undefined ||
      v.isArchived !== undefined,
    { message: 'At least one field must be provided to update a conversation' },
  );

export const sendTutorMessageSchema = z
  .object({
    content: z.string().trim().min(1, 'Message cannot be empty').max(4000),
    subjectId: z.string().trim().max(64).nullable().optional(),
    chapterId: z.string().trim().max(64).nullable().optional(),
    topicId: z.string().trim().max(64).nullable().optional(),
    language: z.enum(LANGUAGES).optional(),
    explanationDepth: z.enum(EXPLANATION_DEPTHS).optional(),
    customSystemPrompt: z.string().trim().max(1500).nullable().optional(),
    responseStyle: z.enum(TUTOR_RESPONSE_STYLES).default('explanation'),
    stream: z.boolean().default(false),
  })
  .strict();

export const rateTutorMessageSchema = z
  .object({
    feedbackRating: z.enum(['helpful', 'unhelpful', 'flagged']),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const generateMaterialSchema = z
  .object({
    subjectId: z.string().trim().max(64).optional(),
    chapterId: z.string().trim().max(64).optional(),
    topicId: z.string().trim().max(64).optional(),
    customTopicTitle: z.string().trim().min(2).max(200).optional(),
    uploadedMaterialId: z.string().trim().max(64).optional(),
    materialType: z.enum(MATERIAL_TYPES),
    language: z.enum(LANGUAGES).default('en'),
    explanationDepth: z.enum(EXPLANATION_DEPTHS).default('intermediate'),
    customInstructions: z.string().trim().max(1000).optional(),
    saveToLibrary: z.boolean().default(true),
    regenerate: z.boolean().default(false),
  })
  .strict()
  .refine((v) => Boolean(v.topicId?.trim() || v.customTopicTitle?.trim()), {
    message: 'Either a syllabus topic or a custom topic title is required',
  });

export const updateMaterialSchema = z
  .object({
    title: z.string().trim().min(2).max(240).optional(),
    contentMarkdown: z.string().trim().min(5).max(50_000).optional(),
    isSavedToLibrary: z.boolean().optional(),
    isFlagged: z.boolean().optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.title !== undefined ||
      v.contentMarkdown !== undefined ||
      v.isSavedToLibrary !== undefined ||
      v.isFlagged !== undefined,
    { message: 'At least one material field must be updated' },
  );

export const materialFilterQuerySchema = z.object({
  subjectId: z.string().trim().max(64).optional(),
  chapterId: z.string().trim().max(64).optional(),
  topicId: z.string().trim().max(64).optional(),
  materialType: z.enum(MATERIAL_TYPES).optional(),
  language: z.enum(LANGUAGES).optional(),
  savedOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminModerateMaterialSchema = z
  .object({
    materialId: z.string().trim().min(1).max(64),
    isFlagged: z.boolean().optional(),
    isPublishedByAdmin: z.boolean().optional(),
  })
  .strict();
