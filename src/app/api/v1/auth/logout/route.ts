import { NextResponse } from 'next/server';
import { okEnvelope } from '@/lib/api/response';
import { buildClearSessionCookieHeader } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST() {
  const response = NextResponse.json(okEnvelope({ signedOut: true }), { status: 200 });
  response.headers.set('Set-Cookie', buildClearSessionCookieHeader());
  return response;
}
