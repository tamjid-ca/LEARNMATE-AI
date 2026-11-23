import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { requireAuth } from '@/lib/auth/rbac';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import { getActiveCurriculumRepository } from '@/modules/curriculum/curriculum-repository';
import { createCustomTopicForStudent } from '@/modules/curriculum/custom-education-service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const actor = requireAuth(resolveActorFromHeaders(request.headers));
    const url = new URL(request.url);
    const subjectId = url.searchParams.get('subjectId') ?? undefined;
    const chapterId = url.searchParams.get('chapterId') ?? undefined;
    const result = await getActiveCurriculumRepository().listTopics({
      subjectId,
      chapterId,
      viewerUserId: actor.userId,
      scopeFilter: 'all',
      page: 1,
      limit: 200,
    });
    return NextResponse.json(okEnvelope({ topics: result.items, total: result.total }), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const payload = await request.json();
    const data = await createCustomTopicForStudent(actor, payload);
    return NextResponse.json(okEnvelope(data), { status: 201 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
