import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import {
  getStudentAnalyticsDashboard,
  recordTopicStudyActivityForStudent,
} from '@/modules/analytics/analytics-service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const url = new URL(request.url);
    const data = await getStudentAnalyticsDashboard(actor, {
      language: url.searchParams.get('language') ?? 'en',
      refreshAiRecommendations: url.searchParams.get('refreshAiRecommendations') ?? 'false',
    });
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const body = await request.json();
    const data = await recordTopicStudyActivityForStudent(actor, body);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
