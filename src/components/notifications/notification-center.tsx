'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  BellRing,
  BookOpen,
  CalendarClock,
  Check,
  CheckCheck,
  ClipboardCheck,
  Clock,
  EyeOff,
  FileText,
  Layers,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import {
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_TYPE_CATALOG,
  formatRelativeTimestamp,
  getNotificationCategory,
  type NotificationIconName,
} from '@/config/notifications-catalog';
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationType,
} from '@/types/domain';
import { useUIPreferences } from '@/components/providers/app-providers';
import { emitNotificationsUpdated } from '@/components/notifications/header-notification-bell';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { InlineAlert, PageEmptyState } from '@/components/shared/page-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip } from '@/components/ui/tooltip';
import { notify } from '@/lib/ui/toast';

interface NotificationItem {
  id: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

interface NotificationPrefsState {
  studyReminders: boolean;
  dueFlashcards: boolean;
  upcomingExams: boolean;
  learningMilestones: boolean;
  quizUpdates: boolean;
  aiAndDocuments: boolean;
  systemAlerts: boolean;
}

interface NotificationsPayload {
  notifications: NotificationItem[];
  unreadCount: number;
  readCount: number;
  totalAllCount: number;
  categoryCounts: Record<NotificationCategory, number>;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  preferences: NotificationPrefsState;
}

const DEFAULT_PREFS: NotificationPrefsState = {
  studyReminders: true,
  dueFlashcards: true,
  upcomingExams: true,
  learningMilestones: true,
  quizUpdates: true,
  aiAndDocuments: true,
  systemAlerts: true,
};

const EMPTY_CATEGORY_COUNTS: Record<NotificationCategory, number> = {
  all: 0,
  study: 0,
  quiz_exam: 0,
  flashcards: 0,
  ai_documents: 0,
  system: 0,
};

function renderTypeIcon(icon: NotificationIconName, className = 'size-4') {
  switch (icon) {
    case 'book-open':
      return <BookOpen className={className} />;
    case 'clock-alert':
      return <Clock className={className} />;
    case 'refresh-cw':
      return <RefreshCw className={className} />;
    case 'layers':
      return <Layers className={className} />;
    case 'calendar-clock':
      return <CalendarClock className={className} />;
    case 'clipboard-check':
      return <ClipboardCheck className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
    case 'file-text':
      return <FileText className={className} />;
    case 'trophy':
      return <Trophy className={className} />;
    case 'bell':
    default:
      return <Bell className={className} />;
  }
}

function getCategoryAccentClasses(category: Exclude<NotificationCategory, 'all'>): string {
  switch (category) {
    case 'study':
      return 'bg-sky-500/12 text-sky-600 dark:text-sky-400';
    case 'quiz_exam':
      return 'bg-violet-500/12 text-violet-600 dark:text-violet-400';
    case 'flashcards':
      return 'bg-amber-500/12 text-amber-600 dark:text-amber-400';
    case 'ai_documents':
      return 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400';
    case 'system':
    default:
      return 'bg-slate-500/12 text-slate-600 dark:text-slate-300';
  }
}

const PREF_CONTROLS: ReadonlyArray<{
  key: keyof NotificationPrefsState;
  labelEn: string;
  labelBn: string;
  descEn: string;
  descBn: string;
}> = [
  {
    key: 'studyReminders',
    labelEn: 'Study & Revision Reminders',
    labelBn: 'অধ্যয়ন ও রিভিশন রিমাইন্ডার',
    descEn: 'Daily planned tasks, upcoming revisions, and missed schedule alerts.',
    descBn: 'দৈনিক অধ্যয়ন কাজ, রিভিশন ও মিস হওয়া রুটিনের সতর্কতা।',
  },
  {
    key: 'dueFlashcards',
    labelEn: 'Flashcard Revision Due Alerts',
    labelBn: 'ফ্ল্যাশকার্ড রিভিশন অ্যালার্ট',
    descEn: 'Spaced-repetition cards waiting in your active-recall queue.',
    descBn: 'এসএম-২ রিভিশনের জন্য নির্ধারিত ফ্ল্যাশকার্ডের বার্তা।',
  },
  {
    key: 'upcomingExams',
    labelEn: 'Examination Countdown Reminders',
    labelBn: 'আসন্ন পরীক্ষার সতর্কতা',
    descEn: 'Reminders aligned to your upcoming board or custom exams.',
    descBn: 'বোর্ড ও কাস্টম পরীক্ষার সময়সূচি অনুযায়ী রিমাইন্ডার।',
  },
  {
    key: 'quizUpdates',
    labelEn: 'Quiz & Assessment Results',
    labelBn: 'কুইজ ও মূল্যায়নের ফলাফল',
    descEn: 'Completion notices and score summaries for submitted quizzes.',
    descBn: 'জমা দেওয়া কুইজ ও মক টেস্টের ফলাফলের বিজ্ঞপ্তি।',
  },
  {
    key: 'aiAndDocuments',
    labelEn: 'AI Generation & Document Processing',
    labelBn: 'এআই জেনারেশন ও ডকুমেন্ট আপডেট',
    descEn: 'Status updates when study packs or uploaded files finish indexing.',
    descBn: 'এআই নোট তৈরি বা আপলোড করা ডকুমেন্ট প্রসেসিং শেষ হলে বার্তা।',
  },
  {
    key: 'learningMilestones',
    labelEn: 'Learning Milestones & Streaks',
    labelBn: 'অর্জন মাইলফলক ও স্ট্রিক',
    descEn: 'Celebrations for completed topics, streaks, and mastery thresholds.',
    descBn: 'টপিক সমাপ্তি, ধারাবাহিকতা ও মাস্টারি অর্জনের স্বীকৃতি।',
  },
  {
    key: 'systemAlerts',
    labelEn: 'System & Account Updates',
    labelBn: 'সিস্টেম ও অ্যাকাউন্ট বার্তা',
    descEn: 'Important platform notices and workspace changes.',
    descBn: 'গুরুত্বপূর্ণ সিস্টেম ও অ্যাকাউন্ট সম্পর্কিত তথ্য।',
  },
];

/**
 * Full-featured MongoDB-backed Notification Center.
 * Strictly manages persistent notifications and user notification preferences,
 * keeping transient action feedback separate via Sonner toasts (`notify`).
 */
export function NotificationCenter() {
  const { language } = useUIPreferences();
  const isBn = language === 'bn';

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [readCount, setReadCount] = useState(0);
  const [totalAllCount, setTotalAllCount] = useState(0);
  const [categoryCounts, setCategoryCounts] =
    useState<Record<NotificationCategory, number>>(EMPTY_CATEGORY_COUNTS);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
    hasMore: false,
  });
  const [preferences, setPreferences] = useState<NotificationPrefsState>(DEFAULT_PREFS);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);

  const applyResponse = useCallback(
    (data: NotificationsPayload, append = false) => {
      setUnreadCount(data.unreadCount ?? 0);
      setReadCount(data.readCount ?? 0);
      setTotalAllCount(data.totalAllCount ?? 0);
      setCategoryCounts(data.categoryCounts ?? EMPTY_CATEGORY_COUNTS);
      if (data.meta) setMeta(data.meta);
      if (data.preferences) {
        setPreferences({ ...DEFAULT_PREFS, ...data.preferences });
      }
      setItems((prev) => {
        if (!append) return data.notifications ?? [];
        const existingIds = new Set(prev.map((n) => n.id));
        const additions = (data.notifications ?? []).filter((n) => !existingIds.has(n.id));
        return [...prev, ...additions];
      });
      emitNotificationsUpdated(data.unreadCount ?? 0);
    },
    [],
  );

  const fetchNotifications = useCallback(
    async (opts?: { page?: number; append?: boolean; skipSync?: boolean; silent?: boolean }) => {
      const targetPage = opts?.page ?? 1;
      const append = opts?.append ?? false;
      const skipSync = opts?.skipSync ?? false;

      if (append) {
        setLoadingMore(true);
      } else if (!opts?.silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams({
          status: statusFilter,
          category: categoryFilter,
          page: String(targetPage),
          limit: '15',
          skipSync: String(skipSync),
        });
        const response = await fetch(`/api/v1/notifications?${params.toString()}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const payload = (await response.json()) as {
          success?: boolean;
          data?: NotificationsPayload;
          error?: { message?: string };
        };
        if (!response.ok || !payload.success || !payload.data) {
          const message = payload.error?.message ?? 'Unable to load notifications';
          setError(message);
          return;
        }
        applyResponse(payload.data, append);
      } catch (err) {
        const fallback = 'Network error while loading notifications.';
        setError(fallback);
        if (!opts?.silent) notify.error(err, fallback);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [applyResponse, categoryFilter, statusFilter],
  );

  const hasSyncedRef = useRef(false);

  // Sync on initial mount, then re-query fast without sync when filters change
  useEffect(() => {
    const skipSync = hasSyncedRef.current;
    hasSyncedRef.current = true;
    void fetchNotifications({ page: 1, skipSync });
  }, [fetchNotifications]);

  async function mutateNotifications(
    body: Record<string, unknown>,
    actionKey: string,
    successToast?: string,
  ) {
    setBusyAction(actionKey);
    try {
      const limit = Math.max(15, meta.page * 15);
      const params = new URLSearchParams({
        status: statusFilter,
        category: categoryFilter,
        page: '1',
        limit: String(limit),
      });
      const response = await fetch(`/api/v1/notifications?${params.toString()}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        data?: NotificationsPayload;
        error?: { message?: string };
      };
      if (!response.ok || !payload.success || !payload.data) {
        notify.error(payload.error?.message ?? 'Unable to update notification');
        return;
      }
      applyResponse(payload.data, false);
      if (successToast) {
        notify.success(successToast);
      }
    } catch (err) {
      notify.error(err, 'Network error while updating notification.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePreferenceToggle(key: keyof NotificationPrefsState, checked: boolean) {
    const previous = preferences;
    const updated = { ...preferences, [key]: checked };
    setPreferences(updated);
    setBusyAction(`pref:${key}`);

    try {
      const params = new URLSearchParams({
        status: statusFilter,
        category: categoryFilter,
        page: '1',
        limit: String(Math.max(15, meta.page * 15)),
      });
      const response = await fetch(`/api/v1/notifications?${params.toString()}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'update_preferences',
          preferences: { [key]: checked },
        }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        data?: NotificationsPayload;
        error?: { message?: string };
      };
      if (!response.ok || !payload.success || !payload.data) {
        setPreferences(previous);
        notify.error(payload.error?.message ?? 'Failed to save notification preference');
        return;
      }
      applyResponse(payload.data, false);
      notify.success(isBn ? 'নোটিফিকেশন পছন্দ সংরক্ষিত হয়েছে।' : 'Notification preference updated.');
    } catch (err) {
      setPreferences(previous);
      notify.error(err, 'Network error while saving preferences.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSyncNow() {
    setBusyAction('sync');
    await fetchNotifications({ page: 1, skipSync: false, silent: true });
    setBusyAction(null);
    notify.success(isBn ? 'বিজ্ঞপ্তি সিঙ্ক সম্পন্ন হয়েছে।' : 'Notifications synced.');
  }

  return (
    <div className="space-y-6">
      {/* SaaS Notification Center Header */}
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--primary)]/12 text-[var(--primary)]">
                <BellRing className="size-4" />
              </div>
              <CardTitle className="text-xl">
                {isBn ? 'বিজ্ঞপ্তি কেন্দ্র' : 'Notifications'}
              </CardTitle>
              <Badge variant={unreadCount > 0 ? 'accent' : 'secondary'}>
                {unreadCount} {isBn ? 'অপঠিত' : 'Unread'}
              </Badge>
            </div>
            <CardDescription>
              {isBn
                ? 'অধ্যয়ন রিমাইন্ডার, কুইজ ও পরীক্ষার আপডেট, ফ্ল্যাশকার্ড রিভিশন এবং এআই ও ডকুমেন্ট প্রসেসিং বার্তা।'
                : 'Persistent study reminders, quiz and examination updates, due flashcard alerts, and AI or document processing notices.'}
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busyAction !== null || loading}
              onClick={() => void handleSyncNow()}
            >
              {busyAction === 'sync' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              <span>{isBn ? 'সিঙ্ক' : 'Sync'}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={busyAction !== null || unreadCount === 0}
              onClick={() =>
                void mutateNotifications(
                  { action: 'mark_all_read' },
                  'mark_all_read',
                  isBn ? 'সব বিজ্ঞপ্তি পঠিত হিসেবে চিহ্নিত হয়েছে।' : 'All notifications marked as read.',
                )
              }
            >
              {busyAction === 'mark_all_read' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCheck className="size-4" />
              )}
              <span>{isBn ? 'সব পঠিত করুন' : 'Mark all as read'}</span>
            </Button>

            <ConfirmDialog
              destructive
              busy={busyAction === 'clear_read'}
              title={isBn ? 'পঠিত বিজ্ঞপ্তি মুছে ফেলবেন?' : 'Clear all read notifications?'}
              description={
                isBn
                  ? 'সব পঠিত বিজ্ঞপ্তি আপনার তালিকা থেকে স্থায়ীভাবে সরিয়ে ফেলা হবে।'
                  : 'This permanently removes all already-read notifications from your inbox. Unread items remain untouched.'
              }
              confirmLabel={isBn ? 'পঠিতগুলো মুছুন' : 'Clear Read'}
              cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
              onConfirm={async () => {
                await mutateNotifications(
                  { action: 'clear_read' },
                  'clear_read',
                  isBn ? 'পঠিত বিজ্ঞপ্তি মুছে ফেলা হয়েছে।' : 'Cleared read notifications.',
                );
              }}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyAction !== null || readCount === 0}
                >
                  <Trash2 className="size-4" />
                  <span>{isBn ? 'পঠিত মুছুন' : 'Clear read'}</span>
                </Button>
              }
            />

            <Sheet open={prefsOpen} onOpenChange={setPrefsOpen}>
              <SheetTrigger asChild>
                <Button variant="secondary" size="sm">
                  <SlidersHorizontal className="size-4" />
                  <span>{isBn ? 'পছন্দসমূহ' : 'Preferences'}</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>
                    {isBn ? 'বিজ্ঞপ্তি পছন্দসমূহ' : 'Notification Preferences'}
                  </SheetTitle>
                  <SheetDescription>
                    {isBn
                      ? 'কোন কোন ধরনের স্থায়ী বিজ্ঞপ্তি আপনার ইনবক্সে জমা হবে তা নিয়ন্ত্রণ করুন।'
                      : 'Choose which persistent alert categories are generated and stored in your Notification Center.'}
                  </SheetDescription>
                </SheetHeader>

                <div className="space-y-3 px-4 pb-6">
                  {PREF_CONTROLS.map((pref) => {
                    const checked = Boolean(preferences[pref.key]);
                    return (
                      <div
                        key={pref.key}
                        className="flex items-start justify-between gap-4 rounded-xl border p-3.5"
                      >
                        <div className="space-y-1">
                          <Label htmlFor={`pref-${pref.key}`} className="text-sm font-medium">
                            {isBn ? pref.labelBn : pref.labelEn}
                          </Label>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {isBn ? pref.descBn : pref.descEn}
                          </p>
                        </div>
                        <Switch
                          id={`pref-${pref.key}`}
                          checked={checked}
                          disabled={busyAction === `pref:${pref.key}`}
                          onCheckedChange={(next) => void handlePreferenceToggle(pref.key, next)}
                        />
                      </div>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>

        {/* Read Status Tabs + Category Filter Bar */}
        <CardContent className="space-y-4 border-t pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              defaultValue="all"
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as 'all' | 'unread' | 'read')}
            >
              <TabsList>
                <TabsTrigger value="all">
                  {isBn ? 'সব' : 'All'} ({totalAllCount})
                </TabsTrigger>
                <TabsTrigger value="unread">
                  {isBn ? 'অপঠিত' : 'Unread'} ({unreadCount})
                </TabsTrigger>
                <TabsTrigger value="read">
                  {isBn ? 'পঠিত' : 'Read'} ({readCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <p className="text-xs text-[var(--muted-foreground)]">
              {isBn
                ? `দেখানো হচ্ছে ${items.length} / ${meta.total}টি বিজ্ঞপ্তি`
                : `Showing ${items.length} of ${meta.total} notification(s)`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Notification category filters">
            {NOTIFICATION_CATEGORIES.map((category) => {
              const active = categoryFilter === category;
              const label = isBn
                ? NOTIFICATION_CATEGORY_LABELS[category].bn
                : NOTIFICATION_CATEGORY_LABELS[category].en;
              const count = categoryCounts[category] ?? 0;

              return (
                <Button
                  key={category}
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 gap-1.5 rounded-full px-3 text-xs"
                  onClick={() => setCategoryFilter(category)}
                >
                  <span>{label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'
                    }`}
                  >
                    {count}
                  </span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error ? (
        <InlineAlert
          variant="destructive"
          title={isBn ? 'বিজ্ঞপ্তি লোড করা যায়নি' : 'Could not load notifications'}
          description={error}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void fetchNotifications({ page: 1, skipSync: false })}
            >
              <RefreshCw className="size-3.5" />
              <span>{isBn ? 'আবার চেষ্টা করুন' : 'Retry'}</span>
            </Button>
          }
        />
      ) : null}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[1, 2, 3, 4].map((idx) => (
            <Card key={idx}>
              <CardContent className="flex items-start gap-4 p-4">
                <Skeleton className="size-10 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="h-3.5 w-4/5" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <PageEmptyState
          title={
            statusFilter === 'unread'
              ? isBn
                ? 'কোনো অপঠিত বিজ্ঞপ্তি নেই'
                : 'You are all caught up'
              : isBn
                ? 'এই ফিল্টারে কোনো বিজ্ঞপ্তি নেই'
                : 'No notifications in this view'
          }
          description={
            statusFilter === 'unread'
              ? isBn
                ? 'আপনার সব অধ্যয়ন ও পরীক্ষা সংক্রান্ত বিজ্ঞপ্তি পড়া হয়ে গেছে।'
                : 'Every notification in your inbox has been read. Switch filters or sync to check for new updates.'
              : isBn
                ? 'অধ্যয়ন পরিকল্পনা, কুইজ, ফ্ল্যাশকার্ড বা ডকুমেন্ট আপলোড করলে এখানে বিজ্ঞপ্তি জমা হবে।'
                : 'Alerts from study plans, quizzes, flashcard revisions, AI generation, and document processing appear here.'
          }
          actionLabel={
            statusFilter !== 'all' || categoryFilter !== 'all'
              ? isBn
                ? 'ফিল্টার রিসেট করুন'
                : 'Show All Notifications'
              : isBn
                ? 'অধ্যয়ন শুরু করুন'
                : 'Explore My Learning'
          }
          actionHref={
            statusFilter !== 'all' || categoryFilter !== 'all' ? undefined : '/my-learning'
          }
          onAction={
            statusFilter !== 'all' || categoryFilter !== 'all'
              ? () => {
                  setStatusFilter('all');
                  setCategoryFilter('all');
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => {
            const metaEntry = NOTIFICATION_TYPE_CATALOG[item.notificationType] ?? NOTIFICATION_TYPE_CATALOG.system;
            const category = getNotificationCategory(item.notificationType);
            const categoryLabel = isBn
              ? NOTIFICATION_CATEGORY_LABELS[category].bn
              : NOTIFICATION_CATEGORY_LABELS[category].en;
            const { relative, exact } = formatRelativeTimestamp(item.createdAt, language);
            const isItemBusy =
              busyAction === `read:${item.id}` ||
              busyAction === `unread:${item.id}` ||
              busyAction === `dismiss:${item.id}`;

            return (
              <Card
                key={item.id}
                className={`transition-colors ${
                  item.isRead
                    ? 'bg-[var(--card)]/70 opacity-85'
                    : 'border-[var(--primary)]/35 bg-[var(--card)] shadow-xs'
                }`}
              >
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ${getCategoryAccentClasses(
                        category,
                      )}`}
                    >
                      {renderTypeIcon(metaEntry.icon)}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {!item.isRead ? (
                          <span
                            className="inline-block size-2 shrink-0 rounded-full bg-[var(--primary)]"
                            aria-label="Unread notification"
                          />
                        ) : null}
                        <h3 className="text-sm font-semibold text-[var(--foreground)]">
                          {item.title}
                        </h3>
                        <Badge variant="outline" className="text-[11px]">
                          {categoryLabel}
                        </Badge>
                      </div>

                      <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
                        {item.message}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 pt-0.5 text-xs text-[var(--muted-foreground)]">
                        <Tooltip label={exact || relative}>
                          <time dateTime={item.createdAt} className="cursor-default">
                            {relative}
                          </time>
                        </Tooltip>
                        <span>·</span>
                        <span>{isBn ? metaEntry.labelBn : metaEntry.labelEn}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
                    {item.actionUrl ? (
                      <Link
                        href={item.actionUrl}
                        onClick={() => {
                          if (!item.isRead) {
                            void mutateNotifications(
                              { action: 'mark_read', notificationId: item.id },
                              `read:${item.id}`,
                            );
                          }
                        }}
                      >
                        <Button size="sm" variant={item.isRead ? 'outline' : 'default'}>
                          <span>{isBn ? 'দেখুন' : 'Open'}</span>
                          <ArrowRight className="size-3.5" />
                        </Button>
                      </Link>
                    ) : null}

                    {item.isRead ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isItemBusy}
                        title={isBn ? 'অপঠিত করুন' : 'Mark as unread'}
                        aria-label={isBn ? 'অপঠিত করুন' : 'Mark as unread'}
                        onClick={() =>
                          void mutateNotifications(
                            { action: 'mark_unread', notificationId: item.id },
                            `unread:${item.id}`,
                            isBn ? 'অপঠিত হিসেবে চিহ্নিত হয়েছে।' : 'Marked as unread.',
                          )
                        }
                      >
                        <EyeOff className="size-3.5" />
                        <span className="sr-only sm:not-sr-only">
                          {isBn ? 'অপঠিত' : 'Unread'}
                        </span>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isItemBusy}
                        title={isBn ? 'পঠিত করুন' : 'Mark as read'}
                        aria-label={isBn ? 'পঠিত করুন' : 'Mark as read'}
                        onClick={() =>
                          void mutateNotifications(
                            { action: 'mark_read', notificationId: item.id },
                            `read:${item.id}`,
                          )
                        }
                      >
                        <Check className="size-3.5" />
                        <span className="sr-only sm:not-sr-only">{isBn ? 'পঠিত' : 'Read'}</span>
                      </Button>
                    )}

                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                      disabled={isItemBusy}
                      title={isBn ? 'সরিয়ে ফেলুন' : 'Dismiss'}
                      aria-label={isBn ? 'সরিয়ে ফেলুন' : 'Dismiss'}
                      onClick={() =>
                        void mutateNotifications(
                          { action: 'dismiss', notificationId: item.id },
                          `dismiss:${item.id}`,
                          isBn ? 'বিজ্ঞপ্তি সরিয়ে ফেলা হয়েছে।' : 'Notification dismissed.',
                        )
                      }
                    >
                      {busyAction === `dismiss:${item.id}` ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <X className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {meta.hasMore ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                disabled={loadingMore}
                onClick={() =>
                  void fetchNotifications({
                    page: meta.page + 1,
                    append: true,
                    skipSync: true,
                  })
                }
              >
                {loadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
                <span>
                  {isBn
                    ? `আরও লোড করুন (${items.length}/${meta.total})`
                    : `Load more (${items.length} of ${meta.total})`}
                </span>
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
