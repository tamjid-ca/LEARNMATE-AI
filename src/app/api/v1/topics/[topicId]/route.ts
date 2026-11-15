import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import { getTopicDetailForUser } from '@/modules/curriculum/curriculum-service';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ topicId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { topicId } = await context.params;
    const detail = await getTopicDetailForUser(actor, topicId);
    return NextResponse.json(okEnvelope(detail), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
