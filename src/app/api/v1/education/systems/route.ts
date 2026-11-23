import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { requireAuth } from '@/lib/auth/rbac';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import { getActiveCurriculumRepository } from '@/modules/curriculum/curriculum-repository';
import { createCustomEducationSystemForStudent } from '@/modules/curriculum/custom-education-service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const actor = requireAuth(resolveActorFromHeaders(request.headers));
    const url = new URL(request.url);
    const includeArchived = url.searchParams.get('includeArchived') === 'true';
    const systems = await getActiveCurriculumRepository().listEducationSystems(false, undefined, {
      viewerUserId: actor.userId,
      scopeFilter: 'all',
      includeArchived,
    });
    return NextResponse.json(okEnvelope({ systems }), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const payload = await request.json();
    const data = await createCustomEducationSystemForStudent(actor, payload);
    return NextResponse.json(okEnvelope(data), { status: 201 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
