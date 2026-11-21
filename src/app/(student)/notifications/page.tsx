'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Settings2,
} from 'lucide-react';
import { useUIPreferences } from '@/components/providers/app-providers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { NotificationType } from '@/types/domain';

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

interface NotificationPreferencesState {
  studyReminders: boolean;
  dueFlashcards: boolean;
  upcomingExams: boolean;
  learningMilestones: boolean;
}

const NOTIFICATION_TYPE_LABELS: Record<NotificationType, { en: string; bn: string }> = {
  study_reminder: { en: 'Study Reminder', bn: 'অধ্যয়ন অনুস্মারক' },
  upcoming_revision: { en: 'Upcoming Revision', bn: 'আসন্ন রিভিশন' },
  due_flashcards: { en: 'Due Flashcards', bn: 'বাকি ফ্ল্যাশকার্ড' },
  upcoming_exam: { en: 'Upcoming Exam', bn: 'আসন্ন পরীক্ষা' },
  missed_task: { en: 'Missed Task', bn: 'বাদ পড়া কাজ' },
  learning_milestone: { en: 'Milestone', bn: 'অর্জন মাইলফলক' },
};

export default function StudentNotificationsPage() {
  const { language } = useUIPreferences();
  const isBn = language === 'bn';

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferencesState>({
    studyReminders: true,
    dueFlashcards: true,
    upcomingExams: true,
    learningMilestones: true,
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'unread' | NotificationType>('all');

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/v1/notifications');
      const json = await res.json();
      if (res.ok && json.success) {
        setNotifications(json.data.notifications ?? []);
        setUnreadCount(json.data.unreadCount ?? 0);
        if (json.data.preferences) {
          setPreferences(json.data.preferences);
        }
      } else {
        setErrorMessage(json?.error?.message ?? 'Failed to load notifications.');
      }
    } catch {
      setErrorMessage('Network error while loading notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const handleMarkSingleRead = async (notificationId: string) => {
    setUpdating(true);
    try {
      const res = await fetch('/api/v1/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_read',
          notificationId,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setNotifications(json.data.notifications ?? []);
        setUnreadCount(json.data.unreadCount ?? 0);
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkAllRead = async () => {
    setUpdating(true);
    try {
      const res = await fetch('/api/v1/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_all_read',
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setNotifications(json.data.notifications ?? []);
        setUnreadCount(json.data.unreadCount ?? 0);
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleTogglePreference = async (key: keyof NotificationPreferencesState) => {
    setUpdating(true);
    const nextValue = !preferences[key];
    try {
      const res = await fetch('/api/v1/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_preferences',
          preferences: {
            [key]: nextValue,
          },
        }),
      });
      const json = await res.json();
      if (res.ok && json.success && json.data.preferences) {
        setPreferences(json.data.preferences);
      }
    } finally {
      setUpdating(false);
    }
  };

  const filteredNotifications = notifications.filter((item) => {
    if (filterMode === 'all') return true;
    if (filterMode === 'unread') return !item.isRead;
    return item.notificationType === filterMode;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {isBn ? 'বিজ্ঞপ্তি ও অনুস্মারক কেন্দ্র' : 'Notifications & Study Reminders'}
            </h1>
            <Badge variant={unreadCount > 0 ? 'default' : 'secondary'}>
              {unreadCount} {isBn ? 'অপঠিত' : 'Unread'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {isBn
              ? 'ফ্ল্যাশকার্ড রিভিশন, অধ্যয়ন রোডম্যাপ, আসন্ন পরীক্ষা এবং অর্জনের বিজ্ঞপ্তি।'
              : 'Stay updated on due flashcards, upcoming revisions, missed roadmap tasks, and unlocked milestones.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={loading || updating}
            onClick={() => void loadNotifications()}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            {isBn ? 'সিঙ্ক করুন' : 'Sync Reminders'}
          </Button>
          {unreadCount > 0 && (
            <Button
              size="sm"
              disabled={updating}
              onClick={() => void handleMarkAllRead()}
            >
              <CheckCheck className="mr-1.5 h-4 w-4" />
              {isBn ? 'সব পঠিত চিহ্নিত করুন' : 'Mark All Read'}
            </Button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      )}

      {/* Notification Preferences Card (FR-NOTIFY-003) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4 text-primary" />
            <span>
              {isBn
                ? 'বিজ্ঞপ্তি পছন্দসমূহ (FR-NOTIFY-003)'
                : 'Notification Preferences (FR-NOTIFY-003)'}
            </span>
          </CardTitle>
          <CardDescription>
            {isBn
              ? 'কোন ধরনের ইন-অ্যাপ রিমাইন্ডার পেতে চান তা নির্বাচন করুন।'
              : 'Control which in-app reminders LearnMate AI generates for your account.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              {
                key: 'studyReminders',
                en: 'Study & Revision Reminders',
                bn: 'অধ্যয়ন ও রিভিশন অনুস্মারক',
              },
              {
                key: 'dueFlashcards',
                en: 'Due SM-2 Flashcards',
                bn: 'আজকের ফ্ল্যাশকার্ড রিমাইন্ডার',
              },
              {
                key: 'upcomingExams',
                en: 'Upcoming Exam Countdowns',
                bn: 'আসন্ন পরীক্ষার কাউন্টডাউন',
              },
              {
                key: 'learningMilestones',
                en: 'Achievement Milestones',
                bn: 'অর্জন ও মাইলফলক বার্তা',
              },
            ] as const
          ).map((pref) => {
            const enabled = preferences[pref.key];
            return (
              <div
                key={pref.key}
                className="flex items-center justify-between rounded-lg border p-3 text-xs"
              >
                <span className="font-medium">{isBn ? pref.bn : pref.en}</span>
                <Button
                  size="sm"
                  variant={enabled ? 'default' : 'outline'}
                  className="h-7 px-2.5 text-xs"
                  disabled={updating}
                  onClick={() => void handleTogglePreference(pref.key)}
                >
                  {enabled ? (isBn ? 'চালু' : 'Enabled') : isBn ? 'বন্ধ' : 'Muted'}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant={filterMode === 'all' ? 'default' : 'outline'}
          className="h-7 px-2.5 text-xs"
          onClick={() => setFilterMode('all')}
        >
          {isBn ? 'সব' : 'All'} ({notifications.length})
        </Button>
        <Button
          size="sm"
          variant={filterMode === 'unread' ? 'default' : 'outline'}
          className="h-7 px-2.5 text-xs"
          onClick={() => setFilterMode('unread')}
        >
          {isBn ? 'অপঠিত' : 'Unread'} ({unreadCount})
        </Button>
        {(Object.keys(NOTIFICATION_TYPE_LABELS) as NotificationType[]).map((type) => (
          <Button
            key={type}
            size="sm"
            variant={filterMode === type ? 'secondary' : 'ghost'}
            className="h-7 px-2.5 text-xs"
            onClick={() => setFilterMode(type)}
          >
            {isBn
              ? NOTIFICATION_TYPE_LABELS[type].bn
              : NOTIFICATION_TYPE_LABELS[type].en}
          </Button>
        ))}
      </div>

      {/* Notifications List */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {isBn ? 'বিজ্ঞপ্তি লোড হচ্ছে...' : 'Loading notifications...'}
          </CardContent>
        </Card>
      ) : filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Bell className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              {isBn ? 'কোনো বিজ্ঞপ্তি পাওয়া যায়নি' : 'No notifications in this view'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isBn
                ? 'সবগুলো ফ্ল্যাশকার্ড ও রোডম্যাপের কাজ আপ-টু-ডেট রয়েছে।'
                : 'Your flashcards, study plan tasks, and milestones are all caught up.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filteredNotifications.map((item) => {
            const typeLabel = NOTIFICATION_TYPE_LABELS[item.notificationType];
            return (
              <Card
                key={item.id}
                className={item.isRead ? 'opacity-80' : 'border-primary/40 bg-primary/5'}
              >
                <CardContent className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{item.title}</span>
                      <Badge variant="outline" className="text-[11px]">
                        {isBn ? typeLabel.bn : typeLabel.en}
                      </Badge>
                      {!item.isRead && (
                        <Badge variant="default" className="text-[10px]">
                          {isBn ? 'নতুন' : 'New'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{item.message}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.actionUrl && (
                      <Link href={item.actionUrl}>
                        <Button size="sm" variant="outline" className="h-7 text-xs">
                          <span>{isBn ? 'খুলুন' : 'Open'}</span>
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </Button>
                      </Link>
                    )}
                    {!item.isRead && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs"
                        disabled={updating}
                        onClick={() => void handleMarkSingleRead(item.id)}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        {isBn ? 'পঠিত' : 'Mark Read'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
