import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import {
  deleteCustomEducationSystemForStudent,
  updateCustomEducationSystemForStudent,
} from '@/modules/curriculum/custom-education-service';

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ systemId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { systemId } = await context.params;
    const payload = await request.json();
    const data = await updateCustomEducationSystemForStudent(actor, systemId, payload);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ systemId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { systemId } = await context.params;
    const url = new URL(request.url);
    const forceCascade = url.searchParams.get('forceCascade') === 'true';
    const data = await deleteCustomEducationSystemForStudent(actor, systemId, { forceCascade });
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
