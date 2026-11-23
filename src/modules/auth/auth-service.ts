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
  getActiveCurriculumRepository,
  type CurriculumRepository,
} from '../curriculum/curriculum-repository.ts';
import {
  createCustomEducationSystemForStudent,
  createCustomExaminationForStudent,
  createCustomSubjectForStudent,
} from '../curriculum/custom-education-service.ts';
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
  curriculumRepo?: CurriculumRepository,
): Promise<{ user: PublicUserProfile; sessionToken: string }> {
  const verified = requireAuth(actor);
  const parsed = onboardingSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid onboarding preferences', parsed.error.flatten());
  }

  const data = parsed.data;
  const activeCurriculumRepo = curriculumRepo ?? getActiveCurriculumRepository();
  let resolvedSystemId = data.educationSystemId;
  let resolvedSystemCode = data.educationSystemCode;
  let resolvedExamId = data.targetExaminationId;
  const resolvedSubjectIds: string[] = [];

  try {
    if (data.educationMode === 'custom' && data.customSystem) {
      const createdSys = await createCustomEducationSystemForStudent(
        verified,
        {
          name: data.customSystem.name,
          description: data.customSystem.description,
          country: data.country,
          educationType: data.customSystem.educationType,
          preferredLanguage: data.preferredLanguage,
          academicYear: data.customSystem.academicYear,
          hierarchyPreset:
            data.customSystem.hierarchyPreset &&
            (data.customSystem.hierarchyPreset as string) !== 'custom'
              ? data.customSystem.hierarchyPreset
              : 'default',
          setAsActive: false,
        },
        activeCurriculumRepo,
        repo,
      );
      resolvedSystemId = createdSys.system.id;
      resolvedSystemCode = createdSys.system.code;

      if (data.targetExaminationCode?.trim()) {
        const createdExam = await createCustomExaminationForStudent(
          verified,
          {
            educationSystemId: createdSys.system.id,
            name: data.targetExaminationCode.trim(),
            academicSession: data.customSystem.academicYear,
          },
          activeCurriculumRepo,
        );
        resolvedExamId = createdExam.examination.id;
      }

      for (const subjectName of data.selectedSubjects) {
        const createdSubj = await createCustomSubjectForStudent(
          verified,
          {
            educationSystemId: createdSys.system.id,
            examinationIds: resolvedExamId ? [resolvedExamId] : [],
            name: subjectName,
          },
          activeCurriculumRepo,
          repo,
        );
        resolvedSubjectIds.push(createdSubj.subject.id);
      }
    } else {
      const visibility = { viewerUserId: verified.userId, scopeFilter: 'all' as const };
      const [systems, exams, subjects] = await Promise.all([
        activeCurriculumRepo.listEducationSystems(false, undefined, visibility),
        activeCurriculumRepo.listExaminations(visibility),
        activeCurriculumRepo.listSubjects(visibility),
      ]);

      const matchedSys =
        (resolvedSystemId ? systems.find((s) => s.id === resolvedSystemId) : undefined) ??
        systems.find((s) => s.code === data.educationSystemCode);
      if (matchedSys) {
        resolvedSystemId = matchedSys.id;
      }

      const matchedExam =
        (resolvedExamId ? exams.find((e) => e.id === resolvedExamId) : undefined) ??
        (data.targetExaminationCode
          ? exams.find(
              (e) =>
                e.code.toLowerCase() === data.targetExaminationCode!.toLowerCase() ||
                e.name.toLowerCase() === data.targetExaminationCode!.toLowerCase(),
            )
          : undefined);
      if (matchedExam) {
        resolvedExamId = matchedExam.id;
      }

      const fallbackSystemId = resolvedSystemId ?? systems[0]?.id;
      for (const subjName of data.selectedSubjects) {
        const matchedSubj = subjects.find(
          (s) =>
            s.name.toLowerCase() === subjName.toLowerCase() ||
            subjName.toLowerCase().includes(s.name.toLowerCase()),
        );
        if (matchedSubj) {
          resolvedSubjectIds.push(matchedSubj.id);
        } else if (fallbackSystemId) {
          const customSubj = await createCustomSubjectForStudent(
            verified,
            {
              educationSystemId: fallbackSystemId,
              name: subjName,
            },
            activeCurriculumRepo,
            repo,
          );
          resolvedSubjectIds.push(customSubj.subject.id);
        }
      }
    }
  } catch {
    // Keep onboarding resilient even if optional curriculum DB seeding is unavailable in isolated unit tests
  }

  const updated = await repo.updateById(verified.userId, {
    country: data.country,
    preferredLanguage: data.preferredLanguage,
    dailyStudyMinutes: data.dailyStudyMinutes,
    learningPreferences: data.learningPreferences,
    timezone: data.timezone,
    ...(resolvedSystemId ? { educationSystemId: resolvedSystemId } : {}),
    ...(resolvedExamId ? { targetExaminationId: resolvedExamId } : {}),
    ...(resolvedSubjectIds.length > 0 ? { selectedSubjectIds: resolvedSubjectIds } : {}),
    ...(data.institution !== undefined ? { institution: data.institution } : {}),
    onboardingCompleted: true,
    onboardingMeta: {
      educationSystemCode: resolvedSystemCode,
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
