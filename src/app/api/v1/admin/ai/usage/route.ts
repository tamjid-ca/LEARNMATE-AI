import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import { getAdminAIUsageDashboard } from '@/modules/ai/ai-service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const url = new URL(request.url);
    const query = Object.fromEntries(url.searchParams.entries());
    const { logs, summary, meta } = await getAdminAIUsageDashboard(actor, query);
    return NextResponse.json(okEnvelope({ logs, summary }, meta), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
