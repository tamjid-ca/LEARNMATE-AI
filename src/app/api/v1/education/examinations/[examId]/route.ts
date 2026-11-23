import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import {
  deleteCustomExaminationForStudent,
  duplicateCustomExaminationForStudent,
  updateCustomExaminationForStudent,
} from '@/modules/curriculum/custom-education-service';

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ examId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { examId } = await context.params;
    const payload = await request.json();
    const data = await updateCustomExaminationForStudent(actor, examId, payload);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ examId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { examId } = await context.params;
    const data = await duplicateCustomExaminationForStudent(actor, examId);
    return NextResponse.json(okEnvelope(data), { status: 201 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ examId: string }> },
) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const { examId } = await context.params;
    const data = await deleteCustomExaminationForStudent(actor, examId);
    return NextResponse.json(okEnvelope(data), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
