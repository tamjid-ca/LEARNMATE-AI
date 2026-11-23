import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import {
  getEducationLabelsForStudent,
  resetEducationLabelsForStudent,
  upsertEducationLabelsForStudent,
} from '@/modules/curriculum/custom-education-service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const url = new URL(request.url);
    const educationSystemId = url.searchParams.get('educationSystemId') ?? undefined;
    const data = await getEducationLabelsForStudent(actor, educationSystemId);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function PUT(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const payload = await request.json();
    const data = await upsertEducationLabelsForStudent(actor, payload);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const url = new URL(request.url);
    const educationSystemId = url.searchParams.get('educationSystemId') ?? undefined;
    const data = await resetEducationLabelsForStudent(actor, educationSystemId);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
