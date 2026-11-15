'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Inbox, RefreshCw, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUIPreferences } from '@/components/providers/app-providers';
import { findNavItemByPath } from '@/config/navigation';
import { NavIcon } from './nav-icon';

export function PageLoadingState({ title = 'Loading workspace...' }: { title?: string }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label={title}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function PageEmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]">
          <Inbox className="size-6" />
        </div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-1 max-w-md text-sm text-[var(--muted-foreground)]">{description}</p>
        {actionLabel && actionHref ? (
          <Link href={actionHref} className="mt-5">
            <Button size="sm">{actionLabel}</Button>
          </Link>
        ) : null}
        {actionLabel && onAction ? (
          <Button size="sm" onClick={onAction} className="mt-5">
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function PageErrorState({
  title = 'Unable to load this section',
  message = 'A temporary error occurred while preparing this view. Please try again.',
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="border-red-500/30 bg-red-500/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-red-500/15 text-red-600 dark:text-red-400">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-1">{message}</CardDescription>
          </div>
        </div>
      </CardHeader>
      {onRetry ? (
        <CardFooter>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="size-4" />
            <span>Retry</span>
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}

export function WorkspaceModuleScaffold({
  pathname,
  highlights,
}: {
  pathname: string;
  highlights: readonly { labelEn: string; labelBn: string; value: string; subtext: string }[];
}) {
  const { language } = useUIPreferences();
  const navItem = findNavItemByPath(pathname);

  const title = navItem
    ? language === 'bn'
      ? navItem.labelBn
      : navItem.labelEn
    : 'Workspace Module';
  const description = navItem
    ? language === 'bn'
      ? navItem.descriptionBn
      : navItem.descriptionEn
    : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {navItem ? (
            <div className="mt-0.5 flex size-10 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)]">
              <NavIcon name={navItem.icon} className="size-5" />
            </div>
          ) : null}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              {navItem?.badge ? <Badge variant="accent">{navItem.badge}</Badge> : null}
              {navItem?.stateTarget ? (
                <Badge variant="outline">{navItem.stateTarget}</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/tutor">
            <Button size="sm">
              <Sparkles className="size-4" />
              <span>{language === 'bn' ? 'এআই টিউটর খুলুন' : 'Ask AI Tutor'}</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {highlights.map((item) => (
          <Card key={item.labelEn}>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                {language === 'bn' ? item.labelBn : item.labelEn}
              </CardDescription>
              <CardTitle className="text-2xl font-bold">{item.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-[var(--muted-foreground)]">{item.subtext}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="ready">
        <TabsList>
          <TabsTrigger value="ready">
            {language === 'bn' ? 'মডিউল ওভারভিউ' : 'Module Overview'}
          </TabsTrigger>
          <TabsTrigger value="loading">
            {language === 'bn' ? 'লোডিং স্টেট' : 'Loading State Preview'}
          </TabsTrigger>
          <TabsTrigger value="error">
            {language === 'bn' ? 'এরর স্টেট' : 'Error Recovery Preview'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ready">
          <PageEmptyState
            title={
              language === 'bn'
                ? `${title} প্রস্তুত হচ্ছে`
                : `${title} Workspace Shell Ready`
            }
            description={
              language === 'bn'
                ? `ডিজাইন সিস্টেম এবং রেসপনসিভ নেভিগেশন সক্রিয়। পূর্ণ ব্যাকএন্ড এবং ডাটাবেস ওয়ার্কফ্লো নির্ধারিত ডেভেলপমেন্ট স্টেটে (${navItem?.stateTarget ?? 'Upcoming State'}) যুক্ত হবে।`
                : `Responsive layout, dark/light theme tokens, and Bangla/English localization are active. End-to-end persistence and OpenRouter workflows connect in ${navItem?.stateTarget ?? 'upcoming states'}.`
            }
            actionLabel={language === 'bn' ? 'আমার পাঠ্যক্রমে যান' : 'Explore Curriculum'}
            actionHref="/my-learning"
          />
        </TabsContent>

        <TabsContent value="loading">
          <PageLoadingState title={`Loading ${title}`} />
        </TabsContent>

        <TabsContent value="error">
          <PageErrorState
            title={language === 'bn' ? 'সংযোগ পরীক্ষা' : 'Graceful Error Boundary Preview'}
            message={
              language === 'bn'
                ? 'কোনো সার্ভিস সাময়িকভাবে অনুপস্থিত থাকলে অ্যাপ্লিকেশন ক্র্যাশ না করে এইভাবে পুনরুদ্ধারের সুযোগ দেবে।'
                : 'When an external API or database query fails, LearnMate AI isolates the failure and provides safe retry controls.'
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
