import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import { browseCurriculumHierarchy } from '@/modules/curriculum/curriculum-service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const url = new URL(request.url);
    const query = Object.fromEntries(url.searchParams.entries());
    const result = await browseCurriculumHierarchy(actor, query);
    const { meta, ...data } = result;
    return NextResponse.json(okEnvelope(data, meta), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
