/**
 * LearnMate AI — Curriculum & Administrative CMS Zod Validators
 * Enforces strict input validation for all 6 hierarchy levels, saved topics,
 * JSON/CSV syllabus import-export, and admin user role/status management.
 */

import { z } from 'zod';
import {
  ACCOUNT_STATUSES,
  DIFFICULTY_LEVELS,
  LANGUAGES,
  USER_ROLES,
} from '../../types/domain.ts';

export const CURRICULUM_ENTITY_TYPES = [
  'educationSystem',
  'educationLevel',
  'examination',
  'subject',
  'chapter',
  'topic',
] as const;

export type CurriculumEntityType = (typeof CURRICULUM_ENTITY_TYPES)[number];

export const curriculumFilterQuerySchema = z.object({
  country: z.string().trim().max(12).optional(),
  educationSystemId: z.string().trim().max(64).optional(),
  educationLevelId: z.string().trim().max(64).optional(),
  examinationId: z.string().trim().max(64).optional(),
  subjectId: z.string().trim().max(64).optional(),
  chapterId: z.string().trim().max(64).optional(),
  difficulty: z.enum(DIFFICULTY_LEVELS).optional(),
  search: z.string().trim().max(160).optional(),
  savedOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .optional(),
  includeInactive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const educationSystemPayloadSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[A-Z0-9_-]+$/i, 'Code may only contain letters, numbers, hyphens, and underscores')
      .transform((val) => val.toUpperCase()),
    name: z.string().trim().min(2).max(140),
    country: z.string().trim().min(2).max(12).default('BD'),
    description: z.string().trim().max(500).optional(),
    supportedLanguages: z.array(z.enum(LANGUAGES)).min(1).default(['en', 'bn']),
    isActive: z.boolean().default(true),
  })
  .strict();

export const educationLevelPayloadSchema = z
  .object({
    educationSystemId: z.string().trim().min(1).max(64),
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[A-Z0-9_-]+$/i)
      .transform((val) => val.toUpperCase()),
    name: z.string().trim().min(2).max(140),
    description: z.string().trim().max(500).optional(),
    order: z.coerce.number().int().min(0).max(1000).default(0),
    isActive: z.boolean().default(true),
  })
  .strict();

export const examinationPayloadSchema = z
  .object({
    educationSystemId: z.string().trim().min(1).max(64),
    educationLevelId: z.string().trim().min(1).max(64),
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[A-Z0-9_-]+$/i)
      .transform((val) => val.toUpperCase()),
    name: z.string().trim().min(2).max(140),
    description: z.string().trim().max(500).optional(),
    examDate: z.string().trim().max(40).optional(),
    isActive: z.boolean().default(true),
  })
  .strict();

export const subjectPayloadSchema = z
  .object({
    educationSystemId: z.string().trim().min(1).max(64),
    educationLevelId: z.string().trim().min(1).max(64),
    examinationIds: z.array(z.string().trim().min(1).max(64)).max(20).default([]),
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[A-Z0-9_-]+$/i)
      .transform((val) => val.toUpperCase()),
    name: z.string().trim().min(2).max(140),
    nameBn: z.string().trim().max(140).optional(),
    description: z.string().trim().max(500).optional(),
    order: z.coerce.number().int().min(0).max(1000).default(0),
    isActive: z.boolean().default(true),
  })
  .strict();

export const chapterPayloadSchema = z
  .object({
    subjectId: z.string().trim().min(1).max(64),
    chapterNumber: z.coerce.number().int().min(1).max(200),
    title: z.string().trim().min(2).max(160),
    titleBn: z.string().trim().max(160).optional(),
    description: z.string().trim().max(600).optional(),
    order: z.coerce.number().int().min(0).max(1000).default(0),
    isActive: z.boolean().default(true),
  })
  .strict();

export const topicPayloadSchema = z
  .object({
    subjectId: z.string().trim().min(1).max(64),
    chapterId: z.string().trim().min(1).max(64),
    code: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .regex(/^[A-Z0-9_.-]+$/i)
      .transform((val) => val.toUpperCase()),
    title: z.string().trim().min(2).max(180),
    titleBn: z.string().trim().max(180).optional(),
    description: z.string().trim().max(1200).optional(),
    learningObjectives: z.array(z.string().trim().min(2).max(240)).max(20).default([]),
    prerequisiteTopicIds: z.array(z.string().trim().min(1).max(64)).max(15).default([]),
    difficulty: z.enum(DIFFICULTY_LEVELS).default('medium'),
    estimatedMinutes: z.coerce.number().int().min(5).max(600).default(45),
    keyConcepts: z.array(z.string().trim().min(1).max(120)).max(25).default([]),
    curriculumReferences: z.array(z.string().trim().min(2).max(240)).max(15).default([]),
    syllabusWeightVerified: z.boolean().default(false),
    syllabusPriorityScore: z.coerce.number().min(0).max(100).optional(),
    order: z.coerce.number().int().min(0).max(1000).default(0),
    isActive: z.boolean().default(true),
  })
  .strict();

export const createCurriculumEntitySchema = z.discriminatedUnion('entityType', [
  z.object({
    entityType: z.literal('educationSystem'),
    data: educationSystemPayloadSchema,
  }),
  z.object({
    entityType: z.literal('educationLevel'),
    data: educationLevelPayloadSchema,
  }),
  z.object({
    entityType: z.literal('examination'),
    data: examinationPayloadSchema,
  }),
  z.object({
    entityType: z.literal('subject'),
    data: subjectPayloadSchema,
  }),
  z.object({
    entityType: z.literal('chapter'),
    data: chapterPayloadSchema,
  }),
  z.object({
    entityType: z.literal('topic'),
    data: topicPayloadSchema,
  }),
]);

export const updateCurriculumEntitySchema = z.discriminatedUnion('entityType', [
  z.object({
    entityType: z.literal('educationSystem'),
    id: z.string().trim().min(1).max(64),
    data: educationSystemPayloadSchema.partial(),
  }),
  z.object({
    entityType: z.literal('educationLevel'),
    id: z.string().trim().min(1).max(64),
    data: educationLevelPayloadSchema.partial(),
  }),
  z.object({
    entityType: z.literal('examination'),
    id: z.string().trim().min(1).max(64),
    data: examinationPayloadSchema.partial(),
  }),
  z.object({
    entityType: z.literal('subject'),
    id: z.string().trim().min(1).max(64),
    data: subjectPayloadSchema.partial(),
  }),
  z.object({
    entityType: z.literal('chapter'),
    id: z.string().trim().min(1).max(64),
    data: chapterPayloadSchema.partial(),
  }),
  z.object({
    entityType: z.literal('topic'),
    id: z.string().trim().min(1).max(64),
    data: topicPayloadSchema.partial(),
  }),
]);

export const deleteCurriculumEntitySchema = z
  .object({
    entityType: z.enum(CURRICULUM_ENTITY_TYPES),
    id: z.string().trim().min(1).max(64),
  })
  .strict();

export const toggleSavedTopicSchema = z
  .object({
    topicId: z.string().trim().min(1).max(64),
  })
  .strict();

export const curriculumJsonImportBundleSchema = z
  .object({
    educationSystems: z.array(educationSystemPayloadSchema).optional().default([]),
    educationLevels: z.array(educationLevelPayloadSchema).optional().default([]),
    examinations: z.array(examinationPayloadSchema).optional().default([]),
    subjects: z.array(subjectPayloadSchema).optional().default([]),
    chapters: z.array(chapterPayloadSchema).optional().default([]),
    topics: z.array(topicPayloadSchema).optional().default([]),
  })
  .strict();

export const curriculumImportRequestSchema = z.discriminatedUnion('format', [
  z.object({
    format: z.literal('json'),
    bundle: curriculumJsonImportBundleSchema,
  }),
  z.object({
    format: z.literal('csv'),
    csvText: z.string().trim().min(10).max(500_000),
    defaultSubjectId: z.string().trim().min(1).max(64),
    defaultChapterId: z.string().trim().min(1).max(64),
  }),
]);

export const adminUserListQuerySchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(ACCOUNT_STATUSES).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminUpdateUserSchema = z
  .object({
    userId: z.string().trim().min(1).max(64),
    role: z.enum(USER_ROLES).optional(),
    status: z.enum(ACCOUNT_STATUSES).optional(),
  })
  .strict()
  .refine((v) => v.role !== undefined || v.status !== undefined, {
    message: 'At least one of role or status must be provided',
  });
