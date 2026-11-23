/**
 * LearnMate AI — Custom Education System, Labels, Hierarchy, Examinations & Subjects Validators
 */

import { z } from 'zod';
import {
  DIFFICULTY_LEVELS,
  EDUCATION_SYSTEM_TYPES,
  LANGUAGES,
  TOPIC_PRIORITIES,
} from '../../types/domain.ts';

const safeCodeRegex = /^[A-Z0-9_-]+$/i;
const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

export const customHierarchyLevelSchema = z.object({
  key: z.string().trim().min(2).max(40),
  singularLabel: z.string().trim().min(1).max(60),
  pluralLabel: z.string().trim().min(1).max(60),
  order: z.coerce.number().int().min(0).max(50),
  required: z.boolean().default(false),
  allowMultiple: z.boolean().default(true),
});

export const educationLabelDefinitionSchema = z.object({
  key: z.string().trim().min(2).max(40),
  defaultLabel: z.string().trim().min(1).max(60).optional(),
  singular: z.string().trim().min(1).max(60),
  plural: z.string().trim().min(1).max(60),
  order: z.coerce.number().int().min(0).max(50),
  required: z.boolean().default(false),
  allowMultiple: z.boolean().default(true),
  isVisible: z.boolean().default(true),
});

export const upsertEducationLabelsSchema = z
  .object({
    educationSystemId: z.string().trim().max(64).optional(),
    presetName: z
      .enum(['default', 'school', 'university', 'self_learning', 'competitive', 'custom'])
      .default('custom'),
    labels: z.array(educationLabelDefinitionSchema).min(1).max(16),
  })
  .strict()
  .refine(
    (v) => {
      const keys = v.labels.map((l) => l.key.toLowerCase());
      return new Set(keys).size === keys.length;
    },
    { message: 'Education label keys must be unique' },
  );

export const createCustomEducationSystemSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(safeCodeRegex, 'Code may only contain letters, numbers, hyphens, and underscores')
      .transform((v) => v.toUpperCase())
      .optional(),
    name: z.string().trim().min(2, 'System name must be at least 2 characters').max(140),
    description: z.string().trim().max(600).optional(),
    country: z.string().trim().min(2).max(40).default('GLOBAL'),
    educationType: z.enum(EDUCATION_SYSTEM_TYPES).default('custom'),
    preferredLanguage: z.enum(LANGUAGES).default('en'),
    academicYear: z.string().trim().max(40).optional(),
    hierarchyPreset: z
      .enum(['default', 'school', 'university', 'self_learning', 'competitive'])
      .optional(),
    hierarchyLevels: z.array(customHierarchyLevelSchema).min(1).max(12).optional(),
    setAsActive: z.boolean().default(true),
  })
  .strict();

export const updateCustomEducationSystemSchema = z
  .object({
    name: z.string().trim().min(2).max(140).optional(),
    description: z.string().trim().max(600).optional(),
    country: z.string().trim().min(2).max(40).optional(),
    educationType: z.enum(EDUCATION_SYSTEM_TYPES).optional(),
    preferredLanguage: z.enum(LANGUAGES).optional(),
    academicYear: z.string().trim().max(40).optional(),
    hierarchyLevels: z.array(customHierarchyLevelSchema).min(1).max(12).optional(),
    isArchived: z.boolean().optional(),
  })
  .strict();

export const setActiveEducationSchema = z
  .object({
    educationSystemId: z.string().trim().min(1).max(64),
    educationLevelId: z.string().trim().max(64).optional().nullable(),
    targetExaminationId: z.string().trim().max(64).optional().nullable(),
  })
  .strict();

export const createCustomEducationLevelSchema = z
  .object({
    educationSystemId: z.string().trim().min(1).max(64),
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(safeCodeRegex)
      .transform((v) => v.toUpperCase())
      .optional(),
    name: z.string().trim().min(1).max(140),
    description: z.string().trim().max(500).optional(),
    hierarchyKey: z.string().trim().min(2).max(40).default('educationLevel'),
    order: z.coerce.number().int().min(0).max(500).default(0),
  })
  .strict();

export const updateCustomEducationLevelSchema = z
  .object({
    name: z.string().trim().min(1).max(140).optional(),
    description: z.string().trim().max(500).optional(),
    hierarchyKey: z.string().trim().min(2).max(40).optional(),
    order: z.coerce.number().int().min(0).max(500).optional(),
    isArchived: z.boolean().optional(),
  })
  .strict();

export const examinationTopicPrioritySchema = z.object({
  topicId: z.string().trim().min(1).max(64),
  priority: z.enum(TOPIC_PRIORITIES),
});

export const createCustomExaminationSchema = z
  .object({
    educationSystemId: z.string().trim().min(1).max(64),
    educationLevelId: z.string().trim().max(64).optional(),
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(safeCodeRegex)
      .transform((v) => v.toUpperCase())
      .optional(),
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().max(800).optional(),
    customLabelTag: z.string().trim().max(80).optional(),
    academicSession: z.string().trim().max(60).optional(),
    examDate: z.string().trim().max(40).optional().nullable(),
    subjectIds: z.array(z.string().trim().min(1).max(64)).max(30).default([]),
    syllabusCoverage: z.string().trim().max(2000).optional(),
    totalMarks: z.coerce.number().int().min(1).max(10_000).optional(),
    durationMinutes: z.coerce.number().int().min(5).max(1_440).optional(),
    preparationGoals: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
    topicPriorities: z.array(examinationTopicPrioritySchema).max(50).default([]),
  })
  .strict();

export const updateCustomExaminationSchema = z
  .object({
    educationLevelId: z.string().trim().max(64).optional().nullable(),
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(800).optional(),
    customLabelTag: z.string().trim().max(80).optional(),
    academicSession: z.string().trim().max(60).optional(),
    examDate: z.string().trim().max(40).optional().nullable(),
    subjectIds: z.array(z.string().trim().min(1).max(64)).max(30).optional(),
    syllabusCoverage: z.string().trim().max(2000).optional(),
    totalMarks: z.coerce.number().int().min(1).max(10_000).optional().nullable(),
    durationMinutes: z.coerce.number().int().min(5).max(1_440).optional().nullable(),
    preparationGoals: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
    topicPriorities: z.array(examinationTopicPrioritySchema).max(50).optional(),
    isArchived: z.boolean().optional(),
  })
  .strict();

export const createCustomSubjectSchema = z
  .object({
    educationSystemId: z.string().trim().min(1).max(64),
    educationLevelId: z.string().trim().max(64).optional(),
    examinationIds: z.array(z.string().trim().min(1).max(64)).max(20).default([]),
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(safeCodeRegex)
      .transform((v) => v.toUpperCase())
      .optional(),
    name: z.string().trim().min(2).max(140),
    nameBn: z.string().trim().max(140).optional(),
    description: z.string().trim().max(800).optional(),
    color: z.string().trim().regex(hexColorRegex, 'Color must be a 6-digit hex code').default('#2563eb'),
    icon: z.string().trim().min(1).max(40).default('book-open'),
    difficultyLevel: z.enum(DIFFICULTY_LEVELS).default('medium'),
    learningObjectives: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
    order: z.coerce.number().int().min(0).max(500).default(0),
  })
  .strict();

export const updateCustomSubjectSchema = z
  .object({
    educationLevelId: z.string().trim().max(64).optional().nullable(),
    examinationIds: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
    name: z.string().trim().min(2).max(140).optional(),
    nameBn: z.string().trim().max(140).optional(),
    description: z.string().trim().max(800).optional(),
    color: z.string().trim().regex(hexColorRegex).optional(),
    icon: z.string().trim().min(1).max(40).optional(),
    difficultyLevel: z.enum(DIFFICULTY_LEVELS).optional(),
    learningObjectives: z.array(z.string().trim().min(1).max(240)).max(20).optional(),
    order: z.coerce.number().int().min(0).max(500).optional(),
    isArchived: z.boolean().optional(),
  })
  .strict();

export const createCustomChapterSchema = z
  .object({
    subjectId: z.string().trim().min(1).max(64),
    chapterNumber: z.coerce.number().int().min(1).max(500).optional(),
    title: z.string().trim().min(2).max(160),
    titleBn: z.string().trim().max(160).optional(),
    description: z.string().trim().max(800).optional(),
    learningObjectives: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
    order: z.coerce.number().int().min(0).max(500).default(0),
  })
  .strict();

export const updateCustomChapterSchema = z
  .object({
    chapterNumber: z.coerce.number().int().min(1).max(500).optional(),
    title: z.string().trim().min(2).max(160).optional(),
    titleBn: z.string().trim().max(160).optional(),
    description: z.string().trim().max(800).optional(),
    learningObjectives: z.array(z.string().trim().min(1).max(240)).max(20).optional(),
    order: z.coerce.number().int().min(0).max(500).optional(),
    isArchived: z.boolean().optional(),
  })
  .strict();

export const createCustomTopicSchema = z
  .object({
    subjectId: z.string().trim().min(1).max(64),
    chapterId: z.string().trim().min(1).max(64),
    code: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .regex(/^[A-Z0-9_.-]+$/i)
      .transform((v) => v.toUpperCase())
      .optional(),
    title: z.string().trim().min(2).max(180),
    titleBn: z.string().trim().max(180).optional(),
    description: z.string().trim().max(1200).optional(),
    learningObjectives: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
    keyConcepts: z.array(z.string().trim().min(1).max(120)).max(25).default([]),
    curriculumReferences: z.array(z.string().trim().min(1).max(240)).max(15).default([]),
    difficulty: z.enum(DIFFICULTY_LEVELS).default('medium'),
    estimatedMinutes: z.coerce.number().int().min(5).max(600).default(45),
    order: z.coerce.number().int().min(0).max(500).default(0),
  })
  .strict();

export const updateCustomTopicSchema = z
  .object({
    title: z.string().trim().min(2).max(180).optional(),
    titleBn: z.string().trim().max(180).optional(),
    description: z.string().trim().max(1200).optional(),
    learningObjectives: z.array(z.string().trim().min(1).max(240)).max(20).optional(),
    keyConcepts: z.array(z.string().trim().min(1).max(120)).max(25).optional(),
    curriculumReferences: z.array(z.string().trim().min(1).max(240)).max(15).optional(),
    difficulty: z.enum(DIFFICULTY_LEVELS).optional(),
    estimatedMinutes: z.coerce.number().int().min(5).max(600).optional(),
    order: z.coerce.number().int().min(0).max(500).optional(),
    isArchived: z.boolean().optional(),
  })
  .strict();
