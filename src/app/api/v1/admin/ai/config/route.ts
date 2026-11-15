import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import {
  getAdminAIConfig,
  updateAdminAIConfig,
} from '@/modules/ai/ai-service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const data = await getAdminAIConfig(actor);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const body = await request.json();
    const data = await updateAdminAIConfig(actor, body);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
