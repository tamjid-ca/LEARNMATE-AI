/**
 * LearnMate AI — Client-Safe Persistent Notification Catalog & Helpers
 * Strictly governs persistent MongoDB notifications (distinct from transient Sonner UI toasts).
 */

import type {
  NotificationCategory,
  NotificationType,
  SupportedLanguage,
} from '../types/domain.ts';

export type NotificationIconName =
  | 'book-open'
  | 'clock-alert'
  | 'refresh-cw'
  | 'layers'
  | 'calendar-clock'
  | 'clipboard-check'
  | 'sparkles'
  | 'file-text'
  | 'trophy'
  | 'bell';

export interface NotificationMetaEntry {
  type: NotificationType;
  category: Exclude<NotificationCategory, 'all'>;
  labelEn: string;
  labelBn: string;
  icon: NotificationIconName;
}

export const NOTIFICATION_TYPE_CATALOG: Record<NotificationType, NotificationMetaEntry> = {
  study_reminder: {
    type: 'study_reminder',
    category: 'study',
    labelEn: 'Study Reminder',
    labelBn: 'অধ্যয়ন অনুস্মারক',
    icon: 'book-open',
  },
  upcoming_revision: {
    type: 'upcoming_revision',
    category: 'study',
    labelEn: 'Upcoming Revision',
    labelBn: 'আসন্ন রিভিশন',
    icon: 'refresh-cw',
  },
  missed_task: {
    type: 'missed_task',
    category: 'study',
    labelEn: 'Study Plan Attention',
    labelBn: 'বাদ পড়া অধ্যয়ন কাজ',
    icon: 'clock-alert',
  },
  upcoming_exam: {
    type: 'upcoming_exam',
    category: 'quiz_exam',
    labelEn: 'Examination Reminder',
    labelBn: 'আসন্ন পরীক্ষা',
    icon: 'calendar-clock',
  },
  quiz_exam: {
    type: 'quiz_exam',
    category: 'quiz_exam',
    labelEn: 'Quiz & Examination',
    labelBn: 'কুইজ ও পরীক্ষা',
    icon: 'clipboard-check',
  },
  due_flashcards: {
    type: 'due_flashcards',
    category: 'flashcards',
    labelEn: 'Flashcard Revision',
    labelBn: 'ফ্ল্যাশকার্ড রিভিশন',
    icon: 'layers',
  },
  ai_generation: {
    type: 'ai_generation',
    category: 'ai_documents',
    labelEn: 'AI Generation',
    labelBn: 'এআই জেনারেশন',
    icon: 'sparkles',
  },
  document_processing: {
    type: 'document_processing',
    category: 'ai_documents',
    labelEn: 'Document Processing',
    labelBn: 'ডকুমেন্ট প্রসেসিং',
    icon: 'file-text',
  },
  learning_milestone: {
    type: 'learning_milestone',
    category: 'system',
    labelEn: 'Milestone',
    labelBn: 'অর্জন মাইলফলক',
    icon: 'trophy',
  },
  system: {
    type: 'system',
    category: 'system',
    labelEn: 'System Update',
    labelBn: 'সিস্টেম বার্তা',
    icon: 'bell',
  },
};

export const NOTIFICATION_CATEGORY_LABELS: Record<
  NotificationCategory,
  { en: string; bn: string }
> = {
  all: { en: 'All Categories', bn: 'সব বিভাগ' },
  study: { en: 'Study Reminders', bn: 'অধ্যয়ন রিমাইন্ডার' },
  quiz_exam: { en: 'Quizzes & Exams', bn: 'কুইজ ও পরীক্ষা' },
  flashcards: { en: 'Flashcard Revisions', bn: 'ফ্ল্যাশকার্ড রিভিশন' },
  ai_documents: { en: 'AI & Documents', bn: 'এআই ও ডকুমেন্ট' },
  system: { en: 'System & Milestones', bn: 'সিস্টেম ও মাইলফলক' },
};

export function getNotificationCategory(
  notificationType: NotificationType,
): Exclude<NotificationCategory, 'all'> {
  return NOTIFICATION_TYPE_CATALOG[notificationType]?.category ?? 'system';
}

export function getTypesForNotificationCategory(
  category: NotificationCategory,
): NotificationType[] | undefined {
  if (category === 'all') return undefined;
  return (Object.values(NOTIFICATION_TYPE_CATALOG) as NotificationMetaEntry[])
    .filter((entry) => entry.category === category)
    .map((entry) => entry.type);
}

export function formatRelativeTimestamp(
  input: Date | string,
  language: SupportedLanguage = 'en',
  now: Date = new Date(),
): { relative: string; exact: string } {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return { relative: language === 'bn' ? 'অজানা' : 'Unknown', exact: '' };
  }

  const exact = date.toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  let relative: string;
  if (diffMins < 1) {
    relative = language === 'bn' ? 'এইমাত্র' : 'Just now';
  } else if (diffMins < 60) {
    relative = language === 'bn' ? `${diffMins} মি. আগে` : `${diffMins}m ago`;
  } else if (diffHours < 24) {
    relative = language === 'bn' ? `${diffHours} ঘণ্টা আগে` : `${diffHours}h ago`;
  } else if (diffDays < 7) {
    relative = language === 'bn' ? `${diffDays} দিন আগে` : `${diffDays}d ago`;
  } else {
    relative = date.toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  return { relative, exact };
}
