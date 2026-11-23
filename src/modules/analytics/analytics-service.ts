/**
 * LearnMate AI — Learning Analytics, Adaptive Recommendations, Notifications & Gamification Service
 * Grounded in docs/PROJECT_SRS.md Sections 4.10 & 4.11 (FR-ANALYTICS-001..008, FR-NOTIFY-001..003, FR-GAME-001..004).
 */

import {
  getOpenRouterTransport,
  type OpenRouterTransport,
} from '../../lib/ai/openrouter-client.ts';
import { AppError } from '../../lib/api/errors.ts';
import {
  assertResourceOwnership,
  type AuthenticatedActor,
  requireAuth,
} from '../../lib/auth/rbac.ts';
import { structuredRecommendationOutputSchema } from '../../lib/validators/ai.ts';
import {
  analyticsQuerySchema,
  type RecordTopicProgressInput,
  recordTopicProgressSchema,
  type UpdateNotificationsInput,
  updateNotificationsSchema,
} from '../../lib/validators/analytics-notifications.ts';
import {
  type AIRepository,
  getActiveAIRepository,
} from '../ai/ai-repository.ts';
import { executeStructuredAITask } from '../ai/ai-service.ts';
import {
  getActiveUserRepository,
  type NotificationPreferences,
  type UserRepository,
} from '../auth/user-repository.ts';
import {
  type CurriculumRepository,
  getActiveCurriculumRepository,
} from '../curriculum/curriculum-repository.ts';
import { assertCurriculumRecordReadable } from '../curriculum/custom-education-service.ts';
import { toDateKey } from '../planner/scheduler-engine.ts';
import {
  getDefaultStudyPlanRepository,
  type StudyPlanRepository,
} from '../planner/planner-repository.ts';
import {
  type FlashcardRepository,
  getActiveFlashcardRepository,
} from '../flashcards/flashcard-repository.ts';
import {
  getActiveQuizRepository,
  type QuizRepository,
} from '../quizzes/quiz-repository.ts';
import {
  type AnalyticsRepository,
  getDefaultAnalyticsRepository,
  type MasteryBand,
  type NotificationRecord,
  type ProgressRecord,
} from './analytics-repository.ts';

export interface AnalyticsServiceOptions {
  analyticsRepo?: AnalyticsRepository;
  userRepo?: UserRepository;
  curriculumRepo?: CurriculumRepository;
  quizRepo?: QuizRepository;
  flashcardRepo?: FlashcardRepository;
  plannerRepo?: StudyPlanRepository;
  aiRepo?: AIRepository;
  aiTransport?: OpenRouterTransport;
  referenceDate?: Date;
}

export interface TopicMasteryComputationInput {
  isCompleted: boolean;
  studyTimeMinutes: number;
  quizAttemptsCount: number;
  quizAverageAccuracy: number; // 0..100
  flashcardReviewsCount: number;
  isFlaggedWeakInQuiz: boolean;
}

export interface TopicMasteryComputationResult {
  estimatedMasteryScore: number;
  masteryBand: MasteryBand;
}

export interface StreakComputationResult {
  currentStreakDays: number;
  longestStreakDays: number;
  activeDateKeys: string[];
}

export interface SubjectPerformanceItem {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  subjectNameBn?: string;
  totalTopicsCount: number;
  completedTopicsCount: number;
  studyTimeMinutes: number;
  quizAttemptsCount: number;
  averageQuizAccuracyPercent: number;
  estimatedMasteryScore: number;
  masteryBand: MasteryBand;
}

export interface TopicMasteryViewItem {
  topicId: string;
  topicCode: string;
  topicTitle: string;
  topicTitleBn?: string;
  subjectId: string;
  subjectName: string;
  chapterId: string;
  isCompleted: boolean;
  studyTimeMinutes: number;
  quizAttemptsCount: number;
  quizAverageAccuracy: number;
  flashcardReviewsCount: number;
  estimatedMasteryScore: number;
  masteryBand: MasteryBand;
  lastActivityAt?: Date;
}

export interface PerformanceTrendPoint {
  dateKey: string;
  studyMinutes: number;
  quizAccuracyPercent: number | null;
  flashcardReviewsCount: number;
}

export interface ExplainableRecommendationItem {
  id: string;
  title: string;
  reason: string;
  evidenceBasis: string;
  suggestedAction: string;
  actionUrl: string;
  priority: 'high' | 'medium' | 'low';
}

export interface GamificationMilestoneItem {
  code: string;
  title: string;
  description: string;
  unlocked: boolean;
  progressCurrent: number;
  progressTarget: number;
  pointsAwarded: number;
}

export interface GamificationSummary {
  currentStreakDays: number;
  longestStreakDays: number;
  meaningfulStudyPoints: number;
  milestones: GamificationMilestoneItem[];
  antiGamingPolicyNote: string;
}

export interface StudentAnalyticsDashboardView {
  overview: {
    totalStudyTimeMinutes: number;
    completedTopicsCount: number;
    totalTopicsCount: number;
    quizAttemptsCount: number;
    averageQuizAccuracyPercent: number;
    flashcardReviewsCount: number;
    dueFlashcardsCount: number;
    studyPlanCompletionPercent: number;
    overallEstimatedMasteryScore: number;
    masteryEstimateDisclaimer: string;
  };
  subjectPerformance: SubjectPerformanceItem[];
  topicMastery: TopicMasteryViewItem[];
  strongTopics: TopicMasteryViewItem[];
  weakTopics: TopicMasteryViewItem[];
  performanceTrends: PerformanceTrendPoint[];
  recommendations: ExplainableRecommendationItem[];
  gamification: GamificationSummary;
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  studyReminders: true,
  dueFlashcards: true,
  upcomingExams: true,
  learningMilestones: true,
};

function resolveDependencies(options?: AnalyticsServiceOptions) {
  return {
    analyticsRepo: options?.analyticsRepo ?? getDefaultAnalyticsRepository(),
    userRepo: options?.userRepo ?? getActiveUserRepository(),
    curriculumRepo: options?.curriculumRepo ?? getActiveCurriculumRepository(),
    quizRepo: options?.quizRepo ?? getActiveQuizRepository(),
    flashcardRepo: options?.flashcardRepo ?? getActiveFlashcardRepository(),
    plannerRepo: options?.plannerRepo ?? getDefaultStudyPlanRepository(),
    aiRepo: options?.aiRepo ?? getActiveAIRepository(),
    aiTransport: options?.aiTransport ?? getOpenRouterTransport(),
    referenceDate: options?.referenceDate ?? new Date(),
  };
}

/**
 * Deterministically computes an estimated topic mastery score (0..100) and band
 * from verified quiz accuracy, flashcard reviews, and topic study completion (`FR-ANALYTICS-006`, `FR-ANALYTICS-008`).
 */
export function computeTopicMasteryEstimate(
  input: TopicMasteryComputationInput,
): TopicMasteryComputationResult {
  const hasAnyActivity =
    input.isCompleted ||
    input.studyTimeMinutes > 0 ||
    input.quizAttemptsCount > 0 ||
    input.flashcardReviewsCount > 0;

  if (!hasAnyActivity) {
    return {
      estimatedMasteryScore: 0,
      masteryBand: 'unstarted',
    };
  }

  let score = 0;

  if (input.quizAttemptsCount > 0) {
    // Verified quiz accuracy contributes up to 65 points
    score += Math.round(Math.max(0, Math.min(100, input.quizAverageAccuracy)) * 0.65);
  } else if (input.isCompleted) {
    // Completed study without quiz yet contributes baseline 42 points
    score += 42;
  } else {
    score += Math.min(25, Math.round(input.studyTimeMinutes * 0.5));
  }

  // Completed topic milestone contributes up to 20 points
  if (input.isCompleted) {
    score += 20;
  } else if (input.studyTimeMinutes > 0) {
    score += Math.min(12, Math.round(input.studyTimeMinutes / 4));
  }

  // Spaced-repetition active recall contributes up to 15 points
  if (input.flashcardReviewsCount > 0) {
    score += Math.min(15, input.flashcardReviewsCount * 5);
  }

  score = Math.max(5, Math.min(100, score));

  if (input.isFlaggedWeakInQuiz && score >= 60) {
    score = 55;
  }

  const masteryBand: MasteryBand =
    score >= 75 ? 'strong' : score >= 60 ? 'developing' : 'weak';

  return {
    estimatedMasteryScore: score,
    masteryBand,
  };
}

/**
 * Calculates consecutive-day learning streaks from verified activity timestamps (`FR-ANALYTICS-002`, `FR-GAME-001`).
 */
export function calculateLearningStreak(
  activityDates: Date[],
  referenceDate: Date = new Date(),
): StreakComputationResult {
  const uniqueKeys = Array.from(
    new Set(activityDates.map((d) => toDateKey(d))),
  ).sort((a, b) => a.localeCompare(b));

  if (uniqueKeys.length === 0) {
    return {
      currentStreakDays: 0,
      longestStreakDays: 0,
      activeDateKeys: [],
    };
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const parseKeyMs = (key: string) => new Date(`${key}T00:00:00.000Z`).getTime();

  let longest = 1;
  let running = 1;
  for (let i = 1; i < uniqueKeys.length; i++) {
    const prevMs = parseKeyMs(uniqueKeys[i - 1]!);
    const currMs = parseKeyMs(uniqueKeys[i]!);
    if (Math.round((currMs - prevMs) / dayMs) === 1) {
      running += 1;
      if (running > longest) longest = running;
    } else {
      running = 1;
    }
  }

  // Current streak is active if last activity was today or yesterday (UTC)
  const refKey = toDateKey(referenceDate);
  const refMs = parseKeyMs(refKey);
  const lastKey = uniqueKeys[uniqueKeys.length - 1]!;
  const lastMs = parseKeyMs(lastKey);
  const diffFromRefDays = Math.round((refMs - lastMs) / dayMs);

  let currentStreakDays = 0;
  if (diffFromRefDays <= 1) {
    currentStreakDays = 1;
    for (let i = uniqueKeys.length - 1; i > 0; i--) {
      const curr = parseKeyMs(uniqueKeys[i]!);
      const prev = parseKeyMs(uniqueKeys[i - 1]!);
      if (Math.round((curr - prev) / dayMs) === 1) {
        currentStreakDays += 1;
      } else {
        break;
      }
    }
  }

  return {
    currentStreakDays,
    longestStreakDays: Math.max(longest, currentStreakDays),
    activeDateKeys: uniqueKeys,
  };
}

/**
 * Computes meaningful gamification points and achievement milestones (`FR-GAME-001..004`).
 * Points are strictly tied to unique completed topics, submitted quiz attempts, and spaced-repetition reviews.
 */
export function computeGamificationSummary(params: {
  completedTopicsCount: number;
  quizAttemptsCount: number;
  flashcardReviewsCount: number;
  strongTopicsCount: number;
  currentStreakDays: number;
  longestStreakDays: number;
}): GamificationSummary {
  const meaningfulStudyPoints =
    params.completedTopicsCount * 25 +
    params.quizAttemptsCount * 20 +
    params.flashcardReviewsCount * 5 +
    params.strongTopicsCount * 30 +
    params.longestStreakDays * 10;

  const milestones: GamificationMilestoneItem[] = [
    {
      code: 'FIRST_TOPIC_COMPLETE',
      title: 'Syllabus Explorer',
      description: 'Complete your first syllabus topic learning session.',
      unlocked: params.completedTopicsCount >= 1,
      progressCurrent: Math.min(1, params.completedTopicsCount),
      progressTarget: 1,
      pointsAwarded: 25,
    },
    {
      code: 'QUIZ_CHECKPOINT',
      title: 'Assessment Calibrator',
      description: 'Submit at least 1 scored practice quiz or mock examination.',
      unlocked: params.quizAttemptsCount >= 1,
      progressCurrent: Math.min(1, params.quizAttemptsCount),
      progressTarget: 1,
      pointsAwarded: 20,
    },
    {
      code: 'ACTIVE_RECALL_5',
      title: 'Spaced Repetition Practitioner',
      description: 'Complete 5 SM-2 flashcard active recall reviews.',
      unlocked: params.flashcardReviewsCount >= 5,
      progressCurrent: Math.min(5, params.flashcardReviewsCount),
      progressTarget: 5,
      pointsAwarded: 25,
    },
    {
      code: 'STREAK_3_DAYS',
      title: '3-Day Consistency Streak',
      description: 'Maintain verified study activity across 3 consecutive days.',
      unlocked: params.longestStreakDays >= 3,
      progressCurrent: Math.min(3, params.longestStreakDays),
      progressTarget: 3,
      pointsAwarded: 30,
    },
    {
      code: 'STRONG_MASTERY_TOPIC',
      title: 'Concept Mastery Builder',
      description: 'Reach Strong estimated mastery (>=75%) in at least 1 syllabus topic.',
      unlocked: params.strongTopicsCount >= 1,
      progressCurrent: Math.min(1, params.strongTopicsCount),
      progressTarget: 1,
      pointsAwarded: 30,
    },
  ];

  return {
    currentStreakDays: params.currentStreakDays,
    longestStreakDays: params.longestStreakDays,
    meaningfulStudyPoints,
    milestones,
    antiGamingPolicyNote:
      'Study points and milestones are awarded exclusively for verified topic completions, scored quiz attempts, and spaced-repetition reviews — never for repeated clicks or unverified page views (FR-GAME-004).',
  };
}

/**
 * Synchronizes canonical `progressRecords` from verified activity across `quizAttempts`, `flashcards`,
 * `reviewLogs`, and `studyTasks`, and returns the full Student Analytics Dashboard (`FR-ANALYTICS-001..008`).
 */
export async function getStudentAnalyticsDashboard(
  actor: AuthenticatedActor | null,
  rawQuery?: unknown,
  options?: AnalyticsServiceOptions,
): Promise<StudentAnalyticsDashboardView> {
  const authed = requireAuth(actor);
  const query = analyticsQuerySchema.parse(rawQuery ?? {});
  const {
    analyticsRepo,
    curriculumRepo,
    quizRepo,
    flashcardRepo,
    plannerRepo,
    aiRepo,
    aiTransport,
    referenceDate,
  } = resolveDependencies(options);

  const [
    subjects,
    topicsResult,
    existingProgress,
    quizzesResult,
    quizAttempts,
    flashcards,
    reviewLogs,
    studyPlans,
    studyTasks,
  ] = await Promise.all([
    curriculumRepo.listSubjects({
      includeInactive: false,
      viewerUserId: authed.userId,
      scopeFilter: 'all',
    }),
    curriculumRepo.listTopics({
      includeInactive: false,
      viewerUserId: authed.userId,
      scopeFilter: 'all',
      page: 1,
      limit: 250,
    }),
    analyticsRepo.listProgressByUser(authed.userId),
    quizRepo.listQuizzesByUser({ userId: authed.userId, page: 1, limit: 100 }),
    quizRepo.listAttemptsByUser(authed.userId, 100),
    flashcardRepo.listCardsByUser(authed.userId),
    flashcardRepo.listReviewLogsByUser(authed.userId, 200),
    plannerRepo.listPlansByUser(authed.userId),
    plannerRepo.listTasksByUser(authed.userId),
  ]);

  const topics = topicsResult.items;
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const existingProgressByTopic = new Map(existingProgress.map((p) => [p.topicId, p]));
  const quizById = new Map(quizzesResult.items.map((q) => [q.id, q]));
  const submittedAttempts = quizAttempts.filter((a) => a.status === 'submitted');

  // Map topicId -> quiz attempts, accuracy, and weak flags
  const topicQuizStats = new Map<
    string,
    { attempts: number; accuracySum: number; flaggedWeak: boolean; lastAt?: Date }
  >();
  for (const attempt of submittedAttempts) {
    const quiz = quizById.get(attempt.quizId);
    const coveredTopicIds = new Set<string>([
      ...(quiz?.topicIds ?? []),
      ...attempt.weakTopicIds,
    ]);
    for (const topicId of coveredTopicIds) {
      const curr = topicQuizStats.get(topicId) ?? {
        attempts: 0,
        accuracySum: 0,
        flaggedWeak: false,
      };
      curr.attempts += 1;
      curr.accuracySum += attempt.accuracyPercent;
      if (attempt.weakTopicIds.includes(topicId)) {
        curr.flaggedWeak = true;
      }
      const attDate = attempt.submittedAt ?? attempt.updatedAt;
      if (!curr.lastAt || attDate.getTime() > curr.lastAt.getTime()) {
        curr.lastAt = attDate;
      }
      topicQuizStats.set(topicId, curr);
    }
  }

  // Map flashcardId -> card & topicId -> flashcard review counts
  const cardById = new Map(flashcards.map((c) => [c.id, c]));
  const topicFlashcardReviews = new Map<string, { count: number; lastAt?: Date }>();
  for (const log of reviewLogs) {
    const card = cardById.get(log.flashcardId);
    if (card?.topicId) {
      const curr = topicFlashcardReviews.get(card.topicId) ?? { count: 0 };
      curr.count += 1;
      if (!curr.lastAt || log.reviewedAt.getTime() > curr.lastAt.getTime()) {
        curr.lastAt = log.reviewedAt;
      }
      topicFlashcardReviews.set(card.topicId, curr);
    }
  }

  // Map topicId -> completed study tasks & minutes
  const completedTasks = studyTasks.filter((t) => t.status === 'completed');
  const topicTaskStats = new Map<
    string,
    { completed: boolean; minutes: number; completedAt?: Date }
  >();
  for (const task of completedTasks) {
    if (task.topicId) {
      const curr = topicTaskStats.get(task.topicId) ?? { completed: false, minutes: 0 };
      curr.completed = true;
      curr.minutes += task.durationMinutes;
      const doneDate = task.completedAt ?? task.updatedAt;
      if (!curr.completedAt || doneDate.getTime() > curr.completedAt.getTime()) {
        curr.completedAt = doneDate;
      }
      topicTaskStats.set(task.topicId, curr);
    }
  }

  // Sync canonical progressRecords for topics with activity
  const topicMasteryViews: TopicMasteryViewItem[] = [];
  for (const topic of topics) {
    const prev = existingProgressByTopic.get(topic.id);
    const qStat = topicQuizStats.get(topic.id);
    const fStat = topicFlashcardReviews.get(topic.id);
    const tStat = topicTaskStats.get(topic.id);

    const isCompleted = Boolean(prev?.isCompleted || tStat?.completed);
    const studyTimeMinutes = Math.max(prev?.studyTimeMinutes ?? 0, tStat?.minutes ?? 0);
    const quizAttemptsCount = Math.max(prev?.quizAttemptsCount ?? 0, qStat?.attempts ?? 0);
    const quizAverageAccuracy =
      qStat && qStat.attempts > 0
        ? Math.round(qStat.accuracySum / qStat.attempts)
        : (prev?.quizAverageAccuracy ?? 0);
    const flashcardReviewsCount = Math.max(
      prev?.flashcardReviewsCount ?? 0,
      fStat?.count ?? 0,
    );

    const mastery = computeTopicMasteryEstimate({
      isCompleted,
      studyTimeMinutes,
      quizAttemptsCount,
      quizAverageAccuracy,
      flashcardReviewsCount,
      isFlaggedWeakInQuiz: Boolean(qStat?.flaggedWeak),
    });

    const candidateDates = [
      prev?.lastActivityAt,
      qStat?.lastAt,
      fStat?.lastAt,
      tStat?.completedAt,
    ].filter((d): d is Date => Boolean(d));
    const lastActivityAt =
      candidateDates.length > 0
        ? new Date(Math.max(...candidateDates.map((d) => d.getTime())))
        : undefined;

    if (
      isCompleted ||
      studyTimeMinutes > 0 ||
      quizAttemptsCount > 0 ||
      flashcardReviewsCount > 0
    ) {
      await analyticsRepo.upsertProgress({
        userId: authed.userId,
        subjectId: topic.subjectId,
        chapterId: topic.chapterId,
        topicId: topic.id,
        isCompleted,
        completedAt: isCompleted ? (prev?.completedAt ?? tStat?.completedAt ?? new Date()) : undefined,
        studyTimeMinutes,
        quizAttemptsCount,
        quizAverageAccuracy,
        flashcardReviewsCount,
        estimatedMasteryScore: mastery.estimatedMasteryScore,
        masteryBand: mastery.masteryBand,
        lastActivityAt,
      });
    }

    const subject = subjectById.get(topic.subjectId);
    topicMasteryViews.push({
      topicId: topic.id,
      topicCode: topic.code,
      topicTitle: topic.title,
      topicTitleBn: topic.titleBn,
      subjectId: topic.subjectId,
      subjectName: subject?.name ?? 'Subject',
      chapterId: topic.chapterId,
      isCompleted,
      studyTimeMinutes,
      quizAttemptsCount,
      quizAverageAccuracy,
      flashcardReviewsCount,
      estimatedMasteryScore: mastery.estimatedMasteryScore,
      masteryBand: mastery.masteryBand,
      lastActivityAt,
    });
  }

  // Subject-wise aggregation (FR-ANALYTICS-002)
  const subjectPerformance: SubjectPerformanceItem[] = subjects.map((subject) => {
    const subTopics = topicMasteryViews.filter((t) => t.subjectId === subject.id);
    const completedTopicsCount = subTopics.filter((t) => t.isCompleted).length;
    const studyTimeMinutes = subTopics.reduce((sum, t) => sum + t.studyTimeMinutes, 0);
    const activeTopics = subTopics.filter((t) => t.masteryBand !== 'unstarted');
    const quizTopics = subTopics.filter((t) => t.quizAttemptsCount > 0);

    const averageQuizAccuracyPercent =
      quizTopics.length > 0
        ? Math.round(
            quizTopics.reduce((sum, t) => sum + t.quizAverageAccuracy, 0) / quizTopics.length,
          )
        : 0;
    const estimatedMasteryScore =
      activeTopics.length > 0
        ? Math.round(
            activeTopics.reduce((sum, t) => sum + t.estimatedMasteryScore, 0) /
              activeTopics.length,
          )
        : 0;
    const masteryBand: MasteryBand =
      activeTopics.length === 0
        ? 'unstarted'
        : estimatedMasteryScore >= 75
          ? 'strong'
          : estimatedMasteryScore >= 60
            ? 'developing'
            : 'weak';

    return {
      subjectId: subject.id,
      subjectCode: subject.code,
      subjectName: subject.name,
      subjectNameBn: subject.nameBn,
      totalTopicsCount: subTopics.length,
      completedTopicsCount,
      studyTimeMinutes,
      quizAttemptsCount: subTopics.reduce((sum, t) => sum + t.quizAttemptsCount, 0),
      averageQuizAccuracyPercent,
      estimatedMasteryScore,
      masteryBand,
    };
  });

  // Overall KPI calculations
  const quizMinutes = Math.round(
    submittedAttempts.reduce((sum, a) => sum + (a.durationSeconds ?? 300), 0) / 60,
  );
  const reviewMinutes = Math.round(
    reviewLogs.reduce((sum, r) => sum + (r.durationMs ?? 15000), 0) / 60000,
  );
  const topicAndTaskMinutes = topicMasteryViews.reduce(
    (sum, t) => sum + t.studyTimeMinutes,
    0,
  );
  const totalStudyTimeMinutes = topicAndTaskMinutes + quizMinutes + reviewMinutes;

  const completedTopicsCount = topicMasteryViews.filter((t) => t.isCompleted).length;
  const averageQuizAccuracyPercent =
    submittedAttempts.length > 0
      ? Math.round(
          submittedAttempts.reduce((sum, a) => sum + a.accuracyPercent, 0) /
            submittedAttempts.length,
        )
      : 0;

  const dueFlashcardsCount = flashcards.filter(
    (c) => c.nextReviewAt.getTime() <= referenceDate.getTime() || c.masteryState === 'difficult',
  ).length;

  const activePlan = studyPlans.find((p) => p.status === 'active') ?? studyPlans[0];
  const studyPlanCompletionPercent = activePlan?.completionPercent ?? 0;

  const startedTopics = topicMasteryViews.filter((t) => t.masteryBand !== 'unstarted');
  const overallEstimatedMasteryScore =
    startedTopics.length > 0
      ? Math.round(
          startedTopics.reduce((sum, t) => sum + t.estimatedMasteryScore, 0) /
            startedTopics.length,
        )
      : 0;

  const strongTopics = topicMasteryViews
    .filter((t) => t.masteryBand === 'strong')
    .sort((a, b) => b.estimatedMasteryScore - a.estimatedMasteryScore);

  const weakTopics = topicMasteryViews
    .filter((t) => t.masteryBand === 'weak')
    .sort((a, b) => a.estimatedMasteryScore - b.estimatedMasteryScore);

  // Streaks from verified activity timestamps
  const verifiedActivityDates: Date[] = [
    ...submittedAttempts.map((a) => a.submittedAt ?? a.updatedAt),
    ...reviewLogs.map((r) => r.reviewedAt),
    ...completedTasks.map((t) => t.completedAt ?? t.updatedAt),
    ...topicMasteryViews
      .map((t) => t.lastActivityAt)
      .filter((d): d is Date => Boolean(d)),
  ];
  const streak = calculateLearningStreak(verifiedActivityDates, referenceDate);

  // Performance Trends by date (FR-ANALYTICS-003)
  const trendMap = new Map<
    string,
    { studyMinutes: number; quizAccSum: number; quizCount: number; reviews: number }
  >();
  for (const dateKey of streak.activeDateKeys.slice(-14)) {
    trendMap.set(dateKey, { studyMinutes: 0, quizAccSum: 0, quizCount: 0, reviews: 0 });
  }
  for (const attempt of submittedAttempts) {
    const key = toDateKey(attempt.submittedAt ?? attempt.updatedAt);
    const entry = trendMap.get(key) ?? {
      studyMinutes: 0,
      quizAccSum: 0,
      quizCount: 0,
      reviews: 0,
    };
    entry.studyMinutes += Math.max(5, Math.round((attempt.durationSeconds ?? 300) / 60));
    entry.quizAccSum += attempt.accuracyPercent;
    entry.quizCount += 1;
    trendMap.set(key, entry);
  }
  for (const log of reviewLogs) {
    const key = toDateKey(log.reviewedAt);
    const entry = trendMap.get(key) ?? {
      studyMinutes: 0,
      quizAccSum: 0,
      quizCount: 0,
      reviews: 0,
    };
    entry.reviews += 1;
    entry.studyMinutes += 2;
    trendMap.set(key, entry);
  }
  for (const task of completedTasks) {
    const key = toDateKey(task.completedAt ?? task.updatedAt);
    const entry = trendMap.get(key) ?? {
      studyMinutes: 0,
      quizAccSum: 0,
      quizCount: 0,
      reviews: 0,
    };
    entry.studyMinutes += task.durationMinutes;
    trendMap.set(key, entry);
  }

  const performanceTrends: PerformanceTrendPoint[] = Array.from(trendMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([dateKey, d]) => ({
      dateKey,
      studyMinutes: d.studyMinutes,
      quizAccuracyPercent: d.quizCount > 0 ? Math.round(d.quizAccSum / d.quizCount) : null,
      flashcardReviewsCount: d.reviews,
    }));

  // Explainable Adaptive Recommendations with inspectable evidenceBasis (FR-ANALYTICS-005..007)
  const recommendations: ExplainableRecommendationItem[] = [];

  for (const weak of weakTopics.slice(0, 2)) {
    recommendations.push({
      id: `rec-weak-${weak.topicId}`,
      title: `Remediate Weak Topic: ${weak.topicTitle}`,
      reason: `Your estimated mastery in ${weak.topicTitle} (${weak.subjectName}) is ${weak.estimatedMasteryScore}% (Weak band).`,
      evidenceBasis: `Verified basis: ${weak.quizAttemptsCount} quiz attempt(s) averaging ${weak.quizAverageAccuracy}% accuracy and ${weak.flashcardReviewsCount} flashcard review(s).`,
      suggestedAction: 'Review quick revision notes with AI Tutor and retry a targeted practice quiz.',
      actionUrl: '/quizzes',
      priority: 'high',
    });
  }

  if (dueFlashcardsCount > 0) {
    recommendations.push({
      id: 'rec-due-flashcards',
      title: `Clear ${dueFlashcardsCount} Due Spaced-Repetition Flashcard(s)`,
      reason: 'Active recall intervals have elapsed on cards in your SM-2 queue.',
      evidenceBasis: `Verified basis: ${dueFlashcardsCount} card(s) have nextReviewAt <= today or are marked 'difficult' across ${reviewLogs.length} historical review logs.`,
      suggestedAction: 'Complete a 10-minute SM-2 flashcard review session.',
      actionUrl: '/flashcards',
      priority: 'high',
    });
  }

  const pendingTodayTasks = studyTasks.filter(
    (t) => t.status !== 'completed' && t.scheduledDateKey <= toDateKey(referenceDate),
  );
  if (pendingTodayTasks.length > 0) {
    recommendations.push({
      id: 'rec-study-plan-due',
      title: `Complete ${pendingTodayTasks.length} Scheduled Roadmap Task(s)`,
      reason: `Your active preparation plan (${studyPlanCompletionPercent}% complete) has tasks due on or before ${toDateKey(referenceDate)}.`,
      evidenceBasis: `Verified basis: Study Plan "${activePlan?.title ?? 'Active Plan'}" has ${pendingTodayTasks.length} pending/rescheduled task(s) scheduled on or before today.`,
      suggestedAction: 'Open your Study Planner to complete or reschedule due tasks.',
      actionUrl: '/planner',
      priority: 'medium',
    });
  }

  if (recommendations.length === 0) {
    const nextUnstarted = topicMasteryViews.find((t) => t.masteryBand === 'unstarted');
    recommendations.push({
      id: 'rec-next-syllabus-topic',
      title: nextUnstarted
        ? `Start Next Syllabus Topic: ${nextUnstarted.topicTitle}`
        : 'Take a Timed Mock Examination',
      reason: nextUnstarted
        ? `Continue expanding syllabus coverage in ${nextUnstarted.subjectName}.`
        : 'All tracked topics have been initiated; benchmark your exam readiness.',
      evidenceBasis: `Verified basis: ${completedTopicsCount}/${topicMasteryViews.length} syllabus topics completed; overall estimated mastery is ${overallEstimatedMasteryScore}%.`,
      suggestedAction: nextUnstarted
        ? 'Generate structured topic explanation notes or ask AI Subject Tutor.'
        : 'Launch a full-syllabus timed mock exam.',
      actionUrl: nextUnstarted ? '/materials' : '/quizzes',
      priority: 'medium',
    });
  }

  if (query.refreshAiRecommendations) {
    try {
      const aiResult = await executeStructuredAITask(
        {
          userId: authed.userId,
          taskType: 'recommendations',
          schema: structuredRecommendationOutputSchema,
          variables: {
            curriculumContext: `Completed Topics: ${completedTopicsCount}/${topicMasteryViews.length}, Overall Mastery Estimate: ${overallEstimatedMasteryScore}%`,
            userPrompt: `Weak Topics: ${weakTopics.map((w) => w.topicTitle).join(', ') || 'None'}, Due Flashcards: ${dueFlashcardsCount}, Quiz Avg Accuracy: ${averageQuizAccuracyPercent}%`,
            language: query.language,
          },
        },
        aiRepo,
        aiTransport,
      );
      if (aiResult.data.recommendations[0]) {
        const aiRec = aiResult.data.recommendations[0];
        recommendations.push({
          id: 'rec-ai-advisor',
          title: aiRec.title,
          reason: aiRec.reason,
          evidenceBasis: `Verified basis: Synthesized by AI Advisor from ${submittedAttempts.length} quiz attempt(s) (${averageQuizAccuracyPercent}% avg) and ${completedTopicsCount} completed topic(s).`,
          suggestedAction: aiRec.suggestedAction,
          actionUrl: '/tutor',
          priority: aiRec.priority,
        });
      }
    } catch {
      // Deterministic recommendations remain authoritative if AI is unavailable
    }
  }

  const gamification = computeGamificationSummary({
    completedTopicsCount,
    quizAttemptsCount: submittedAttempts.length,
    flashcardReviewsCount: reviewLogs.length,
    strongTopicsCount: strongTopics.length,
    currentStreakDays: streak.currentStreakDays,
    longestStreakDays: streak.longestStreakDays,
  });

  return {
    overview: {
      totalStudyTimeMinutes,
      completedTopicsCount,
      totalTopicsCount: topicMasteryViews.length,
      quizAttemptsCount: submittedAttempts.length,
      averageQuizAccuracyPercent,
      flashcardReviewsCount: reviewLogs.length,
      dueFlashcardsCount,
      studyPlanCompletionPercent,
      overallEstimatedMasteryScore,
      masteryEstimateDisclaimer:
        'Mastery scores are algorithmic estimates derived from verified practice quizzes, spaced-repetition reviews, and completed study sessions — they are not definitive assessments of student ability (FR-ANALYTICS-008).',
    },
    subjectPerformance,
    topicMastery: topicMasteryViews,
    strongTopics,
    weakTopics,
    performanceTrends,
    recommendations,
    gamification,
  };
}

/**
 * Records explicit topic study progress or completion for the authenticated student (`FR-ANALYTICS-002`).
 */
export async function recordTopicStudyActivityForStudent(
  actor: AuthenticatedActor | null,
  rawInput: unknown,
  options?: AnalyticsServiceOptions,
): Promise<ProgressRecord> {
  const authed = requireAuth(actor);
  const input: RecordTopicProgressInput = recordTopicProgressSchema.parse(rawInput);
  const { analyticsRepo, curriculumRepo, referenceDate } = resolveDependencies(options);

  const topic = await curriculumRepo.findTopicById(input.topicId);
  assertCurriculumRecordReadable(topic, authed, 'Topic');
  if (!topic) {
    throw new AppError('NOT_FOUND', 'Curriculum topic not found.', 404);
  }

  const existing = await analyticsRepo.findProgressByTopic(authed.userId, topic.id);
  const isCompleted = input.markCompleted ?? existing?.isCompleted ?? false;
  const studyTimeMinutes = (existing?.studyTimeMinutes ?? 0) + input.studyTimeMinutesDelta;
  const quizAttemptsCount = existing?.quizAttemptsCount ?? 0;
  const quizAverageAccuracy = existing?.quizAverageAccuracy ?? 0;
  const flashcardReviewsCount = existing?.flashcardReviewsCount ?? 0;

  const mastery = computeTopicMasteryEstimate({
    isCompleted,
    studyTimeMinutes,
    quizAttemptsCount,
    quizAverageAccuracy,
    flashcardReviewsCount,
    isFlaggedWeakInQuiz: false,
  });

  return analyticsRepo.upsertProgress({
    userId: authed.userId,
    subjectId: topic.subjectId,
    chapterId: topic.chapterId,
    topicId: topic.id,
    isCompleted,
    completedAt: isCompleted ? (existing?.completedAt ?? referenceDate) : undefined,
    studyTimeMinutes,
    quizAttemptsCount,
    quizAverageAccuracy,
    flashcardReviewsCount,
    estimatedMasteryScore: mastery.estimatedMasteryScore,
    masteryBand: mastery.masteryBand,
    lastActivityAt: referenceDate,
  });
}

/**
 * Synchronizes deduplicated in-app notifications from verified due flashcards, study tasks,
 * upcoming exams, and learning milestones while respecting `user.notificationPreferences` (`FR-NOTIFY-001..003`).
 */
export async function listAndSyncNotificationsForStudent(
  actor: AuthenticatedActor | null,
  options?: AnalyticsServiceOptions,
): Promise<{
  notifications: NotificationRecord[];
  unreadCount: number;
  preferences: NotificationPreferences;
}> {
  const authed = requireAuth(actor);
  const {
    analyticsRepo,
    userRepo,
    flashcardRepo,
    plannerRepo,
    quizRepo,
    referenceDate,
  } = resolveDependencies(options);

  const user = await userRepo.findById(authed.userId);
  const preferences: NotificationPreferences = user?.notificationPreferences
    ? { ...user.notificationPreferences }
    : { ...DEFAULT_NOTIFICATION_PREFERENCES };

  const todayKey = toDateKey(referenceDate);
  const [flashcards, reviewLogs, studyPlans, studyTasks, quizAttempts, progressRecords] =
    await Promise.all([
      flashcardRepo.listCardsByUser(authed.userId),
      flashcardRepo.listReviewLogsByUser(authed.userId, 50),
      plannerRepo.listPlansByUser(authed.userId),
      plannerRepo.listTasksByUser(authed.userId),
      quizRepo.listAttemptsByUser(authed.userId, 50),
      analyticsRepo.listProgressByUser(authed.userId),
    ]);

  // 1. Due Flashcards notification (respects preferences.dueFlashcards)
  if (preferences.dueFlashcards) {
    const dueCount = flashcards.filter(
      (c) => c.nextReviewAt.getTime() <= referenceDate.getTime() || c.masteryState === 'difficult',
    ).length;
    if (dueCount > 0) {
      await analyticsRepo.createNotificationIfNotExists({
        userId: authed.userId,
        notificationType: 'due_flashcards',
        title: `${dueCount} Flashcard(s) Due for Spaced-Repetition Review`,
        message: `You have ${dueCount} active-recall card(s) ready for SM-2 review today.`,
        actionUrl: '/flashcards',
        dedupeKey: `due_flashcards:${todayKey}`,
      });
    }
  }

  // 2. Study reminders, missed tasks & upcoming revision notifications (respects preferences.studyReminders)
  if (preferences.studyReminders) {
    const missedTasks = studyTasks.filter(
      (t) =>
        (t.status === 'pending' && t.scheduledDateKey < todayKey) ||
        t.status === 'skipped',
    );
    if (missedTasks.length > 0) {
      await analyticsRepo.createNotificationIfNotExists({
        userId: authed.userId,
        notificationType: 'missed_task',
        title: `${missedTasks.length} Missed or Skipped Study Task(s)`,
        message: `You have ${missedTasks.length} task(s) from earlier dates that can be adaptively rescheduled in your Study Planner.`,
        actionUrl: '/planner',
        dedupeKey: `missed_task:${todayKey}`,
      });
    }

    const todayRevisionTasks = studyTasks.filter(
      (t) =>
        t.status !== 'completed' &&
        t.scheduledDateKey >= todayKey &&
        (t.taskType === 'revision' || t.taskType === 'final_revision'),
    );
    if (todayRevisionTasks.length > 0) {
      await analyticsRepo.createNotificationIfNotExists({
        userId: authed.userId,
        notificationType: 'upcoming_revision',
        title: `Upcoming Revision Session: ${todayRevisionTasks[0]!.title}`,
        message: `Scheduled revision session (${todayRevisionTasks[0]!.durationMinutes} mins) on ${todayRevisionTasks[0]!.scheduledDateKey}.`,
        actionUrl: '/planner',
        dedupeKey: `upcoming_revision:${todayRevisionTasks[0]!.id}`,
      });
    }

    const todayTasks = studyTasks.filter(
      (t) => t.status === 'pending' && t.scheduledDateKey === todayKey,
    );
    if (todayTasks.length > 0) {
      await analyticsRepo.createNotificationIfNotExists({
        userId: authed.userId,
        notificationType: 'study_reminder',
        title: `Daily Study Goal: ${todayTasks.length} Task(s) Scheduled Today`,
        message: `Stay on track with your roadmap by completing today's ${todayTasks.reduce((s, t) => s + t.durationMinutes, 0)} minutes of planned study.`,
        actionUrl: '/planner',
        dedupeKey: `study_reminder:${todayKey}`,
      });
    }
  }

  // 3. Upcoming examination notifications (respects preferences.upcomingExams)
  if (preferences.upcomingExams) {
    const activePlan = studyPlans.find((p) => p.status === 'active');
    if (activePlan) {
      const daysUntilTarget = Math.ceil(
        (activePlan.targetDate.getTime() - referenceDate.getTime()) / (24 * 60 * 60 * 1000),
      );
      if (daysUntilTarget >= 0 && daysUntilTarget <= 30) {
        await analyticsRepo.createNotificationIfNotExists({
          userId: authed.userId,
          notificationType: 'upcoming_exam',
          title: `Upcoming Target Date: ${activePlan.title} (${daysUntilTarget} days left)`,
          message: `Your target examination/completion date is ${toDateKey(activePlan.targetDate)}. Current plan completion: ${activePlan.completionPercent}%.`,
          actionUrl: '/planner',
          dedupeKey: `upcoming_exam:${activePlan.id}:${todayKey}`,
        });
      }
    }
  }

  // 4. Learning milestone notifications (respects preferences.learningMilestones)
  if (preferences.learningMilestones) {
    const completedTopicsCount = progressRecords.filter((p) => p.isCompleted).length;
    const submittedQuizCount = quizAttempts.filter((a) => a.status === 'submitted').length;
    if (completedTopicsCount >= 1 || submittedQuizCount >= 1 || reviewLogs.length >= 5) {
      await analyticsRepo.createNotificationIfNotExists({
        userId: authed.userId,
        notificationType: 'learning_milestone',
        title: 'Learning Milestone Unlocked!',
        message: `You have completed ${completedTopicsCount} topic(s), ${submittedQuizCount} quiz attempt(s), and ${reviewLogs.length} flashcard review(s). Keep building your mastery!`,
        actionUrl: '/analytics',
        dedupeKey: `milestone:summary:${completedTopicsCount}:${submittedQuizCount}`,
      });
    }
  }

  const notifications = await analyticsRepo.listNotificationsByUser(authed.userId, 50);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return {
    notifications,
    unreadCount,
    preferences,
  };
}

/**
 * Marks notifications as read or updates the student's notification preferences (`FR-NOTIFY-001..003`).
 */
export async function updateNotificationsForStudent(
  actor: AuthenticatedActor | null,
  rawInput: unknown,
  options?: AnalyticsServiceOptions,
): Promise<{
  notifications: NotificationRecord[];
  unreadCount: number;
  preferences: NotificationPreferences;
}> {
  const authed = requireAuth(actor);
  const input: UpdateNotificationsInput = updateNotificationsSchema.parse(rawInput);
  const { analyticsRepo, userRepo } = resolveDependencies(options);

  const user = await userRepo.findById(authed.userId);
  let preferences: NotificationPreferences = user?.notificationPreferences
    ? { ...user.notificationPreferences }
    : { ...DEFAULT_NOTIFICATION_PREFERENCES };

  if (input.action === 'mark_read') {
    const existing = await analyticsRepo.findNotificationById(input.notificationId);
    if (!existing) {
      throw new AppError('NOT_FOUND', 'Notification not found.', 404);
    }
    assertResourceOwnership(authed, existing.userId);
    await analyticsRepo.markNotificationRead(existing.id, authed.userId);
  } else if (input.action === 'mark_all_read') {
    await analyticsRepo.markAllNotificationsRead(authed.userId);
  } else if (input.action === 'update_preferences') {
    preferences = {
      ...preferences,
      ...input.preferences,
    };
    if (user) {
      await userRepo.updateById(authed.userId, {
        notificationPreferences: preferences,
      });
    }
  }

  const notifications = await analyticsRepo.listNotificationsByUser(authed.userId, 50);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return {
    notifications,
    unreadCount,
    preferences,
  };
}
