import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { buildSessionCookieHeader } from '@/lib/auth/session';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { registerStudentAccount } from '@/modules/auth/auth-service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'local';
    enforceRateLimit(`auth:register:${ip}`, 10, 60_000);

    const body = await request.json();
    const result = await registerStudentAccount(body);

    const response = NextResponse.json(
      okEnvelope({
        user: result.user,
        ...(process.env.NODE_ENV !== 'production'
          ? { emailVerificationToken: result.emailVerificationToken }
          : {}),
      }),
      { status: 201 },
    );
    response.headers.set('Set-Cookie', buildSessionCookieHeader(result.sessionToken));
    return response;
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
