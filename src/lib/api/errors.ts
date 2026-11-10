/**
 * LearnMate AI — Standardized Application Error Hierarchy
 * Ensures safe, non-sensitive error envelopes across all /api/v1/* endpoints.
 */

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  RATE_LIMITED: 'RATE_LIMITED',
  AI_QUOTA_EXCEEDED: 'AI_QUOTA_EXCEEDED',
  AI_PROVIDER_UNAVAILABLE: 'AI_PROVIDER_UNAVAILABLE',
  AI_OUTPUT_INVALID: 'AI_OUTPUT_INVALID',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: ErrorCode, message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError(ERROR_CODES.VALIDATION_ERROR, message, 400, details);
  }

  static unauthorized(message = 'Authentication required'): AppError {
    return new AppError(ERROR_CODES.UNAUTHORIZED, message, 401);
  }

  static forbidden(message = 'Insufficient permissions for this operation'): AppError {
    return new AppError(ERROR_CODES.FORBIDDEN, message, 403);
  }

  static notFound(resource = 'Resource'): AppError {
    return new AppError(ERROR_CODES.NOT_FOUND, `${resource} not found`, 404);
  }

  static conflict(message: string): AppError {
    return new AppError(ERROR_CODES.CONFLICT, message, 409);
  }

  static rateLimited(message = 'Too many requests; please try again shortly'): AppError {
    return new AppError(ERROR_CODES.RATE_LIMITED, message, 429);
  }

  static aiUnavailable(message = 'AI service is temporarily unavailable; non-AI features remain active'): AppError {
    return new AppError(ERROR_CODES.AI_PROVIDER_UNAVAILABLE, message, 503);
  }
}

export function normalizeUnknownError(err: unknown): {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: unknown;
} {
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    };
  }
  return {
    statusCode: 500,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: 'An unexpected server error occurred',
  };
}
