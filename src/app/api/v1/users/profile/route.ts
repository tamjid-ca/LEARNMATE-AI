import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import {
  buildClearSessionCookieHeader,
  resolveActorFromHeaders,
} from '@/lib/auth/session';
import {
  deleteAuthenticatedAccount,
  getAuthenticatedProfile,
  updateAuthenticatedProfile,
} from '@/modules/auth/auth-service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const user = await getAuthenticatedProfile(actor);
    return NextResponse.json(okEnvelope({ user }), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const body = await request.json();
    const user = await updateAuthenticatedProfile(actor, body);
    return NextResponse.json(okEnvelope({ user }), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const result = await deleteAuthenticatedAccount(actor);
    const response = NextResponse.json(okEnvelope(result), { status: 200 });
    response.headers.set('Set-Cookie', buildClearSessionCookieHeader());
    return response;
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
