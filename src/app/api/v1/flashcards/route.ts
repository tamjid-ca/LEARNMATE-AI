import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import {
  createManualDeckForStudent,
  generateAIFlashcardsForStudent,
  listDecksForStudent,
} from '@/modules/flashcards/flashcard-service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const data = await listDecksForStudent(actor);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const body = (await request.json()) as Record<string, unknown>;
    const mode = body.mode === 'manual' ? 'manual' : 'ai';

    const data =
      mode === 'manual'
        ? await createManualDeckForStudent(actor, body)
        : await generateAIFlashcardsForStudent(actor, { ...body, mode: 'ai' });

    return NextResponse.json(okEnvelope(data), { status: 201 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
