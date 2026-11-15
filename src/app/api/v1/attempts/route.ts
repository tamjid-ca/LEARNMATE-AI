import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import { startQuizAttemptForStudent } from '@/modules/quizzes/quiz-service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const body = await request.json();
    const data = await startQuizAttemptForStudent(actor, body);
    return NextResponse.json(okEnvelope(data), { status: 201 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
