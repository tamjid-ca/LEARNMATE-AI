/**
 * LearnMate AI — Deterministic Study Roadmap & Scheduling Engine
 * Grounded in docs/PROJECT_SRS.md Section 4.8 (FR-PLAN-003..011) and ADR-006:
 * - Uses deterministic date allocation across available days of the week and daily study minutes.
 * - Orders topics by prerequisites, verified weak-topic performance, overdue spaced-repetition reviews,
 *   student subject proficiency, and verified curriculum weights (never inventing official exam weightings
 *   when `syllabusWeightVerified` is false — FR-PLAN-011).
 * - Generates all 6 task types (`learn_topic`, `revision`, `practice_quiz`, `flashcard_review`,
 *   `mock_exam`, `final_revision`) and weekly milestones.
 */

import type {
  ChapterRecord,
  SubjectRecord,
  TopicRecord,
} from '../curriculum/seed-data.ts';
import type {
  ExplanationDepth,
  StudyTaskStatus,
  StudyTaskType,
} from '../../types/domain.ts';

export interface PlannedStudyTaskDraft {
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  taskType: StudyTaskType;
  title: string;
  description: string;
  scheduledDateKey: string;
  scheduledDate: Date;
  durationMinutes: number;
  priorityRank: number;
  status: StudyTaskStatus;
  isManuallyEdited: boolean;
}

export interface WeeklyMilestoneItem {
  weekNumber: number;
  startDateKey: string;
  endDateKey: string;
  title: string;
  focusSubjectNames: string[];
  plannedMinutes: number;
  taskCount: number;
}

export interface ScheduleFeasibilityReport {
  isFeasible: boolean;
  availableStudyDaysCount: number;
  totalAvailableMinutes: number;
  totalPlannedMinutes: number;
  utilizationPercent: number;
  verifiedWeightTopicCount: number;
  unverifiedWeightTopicCount: number;
  weightingPolicyNote: string;
  warningMessage?: string;
}

export interface DeterministicRoadmapInput {
  startDate: Date;
  targetDate: Date;
  dailyStudyMinutes: number;
  availableDaysOfWeek: number[];
  subjects: SubjectRecord[];
  chapters: ChapterRecord[];
  topics: TopicRecord[];
  proficiencyBySubject?: Record<string, ExplanationDepth>;
  weakTopicIds?: string[];
  dueFlashcardTopicIds?: string[];
  completedTopicIds?: string[];
  aiPriorityTopicCodes?: string[];
}

export interface DeterministicRoadmapResult {
  tasks: PlannedStudyTaskDraft[];
  weeklyMilestones: WeeklyMilestoneItem[];
  feasibility: ScheduleFeasibilityReport;
}

/**
 * Formats a Date into a canonical `YYYY-MM-DD` UTC key.
 */
export function toDateKey(date: Date): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return utc.toISOString().slice(0, 10);
}

/**
 * Normalizes a Date to midnight UTC (`00:00:00.000Z`).
 */
export function normalizeToUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Enumerates all available study dates between `startDate` and `targetDate` (inclusive)
 * matching `availableDaysOfWeek` (`0 = Sunday .. 6 = Saturday`).
 * Guarantees at least 1 study date (`startDate`) if the window has no matching day.
 */
export function enumerateAvailableStudyDates(
  startDate: Date,
  targetDate: Date,
  availableDaysOfWeek: number[],
): Date[] {
  const start = normalizeToUtcMidnight(startDate);
  const end = normalizeToUtcMidnight(
    targetDate.getTime() >= start.getTime() ? targetDate : startDate,
  );
  const allowedDays = new Set(
    availableDaysOfWeek.length > 0 ? availableDaysOfWeek : [0, 1, 2, 3, 4, 5, 6],
  );

  const dates: Date[] = [];
  const cursor = new Date(start.getTime());
  const maxDays = 366; // Cap at 1 year window for deterministic safety
  let steps = 0;

  while (cursor.getTime() <= end.getTime() && steps < maxDays) {
    if (allowedDays.has(cursor.getUTCDay())) {
      dates.push(new Date(cursor.getTime()));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    steps += 1;
  }

  if (dates.length === 0) {
    dates.push(start);
  }

  return dates;
}

/**
 * Orders syllabus topics deterministically while respecting prerequisites (`prerequisiteTopicIds`),
 * verified weak-topic signals (`weakTopicIds`), overdue flashcard topics (`dueFlashcardTopicIds`),
 * student subject proficiency, and verified syllabus priority scores (`FR-PLAN-011`).
 */
export function prioritizeTopicsDeterministically(params: {
  topics: TopicRecord[];
  proficiencyBySubject?: Record<string, ExplanationDepth>;
  weakTopicIds?: string[];
  dueFlashcardTopicIds?: string[];
  aiPriorityTopicCodes?: string[];
}): TopicRecord[] {
  const {
    topics,
    proficiencyBySubject = {},
    weakTopicIds = [],
    dueFlashcardTopicIds = [],
    aiPriorityTopicCodes = [],
  } = params;

  const weakSet = new Set(weakTopicIds);
  const dueSet = new Set(dueFlashcardTopicIds);
  const aiCodeSet = new Set(aiPriorityTopicCodes.map((c) => c.toUpperCase()));
  const topicById = new Map(topics.map((t) => [t.id, t]));

  // Score each topic deterministically without inventing official exam weights (FR-PLAN-011)
  const scoreTopic = (topic: TopicRecord): number => {
    let score = 0;
    if (weakSet.has(topic.id)) score += 50;
    if (dueSet.has(topic.id)) score += 35;
    if (aiCodeSet.has(topic.code.toUpperCase())) score += 15;

    const proficiency = proficiencyBySubject[topic.subjectId] ?? 'intermediate';
    if (proficiency === 'beginner') score += 20;
    else if (proficiency === 'intermediate') score += 10;

    if (topic.difficulty === 'hard') score += 12;
    else if (topic.difficulty === 'medium') score += 6;

    // FR-PLAN-011: Only apply syllabusPriorityScore when syllabusWeightVerified === true
    if (topic.syllabusWeightVerified && typeof topic.syllabusPriorityScore === 'number') {
      score += Math.min(25, Math.max(0, topic.syllabusPriorityScore));
    }

    return score;
  };

  // Topological sort that respects prerequisites while prioritizing higher-scored topics
  const remaining = [...topics].sort((a, b) => {
    const diff = scoreTopic(b) - scoreTopic(a);
    if (diff !== 0) return diff;
    return a.order - b.order;
  });

  const resolvedIds = new Set<string>();
  const ordered: TopicRecord[] = [];

  while (remaining.length > 0) {
    const readyIndex = remaining.findIndex((t) =>
      t.prerequisiteTopicIds.every((preId) => !topicById.has(preId) || resolvedIds.has(preId)),
    );
    const chosenIndex = readyIndex >= 0 ? readyIndex : 0;
    const [chosen] = remaining.splice(chosenIndex, 1);
    if (chosen) {
      ordered.push(chosen);
      resolvedIds.add(chosen.id);
    }
  }

  return ordered;
}

/**
 * Generates a complete deterministic study roadmap with daily date allocation,
 * revision/practice/mock-exam sessions, weekly milestones, and feasibility telemetry.
 */
export function generateDeterministicRoadmap(
  input: DeterministicRoadmapInput,
): DeterministicRoadmapResult {
  const dailyStudyMinutes = Math.max(15, Math.min(720, Math.round(input.dailyStudyMinutes)));
  const availableDates = enumerateAvailableStudyDates(
    input.startDate,
    input.targetDate,
    input.availableDaysOfWeek,
  );

  const subjectById = new Map(input.subjects.map((s) => [s.id, s]));
  const chapterById = new Map(input.chapters.map((c) => [c.id, c]));
  const weakSet = new Set(input.weakTopicIds ?? []);
  const dueSet = new Set(input.dueFlashcardTopicIds ?? []);
  const completedSet = new Set(input.completedTopicIds ?? []);

  const orderedTopics = prioritizeTopicsDeterministically({
    topics: input.topics,
    proficiencyBySubject: input.proficiencyBySubject,
    weakTopicIds: input.weakTopicIds,
    dueFlashcardTopicIds: input.dueFlashcardTopicIds,
    aiPriorityTopicCodes: input.aiPriorityTopicCodes,
  });

  const unScheduledQueue: Array<Omit<PlannedStudyTaskDraft, 'scheduledDateKey' | 'scheduledDate'>> =
    [];
  let rankCounter = 1;

  // 1. Overdue flashcard reviews & weak-topic remediation first (FR-PLAN-009, FR-PLAN-010)
  for (const topic of orderedTopics) {
    if (dueSet.has(topic.id)) {
      const subject = subjectById.get(topic.subjectId);
      unScheduledQueue.push({
        subjectId: topic.subjectId,
        chapterId: topic.chapterId,
        topicId: topic.id,
        taskType: 'flashcard_review',
        title: `Overdue Flashcard Review: ${topic.title}`,
        description: `Spaced-repetition active recall review for ${subject?.name ?? 'Subject'} — ${topic.title} (prioritized due to overdue cards).`,
        durationMinutes: Math.min(30, dailyStudyMinutes),
        priorityRank: rankCounter++,
        status: 'pending',
        isManuallyEdited: false,
      });
    }
  }

  // 2. Core topic learning + periodic revision & chapter practice quizzes (FR-PLAN-004)
  let topicsScheduledCount = 0;
  for (const topic of orderedTopics) {
    if (completedSet.has(topic.id)) {
      continue;
    }
    const subject = subjectById.get(topic.subjectId);
    const chapter = chapterById.get(topic.chapterId);
    const proficiency = input.proficiencyBySubject?.[topic.subjectId] ?? 'intermediate';
    const baseMinutes = topic.estimatedMinutes || 45;
    const adjustedMinutes =
      proficiency === 'beginner'
        ? Math.round(baseMinutes * 1.15)
        : proficiency === 'advanced'
          ? Math.round(baseMinutes * 0.85)
          : baseMinutes;
    const durationMinutes = Math.max(20, Math.min(dailyStudyMinutes, adjustedMinutes));

    const isWeak = weakSet.has(topic.id);
    const weightBadge =
      topic.syllabusWeightVerified && typeof topic.syllabusPriorityScore === 'number'
        ? ` [Verified syllabus priority: ${topic.syllabusPriorityScore}]`
        : '';

    unScheduledQueue.push({
      subjectId: topic.subjectId,
      chapterId: topic.chapterId,
      topicId: topic.id,
      taskType: isWeak ? 'revision' : 'learn_topic',
      title: `${isWeak ? 'Priority Remediation' : 'Learn Topic'}: ${topic.title}`,
      description: `${subject?.name ?? 'Subject'} · ${chapter?.title ?? 'Chapter'} (${topic.code}). ${
        isWeak
          ? 'Prioritized from verified quiz diagnostics (<60% accuracy).'
          : 'Core concept mastery and guided notes.'
      }${weightBadge}`,
      durationMinutes,
      priorityRank: rankCounter++,
      status: 'pending',
      isManuallyEdited: false,
    });

    topicsScheduledCount += 1;

    // Every 2 topics, schedule a targeted revision or flashcard active recall session
    if (topicsScheduledCount % 2 === 0) {
      unScheduledQueue.push({
        subjectId: topic.subjectId,
        chapterId: topic.chapterId,
        topicId: topic.id,
        taskType: topicsScheduledCount % 4 === 0 ? 'flashcard_review' : 'revision',
        title:
          topicsScheduledCount % 4 === 0
            ? `Active Recall Flashcards: ${chapter?.title ?? topic.title}`
            : `Concept Consolidation Revision: ${chapter?.title ?? topic.title}`,
        description: `Consolidate key definitions, formulas, and common pitfalls covered in ${subject?.name ?? 'Subject'}.`,
        durationMinutes: Math.min(30, dailyStudyMinutes),
        priorityRank: rankCounter++,
        status: 'pending',
        isManuallyEdited: false,
      });
    }

    // Every 3 topics, schedule a practice quiz session
    if (topicsScheduledCount % 3 === 0) {
      unScheduledQueue.push({
        subjectId: topic.subjectId,
        chapterId: topic.chapterId,
        topicId: topic.id,
        taskType: 'practice_quiz',
        title: `Practice Quiz: ${chapter?.title ?? subject?.name ?? topic.title}`,
        description: `Timed objective & rubric short-answer checkpoint covering recent topics in ${subject?.name ?? 'Subject'}.`,
        durationMinutes: Math.min(40, dailyStudyMinutes),
        priorityRank: rankCounter++,
        status: 'pending',
        isManuallyEdited: false,
      });
    }
  }

  // 3. Ensure at least one practice quiz, one mock exam, and one final revision in the roadmap (FR-PLAN-004)
  const primarySubject = input.subjects[0];
  if (!unScheduledQueue.some((t) => t.taskType === 'practice_quiz')) {
    unScheduledQueue.push({
      subjectId: primarySubject?.id,
      taskType: 'practice_quiz',
      title: `Checkpoint Practice Quiz: ${primarySubject?.name ?? 'Selected Syllabus'}`,
      description: 'Verify topic accuracy and identify weak concepts before mock examination.',
      durationMinutes: Math.min(35, dailyStudyMinutes),
      priorityRank: rankCounter++,
      status: 'pending',
      isManuallyEdited: false,
    });
  }

  unScheduledQueue.push({
    subjectId: primarySubject?.id,
    taskType: 'mock_exam',
    title: `Full Syllabus Mock Examination (${input.subjects.map((s) => s.name).join(', ') || 'Target Exam'})`,
    description:
      'Simulated timed examination across selected subjects to benchmark speed and accuracy.',
    durationMinutes: Math.min(60, dailyStudyMinutes),
    priorityRank: rankCounter++,
    status: 'pending',
    isManuallyEdited: false,
  });

  unScheduledQueue.push({
    subjectId: primarySubject?.id,
    taskType: 'final_revision',
    title: 'Final Exam Readiness & Formula/Summary Review',
    description:
      'High-yield quick revision notes, formula sheet walkthrough, and mistake log review before examination day.',
    durationMinutes: Math.min(45, dailyStudyMinutes),
    priorityRank: rankCounter++,
    status: 'pending',
    isManuallyEdited: false,
  });

  // 4. Deterministic Date Allocation across available study dates
  const allocatedTasks = allocateTasksAcrossStudyDates(
    unScheduledQueue,
    availableDates,
    dailyStudyMinutes,
  );

  // 5. Build Weekly Milestones (FR-PLAN-004)
  const weeklyMilestones = buildWeeklyMilestones(allocatedTasks, subjectById);

  // 6. Compute Feasibility & Honest Weighting Report (FR-PLAN-011)
  const totalAvailableMinutes = availableDates.length * dailyStudyMinutes;
  const totalPlannedMinutes = allocatedTasks.reduce((sum, t) => sum + t.durationMinutes, 0);
  const utilizationPercent =
    totalAvailableMinutes > 0
      ? Math.round((totalPlannedMinutes / totalAvailableMinutes) * 100)
      : 100;
  const verifiedWeightTopicCount = orderedTopics.filter((t) => t.syllabusWeightVerified).length;
  const unverifiedWeightTopicCount = orderedTopics.length - verifiedWeightTopicCount;

  const isFeasible = totalPlannedMinutes <= totalAvailableMinutes;
  const feasibility: ScheduleFeasibilityReport = {
    isFeasible,
    availableStudyDaysCount: availableDates.length,
    totalAvailableMinutes,
    totalPlannedMinutes,
    utilizationPercent,
    verifiedWeightTopicCount,
    unverifiedWeightTopicCount,
    weightingPolicyNote:
      verifiedWeightTopicCount > 0 && unverifiedWeightTopicCount === 0
        ? 'All selected topics include verified curriculum priority weights (FR-PLAN-011).'
        : 'Official examination weightings are only applied where curriculum metadata is verified (FR-PLAN-011); unverified topics are ordered by prerequisites, difficulty, and your verified performance.',
    warningMessage: isFeasible
      ? undefined
      : `Planned workload (${totalPlannedMinutes} mins) exceeds available study capacity (${totalAvailableMinutes} mins across ${availableDates.length} study days). Increase daily study minutes or extend your target date for a lighter daily load.`,
  };

  return {
    tasks: allocatedTasks,
    weeklyMilestones,
    feasibility,
  };
}

/**
 * Allocates ordered tasks across `availableDates` without exceeding `dailyStudyMinutes` per day
 * while capacities permit. If tasks exceed total available capacity, overflow tasks are distributed
 * across the final study days so no syllabus topic is silently dropped.
 */
function allocateTasksAcrossStudyDates(
  queue: Array<Omit<PlannedStudyTaskDraft, 'scheduledDateKey' | 'scheduledDate'>>,
  availableDates: Date[],
  dailyStudyMinutes: number,
): PlannedStudyTaskDraft[] {
  const usedMinutesByDayIndex = new Array<number>(availableDates.length).fill(0);
  const allocated: PlannedStudyTaskDraft[] = [];
  let currentDayIdx = 0;

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i]!;

    // Reserve the final available date for `final_revision` when multiple dates exist
    if (item.taskType === 'final_revision' && availableDates.length > 1) {
      const lastIdx = availableDates.length - 1;
      const date = availableDates[lastIdx]!;
      usedMinutesByDayIndex[lastIdx] = (usedMinutesByDayIndex[lastIdx] ?? 0) + item.durationMinutes;
      allocated.push({
        ...item,
        scheduledDate: date,
        scheduledDateKey: toDateKey(date),
      });
      continue;
    }

    // Advance day pointer if adding this task exceeds dailyStudyMinutes (unless day is currently empty)
    while (
      currentDayIdx < availableDates.length - 1 &&
      (usedMinutesByDayIndex[currentDayIdx] ?? 0) > 0 &&
      (usedMinutesByDayIndex[currentDayIdx] ?? 0) + item.durationMinutes > dailyStudyMinutes
    ) {
      currentDayIdx += 1;
    }

    const chosenDate = availableDates[currentDayIdx] ?? availableDates[availableDates.length - 1]!;
    usedMinutesByDayIndex[currentDayIdx] =
      (usedMinutesByDayIndex[currentDayIdx] ?? 0) + item.durationMinutes;

    allocated.push({
      ...item,
      scheduledDate: chosenDate,
      scheduledDateKey: toDateKey(chosenDate),
    });
  }

  return allocated;
}

/**
 * Groups allocated tasks into 7-day weekly milestones starting from the first scheduled task date.
 */
export function buildWeeklyMilestones(
  tasks: Array<{
    subjectId?: string;
    scheduledDate: Date;
    scheduledDateKey: string;
    durationMinutes: number;
    title: string;
  }>,
  subjectById: Map<string, SubjectRecord>,
): WeeklyMilestoneItem[] {
  if (tasks.length === 0) return [];

  const sorted = [...tasks].sort(
    (a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime(),
  );
  const firstDate = normalizeToUtcMidnight(sorted[0]!.scheduledDate);
  const buckets = new Map<number, typeof sorted>();

  for (const task of sorted) {
    const taskMidnight = normalizeToUtcMidnight(task.scheduledDate);
    const diffDays = Math.max(
      0,
      Math.floor((taskMidnight.getTime() - firstDate.getTime()) / (24 * 60 * 60 * 1000)),
    );
    const weekNumber = Math.floor(diffDays / 7) + 1;
    const list = buckets.get(weekNumber) ?? [];
    list.push(task);
    buckets.set(weekNumber, list);
  }

  const milestones: WeeklyMilestoneItem[] = [];
  for (const [weekNumber, weekTasks] of Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])) {
    const startDateKey = weekTasks[0]!.scheduledDateKey;
    const endDateKey = weekTasks[weekTasks.length - 1]!.scheduledDateKey;
    const focusSubjectNames = Array.from(
      new Set(
        weekTasks
          .map((t) => (t.subjectId ? subjectById.get(t.subjectId)?.name : undefined))
          .filter((name): name is string => Boolean(name)),
      ),
    );
    const plannedMinutes = weekTasks.reduce((sum, t) => sum + t.durationMinutes, 0);

    milestones.push({
      weekNumber,
      startDateKey,
      endDateKey,
      title: `Week ${weekNumber}: ${
        focusSubjectNames.length > 0 ? focusSubjectNames.join(' & ') : 'Core Preparation & Revision'
      }`,
      focusSubjectNames,
      plannedMinutes,
      taskCount: weekTasks.length,
    });
  }

  return milestones;
}

/**
 * Reschedules overdue, skipped, or pending tasks across available study dates from `referenceDate`
 * through `targetDate`, boosting weak topics first while preserving completed tasks (`FR-PLAN-006`, `FR-PLAN-008`).
 */
export function rescheduleRemainingTasksDeterministically<
  T extends {
    id: string;
    subjectId?: string;
    topicId?: string;
    taskType: StudyTaskType;
    title: string;
    description?: string;
    scheduledDate: Date;
    scheduledDateKey: string;
    durationMinutes: number;
    priorityRank: number;
    status: StudyTaskStatus;
  },
>(params: {
  tasks: T[];
  referenceDate: Date;
  targetDate: Date;
  dailyStudyMinutes: number;
  availableDaysOfWeek: number[];
  weakTopicIds?: string[];
}): Array<{
  id: string;
  scheduledDate: Date;
  scheduledDateKey: string;
  priorityRank: number;
  status: StudyTaskStatus;
}> {
  const refMidnight = normalizeToUtcMidnight(params.referenceDate);
  const availableDates = enumerateAvailableStudyDates(
    refMidnight,
    params.targetDate,
    params.availableDaysOfWeek,
  );
  const weakSet = new Set(params.weakTopicIds ?? []);
  const dailyCap = Math.max(15, params.dailyStudyMinutes);

  // Tasks that are not completed get redistributed starting from referenceDate
  const toReschedule = params.tasks
    .filter((t) => t.status !== 'completed')
    .sort((a, b) => {
      const aWeak = a.topicId && weakSet.has(a.topicId) ? 1 : 0;
      const bWeak = b.topicId && weakSet.has(b.topicId) ? 1 : 0;
      if (bWeak !== aWeak) return bWeak - aWeak;
      const aOverdue = a.scheduledDate.getTime() < refMidnight.getTime() || a.status === 'skipped' ? 1 : 0;
      const bOverdue = b.scheduledDate.getTime() < refMidnight.getTime() || b.status === 'skipped' ? 1 : 0;
      if (bOverdue !== aOverdue) return bOverdue - aOverdue;
      return a.priorityRank - b.priorityRank;
    });

  const usedMinutesByDayIndex = new Array<number>(availableDates.length).fill(0);
  let dayIdx = 0;
  let rank = 1;

  return toReschedule.map((task) => {
    while (
      dayIdx < availableDates.length - 1 &&
      (usedMinutesByDayIndex[dayIdx] ?? 0) > 0 &&
      (usedMinutesByDayIndex[dayIdx] ?? 0) + task.durationMinutes > dailyCap
    ) {
      dayIdx += 1;
    }

    const chosenDate = availableDates[dayIdx] ?? availableDates[availableDates.length - 1]!;
    usedMinutesByDayIndex[dayIdx] = (usedMinutesByDayIndex[dayIdx] ?? 0) + task.durationMinutes;

    const wasMissedOrSkipped =
      task.status === 'skipped' || task.scheduledDate.getTime() < refMidnight.getTime();

    return {
      id: task.id,
      scheduledDate: chosenDate,
      scheduledDateKey: toDateKey(chosenDate),
      priorityRank: rank++,
      status: wasMissedOrSkipped ? 'rescheduled' : task.status,
    };
  });
}
