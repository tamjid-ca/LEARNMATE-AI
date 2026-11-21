/**
 * LearnMate AI — Learning Analytics, Notifications & Gamification Validators
 * Grounded in docs/PROJECT_SRS.md Sections 4.10 & 4.11 (FR-ANALYTICS-001..008, FR-NOTIFY-001..003, FR-GAME-001..004).
 */

import { z } from 'zod';
import { LANGUAGES } from '../../types/domain.ts';

export const recordTopicProgressSchema = z.object({
  topicId: z.string().trim().min(1),
  studyTimeMinutesDelta: z.coerce.number().int().min(0).max(360).default(15),
  markCompleted: z.boolean().optional(),
});

export type RecordTopicProgressInput = z.infer<typeof recordTopicProgressSchema>;

export const notificationPreferencesPatchSchema = z.object({
  studyReminders: z.boolean().optional(),
  dueFlashcards: z.boolean().optional(),
  upcomingExams: z.boolean().optional(),
  learningMilestones: z.boolean().optional(),
});

export const updateNotificationsSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('mark_read'),
    notificationId: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal('mark_all_read'),
  }),
  z.object({
    action: z.literal('update_preferences'),
    preferences: notificationPreferencesPatchSchema,
  }),
]);

export type UpdateNotificationsInput = z.infer<typeof updateNotificationsSchema>;

export const analyticsQuerySchema = z.object({
  language: z.enum(LANGUAGES).default('en'),
  refreshAiRecommendations: z.coerce.boolean().default(false),
});
