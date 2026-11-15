import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { initiatePasswordReset } from '@/modules/auth/auth-service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'local';
    enforceRateLimit(`auth:forgot:${ip}`, 8, 60_000);

    const body = await request.json();
    const result = await initiatePasswordReset(body);

    return NextResponse.json(
      okEnvelope({
        accepted: result.accepted,
        ...(process.env.NODE_ENV !== 'production' && result.resetToken
          ? { resetToken: result.resetToken }
          : {}),
      }),
      { status: 200 },
    );
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
