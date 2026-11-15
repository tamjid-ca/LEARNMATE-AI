import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/auth/password.ts';
import {
  createActionToken,
  createSessionToken,
  verifyActionToken,
  verifySessionToken,
} from '../src/lib/auth/session.ts';
import { evaluateRouteAccess } from '../src/lib/auth/route-guard.ts';
import { resetRateLimitBuckets } from '../src/lib/security/rate-limit.ts';
import {
  InMemoryUserRepository,
  setActiveUserRepository,
} from '../src/modules/auth/user-repository.ts';
import {
  completeOnboardingWorkflow,
  confirmPasswordReset,
  deleteAuthenticatedAccount,
  getAuthenticatedProfile,
  initiatePasswordReset,
  loginWithPassword,
  registerStudentAccount,
  updateAuthenticatedProfile,
  verifyUserEmail,
} from '../src/modules/auth/auth-service.ts';
import { POST as registerRoute } from '../src/app/api/v1/auth/register/route.ts';
import { GET as meRoute } from '../src/app/api/v1/auth/me/route.ts';
import { POST as onboardingRoute } from '../src/app/api/v1/onboarding/route.ts';
import {
  DELETE as deleteProfileRoute,
  PATCH as patchProfileRoute,
} from '../src/app/api/v1/users/profile/route.ts';

describe('State 03 — Authentication, RBAC, Profile & Student Onboarding', () => {
  let repo: InMemoryUserRepository;

  beforeEach(() => {
    repo = new InMemoryUserRepository();
    setActiveUserRepository(repo);
    resetRateLimitBuckets();
  });

  it('hashes and verifies passwords with unique cryptographic salts', () => {
    const h1 = hashPassword('CorrectHorseBatteryStaple!');
    const h2 = hashPassword('CorrectHorseBatteryStaple!');
    expect(h1).not.toBe(h2);
    expect(verifyPassword('CorrectHorseBatteryStaple!', h1)).toBe(true);
    expect(verifyPassword('WrongPassword', h1)).toBe(false);
  });

  it('signs and verifies session and action tokens and rejects tampered or expired tokens', () => {
    const token = createSessionToken({
      userId: 'u-101',
      email: 'student@learnmate.ai',
      role: 'student',
      onboardingCompleted: false,
    });
    const verified = verifySessionToken(token);
    expect(verified?.userId).toBe('u-101');
    expect(verified?.role).toBe('student');
    expect(verified?.onboardingCompleted).toBe(false);

    // Tamper signature
    expect(verifySessionToken(`${token}tampered`)).toBeNull();
    // Expired token
    const expired = createSessionToken(
      { userId: 'u-101', email: 'student@learnmate.ai', role: 'student' },
      -10,
    );
    expect(verifySessionToken(expired)).toBeNull();

    const resetToken = createActionToken('reset_password', 'u-101', 'student@learnmate.ai', 600);
    expect(verifyActionToken(resetToken, 'reset_password')?.userId).toBe('u-101');
    expect(verifyActionToken(resetToken, 'verify_email')).toBeNull();
  });

  it('enforces student role on registration, blocks duplicate emails, and rejects privilege escalation', async () => {
    const reg = await registerStudentAccount(
      {
        fullName: 'Nadia Rahman',
        email: 'Nadia@Example.com',
        password: 'securePassword123',
        preferredLanguage: 'bn',
        timezone: 'Asia/Dhaka',
      },
      repo,
    );

    expect(reg.user.email).toBe('nadia@example.com');
    expect(reg.user.role).toBe('student');
    expect(reg.user.onboardingCompleted).toBe(false);
    expect('passwordHash' in reg.user).toBe(false);

    // Duplicate email rejected with 409
    await expect(
      registerStudentAccount(
        {
          fullName: 'Nadia Duplicate',
          email: 'nadia@example.com',
          password: 'securePassword123',
        },
        repo,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });

    // Privilege escalation ("role": "admin") rejected by .strict() Zod schema
    await expect(
      registerStudentAccount(
        {
          fullName: 'Attacker',
          email: 'attacker@example.com',
          password: 'securePassword123',
          role: 'admin',
        },
        repo,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('supports login, email verification, and password reset end-to-end', async () => {
    const reg = await registerStudentAccount(
      {
        fullName: 'Arif Hasan',
        email: 'arif@learnmate.ai',
        password: 'initialPassword123',
      },
      repo,
    );

    // Verify email
    const verifiedUser = await verifyUserEmail({ token: reg.emailVerificationToken }, repo);
    expect(verifiedUser.emailVerifiedAt).toBeInstanceOf(Date);

    // Initiate & confirm password reset
    const recovery = await initiatePasswordReset({ email: 'arif@learnmate.ai' }, repo);
    expect(recovery.accepted).toBe(true);
    expect(recovery.resetToken).toBeDefined();

    await confirmPasswordReset(
      {
        token: recovery.resetToken,
        newPassword: 'updatedPassword456',
      },
      repo,
    );

    // Old password fails, new password succeeds
    await expect(
      loginWithPassword({ email: 'arif@learnmate.ai', password: 'initialPassword123' }, repo),
    ).rejects.toMatchObject({ statusCode: 401 });

    const loginRes = await loginWithPassword(
      { email: 'arif@learnmate.ai', password: 'updatedPassword456' },
      repo,
    );
    expect(loginRes.user.id).toBe(reg.user.id);
  });

  it('completes student onboarding, updates profile, and deletes account data via Route Handlers', async () => {
    const registerReq = new Request('http://localhost:3000/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Tanvir Ahmed',
        email: 'tanvir@learnmate.ai',
        password: 'tanvirPassword123',
      }),
    });
    const registerRes = await registerRoute(registerReq);
    expect(registerRes.status).toBe(201);
    const setCookie = registerRes.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain('learnmate_session=');
    expect(setCookie).toContain('HttpOnly');

    const cookiePair = setCookie.split(';')[0] ?? '';

    // Complete onboarding via POST /api/v1/onboarding
    const onboardingReq = new Request('http://localhost:3000/api/v1/onboarding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookiePair,
      },
      body: JSON.stringify({
        country: 'BD',
        educationSystemCode: 'BD-NCTB',
        educationLevelCode: 'HSC',
        targetExaminationCode: 'HSC-2027',
        selectedSubjects: ['Physics 1st & 2nd Paper', 'Higher Mathematics 1st & 2nd Paper'],
        preferredLanguage: 'bn',
        dailyStudyMinutes: 150,
        learningPreferences: ['conceptual_learning', 'exam_focused'],
        timezone: 'Asia/Dhaka',
        institution: 'Dhaka College',
      }),
    });
    const onboardingRes = await onboardingRoute(onboardingReq);
    expect(onboardingRes.status).toBe(200);
    const onboardingBody = await onboardingRes.json();
    expect(onboardingBody.data.user.onboardingCompleted).toBe(true);
    expect(onboardingBody.data.user.preferredLanguage).toBe('bn');
    expect(onboardingBody.data.user.dailyStudyMinutes).toBe(150);

    // Update profile via PATCH /api/v1/users/profile
    const patchReq = new Request('http://localhost:3000/api/v1/users/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookiePair,
      },
      body: JSON.stringify({
        fullName: 'Tanvir Ahmed HSC',
        dailyStudyMinutes: 180,
      }),
    });
    const patchRes = await patchProfileRoute(patchReq);
    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.data.user.fullName).toBe('Tanvir Ahmed HSC');
    expect(patchBody.data.user.dailyStudyMinutes).toBe(180);

    // Delete account via DELETE /api/v1/users/profile
    const deleteReq = new Request('http://localhost:3000/api/v1/users/profile', {
      method: 'DELETE',
      headers: { cookie: cookiePair },
    });
    const deleteRes = await deleteProfileRoute(deleteReq);
    expect(deleteRes.status).toBe(200);
    const deleteBody = await deleteRes.json();
    expect(deleteBody.data.deleted).toBe(true);
    expect(deleteBody.data.purgedCollections).toBeGreaterThanOrEqual(16);

    // Verify GET /api/v1/auth/me now returns 404 for deleted user
    const meReq = new Request('http://localhost:3000/api/v1/auth/me', {
      method: 'GET',
      headers: { cookie: cookiePair },
    });
    const meRes = await meRoute(meReq);
    expect(meRes.status).toBe(404);
  });

  it('enforces protected route access and role separation in evaluateRouteAccess', () => {
    // Unauthenticated user on protected student route -> redirect to /login
    expect(evaluateRouteAccess('/dashboard', null)).toEqual({
      allowed: false,
      redirectTo: '/login?next=%2Fdashboard',
      statusCode: 307,
    });

    // Un-onboarded student on /dashboard -> redirect to /onboarding
    expect(
      evaluateRouteAccess('/dashboard', {
        userId: 'u-1',
        role: 'student',
        onboardingCompleted: false,
      }),
    ).toEqual({
      allowed: false,
      redirectTo: '/onboarding',
      statusCode: 307,
    });

    // Onboarded student on /dashboard -> allowed
    expect(
      evaluateRouteAccess('/dashboard', {
        userId: 'u-1',
        role: 'student',
        onboardingCompleted: true,
      }),
    ).toEqual({ allowed: true });

    // Student attempting /admin/ai-config -> forbidden redirect
    expect(
      evaluateRouteAccess('/admin/ai-config', {
        userId: 'u-1',
        role: 'student',
        onboardingCompleted: true,
      }),
    ).toEqual({
      allowed: false,
      redirectTo: '/dashboard?error=forbidden',
      statusCode: 403,
    });

    // Admin on /admin/ai-config -> allowed
    expect(
      evaluateRouteAccess('/admin/ai-config', {
        userId: 'u-admin',
        role: 'admin',
        onboardingCompleted: true,
      }),
    ).toEqual({ allowed: true });
  });
});
