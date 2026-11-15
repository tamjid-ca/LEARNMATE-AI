/**
 * LearnMate AI — Authentication, Profile & Onboarding Zod Schemas
 * Enforces strict validation and rejects privilege escalation fields on registration.
 */

import { z } from 'zod';
import { LANGUAGES, LEARNING_STYLES } from '../../types/domain.ts';

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
    email: z.string().trim().toLowerCase().email('Valid email address is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password cannot exceed 128 characters'),
    preferredLanguage: z.enum(LANGUAGES).optional().default('en'),
    timezone: z.string().trim().min(2).max(64).optional().default('Asia/Dhaka'),
  })
  .strict(); // .strict() rejects unexpected fields such as "role": "admin"

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Valid email address is required'),
  password: z.string().min(1, 'Password is required').max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Valid email address is required'),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(10, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(128, 'New password cannot exceed 128 characters'),
});

export const verifyEmailSchema = z.object({
  token: z.string().trim().min(10, 'Verification token is required'),
});

export const onboardingSchema = z.object({
  country: z.string().trim().min(2, 'Country is required').max(64),
  educationSystemCode: z.string().trim().min(2, 'Education system is required').max(64),
  educationLevelCode: z.string().trim().min(1, 'Education level or target exam is required').max(64),
  targetExaminationCode: z.string().trim().max(64).optional(),
  selectedSubjects: z
    .array(z.string().trim().min(1).max(80))
    .min(1, 'Select at least one subject to study')
    .max(15),
  preferredLanguage: z.enum(LANGUAGES),
  dailyStudyMinutes: z
    .number()
    .int()
    .min(15, 'Daily study availability must be at least 15 minutes')
    .max(720, 'Daily study availability cannot exceed 12 hours'),
  learningPreferences: z
    .array(z.enum(LEARNING_STYLES))
    .min(1, 'Select at least one learning preference'),
  timezone: z.string().trim().min(2, 'Timezone is required').max(64),
  institution: z.string().trim().max(120).optional(),
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  profileImageUrl: z.string().trim().url().or(z.literal('')).optional(),
  preferredLanguage: z.enum(LANGUAGES).optional(),
  country: z.string().trim().min(2).max(64).optional(),
  institution: z.string().trim().max(120).optional(),
  timezone: z.string().trim().min(2).max(64).optional(),
  dailyStudyMinutes: z.number().int().min(15).max(720).optional(),
  learningPreferences: z.array(z.enum(LEARNING_STYLES)).min(1).optional(),
  notificationPreferences: z
    .object({
      studyReminders: z.boolean(),
      dueFlashcards: z.boolean(),
      upcomingExams: z.boolean(),
      learningMilestones: z.boolean(),
    })
    .optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
