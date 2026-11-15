import { NextResponse } from 'next/server';
import { okEnvelope } from '@/lib/api/response';
import { COLLECTION_NAMES, AI_TASK_TYPES } from '@/types/domain';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(
    okEnvelope({
      service: 'LearnMate AI',
      state: '02',
      status: 'ok',
      registeredCollections: COLLECTION_NAMES.length,
      registeredAITasks: AI_TASK_TYPES.length,
      timestamp: new Date().toISOString(),
    }),
  );
}
