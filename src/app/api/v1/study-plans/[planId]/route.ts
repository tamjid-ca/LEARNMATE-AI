import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import {
  createManualStudyTaskForStudent,
  deleteStudyPlanForStudent,
  getStudyPlanDetailForStudent,
  updateOrRecalculateStudyPlanForStudent,
} from '@/modules/planner/planner-service';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ planId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { planId } = await context.params;
    const data = await getStudyPlanDetailForStudent(actor, planId);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ planId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { planId } = await context.params;
    const body = await request.json();
    const data = await updateOrRecalculateStudyPlanForStudent(actor, planId, body);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ planId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { planId } = await context.params;
    const body = await request.json();
    const data = await createManualStudyTaskForStudent(actor, planId, body);
    return NextResponse.json(okEnvelope(data), { status: 201 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ planId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { planId } = await context.params;
    const data = await deleteStudyPlanForStudent(actor, planId);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
