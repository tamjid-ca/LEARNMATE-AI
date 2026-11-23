'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const NOTIFICATIONS_UPDATED_EVENT = 'learnmate:notifications-updated';

export function emitNotificationsUpdated(unreadCount?: number) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(NOTIFICATIONS_UPDATED_EVENT, {
      detail: typeof unreadCount === 'number' ? { unreadCount } : undefined,
    }),
  );
}

/**
 * Header notification shortcut with live unread count synced from MongoDB
 * and cross-updated via custom window events from NotificationCenter.
 */
export function HeaderNotificationBell({ label }: { label: string }) {
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const fetchCount = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/notifications?limit=1&skipSync=true', {
        cache: 'no-store',
      });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        success?: boolean;
        data?: { unreadCount?: number };
      };
      if (payload.success && typeof payload.data?.unreadCount === 'number') {
        setUnreadCount(payload.data.unreadCount);
      }
    } catch {
      // Ignore silent header poll failures
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/v1/notifications?limit=1&skipSync=true', {
          cache: 'no-store',
        });
        if (!response.ok || !active) return;
        const payload = (await response.json()) as {
          success?: boolean;
          data?: { unreadCount?: number };
        };
        if (active && payload.success && typeof payload.data?.unreadCount === 'number') {
          setUnreadCount(payload.data.unreadCount);
        }
      } catch {
        // Silent fallback
      }
    };
    void load();

    const handleUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ unreadCount?: number } | undefined>;
      if (typeof custom.detail?.unreadCount === 'number') {
        setUnreadCount(custom.detail.unreadCount);
      } else {
        void fetchCount();
      }
    };

    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, handleUpdated);
    return () => {
      active = false;
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, handleUpdated);
    };
  }, [fetchCount]);

  return (
    <Link href="/notifications" aria-label={label}>
      <Button variant="ghost" size="icon" className="relative" title={label}>
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--destructive)] px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </Button>
    </Link>
  );
}
