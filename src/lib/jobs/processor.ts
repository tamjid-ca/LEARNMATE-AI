/**
 * LearnMate AI — Durable Background Processing & State Transition Architecture
 * Grounded in docs/PROJECT_SRS.md Section 11.
 */

import type { DocumentProcessingStatus } from '../../types/domain.ts';

const VALID_DOCUMENT_STATUS_TRANSITIONS: Record<
  DocumentProcessingStatus,
  readonly DocumentProcessingStatus[]
> = {
  uploaded: ['extracting', 'failed', 'deleted'],
  extracting: ['chunking', 'failed', 'deleted'],
  chunking: ['indexing', 'failed', 'deleted'],
  indexing: ['ready', 'failed', 'deleted'],
  ready: ['deleted'],
  failed: ['extracting', 'deleted'], // Supports idempotent retry from failed state
  deleted: [],
};

export function canTransitionDocumentStatus(
  from: DocumentProcessingStatus,
  to: DocumentProcessingStatus,
): boolean {
  return VALID_DOCUMENT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface DocumentIngestionJobPayload {
  materialId: string;
  userId: string;
  attempt: number;
}

export interface BackgroundJobProcessor {
  enqueueDocumentIngestion(payload: DocumentIngestionJobPayload): Promise<void>;
  processPendingDocumentJobs(limit?: number): Promise<{ processed: number; failed: number }>;
}
