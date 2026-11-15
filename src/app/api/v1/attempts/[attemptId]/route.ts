import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import {
  getQuizAttemptDetailForStudent,
  submitQuizAttemptForStudent,
} from '@/modules/quizzes/quiz-service';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { attemptId } = await context.params;
    const data = await getQuizAttemptDetailForStudent(actor, attemptId);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { attemptId } = await context.params;
    const body = await request.json();
    const data = await submitQuizAttemptForStudent(actor, attemptId, body);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
