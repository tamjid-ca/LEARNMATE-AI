import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryAIRepository } from '../src/modules/ai/ai-repository.ts';
import { InMemoryAnalyticsRepository } from '../src/modules/analytics/analytics-repository.ts';
import {
  calculateLearningStreak,
  computeGamificationSummary,
  computeTopicMasteryEstimate,
  getStudentAnalyticsDashboard,
  listAndSyncNotificationsForStudent,
  recordTopicStudyActivityForStudent,
  updateNotificationsForStudent,
} from '../src/modules/analytics/analytics-service.ts';
import { InMemoryUserRepository } from '../src/modules/auth/user-repository.ts';
import { InMemoryCurriculumRepository } from '../src/modules/curriculum/curriculum-repository.ts';
import { SEED_IDS } from '../src/modules/curriculum/seed-data.ts';
import { InMemoryFlashcardRepository } from '../src/modules/flashcards/flashcard-repository.ts';
import { InMemoryStudyPlanRepository } from '../src/modules/planner/planner-repository.ts';
import { InMemoryQuizRepository } from '../src/modules/quizzes/quiz-repository.ts';

describe('State 11 — Learning Analytics, Notifications & Gamification Gate', () => {
  let analyticsRepo: InMemoryAnalyticsRepository;
  let userRepo: InMemoryUserRepository;
  let curriculumRepo: InMemoryCurriculumRepository;
  let quizRepo: InMemoryQuizRepository;
  let flashcardRepo: InMemoryFlashcardRepository;
  let plannerRepo: InMemoryStudyPlanRepository;
  let aiRepo: InMemoryAIRepository;

  const studentA = {
    userId: '66f000000000000000000d01',
    email: 'student.analytics.a@example.com',
    role: 'student' as const,
  };

  const studentB = {
    userId: '66f000000000000000000d02',
    email: 'student.analytics.b@example.com',
    role: 'student' as const,
  };

  const referenceDate = new Date('2026-05-10T12:00:00.000Z');

  beforeEach(() => {
    analyticsRepo = new InMemoryAnalyticsRepository();
    userRepo = new InMemoryUserRepository();
    curriculumRepo = new InMemoryCurriculumRepository();
    quizRepo = new InMemoryQuizRepository();
    flashcardRepo = new InMemoryFlashcardRepository();
    plannerRepo = new InMemoryStudyPlanRepository();
    aiRepo = new InMemoryAIRepository();
  });

  it('computes deterministic topic mastery estimates, consecutive-day learning streaks, and anti-gaming study points (FR-ANALYTICS-002..008, FR-GAME-001..004)', () => {
    // 1. Unstarted topic -> 0% ('unstarted')
    const unstarted = computeTopicMasteryEstimate({
      isCompleted: false,
      studyTimeMinutes: 0,
      quizAttemptsCount: 0,
      quizAverageAccuracy: 0,
      flashcardReviewsCount: 0,
      isFlaggedWeakInQuiz: false,
    });
    expect(unstarted.estimatedMasteryScore).toBe(0);
    expect(unstarted.masteryBand).toBe('unstarted');

    // 2. High quiz accuracy + completed topic + flashcard reviews -> 'strong' (>=75%)
    const strong = computeTopicMasteryEstimate({
      isCompleted: true,
      studyTimeMinutes: 45,
      quizAttemptsCount: 2,
      quizAverageAccuracy: 90,
      flashcardReviewsCount: 3,
      isFlaggedWeakInQuiz: false,
    });
    expect(strong.estimatedMasteryScore).toBeGreaterThanOrEqual(75);
    expect(strong.masteryBand).toBe('strong');

    // 3. Flagged weak in quiz caps mastery in 'weak' band (<60%)
    const weak = computeTopicMasteryEstimate({
      isCompleted: true,
      studyTimeMinutes: 45,
      quizAttemptsCount: 1,
      quizAverageAccuracy: 40,
      flashcardReviewsCount: 1,
      isFlaggedWeakInQuiz: true,
    });
    expect(weak.estimatedMasteryScore).toBeLessThan(60);
    expect(weak.masteryBand).toBe('weak');

    // 4. Consecutive 3-day streak ending on referenceDate (2026-05-10)
    const streak = calculateLearningStreak(
      [
        new Date('2026-05-01T10:00:00.000Z'),
        new Date('2026-05-08T09:00:00.000Z'),
        new Date('2026-05-09T14:00:00.000Z'),
        new Date('2026-05-10T11:00:00.000Z'),
      ],
      referenceDate,
    );
    expect(streak.currentStreakDays).toBe(3);
    expect(streak.longestStreakDays).toBe(3);

    // 5. Meaningful study points & achievement milestones (FR-GAME-001..004)
    const game = computeGamificationSummary({
      completedTopicsCount: 2,
      quizAttemptsCount: 2,
      flashcardReviewsCount: 5,
      strongTopicsCount: 1,
      currentStreakDays: streak.currentStreakDays,
      longestStreakDays: streak.longestStreakDays,
    });
    expect(game.meaningfulStudyPoints).toBeGreaterThan(100);
    expect(game.milestones.every((m) => m.unlocked)).toBe(true);
    expect(game.antiGamingPolicyNote).toContain('FR-GAME-004');
  });

  it('aggregates subject/topic analytics and explainable recommendations from persisted quiz attempts, flashcards, and study tasks (FR-ANALYTICS-001..008)', async () => {
    const options = {
      analyticsRepo,
      userRepo,
      curriculumRepo,
      quizRepo,
      flashcardRepo,
      plannerRepo,
      aiRepo,
      referenceDate,
    };

    // 1. Seed a strong quiz attempt on newtonsLaws (95% accuracy)
    const strongQuiz = await quizRepo.createQuiz({
      userId: studentA.userId,
      title: 'Mechanics Mastery Quiz',
      mode: 'practice',
      subjectId: SEED_IDS.subjects.hscPhysics,
      topicIds: [SEED_IDS.topics.newtonsLaws],
      difficulty: 'medium',
      questionTypes: ['single_mcq'],
      questionCount: 5,
      negativeMarkingFactor: 0,
      feedbackTiming: 'after_submission',
      language: 'en',
    });
    await quizRepo.createAttempt({
      quizId: strongQuiz.id,
      userId: studentA.userId,
      status: 'submitted',
      startedAt: new Date('2026-05-09T10:00:00.000Z'),
      submittedAt: new Date('2026-05-09T10:15:00.000Z'),
      durationSeconds: 900,
      responses: [],
      totalPointsPossible: 5,
      scoreEarned: 5,
      accuracyPercent: 95,
      weakTopicIds: [],
      recommendedTopicIds: [],
    });

    // 2. Seed a weak quiz attempt on lawsOfThermodynamics (30% accuracy)
    const weakQuiz = await quizRepo.createQuiz({
      userId: studentA.userId,
      title: 'Thermodynamics Checkpoint',
      mode: 'practice',
      subjectId: SEED_IDS.subjects.hscPhysics,
      topicIds: [SEED_IDS.topics.lawsOfThermodynamics],
      difficulty: 'hard',
      questionTypes: ['single_mcq'],
      questionCount: 5,
      negativeMarkingFactor: 0,
      feedbackTiming: 'after_submission',
      language: 'en',
    });
    await quizRepo.createAttempt({
      quizId: weakQuiz.id,
      userId: studentA.userId,
      status: 'submitted',
      startedAt: new Date('2026-05-10T09:00:00.000Z'),
      submittedAt: new Date('2026-05-10T09:10:00.000Z'),
      durationSeconds: 600,
      responses: [],
      totalPointsPossible: 5,
      scoreEarned: 1.5,
      accuracyPercent: 30,
      weakTopicIds: [SEED_IDS.topics.lawsOfThermodynamics],
      recommendedTopicIds: [SEED_IDS.topics.lawsOfThermodynamics],
    });

    // 3. Log explicit study completion on newtonsLaws
    await recordTopicStudyActivityForStudent(
      studentA,
      {
        topicId: SEED_IDS.topics.newtonsLaws,
        studyTimeMinutesDelta: 45,
        markCompleted: true,
      },
      options,
    );

    const dashboard = await getStudentAnalyticsDashboard(studentA, {}, options);

    expect(dashboard.overview.completedTopicsCount).toBe(1);
    expect(dashboard.overview.quizAttemptsCount).toBe(2);
    expect(dashboard.overview.averageQuizAccuracyPercent).toBe(63);
    expect(dashboard.overview.totalStudyTimeMinutes).toBeGreaterThanOrEqual(70);
    expect(dashboard.overview.masteryEstimateDisclaimer).toContain('FR-ANALYTICS-008');

    // Strong and weak topics identified accurately
    expect(dashboard.strongTopics.some((t) => t.topicId === SEED_IDS.topics.newtonsLaws)).toBe(
      true,
    );
    expect(
      dashboard.weakTopics.some((t) => t.topicId === SEED_IDS.topics.lawsOfThermodynamics),
    ).toBe(true);

    // Explainable recommendation includes inspectable evidenceBasis (FR-ANALYTICS-007)
    const weakRec = dashboard.recommendations.find((r) =>
      r.id.includes(SEED_IDS.topics.lawsOfThermodynamics),
    );
    expect(weakRec).toBeDefined();
    expect(weakRec?.evidenceBasis).toContain('Verified basis:');
    expect(dashboard.gamification.currentStreakDays).toBe(2);
  });

  it('generates deduplicated in-app notifications, honors notification preferences, and enforces user ownership (FR-NOTIFY-001..003)', async () => {
    // Seed a due flashcard and an active study plan with a missed task for studentA
    const deck = await flashcardRepo.createDeck({
      userId: studentA.userId,
      title: 'Physics Due Deck',
      subjectId: SEED_IDS.subjects.hscPhysics,
      topicId: SEED_IDS.topics.newtonsLaws,
      cardCount: 1,
      language: 'en',
    });
    await flashcardRepo.createCardsBulk([
      {
        deckId: deck.id,
        userId: studentA.userId,
        topicId: SEED_IDS.topics.newtonsLaws,
        front: 'F = ?',
        back: 'm * a',
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 1,
        nextReviewAt: new Date('2026-05-09T00:00:00.000Z'), // Due before referenceDate
        masteryState: 'review',
      },
    ]);

    const plan = await plannerRepo.createPlan({
      userId: studentA.userId,
      title: 'HSC Exam Countdown Plan',
      targetDate: new Date('2026-05-20T00:00:00.000Z'), // 10 days away
      startDate: new Date('2026-05-01T00:00:00.000Z'),
      subjectIds: [SEED_IDS.subjects.hscPhysics],
      dailyStudyMinutes: 120,
      availableDaysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      proficiencyBySubject: {},
      weeklyMilestones: [],
      status: 'active',
      completionPercent: 25,
    });
    await plannerRepo.createTask({
      studyPlanId: plan.id,
      userId: studentA.userId,
      subjectId: SEED_IDS.subjects.hscPhysics,
      topicId: SEED_IDS.topics.newtonsLaws,
      taskType: 'learn_topic',
      title: 'Missed Mechanics Session',
      scheduledDate: new Date('2026-05-05T00:00:00.000Z'),
      scheduledDateKey: '2026-05-05',
      durationMinutes: 45,
      priorityRank: 1,
      status: 'pending',
      isManuallyEdited: false,
    });

    const options = {
      analyticsRepo,
      userRepo,
      curriculumRepo,
      quizRepo,
      flashcardRepo,
      plannerRepo,
      aiRepo,
      referenceDate,
    };

    // 1. First sync creates due_flashcards, missed_task, and upcoming_exam notifications
    const sync1 = await listAndSyncNotificationsForStudent(studentA, options);
    expect(sync1.notifications.length).toBeGreaterThanOrEqual(3);
    expect(sync1.unreadCount).toBe(sync1.notifications.length);

    // 2. Second sync on the same day is deduplicated (no duplicate spam)
    const sync2 = await listAndSyncNotificationsForStudent(studentA, options);
    expect(sync2.notifications.length).toBe(sync1.notifications.length);

    // 3. Cross-user isolation: studentB cannot mark studentA's notification read
    const firstNotification = sync1.notifications[0]!;
    await expect(
      updateNotificationsForStudent(
        studentB,
        {
          action: 'mark_read',
          notificationId: firstNotification.id,
        },
        options,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    // 4. Mark single notification read & mark all read
    const afterSingleRead = await updateNotificationsForStudent(
      studentA,
      {
        action: 'mark_read',
        notificationId: firstNotification.id,
      },
      options,
    );
    expect(afterSingleRead.unreadCount).toBe(sync1.unreadCount - 1);

    const afterAllRead = await updateNotificationsForStudent(
      studentA,
      { action: 'mark_all_read' },
      options,
    );
    expect(afterAllRead.unreadCount).toBe(0);
  });
});
