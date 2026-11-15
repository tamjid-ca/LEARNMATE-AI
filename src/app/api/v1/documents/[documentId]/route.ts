import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import {
  answerQuestionFromDocumentForStudent,
  deleteDocumentForStudent,
  generateDerivativeFromDocumentForStudent,
  getDocumentDetailForStudent,
} from '@/modules/documents/document-service';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { documentId } = await context.params;
    const data = await getDocumentDetailForStudent(actor, documentId);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { documentId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const action = body.action === 'generate' ? 'generate' : 'qa';

    const data =
      action === 'generate'
        ? await generateDerivativeFromDocumentForStudent(actor, documentId, {
            ...body,
            action: 'generate',
          })
        : await answerQuestionFromDocumentForStudent(actor, documentId, {
            ...body,
            action: 'qa',
          });

    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { documentId } = await context.params;
    const data = await deleteDocumentForStudent(actor, documentId);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
