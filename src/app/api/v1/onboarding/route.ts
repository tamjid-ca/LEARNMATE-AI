import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import {
  buildSessionCookieHeader,
  resolveActorFromHeaders,
} from '@/lib/auth/session';
import {
  ONBOARDING_CURRICULUM_CATALOG,
  completeOnboardingWorkflow,
  getAuthenticatedProfile,
} from '@/modules/auth/auth-service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const user = await getAuthenticatedProfile(actor);
    return NextResponse.json(
      okEnvelope({
        user,
        catalog: ONBOARDING_CURRICULUM_CATALOG,
      }),
      { status: 200 },
    );
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const body = await request.json();
    const result = await completeOnboardingWorkflow(actor, body);

    const response = NextResponse.json(okEnvelope({ user: result.user }), { status: 200 });
    response.headers.set('Set-Cookie', buildSessionCookieHeader(result.sessionToken));
    return response;
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
