import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import {
  listDocumentsForStudent,
  uploadAndProcessDocumentForStudent,
} from '@/modules/documents/document-service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const data = await listDocumentsForStudent(actor);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    if (actor) {
      enforceRateLimit(`doc-upload:${actor.userId}`, 15, 60_000);
    }
    const body = await request.json();
    const data = await uploadAndProcessDocumentForStudent(actor, body);
    return NextResponse.json(okEnvelope(data), { status: 201 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
