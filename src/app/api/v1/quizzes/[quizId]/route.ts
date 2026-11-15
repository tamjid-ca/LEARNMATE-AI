import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import { getQuizDetailForStudent } from '@/modules/quizzes/quiz-service';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ quizId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { quizId } = await context.params;
    const url = new URL(request.url);
    const includeSolutions = url.searchParams.get('includeSolutions') === 'true';
    const data = await getQuizDetailForStudent(actor, quizId, includeSolutions);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
