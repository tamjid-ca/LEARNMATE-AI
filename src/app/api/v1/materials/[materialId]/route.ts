import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import {
  deleteLearningMaterialForStudent,
  getLearningMaterialForStudent,
  updateLearningMaterialForStudent,
} from '@/modules/tutor/tutor-materials-service';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ materialId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { materialId } = await context.params;
    const data = await getLearningMaterialForStudent(actor, materialId);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ materialId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { materialId } = await context.params;
    const body = await request.json();
    const data = await updateLearningMaterialForStudent(actor, materialId, body);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ materialId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { materialId } = await context.params;
    const data = await deleteLearningMaterialForStudent(actor, materialId);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
