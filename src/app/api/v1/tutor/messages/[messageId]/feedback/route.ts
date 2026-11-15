import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import { rateTutorMessageForStudent } from '@/modules/tutor/tutor-materials-service';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ messageId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { messageId } = await context.params;
    const body = await request.json();
    const data = await rateTutorMessageForStudent(actor, messageId, body);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
