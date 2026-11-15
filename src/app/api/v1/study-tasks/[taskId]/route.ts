import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import {
  deleteStudyTaskForStudent,
  updateStudyTaskForStudent,
} from '@/modules/planner/planner-service';

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { taskId } = await context.params;
    const body = await request.json();
    const data = await updateStudyTaskForStudent(actor, taskId, body);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { taskId } = await context.params;
    const data = await deleteStudyTaskForStudent(actor, taskId);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
