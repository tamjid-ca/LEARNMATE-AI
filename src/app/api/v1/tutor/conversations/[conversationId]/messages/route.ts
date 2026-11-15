import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import { sendTutorMessageForStudent } from '@/modules/tutor/tutor-materials-service';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { conversationId } = await context.params;
    const body = await request.json();
    const result = await sendTutorMessageForStudent(actor, conversationId, body);

    if (result.stream) {
      return new Response(result.stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

    return NextResponse.json(
      okEnvelope({
        conversation: result.conversation,
        userMessage: result.userMessage,
        assistantMessage: result.assistantMessage,
      }),
      { status: 201 },
    );
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
