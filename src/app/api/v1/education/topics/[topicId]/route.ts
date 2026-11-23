import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import {
  deleteCustomTopicForStudent,
  updateCustomTopicForStudent,
} from '@/modules/curriculum/custom-education-service';

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ topicId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { topicId } = await context.params;
    const payload = await request.json();
    const data = await updateCustomTopicForStudent(actor, topicId, payload);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ topicId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { topicId } = await context.params;
    const data = await deleteCustomTopicForStudent(actor, topicId);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
