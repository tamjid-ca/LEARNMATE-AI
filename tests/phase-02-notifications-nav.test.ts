import { beforeEach, describe, expect, it } from 'vitest';
import {
  NOTIFICATION_TYPE_CATALOG,
  formatRelativeTimestamp,
  getNotificationCategory,
  getTypesForNotificationCategory,
} from '../src/config/notifications-catalog.ts';
import {
  buildSubjectChapterProgress,
  getAdjacentChapters,
} from '../src/lib/learning/navigation-helpers.ts';
import { sanitizeToastError } from '../src/lib/ui/toast.ts';
import { InMemoryAIRepository } from '../src/modules/ai/ai-repository.ts';
import { InMemoryAnalyticsRepository } from '../src/modules/analytics/analytics-repository.ts';
import {
  emitPersistentNotificationForUser,
  listAndSyncNotificationsForStudent,
  updateNotificationsForStudent,
} from '../src/modules/analytics/analytics-service.ts';
import { InMemoryUserRepository } from '../src/modules/auth/user-repository.ts';
import { InMemoryCurriculumRepository } from '../src/modules/curriculum/curriculum-repository.ts';
import { InMemoryFlashcardRepository } from '../src/modules/flashcards/flashcard-repository.ts';
import { InMemoryStudyPlanRepository } from '../src/modules/planner/planner-repository.ts';
import { InMemoryQuizRepository } from '../src/modules/quizzes/quiz-repository.ts';
import { NOTIFICATION_TYPES } from '../src/types/domain.ts';

describe('Phase 02 — Notification Center, Transient Toasts & Academic Navigation', () => {
  let analyticsRepo: InMemoryAnalyticsRepository;
  let userRepo: InMemoryUserRepository;
  let curriculumRepo: InMemoryCurriculumRepository;
  let quizRepo: InMemoryQuizRepository;
  let flashcardRepo: InMemoryFlashcardRepository;
  let plannerRepo: InMemoryStudyPlanRepository;
  let aiRepo: InMemoryAIRepository;

  let studentA: { userId: string; email: string; role: 'student' };
  let studentB: { userId: string; email: string; role: 'student' };

  beforeEach(async () => {
    analyticsRepo = new InMemoryAnalyticsRepository();
    userRepo = new InMemoryUserRepository();
    curriculumRepo = new InMemoryCurriculumRepository();
    quizRepo = new InMemoryQuizRepository();
    flashcardRepo = new InMemoryFlashcardRepository();
    plannerRepo = new InMemoryStudyPlanRepository();
    aiRepo = new InMemoryAIRepository();

    const userA = await userRepo.create({
      fullName: 'Student Alpha',
      email: 'phase02.a@example.com',
      passwordHash: 'hash',
      role: 'student',
      preferredLanguage: 'en',
      timezone: 'Asia/Dhaka',
    });
    const userB = await userRepo.create({
      fullName: 'Student Beta',
      email: 'phase02.b@example.com',
      passwordHash: 'hash',
      role: 'student',
      preferredLanguage: 'en',
      timezone: 'Asia/Dhaka',
    });
    studentA = { userId: userA.id, email: userA.email, role: 'student' };
    studentB = { userId: userB.id, email: userB.email, role: 'student' };
  });

  const getDeps = () => ({
    analyticsRepo,
    userRepo,
    curriculumRepo,
    quizRepo,
    flashcardRepo,
    plannerRepo,
    aiRepo,
    referenceDate: new Date('2026-06-01T12:00:00.000Z'),
  });

  it('maps every NotificationType into SaaS categories and formats relative timestamps', () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(NOTIFICATION_TYPE_CATALOG[type]).toBeDefined();
      expect(getNotificationCategory(type)).not.toBe('all');
    }

    expect(getTypesForNotificationCategory('all')).toBeUndefined();
    expect(getTypesForNotificationCategory('ai_documents')).toEqual([
      'ai_generation',
      'document_processing',
    ]);
    expect(getTypesForNotificationCategory('quiz_exam')).toEqual(['upcoming_exam', 'quiz_exam']);

    const now = new Date('2026-06-01T12:00:00.000Z');
    expect(formatRelativeTimestamp(new Date('2026-06-01T11:55:00.000Z'), 'en', now).relative).toBe(
      '5m ago',
    );
    expect(formatRelativeTimestamp(new Date('2026-06-01T10:00:00.000Z'), 'en', now).relative).toBe(
      '2h ago',
    );
    expect(formatRelativeTimestamp(new Date('2026-05-29T12:00:00.000Z'), 'en', now).relative).toBe(
      '3d ago',
    );
    expect(formatRelativeTimestamp(new Date('2026-06-01T11:55:00.000Z'), 'bn', now).relative).toBe(
      '5 মি. আগে',
    );
  });

  it('sanitizes internal database and stack-trace errors before toast rendering', () => {
    expect(
      sanitizeToastError(
        new Error('MongoServerError: ECONNREFUSED 127.0.0.1:27017'),
        'Could not save item.',
      ),
    ).toBe('Could not save item.');

    expect(
      sanitizeToastError(
        'Error at Object.fn (/Users/dev/project/node_modules/pkg/index.js:12:4)',
        'Safe fallback',
      ),
    ).toBe('Safe fallback');

    expect(sanitizeToastError({ error: { message: 'Profile saved cleanly' } })).toBe(
      'Profile saved cleanly',
    );
  });

  it('supports filtering by read status & category, pagination, mark_unread, dismiss, clear_read, and strict ownership', async () => {
    await emitPersistentNotificationForUser(
      studentA.userId,
      {
        notificationType: 'study_reminder',
        title: 'Physics Revision Due',
        message: 'Complete Thermodynamics revision.',
        actionUrl: '/planner',
      },
      analyticsRepo,
    );
    const quizNotif = await emitPersistentNotificationForUser(
      studentA.userId,
      {
        notificationType: 'quiz_exam',
        title: 'Chemistry Quiz Completed',
        message: 'You scored 85%.',
        actionUrl: '/quizzes',
      },
      analyticsRepo,
    );
    await emitPersistentNotificationForUser(
      studentA.userId,
      {
        notificationType: 'document_processing',
        title: 'PDF Indexed',
        message: 'Notes.pdf ready for RAG.',
        actionUrl: '/documents',
      },
      analyticsRepo,
    );

    const allRes = await listAndSyncNotificationsForStudent(studentA, getDeps(), {
      skipSync: true,
    });
    expect(allRes.totalAllCount).toBe(3);
    expect(allRes.unreadCount).toBe(3);
    expect(allRes.categoryCounts.study).toBe(1);
    expect(allRes.categoryCounts.quiz_exam).toBe(1);
    expect(allRes.categoryCounts.ai_documents).toBe(1);

    // Category filtering
    const aiDocsOnly = await listAndSyncNotificationsForStudent(studentA, getDeps(), {
      category: 'ai_documents',
      skipSync: true,
    });
    expect(aiDocsOnly.notifications.map((n) => n.notificationType)).toEqual([
      'document_processing',
    ]);

    // Mark read -> check read/unread filter -> mark_unread
    const afterRead = await updateNotificationsForStudent(
      studentA,
      { action: 'mark_read', notificationId: quizNotif.id },
      getDeps(),
      { status: 'read' },
    );
    expect(afterRead.unreadCount).toBe(2);
    expect(afterRead.readCount).toBe(1);
    expect(afterRead.notifications).toHaveLength(1);
    expect(afterRead.notifications[0]?.id).toBe(quizNotif.id);

    const afterUnread = await updateNotificationsForStudent(
      studentA,
      { action: 'mark_unread', notificationId: quizNotif.id },
      getDeps(),
    );
    expect(afterUnread.unreadCount).toBe(3);
    expect(afterUnread.readCount).toBe(0);

    // Cross-user isolation
    await expect(
      updateNotificationsForStudent(
        studentB,
        { action: 'dismiss', notificationId: quizNotif.id },
        getDeps(),
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    // Mark read then clear_read leaves unread notifications intact
    await updateNotificationsForStudent(
      studentA,
      { action: 'mark_read', notificationId: quizNotif.id },
      getDeps(),
    );
    const afterClear = await updateNotificationsForStudent(
      studentA,
      { action: 'clear_read' },
      getDeps(),
    );
    expect(afterClear.totalAllCount).toBe(2);
    expect(afterClear.readCount).toBe(0);

    // Dismiss individual notification
    const remainingId = afterClear.notifications[0]!.id;
    const afterDismiss = await updateNotificationsForStudent(
      studentA,
      { action: 'dismiss', notificationId: remainingId },
      getDeps(),
    );
    expect(afterDismiss.totalAllCount).toBe(1);

    // Preferences update persists expanded flags
    const afterPrefs = await updateNotificationsForStudent(
      studentA,
      {
        action: 'update_preferences',
        preferences: {
          quizUpdates: false,
          aiAndDocuments: false,
          systemAlerts: true,
        },
      },
      getDeps(),
    );
    expect(afterPrefs.preferences.quizUpdates).toBe(false);
    expect(afterPrefs.preferences.aiAndDocuments).toBe(false);
    expect(afterPrefs.preferences.systemAlerts).toBe(true);
  });

  it('paginates notifications with accurate meta.hasMore across multi-page inboxes', async () => {
    for (let i = 1; i <= 20; i++) {
      await emitPersistentNotificationForUser(
        studentA.userId,
        {
          notificationType: 'system',
          title: `Update #${i}`,
          message: `Body ${i}`,
          dedupeKey: `page-test-${i}`,
        },
        analyticsRepo,
      );
    }

    const page1 = await listAndSyncNotificationsForStudent(studentA, getDeps(), {
      page: 1,
      limit: 15,
      skipSync: true,
    });
    expect(page1.notifications).toHaveLength(15);
    expect(page1.meta.hasMore).toBe(true);
    expect(page1.meta.totalPages).toBe(2);

    const page2 = await listAndSyncNotificationsForStudent(studentA, getDeps(), {
      page: 2,
      limit: 15,
      skipSync: true,
    });
    expect(page2.notifications).toHaveLength(5);
    expect(page2.meta.hasMore).toBe(false);
  });

  it('computes subject & chapter topic completion percentages and adjacent chapter navigation', () => {
    const subjects = [
      { id: 's1', educationSystemId: 'sys1', examinationIds: [], code: 'PHY', name: 'Physics' },
      { id: 's2', educationSystemId: 'sys1', examinationIds: [], code: 'BIO', name: 'Biology' },
    ];
    const chapters = [
      { id: 'c1', subjectId: 's1', chapterNumber: 1, title: 'Vectors' },
      { id: 'c2', subjectId: 's1', chapterNumber: 2, title: 'Kinematics' },
      { id: 'c3', subjectId: 's1', chapterNumber: 3, title: 'Dynamics' },
    ];
    const topics = [
      {
        id: 't1',
        subjectId: 's1',
        chapterId: 'c1',
        code: 'T1',
        title: 'Dot Product',
        learningObjectives: [],
        prerequisiteTopicIds: [],
        difficulty: 'easy' as const,
        estimatedMinutes: 20,
        keyConcepts: [],
        curriculumReferences: [],
        syllabusWeightVerified: true,
      },
      {
        id: 't2',
        subjectId: 's1',
        chapterId: 'c1',
        code: 'T2',
        title: 'Cross Product',
        learningObjectives: [],
        prerequisiteTopicIds: [],
        difficulty: 'medium' as const,
        estimatedMinutes: 25,
        keyConcepts: [],
        curriculumReferences: [],
        syllabusWeightVerified: true,
      },
      {
        id: 't3',
        subjectId: 's1',
        chapterId: 'c2',
        code: 'T3',
        title: 'Projectile Motion',
        learningObjectives: [],
        prerequisiteTopicIds: [],
        difficulty: 'hard' as const,
        estimatedMinutes: 30,
        keyConcepts: [],
        curriculumReferences: [],
        syllabusWeightVerified: true,
      },
    ];

    const { subjectProgress, chapterProgress } = buildSubjectChapterProgress(
      subjects,
      chapters,
      topics,
      new Set(['t1', 't3']),
    );

    expect(chapterProgress.get('c1')?.completionPercent).toBe(50);
    expect(chapterProgress.get('c2')?.completionPercent).toBe(100);
    expect(chapterProgress.get('c3')?.completionPercent).toBe(0);
    expect(subjectProgress.get('s1')?.completionPercent).toBe(67);
    expect(subjectProgress.get('s2')?.completionPercent).toBe(0);

    expect(getAdjacentChapters(chapters, 'c1').previousChapter).toBeNull();
    expect(getAdjacentChapters(chapters, 'c1').nextChapter?.id).toBe('c2');
    expect(getAdjacentChapters(chapters, 'c2').previousChapter?.id).toBe('c1');
    expect(getAdjacentChapters(chapters, 'c2').nextChapter?.id).toBe('c3');
    expect(getAdjacentChapters(chapters, 'c3').nextChapter).toBeNull();
  });
});
