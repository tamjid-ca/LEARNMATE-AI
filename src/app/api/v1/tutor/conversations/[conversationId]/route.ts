import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import {
  deleteConversationForStudent,
  getConversationDetailForStudent,
  updateConversationForStudent,
} from '@/modules/tutor/tutor-materials-service';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { conversationId } = await context.params;
    const data = await getConversationDetailForStudent(actor, conversationId);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { conversationId } = await context.params;
    const body = await request.json();
    const data = await updateConversationForStudent(actor, conversationId, body);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { conversationId } = await context.params;
    const data = await deleteConversationForStudent(actor, conversationId);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
