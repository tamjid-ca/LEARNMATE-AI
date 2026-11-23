'use client';

import { toast } from 'sonner';

export interface NotifyOptions {
  id?: string | number;
  description?: string;
  duration?: number;
  fallback?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const INTERNAL_PATTERNS = [
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /ETIMEDOUT/i,
  /Mongoose/i,
  /MongoServerError/i,
  /MongoNetworkError/i,
  /querySrv/i,
  /\/Users\//,
  /node_modules\//,
  /at\s+\w+\s+\(/,
];

/**
 * Strips stack traces, filesystem paths, and database internals before
 * displaying an error message inside a transient toast.
 */
export function sanitizeToastError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  let raw = '';
  if (typeof error === 'string') {
    raw = error;
  } else if (error instanceof Error) {
    raw = error.message;
  } else if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.message === 'string') {
      raw = record.message;
    } else if (record.error && typeof record.error === 'object') {
      const nested = record.error as Record<string, unknown>;
      if (typeof nested.message === 'string') {
        raw = nested.message;
      }
    }
  }

  const singleLine = raw.split('\n')[0]?.trim() ?? '';
  if (!singleLine || INTERNAL_PATTERNS.some((pattern) => pattern.test(singleLine))) {
    return fallback;
  }

  if (singleLine.length > 180) {
    return `${singleLine.slice(0, 177)}...`;
  }
  return singleLine;
}

function buildToastOptions(options?: NotifyOptions) {
  if (!options) return undefined;
  return {
    id: options.id,
    description: options.description,
    duration: options.duration,
    action: options.action,
  };
}

/**
 * Centralized transient UI feedback helper built on Sonner.
 * Distinct from persistent MongoDB notifications shown on `/notifications`.
 */
export const notify = {
  success(message: string, options?: NotifyOptions) {
    return toast.success(message, buildToastOptions(options));
  },

  error(errorOrMessage: unknown, optionsOrFallback?: string | NotifyOptions) {
    const opts = typeof optionsOrFallback === 'string' ? undefined : optionsOrFallback;
    const fallback =
      typeof optionsOrFallback === 'string'
        ? optionsOrFallback
        : (opts?.fallback ?? 'Unable to complete this action. Please try again.');
    const safeMessage = sanitizeToastError(errorOrMessage, fallback);
    return toast.error(safeMessage, {
      id: opts?.id ?? `err:${safeMessage.slice(0, 48)}`,
      description: opts?.description,
      duration: opts?.duration,
      action: opts?.action,
    });
  },

  warning(message: string, options?: NotifyOptions) {
    return toast.warning(message, buildToastOptions(options));
  },

  info(message: string, options?: NotifyOptions) {
    return toast.info(message, buildToastOptions(options));
  },

  loading(message: string, options?: NotifyOptions) {
    return toast.loading(message, buildToastOptions(options));
  },

  promise<T>(
    promise: Promise<T> | (() => Promise<T>),
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error?: string | ((error: unknown) => string);
    },
  ) {
    return toast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: (err) => {
        if (typeof messages.error === 'function') {
          return sanitizeToastError(messages.error(err));
        }
        return sanitizeToastError(err, messages.error);
      },
    });
  },

  dismiss(id?: string | number) {
    toast.dismiss(id);
  },
};
