/**
 * LearnMate AI — Route Access Policy & Protected Route Evaluator
 * Enforces authentication and role-based route protection for Student, Onboarding, and Admin paths.
 */

import type { UserRole } from '../../types/domain.ts';

export interface RouteActorSummary {
  userId: string;
  role: UserRole;
  onboardingCompleted: boolean;
}

export type RouteAccessDecision =
  | { allowed: true }
  | { allowed: false; redirectTo: string; statusCode: 307 | 401 | 403 };

const PROTECTED_STUDENT_PREFIXES = [
  '/dashboard',
  '/my-learning',
  '/tutor',
  '/materials',
  '/quizzes',
  '/flashcards',
  '/planner',
  '/documents',
  '/analytics',
  '/notifications',
  '/settings',
  '/onboarding',
] as const;

export function isProtectedStudentPath(pathname: string): boolean {
  return PROTECTED_STUDENT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isProtectedAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export function evaluateRouteAccess(
  pathname: string,
  actor: RouteActorSummary | null | undefined,
): RouteAccessDecision {
  if (isProtectedAdminPath(pathname)) {
    if (!actor) {
      return {
        allowed: false,
        redirectTo: `/login?next=${encodeURIComponent(pathname)}`,
        statusCode: 307,
      };
    }
    if (actor.role !== 'admin' && actor.role !== 'content_manager') {
      return {
        allowed: false,
        redirectTo: '/dashboard?error=forbidden',
        statusCode: 403,
      };
    }
    return { allowed: true };
  }

  if (isProtectedStudentPath(pathname)) {
    if (!actor) {
      return {
        allowed: false,
        redirectTo: `/login?next=${encodeURIComponent(pathname)}`,
        statusCode: 307,
      };
    }
    if (
      actor.role === 'student' &&
      !actor.onboardingCompleted &&
      pathname !== '/onboarding' &&
      !pathname.startsWith('/onboarding/')
    ) {
      return {
        allowed: false,
        redirectTo: '/onboarding',
        statusCode: 307,
      };
    }
    return { allowed: true };
  }

  return { allowed: true };
}
