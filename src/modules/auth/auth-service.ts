/**
 * LearnMate AI — Authentication, Profile & Student Onboarding Service
 * Implements SRS Sections 3, 4.1 (FR-AUTH-001..007), and 4.2 (FR-ONB-001..008).
 */

import { AppError } from '../../lib/api/errors.ts';
import { hashPassword, verifyPassword } from '../../lib/auth/password.ts';
import { requireAuth, type AuthenticatedActor } from '../../lib/auth/rbac.ts';
import {
  createActionToken,
  createSessionToken,
  verifyActionToken,
} from '../../lib/auth/session.ts';
import {
  forgotPasswordSchema,
  loginSchema,
  onboardingSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from '../../lib/validators/auth.ts';
import {
  getActiveUserRepository,
  toPublicUserProfile,
  type PublicUserProfile,
  type UserRepository,
} from './user-repository.ts';

export interface AuthSessionResult {
  user: PublicUserProfile;
  sessionToken: string;
  emailVerificationToken?: string;
}

export { ONBOARDING_CURRICULUM_CATALOG } from '../../config/onboarding-catalog.ts';

export async function registerStudentAccount(
  rawInput: unknown,
  repo: UserRepository = getActiveUserRepository(),
): Promise<AuthSessionResult> {
  const parsed = registerSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid registration data', parsed.error.flatten());
  }

  const { fullName, email, password, preferredLanguage, timezone } = parsed.data;
  const existing = await repo.findByEmail(email);
  if (existing) {
    throw AppError.conflict('An account with this email address already exists');
  }

  const passwordHash = hashPassword(password);
  const created = await repo.create({
    fullName,
    email,
    passwordHash,
    role: 'student', // Strictly enforced server-side (never trust client role claims)
    preferredLanguage,
    timezone,
  });

  const sessionToken = createSessionToken({
    userId: created.id,
    email: created.email,
    role: created.role,
    onboardingCompleted: created.onboardingCompleted,
  });

  const emailVerificationToken = createActionToken('verify_email', created.id, created.email, 86_400);

  return {
    user: toPublicUserProfile(created),
    sessionToken,
    emailVerificationToken,
  };
}

export async function loginWithPassword(
  rawInput: unknown,
  repo: UserRepository = getActiveUserRepository(),
): Promise<AuthSessionResult> {
  const parsed = loginSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid login credentials format', parsed.error.flatten());
  }

  const { email, password } = parsed.data;
  const user = await repo.findByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw AppError.unauthorized('Invalid email address or password');
  }

  if (user.status === 'suspended' || user.status === 'deleted') {
    throw AppError.forbidden('This account is not permitted to sign in');
  }

  const sessionToken = createSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    onboardingCompleted: user.onboardingCompleted,
  });

  return {
    user: toPublicUserProfile(user),
    sessionToken,
  };
}

export async function getAuthenticatedProfile(
  actor: AuthenticatedActor | null | undefined,
  repo: UserRepository = getActiveUserRepository(),
): Promise<PublicUserProfile> {
  const verified = requireAuth(actor);
  const user = await repo.findById(verified.userId);
  if (!user || user.status === 'deleted') {
    throw AppError.notFound('User account');
  }
  return toPublicUserProfile(user);
}

export async function updateAuthenticatedProfile(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  repo: UserRepository = getActiveUserRepository(),
): Promise<PublicUserProfile> {
  const verified = requireAuth(actor);
  const parsed = updateProfileSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid profile update payload', parsed.error.flatten());
  }

  const updated = await repo.updateById(verified.userId, parsed.data);
  if (!updated) {
    throw AppError.notFound('User account');
  }
  return toPublicUserProfile(updated);
}

export async function completeOnboardingWorkflow(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  repo: UserRepository = getActiveUserRepository(),
): Promise<{ user: PublicUserProfile; sessionToken: string }> {
  const verified = requireAuth(actor);
  const parsed = onboardingSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid onboarding preferences', parsed.error.flatten());
  }

  const data = parsed.data;
  const updated = await repo.updateById(verified.userId, {
    country: data.country,
    preferredLanguage: data.preferredLanguage,
    dailyStudyMinutes: data.dailyStudyMinutes,
    learningPreferences: data.learningPreferences,
    timezone: data.timezone,
    ...(data.institution !== undefined ? { institution: data.institution } : {}),
    onboardingCompleted: true,
    onboardingMeta: {
      educationSystemCode: data.educationSystemCode,
      educationLevelCode: data.educationLevelCode,
      targetExaminationCode: data.targetExaminationCode,
      selectedSubjects: data.selectedSubjects,
    },
  });

  if (!updated) {
    throw AppError.notFound('User account');
  }

  const sessionToken = createSessionToken({
    userId: updated.id,
    email: updated.email,
    role: updated.role,
    onboardingCompleted: true,
  });

  return {
    user: toPublicUserProfile(updated),
    sessionToken,
  };
}

export async function verifyUserEmail(
  rawInput: unknown,
  repo: UserRepository = getActiveUserRepository(),
): Promise<PublicUserProfile> {
  const parsed = verifyEmailSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Verification token is required');
  }
  const tokenPayload = verifyActionToken(parsed.data.token, 'verify_email');
  if (!tokenPayload) {
    throw AppError.validation('Invalid or expired email verification token');
  }
  const updated = await repo.updateById(tokenPayload.userId, {
    emailVerifiedAt: new Date(),
  });
  if (!updated) {
    throw AppError.notFound('User account');
  }
  return toPublicUserProfile(updated);
}

export async function initiatePasswordReset(
  rawInput: unknown,
  repo: UserRepository = getActiveUserRepository(),
): Promise<{ accepted: true; resetToken?: string }> {
  const parsed = forgotPasswordSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Valid email address is required');
  }
  const user = await repo.findByEmail(parsed.data.email);
  if (!user || user.status === 'deleted') {
    // Always return accepted: true to prevent account enumeration
    return { accepted: true };
  }
  const resetToken = createActionToken('reset_password', user.id, user.email, 3600);
  return {
    accepted: true,
    resetToken,
  };
}

export async function confirmPasswordReset(
  rawInput: unknown,
  repo: UserRepository = getActiveUserRepository(),
): Promise<{ reset: true }> {
  const parsed = resetPasswordSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid password reset payload', parsed.error.flatten());
  }
  const tokenPayload = verifyActionToken(parsed.data.token, 'reset_password');
  if (!tokenPayload) {
    throw AppError.validation('Invalid or expired password reset token');
  }
  const newPasswordHash = hashPassword(parsed.data.newPassword);
  const updated = await repo.updateById(tokenPayload.userId, {
    passwordHash: newPasswordHash,
  });
  if (!updated) {
    throw AppError.notFound('User account');
  }
  return { reset: true };
}

export async function deleteAuthenticatedAccount(
  actor: AuthenticatedActor | null | undefined,
  repo: UserRepository = getActiveUserRepository(),
): Promise<{ deleted: boolean; purgedCollections: number }> {
  const verified = requireAuth(actor);
  const result = await repo.deleteAccountAndPersonalData(verified.userId);
  if (!result.deletedUser) {
    throw AppError.notFound('User account');
  }
  return {
    deleted: true,
    purgedCollections: result.purgedCollections,
  };
}
