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
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
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

  static aiUnavailable(
    message = 'AI service is temporarily unavailable; non-AI features remain active',
    details?: unknown,
  ): AppError {
    return new AppError(ERROR_CODES.AI_PROVIDER_UNAVAILABLE, message, 503, details);
  }

  static aiProvider(
    message = 'AI service is temporarily unavailable; non-AI features remain active',
    details?: unknown,
  ): AppError {
    return new AppError(ERROR_CODES.AI_PROVIDER_UNAVAILABLE, message, 503, details);
  }

  static databaseUnavailable(
    message = 'Database service is temporarily unavailable. Please verify connectivity and try again.',
    details?: unknown,
  ): AppError {
    return new AppError(ERROR_CODES.DATABASE_UNAVAILABLE, message, 503, details);
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

  // Handle malformed JSON request bodies
  if (err instanceof SyntaxError && /json/i.test(err.message)) {
    return {
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Invalid JSON request body',
    };
  }

  if (err && typeof err === 'object') {
    const errObj = err as {
      name?: string;
      message?: string;
      code?: number | string;
      issues?: Array<{ path?: Array<string | number>; message?: string }>;
      flatten?: () => unknown;
    };

    // Zod validation errors
    if (errObj.name === 'ZodError' && Array.isArray(errObj.issues)) {
      const firstIssue = errObj.issues[0];
      const fieldPath = firstIssue?.path?.join('.');
      const summary = firstIssue?.message
        ? fieldPath
          ? `${fieldPath}: ${firstIssue.message}`
          : firstIssue.message
        : 'Request validation failed';
      return {
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        message: summary,
        ...(typeof errObj.flatten === 'function' ? { details: errObj.flatten() } : {}),
      };
    }

    // Mongoose cast, BSON, and schema validation errors
    if (
      errObj.name === 'CastError' ||
      errObj.name === 'ValidationError' ||
      errObj.name === 'BSONError'
    ) {
      return {
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid identifier or field format',
      };
    }

    // MongoDB duplicate key conflict
    if (errObj.code === 11000) {
      return {
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
        message: 'A matching record already exists',
      };
    }

    // MongoDB connection or configuration unavailability (never leak connection URIs)
    const msg = errObj.message ?? '';
    if (
      errObj.name === 'MongoServerSelectionError' ||
      errObj.name === 'MongooseServerSelectionError' ||
      errObj.name === 'MongoNetworkError' ||
      errObj.name === 'MongoTimeoutError' ||
      /MONGODB_URI|ECONNREFUSED|ENOTFOUND|Server selection timed out|Client must be connected/i.test(
        msg,
      )
    ) {
      return {
        statusCode: 503,
        code: ERROR_CODES.DATABASE_UNAVAILABLE,
        message: 'Database service is temporarily unavailable. Please check your database connection and try again.',
      };
    }
  }

  return {
    statusCode: 500,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: 'An unexpected server error occurred',
  };
}
