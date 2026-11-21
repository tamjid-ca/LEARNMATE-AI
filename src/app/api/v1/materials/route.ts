import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import {
  generateLearningMaterialForStudent,
  listLearningMaterialsForStudent,
} from '@/modules/tutor/tutor-materials-service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const url = new URL(request.url);
    const query = Object.fromEntries(url.searchParams.entries());
    const { materials, meta } = await listLearningMaterialsForStudent(actor, query);
    return NextResponse.json(okEnvelope({ materials }, meta), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    if (actor) {
      enforceRateLimit(`materials-gen:${actor.userId}`, 20, 60_000);
    }
    const body = await request.json();
    const data = await generateLearningMaterialForStudent(actor, body);
    return NextResponse.json(okEnvelope(data), { status: 201 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
