/**
 * LearnMate AI — Document Management & RAG Zod Validation Schemas
 * Implements SRS Section 4.9 (FR-DOC-001..011).
 */

import { z } from 'zod';
import { MAX_UPLOAD_BYTES } from '../storage/adapter.ts';
import {
  DIFFICULTY_LEVELS,
  EXPLANATION_DEPTHS,
  LANGUAGES,
  MATERIAL_TYPES,
} from '../../types/domain.ts';

export const uploadDocumentPayloadSchema = z
  .object({
    title: z.string().trim().min(2).max(180),
    originalFilename: z.string().trim().min(3).max(240),
    mimeType: z.enum([
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]),
    byteSize: z.coerce.number().int().min(1).max(MAX_UPLOAD_BYTES),
    rawContent: z.string().min(1).max(250_000),
    subjectId: z.string().trim().min(2).max(64).optional(),
    chapterId: z.string().trim().min(2).max(64).optional(),
    topicId: z.string().trim().min(2).max(64).optional(),
  })
  .strict();

export const documentQaSchema = z
  .object({
    action: z.literal('qa').default('qa'),
    question: z.string().trim().min(3).max(2000),
    language: z.enum(LANGUAGES).default('en'),
    topK: z.coerce.number().int().min(1).max(8).default(4),
  })
  .strict();

export const DOCUMENT_DERIVATIVE_TARGETS = [
  'summary',
  'notes',
  'quiz',
  'flashcards',
] as const;
export type DocumentDerivativeTarget = (typeof DOCUMENT_DERIVATIVE_TARGETS)[number];

export const documentDerivativeSchema = z
  .object({
    action: z.literal('generate'),
    target: z.enum(DOCUMENT_DERIVATIVE_TARGETS),
    materialType: z.enum(MATERIAL_TYPES).optional(),
    explanationDepth: z.enum(EXPLANATION_DEPTHS).default('intermediate'),
    difficulty: z.enum(DIFFICULTY_LEVELS).default('medium'),
    itemCount: z.coerce.number().int().min(1).max(20).default(4),
    language: z.enum(LANGUAGES).default('en'),
  })
  .strict();
