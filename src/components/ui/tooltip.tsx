import * as React from 'react';
import { cn } from '@/lib/utils';

export function Tooltip({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('group relative inline-flex items-center', className)} title={label}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-all group-hover:visible group-hover:opacity-100 dark:bg-slate-100 dark:text-slate-900"
      >
        {label}
      </span>
    </span>
  );
}
