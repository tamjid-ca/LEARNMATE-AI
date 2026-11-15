import * as React from 'react';
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { ThemeLanguageControls } from '@/components/shared/theme-language-controls';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-6">
        <Link href="/" className="flex items-center gap-2.5 font-bold">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]">
            <GraduationCap className="size-4" />
          </div>
          <span>LearnMate AI</span>
        </Link>
        <ThemeLanguageControls />
      </header>
      <main className="flex flex-1 items-center justify-center p-4 sm:p-6">{children}</main>
    </div>
  );
}
