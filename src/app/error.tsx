'use client';

import * as React from 'react';
import { PageErrorState } from '@/components/shared/page-states';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-12">
      <PageErrorState
        title="Something went wrong"
        message={error.message || 'An unexpected application error occurred.'}
        onRetry={reset}
      />
    </div>
  );
}
