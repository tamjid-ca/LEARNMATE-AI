import { NextResponse, type NextRequest } from 'next/server';
import {
  evaluateRouteAccess,
  isProtectedAdminPath,
  isProtectedStudentPath,
  type RouteActorSummary,
} from '@/lib/auth/route-guard';
import type { UserRole } from '@/types/domain';

const SESSION_COOKIE_NAME = 'learnmate_session';

function getMiddlewareAuthSecret(): string {
  const configured = process.env.AUTH_SECRET?.trim();
  if (configured && configured.length >= 16) {
    return configured;
  }
  return 'learnmate-dev-fallback-secret-do-not-use-in-prod-32b';
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function verifySessionCookieEdge(token: string | undefined): Promise<RouteActorSummary | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return null;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(getMiddlewareAuthSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const sigBytes = base64UrlToUint8Array(signature);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes.buffer as ArrayBuffer,
      encoder.encode(encodedPayload),
    );
    if (!isValid) return null;

    const jsonStr = new TextDecoder().decode(base64UrlToUint8Array(encodedPayload));
    const parsed = JSON.parse(jsonStr) as {
      purpose?: string;
      userId?: string;
      role?: UserRole;
      onboardingCompleted?: boolean;
      exp?: number;
    };

    const nowSec = Math.floor(Date.now() / 1000);
    if (
      parsed.purpose !== 'session' ||
      !parsed.userId ||
      !parsed.role ||
      typeof parsed.exp !== 'number' ||
      parsed.exp <= nowSec
    ) {
      return null;
    }

    return {
      userId: parsed.userId,
      role: parsed.role,
      onboardingCompleted: Boolean(parsed.onboardingCompleted),
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedStudentPath(pathname) && !isProtectedAdminPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const actor = await verifySessionCookieEdge(token);
  const decision = evaluateRouteAccess(pathname, actor);

  if (!decision.allowed) {
    return NextResponse.redirect(new URL(decision.redirectTo, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/my-learning/:path*',
    '/tutor/:path*',
    '/materials/:path*',
    '/quizzes/:path*',
    '/flashcards/:path*',
    '/planner/:path*',
    '/documents/:path*',
    '/analytics/:path*',
    '/notifications/:path*',
    '/settings/:path*',
    '/onboarding/:path*',
    '/admin/:path*',
  ],
};
