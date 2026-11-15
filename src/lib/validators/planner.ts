/**
 * LearnMate AI — Personalized Study Planner Zod Validation Schemas
 * Grounded in docs/PROJECT_SRS.md Section 4.8 (FR-PLAN-001 through FR-PLAN-011).
 */

import { z } from 'zod';
import {
  EXPLANATION_DEPTHS,
  LANGUAGES,
  STUDY_PLAN_STATUSES,
  STUDY_TASK_STATUSES,
  STUDY_TASK_TYPES,
} from '../../types/domain.ts';

export const createStudyPlanSchema = z.object({
  title: z.string().trim().min(2).max(200),
  targetExaminationId: z.string().trim().min(1).optional(),
  targetDate: z.coerce.date(),
  startDate: z.coerce.date().optional(),
  subjectIds: z.array(z.string().trim().min(1)).min(1).max(20),
  dailyStudyMinutes: z.coerce.number().int().min(15).max(720).default(120),
  availableDaysOfWeek: z
    .array(z.coerce.number().int().min(0).max(6))
    .min(1)
    .max(7)
    .default([0, 1, 2, 3, 4, 5, 6]),
  proficiencyBySubject: z.record(z.string(), z.enum(EXPLANATION_DEPTHS)).default({}),
  language: z.enum(LANGUAGES).default('en'),
});

export type CreateStudyPlanInput = z.infer<typeof createStudyPlanSchema>;

export const updateStudyPlanSchema = z.object({
  action: z
    .enum(['update_config', 'recalculate', 'reschedule_missed'])
    .default('update_config'),
  title: z.string().trim().min(2).max(200).optional(),
  targetExaminationId: z.string().trim().min(1).optional(),
  targetDate: z.coerce.date().optional(),
  dailyStudyMinutes: z.coerce.number().int().min(15).max(720).optional(),
  availableDaysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).min(1).max(7).optional(),
  subjectIds: z.array(z.string().trim().min(1)).min(1).max(20).optional(),
  proficiencyBySubject: z.record(z.string(), z.enum(EXPLANATION_DEPTHS)).optional(),
  status: z.enum(STUDY_PLAN_STATUSES).optional(),
  referenceDate: z.coerce.date().optional(),
  language: z.enum(LANGUAGES).default('en'),
});

export type UpdateStudyPlanInput = z.infer<typeof updateStudyPlanSchema>;

export const createManualStudyTaskSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional(),
  taskType: z.enum(STUDY_TASK_TYPES).default('learn_topic'),
  subjectId: z.string().trim().min(1).optional(),
  chapterId: z.string().trim().min(1).optional(),
  topicId: z.string().trim().min(1).optional(),
  scheduledDate: z.coerce.date(),
  durationMinutes: z.coerce.number().int().min(10).max(360).default(45),
  priorityRank: z.coerce.number().int().min(1).max(100).default(1),
});

export type CreateManualStudyTaskInput = z.infer<typeof createManualStudyTaskSchema>;

export const updateStudyTaskSchema = z.object({
  status: z.enum(STUDY_TASK_STATUSES).optional(),
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(1000).optional(),
  taskType: z.enum(STUDY_TASK_TYPES).optional(),
  scheduledDate: z.coerce.date().optional(),
  durationMinutes: z.coerce.number().int().min(10).max(360).optional(),
  priorityRank: z.coerce.number().int().min(1).max(100).optional(),
});

export type UpdateStudyTaskInput = z.infer<typeof updateStudyTaskSchema>;
