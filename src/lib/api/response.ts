/**
 * LearnMate AI — Standardized API Response Builders
 * Enforces consistent JSON envelopes across all /api/v1/* endpoints.
 */

import { type ErrorCode, normalizeUnknownError } from './errors.ts';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  return {
    page: safePage,
    limit: safeLimit,
    total: Math.max(0, total),
    totalPages: Math.max(1, Math.ceil(Math.max(0, total) / safeLimit)),
  };
}

export function okEnvelope<T>(data: T, meta?: PaginationMeta): ApiSuccessEnvelope<T> {
  return meta ? { success: true, data, meta } : { success: true, data };
}

export function errorEnvelope(err: unknown): { statusCode: number; body: ApiErrorEnvelope } {
  const normalized = normalizeUnknownError(err);
  return {
    statusCode: normalized.statusCode,
    body: {
      success: false,
      error: {
        code: normalized.code,
        message: normalized.message,
        ...(normalized.details !== undefined ? { details: normalized.details } : {}),
      },
    },
  };
}
