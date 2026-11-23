import { NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/api/response';
import { resolveActorFromHeaders } from '@/lib/auth/session';
import {
  listAndSyncNotificationsForStudent,
  updateNotificationsForStudent,
} from '@/modules/analytics/analytics-service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const url = new URL(request.url);
    const query = Object.fromEntries(url.searchParams.entries());
    const data = await listAndSyncNotificationsForStudent(actor, undefined, query);
    return NextResponse.json(okEnvelope(data, data.meta), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const url = new URL(request.url);
    const query = Object.fromEntries(url.searchParams.entries());
    const body = await request.json();
    const data = await updateNotificationsForStudent(actor, body, undefined, query);
    return NextResponse.json(okEnvelope(data, data.meta), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = resolveActorFromHeaders(request.headers);
    const url = new URL(request.url);
    const notificationId = url.searchParams.get('notificationId');
    const clearRead = url.searchParams.get('clearRead') === 'true';
    const query = Object.fromEntries(url.searchParams.entries());

    const payload = clearRead
      ? { action: 'clear_read' }
      : { action: 'dismiss', notificationId: notificationId ?? '' };
    const data = await updateNotificationsForStudent(actor, payload, undefined, query);
    return NextResponse.json(okEnvelope(data, data.meta), { status: 200 });
  } catch (err) {
    const { statusCode, body } = errorEnvelope(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
