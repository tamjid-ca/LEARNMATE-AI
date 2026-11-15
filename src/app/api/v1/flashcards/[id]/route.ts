import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import {
  addCardToDeckForStudent,
  deleteDeckForStudent,
  deleteFlashcardForStudent,
  getDeckDetailForStudent,
  updateFlashcardForStudent,
} from '@/modules/flashcards/flashcard-service';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { id } = await context.params;
    const data = await getDeckDetailForStudent(actor, id);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { id: deckId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const data = await addCardToDeckForStudent(actor, {
      ...body,
      deckId,
    });
    return NextResponse.json(okEnvelope(data), { status: 201 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { id: cardId } = await context.params;
    const body = await request.json();
    const data = await updateFlashcardForStudent(actor, cardId, body);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { id } = await context.params;
    const url = new URL(request.url);
    const targetType = url.searchParams.get('type');
    const data =
      targetType === 'deck'
        ? await deleteDeckForStudent(actor, id)
        : await deleteFlashcardForStudent(actor, id);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
