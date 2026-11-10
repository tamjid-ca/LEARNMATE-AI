/**
 * LearnMate AI — Server-Side Authentication, RBAC & Ownership Architecture
 * Enforces SRS Section 3 and Section 8 security invariants.
 */

import { AppError } from '../api/errors.ts';
import type { UserRole } from '../../types/domain.ts';

export interface AuthenticatedActor {
  userId: string;
  email: string;
  role: UserRole;
}

export type Permission =
  | 'curriculum:read'
  | 'curriculum:write'
  | 'content:review'
  | 'student:learn'
  | 'admin:users'
  | 'admin:ai_config'
  | 'admin:prompts'
  | 'admin:usage_logs'
  | 'admin:audit_logs'
  | 'admin:settings';

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  student: ['curriculum:read', 'student:learn'],
  content_manager: ['curriculum:read', 'curriculum:write', 'content:review', 'student:learn'],
  admin: [
    'curriculum:read',
    'curriculum:write',
    'content:review',
    'student:learn',
    'admin:users',
    'admin:ai_config',
    'admin:prompts',
    'admin:usage_logs',
    'admin:audit_logs',
    'admin:settings',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function requireAuth(actor: AuthenticatedActor | null | undefined): AuthenticatedActor {
  if (!actor || !actor.userId) {
    throw AppError.unauthorized();
  }
  return actor;
}

export function requireRole(
  actor: AuthenticatedActor | null | undefined,
  allowedRoles: readonly UserRole[],
): AuthenticatedActor {
  const verified = requireAuth(actor);
  if (!allowedRoles.includes(verified.role)) {
    throw AppError.forbidden();
  }
  return verified;
}

export function requirePermission(
  actor: AuthenticatedActor | null | undefined,
  permission: Permission,
): AuthenticatedActor {
  const verified = requireAuth(actor);
  if (!hasPermission(verified.role, permission)) {
    throw AppError.forbidden();
  }
  return verified;
}

export function assertResourceOwnership(
  actor: AuthenticatedActor | null | undefined,
  ownerUserId: string,
  allowAdminOverride = false,
): void {
  const verified = requireAuth(actor);
  if (verified.userId === ownerUserId) {
    return;
  }
  if (allowAdminOverride && verified.role === 'admin') {
    return;
  }
  throw AppError.forbidden('You do not have access to this record');
}
