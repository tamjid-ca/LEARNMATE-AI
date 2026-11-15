/**
 * LearnMate AI — Endpoint Rate Limiter
 * Protects authentication, password reset, and AI generation endpoints (SRS NFR-SEC-006).
 */

import { AppError } from '../api/errors.ts';

interface RateBucket {
  count: number;
  resetAtMs: number;
}

const buckets = new Map<string, RateBucket>();

export function enforceRateLimit(
  key: string,
  maxRequests = 15,
  windowMs = 60_000,
  nowMs = Date.now(),
): void {
  const existing = buckets.get(key);
  if (!existing || existing.resetAtMs <= nowMs) {
    buckets.set(key, { count: 1, resetAtMs: nowMs + windowMs });
    return;
  }

  if (existing.count >= maxRequests) {
    throw AppError.rateLimited();
  }
  existing.count += 1;
}

export function resetRateLimitBuckets(): void {
  buckets.clear();
}
