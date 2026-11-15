/**
 * LearnMate AI — Session & Action Token Management
 * Signs and verifies stateless HMAC-SHA256 tokens for HTTP-only cookies and
 * email verification / password recovery flows.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { UserRole } from '../../types/domain.ts';
import type { AuthenticatedActor } from './rbac.ts';

export const SESSION_COOKIE_NAME = 'learnmate_session';
export const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionTokenPayload extends AuthenticatedActor {
  purpose: 'session';
  onboardingCompleted: boolean;
  iat: number;
  exp: number;
}

export interface ActionTokenPayload {
  purpose: 'verify_email' | 'reset_password';
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

function getAuthSecret(env: Record<string, string | undefined> = process.env): string {
  const configured = env.AUTH_SECRET?.trim();
  if (configured && configured.length >= 16) {
    return configured;
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET must be configured with at least 16 characters in production');
  }
  return 'learnmate-dev-fallback-secret-do-not-use-in-prod-32b';
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function signData(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function createSessionToken(
  actor: AuthenticatedActor & { onboardingCompleted?: boolean },
  ttlSeconds = DEFAULT_SESSION_TTL_SECONDS,
  env: Record<string, string | undefined> = process.env,
): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: SessionTokenPayload = {
    purpose: 'session',
    userId: actor.userId,
    email: actor.email,
    role: actor.role,
    onboardingCompleted: actor.onboardingCompleted ?? false,
    iat: nowSec,
    exp: nowSec + ttlSeconds,
  };
  const secret = getAuthSecret(env);
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signData(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(
  token: string | undefined | null,
  env: Record<string, string | undefined> = process.env,
): SessionTokenPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, providedSig] = parts;
  if (!encodedPayload || !providedSig) return null;

  const secret = getAuthSecret(env);
  const expectedSig = signData(encodedPayload, secret);

  const providedBuf = Buffer.from(providedSig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as SessionTokenPayload;
    const nowSec = Math.floor(Date.now() / 1000);
    if (parsed.purpose !== 'session' || typeof parsed.exp !== 'number' || parsed.exp <= nowSec) {
      return null;
    }
    if (!parsed.userId || !parsed.email || !parsed.role) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function createActionToken(
  purpose: 'verify_email' | 'reset_password',
  userId: string,
  email: string,
  ttlSeconds = 3600,
  env: Record<string, string | undefined> = process.env,
): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: ActionTokenPayload = {
    purpose,
    userId,
    email,
    iat: nowSec,
    exp: nowSec + ttlSeconds,
  };
  const secret = getAuthSecret(env);
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signData(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyActionToken(
  token: string | undefined | null,
  expectedPurpose: 'verify_email' | 'reset_password',
  env: Record<string, string | undefined> = process.env,
): ActionTokenPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, providedSig] = parts;
  if (!encodedPayload || !providedSig) return null;

  const secret = getAuthSecret(env);
  const expectedSig = signData(encodedPayload, secret);

  const providedBuf = Buffer.from(providedSig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as ActionTokenPayload;
    const nowSec = Math.floor(Date.now() / 1000);
    if (parsed.purpose !== expectedPurpose || typeof parsed.exp !== 'number' || parsed.exp <= nowSec) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function buildSessionCookieHeader(
  token: string,
  maxAgeSeconds = DEFAULT_SESSION_TTL_SECONDS,
  isProduction = process.env.NODE_ENV === 'production',
): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isProduction) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function buildClearSessionCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function extractTokenFromHeaders(headers: Headers): string | null {
  const authHeader = headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = headers.get('cookie');
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const [rawName, ...rest] = pair.trim().split('=');
    if (rawName === SESSION_COOKIE_NAME) {
      return rest.join('=');
    }
  }
  return null;
}

export function resolveActorFromHeaders(
  headers: Headers,
  env: Record<string, string | undefined> = process.env,
): (AuthenticatedActor & { onboardingCompleted: boolean; role: UserRole }) | null {
  const token = extractTokenFromHeaders(headers);
  const payload = verifySessionToken(token, env);
  if (!payload) return null;
  return {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    onboardingCompleted: payload.onboardingCompleted,
  };
}
