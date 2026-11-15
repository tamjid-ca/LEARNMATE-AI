/**
 * LearnMate AI — Personalized Study Planner & Adaptive Roadmap Service
 * Grounded in docs/PROJECT_SRS.md Section 4.8 (FR-PLAN-001 through FR-PLAN-011) and ADR-006:
 * - Combines deterministic date allocation (`scheduler-engine.ts`) with AI prioritization & study tips
 *   via `executeStructuredAITask({ taskType: 'planner' })`.
 * - Integrates verified student performance (`quizAttempts.weakTopicIds` and overdue `flashcards`)
 *   to prioritize weak topics and overdue spaced-repetition reviews (`FR-PLAN-009`, `FR-PLAN-010`).
 * - Never invents official examination weightings when `syllabusWeightVerified` is false (`FR-PLAN-011`).
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
import { structuredPlannerSuggestionSchema } from '../../lib/validators/ai.ts';
import {
  type CreateManualStudyTaskInput,
  createManualStudyTaskSchema,
  type CreateStudyPlanInput,
  createStudyPlanSchema,
  type UpdateStudyPlanInput,
  updateStudyPlanSchema,
  type UpdateStudyTaskInput,
  updateStudyTaskSchema,
} from '../../lib/validators/planner.ts';
import {
  type AIRepository,
  getActiveAIRepository,
} from '../ai/ai-repository.ts';
import { executeStructuredAITask } from '../ai/ai-service.ts';
import {
  type CurriculumRepository,
  getActiveCurriculumRepository,
} from '../curriculum/curriculum-repository.ts';
import type {
  ChapterRecord,
  SubjectRecord,
  TopicRecord,
} from '../curriculum/seed-data.ts';
import {
  type FlashcardRepository,
  getActiveFlashcardRepository,
} from '../flashcards/flashcard-repository.ts';
import {
  getActiveQuizRepository,
  type QuizRepository,
} from '../quizzes/quiz-repository.ts';
import {
  getDefaultStudyPlanRepository,
  type StudyPlanRecord,
  type StudyPlanRepository,
  type StudyTaskRecord,
} from './planner-repository.ts';
import {
  buildWeeklyMilestones,
  enumerateAvailableStudyDates,
  generateDeterministicRoadmap,
  normalizeToUtcMidnight,
  rescheduleRemainingTasksDeterministically,
  type ScheduleFeasibilityReport,
  toDateKey,
  type WeeklyMilestoneItem,
} from './scheduler-engine.ts';

export interface PlannerAIOptions {
  repository?: AIRepository;
  fetchImpl?: OpenRouterTransport;
}

export interface PlannerServiceOptions {
  plannerRepo?: StudyPlanRepository;
  curriculumRepo?: CurriculumRepository;
  quizRepo?: QuizRepository;
  flashcardRepo?: FlashcardRepository;
  aiOptions?: PlannerAIOptions;
}

export interface AdaptiveLearningSignals {
  weakTopicIds: string[];
  weakTopicTitles: string[];
  dueFlashcardCount: number;
  dueFlashcardTopicIds: string[];
  dueFlashcardTopicTitles: string[];
  verifiedWeightTopicCount: number;
  unverifiedWeightTopicCount: number;
  weightingDisclaimer: string;
}

export interface CalendarDateBucket {
  dateKey: string;
  totalMinutes: number;
  dailyCapacityMinutes: number;
  tasks: StudyTaskRecord[];
}

export interface StudyPlanDetailView {
  plan: StudyPlanRecord;
  tasks: StudyTaskRecord[];
  calendarByDate: CalendarDateBucket[];
  weeklyMilestones: WeeklyMilestoneItem[];
  feasibility: ScheduleFeasibilityReport;
  adaptiveSignals: AdaptiveLearningSignals;
  studyTips: string[];
}

function resolveDependencies(options?: PlannerServiceOptions) {
  return {
    plannerRepo: options?.plannerRepo ?? getDefaultStudyPlanRepository(),
    curriculumRepo: options?.curriculumRepo ?? getActiveCurriculumRepository(),
    quizRepo: options?.quizRepo ?? getActiveQuizRepository(),
    flashcardRepo: options?.flashcardRepo ?? getActiveFlashcardRepository(),
    aiRepo: options?.aiOptions?.repository ?? getActiveAIRepository(),
    aiTransport: options?.aiOptions?.fetchImpl ?? getOpenRouterTransport(),
  };
}

function calculateCompletionPercent(tasks: StudyTaskRecord[]): number {
  if (tasks.length === 0) return 0;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  return Math.round((completedCount / tasks.length) * 100);
}

async function loadSyllabusForSubjects(
  curriculumRepo: CurriculumRepository,
  subjectIds: string[],
): Promise<{
  subjects: SubjectRecord[];
  chapters: ChapterRecord[];
  topics: TopicRecord[];
}> {
  const uniqueIds = Array.from(new Set(subjectIds));
  const allSubjects = await curriculumRepo.listSubjects({ includeInactive: false });
  const selectedSubjects = allSubjects.filter((s) => uniqueIds.includes(s.id));

  if (selectedSubjects.length === 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      'At least one valid curriculum subject must be selected for the study plan.',
      400,
    );
  }

  const chaptersNested = await Promise.all(
    selectedSubjects.map((s) => curriculumRepo.listChapters(s.id, false)),
  );
  const chapters = chaptersNested.flat().sort((a, b) => a.order - b.order);

  const topicsNested = await Promise.all(
    selectedSubjects.map((s) =>
      curriculumRepo.listTopics({
        subjectId: s.id,
        includeInactive: false,
        page: 1,
        limit: 200,
      }),
    ),
  );
  const topics = topicsNested.flatMap((res) => res.items);

  return {
    subjects: selectedSubjects,
    chapters,
    topics,
  };
}

async function collectVerifiedStudentSignals(params: {
  userId: string;
  topics: TopicRecord[];
  quizRepo: QuizRepository;
  flashcardRepo: FlashcardRepository;
}): Promise<AdaptiveLearningSignals> {
  const topicById = new Map(params.topics.map((t) => [t.id, t]));
  const [attempts, cards] = await Promise.all([
    params.quizRepo.listAttemptsByUser(params.userId, 50),
    params.flashcardRepo.listCardsByUser(params.userId),
  ]);

  const submittedAttempts = attempts.filter((a) => a.status === 'submitted');
  const weakSet = new Set<string>();
  for (const attempt of submittedAttempts) {
    for (const weakTopicId of attempt.weakTopicIds) {
      if (topicById.has(weakTopicId)) {
        weakSet.add(weakTopicId);
      }
    }
  }

  const now = new Date();
  const dueCards = cards.filter(
    (c) => c.nextReviewAt.getTime() <= now.getTime() || c.masteryState === 'difficult',
  );
  const dueTopicSet = new Set<string>();
  for (const card of dueCards) {
    if (card.topicId && topicById.has(card.topicId)) {
      dueTopicSet.add(card.topicId);
    }
  }

  const weakTopicIds = Array.from(weakSet);
  const dueFlashcardTopicIds = Array.from(dueTopicSet);
  const verifiedWeightTopicCount = params.topics.filter((t) => t.syllabusWeightVerified).length;
  const unverifiedWeightTopicCount = params.topics.length - verifiedWeightTopicCount;

  return {
    weakTopicIds,
    weakTopicTitles: weakTopicIds
      .map((id) => topicById.get(id)?.title)
      .filter((t): t is string => Boolean(t)),
    dueFlashcardCount: dueCards.length,
    dueFlashcardTopicIds,
    dueFlashcardTopicTitles: dueFlashcardTopicIds
      .map((id) => topicById.get(id)?.title)
      .filter((t): t is string => Boolean(t)),
    verifiedWeightTopicCount,
    unverifiedWeightTopicCount,
    weightingDisclaimer:
      'Official examination weightings are never fabricated (FR-PLAN-011). Only topics with verified curriculum weight metadata use syllabus priority scores; all other topics are prioritized deterministically by prerequisites, difficulty, and your verified quiz/flashcard history.',
  };
}

function buildCalendarBuckets(
  tasks: StudyTaskRecord[],
  dailyCapacityMinutes: number,
): CalendarDateBucket[] {
  const map = new Map<string, StudyTaskRecord[]>();
  for (const task of tasks) {
    const key = task.scheduledDateKey || toDateKey(task.scheduledDate);
    const list = map.get(key) ?? [];
    list.push(task);
    map.set(key, list);
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dateKey, dayTasks]) => ({
      dateKey,
      totalMinutes: dayTasks.reduce((sum, t) => sum + t.durationMinutes, 0),
      dailyCapacityMinutes,
      tasks: dayTasks.sort((a, b) => a.priorityRank - b.priorityRank),
    }));
}

function computeFeasibilityForTasks(params: {
  plan: StudyPlanRecord;
  tasks: StudyTaskRecord[];
  topics: TopicRecord[];
}): ScheduleFeasibilityReport {
  const availableDates = enumerateAvailableStudyDates(
    params.plan.startDate,
    params.plan.targetDate,
    params.plan.availableDaysOfWeek,
  );
  const totalAvailableMinutes = availableDates.length * params.plan.dailyStudyMinutes;
  const pendingOrAllMinutes = params.tasks.reduce((sum, t) => sum + t.durationMinutes, 0);
  const utilizationPercent =
    totalAvailableMinutes > 0
      ? Math.round((pendingOrAllMinutes / totalAvailableMinutes) * 100)
      : 100;
  const verifiedWeightTopicCount = params.topics.filter((t) => t.syllabusWeightVerified).length;
  const unverifiedWeightTopicCount = params.topics.length - verifiedWeightTopicCount;
  const isFeasible = pendingOrAllMinutes <= totalAvailableMinutes;

  return {
    isFeasible,
    availableStudyDaysCount: availableDates.length,
    totalAvailableMinutes,
    totalPlannedMinutes: pendingOrAllMinutes,
    utilizationPercent,
    verifiedWeightTopicCount,
    unverifiedWeightTopicCount,
    weightingPolicyNote:
      'Official examination weightings are only applied where curriculum metadata is verified (FR-PLAN-011); unverified topics are ordered by prerequisites, difficulty, and your verified performance.',
    warningMessage: isFeasible
      ? undefined
      : `Planned workload (${pendingOrAllMinutes} mins) exceeds available study capacity (${totalAvailableMinutes} mins across ${availableDates.length} study days). Increase daily study minutes or extend your target date.`,
  };
}

/**
 * Lists all study plans belonging to the authenticated student.
 */
export async function listStudyPlansForStudent(
  actor: AuthenticatedActor | null,
  options?: PlannerServiceOptions,
): Promise<{
  plans: StudyPlanRecord[];
  activePlanDetail: StudyPlanDetailView | null;
}> {
  const authed = requireAuth(actor);
  const { plannerRepo } = resolveDependencies(options);
  const plans = await plannerRepo.listPlansByUser(authed.userId);
  const activePlan = plans.find((p) => p.status === 'active') ?? plans[0] ?? null;

  if (!activePlan) {
    return { plans: [], activePlanDetail: null };
  }

  const activePlanDetail = await getStudyPlanDetailForStudent(authed, activePlan.id, options);
  return { plans, activePlanDetail };
}

/**
 * Retrieves a single study plan with all scheduled tasks, calendar buckets, weekly milestones,
 * feasibility telemetry, and verified adaptive learning signals.
 */
export async function getStudyPlanDetailForStudent(
  actor: AuthenticatedActor | null,
  planId: string,
  options?: PlannerServiceOptions,
): Promise<StudyPlanDetailView> {
  const authed = requireAuth(actor);
  const { plannerRepo, curriculumRepo, quizRepo, flashcardRepo } = resolveDependencies(options);

  const plan = await plannerRepo.findPlanById(planId);
  if (!plan) {
    throw new AppError('NOT_FOUND', 'Study plan not found.', 404);
  }
  assertResourceOwnership(authed, plan.userId);

  const [tasks, syllabus] = await Promise.all([
    plannerRepo.listTasksByPlan(plan.id, authed.userId),
    loadSyllabusForSubjects(curriculumRepo, plan.subjectIds).catch(() => ({
      subjects: [] as SubjectRecord[],
      chapters: [] as ChapterRecord[],
      topics: [] as TopicRecord[],
    })),
  ]);

  const adaptiveSignals = await collectVerifiedStudentSignals({
    userId: authed.userId,
    topics: syllabus.topics,
    quizRepo,
    flashcardRepo,
  });

  const feasibility = computeFeasibilityForTasks({
    plan,
    tasks,
    topics: syllabus.topics,
  });

  const subjectById = new Map(syllabus.subjects.map((s) => [s.id, s]));
  const weeklyMilestones =
    plan.weeklyMilestones.length > 0
      ? plan.weeklyMilestones
      : buildWeeklyMilestones(tasks, subjectById);

  return {
    plan,
    tasks,
    calendarByDate: buildCalendarBuckets(tasks, plan.dailyStudyMinutes),
    weeklyMilestones,
    feasibility,
    adaptiveSignals,
    studyTips: [
      adaptiveSignals.weakTopicTitles.length > 0
        ? `Focus early sessions on verified weak topics: ${adaptiveSignals.weakTopicTitles.join(', ')}.`
        : 'Complete a practice quiz after every 2–3 topics to calibrate topic mastery.',
      adaptiveSignals.dueFlashcardCount > 0
        ? `Clear ${adaptiveSignals.dueFlashcardCount} due/difficult flashcards before starting new chapters.`
        : 'Use spaced repetition reviews every 48–72 hours to lock in formulas and definitions.',
      'Reserve your final scheduled study day for high-yield summary notes and mock exam mistake review.',
    ],
  };
}

/**
 * Creates a new personalized preparation plan and deterministically schedules syllabus tasks (`FR-PLAN-001..004`).
 */
export async function createStudyPlanForStudent(
  actor: AuthenticatedActor | null,
  rawInput: unknown,
  options?: PlannerServiceOptions,
): Promise<StudyPlanDetailView> {
  const authed = requireAuth(actor);
  const input: CreateStudyPlanInput = createStudyPlanSchema.parse(rawInput);
  const { plannerRepo, curriculumRepo, quizRepo, flashcardRepo, aiRepo, aiTransport } =
    resolveDependencies(options);

  const startDate = normalizeToUtcMidnight(input.startDate ?? new Date());
  const targetDate = normalizeToUtcMidnight(input.targetDate);
  if (targetDate.getTime() < startDate.getTime()) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Target examination date must be on or after the study plan start date.',
      400,
    );
  }

  const syllabus = await loadSyllabusForSubjects(curriculumRepo, input.subjectIds);
  const adaptiveSignals = await collectVerifiedStudentSignals({
    userId: authed.userId,
    topics: syllabus.topics,
    quizRepo,
    flashcardRepo,
  });

  // Request AI advisor summary & topic priority suggestions (bounded, never sole source of scheduling)
  let aiSummary =
    input.language === 'bn'
      ? `${syllabus.subjects.map((s) => s.nameBn || s.name).join(', ')}-এর জন্য নির্ধারিত অধ্যয়ন পরিকল্পনা প্রস্তুত করা হয়েছে।`
      : `Structured preparation roadmap generated for ${syllabus.subjects.map((s) => s.name).join(', ')} with deterministic daily time allocation.`;
  let aiPriorityTopicCodes: string[] = [];
  let studyTips: string[] = [
    'Start each study block with a 10-minute active recall warm-up on due flashcards.',
    'Complete chapter checkpoint quizzes before advancing to dependent topics.',
  ];

  try {
    const curriculumContext = syllabus.topics
      .map(
        (t) =>
          `${t.code}: ${t.title} (difficulty=${t.difficulty}, mins=${t.estimatedMinutes}, weightVerified=${t.syllabusWeightVerified})`,
      )
      .join('; ');
    const userPrompt = `Daily Study Minutes: ${input.dailyStudyMinutes}, Target Date: ${toDateKey(targetDate)}, Weak Topics: ${adaptiveSignals.weakTopicTitles.join(', ') || 'None yet'}, Due Flashcards: ${adaptiveSignals.dueFlashcardCount}`;

    const aiResult = await executeStructuredAITask(
      {
        userId: authed.userId,
        taskType: 'planner',
        schema: structuredPlannerSuggestionSchema,
        variables: {
          curriculumContext,
          userPrompt,
          language: input.language,
        },
      },
      aiRepo,
      aiTransport,
    );
    aiSummary = aiResult.data.aiSummary;
    aiPriorityTopicCodes = aiResult.data.priorityTopicCodes ?? [];
    studyTips = aiResult.data.studyTips;
  } catch {
    // Graceful deterministic fallback if AI quota or network is unavailable
  }

  const roadmap = generateDeterministicRoadmap({
    startDate,
    targetDate,
    dailyStudyMinutes: input.dailyStudyMinutes,
    availableDaysOfWeek: input.availableDaysOfWeek,
    subjects: syllabus.subjects,
    chapters: syllabus.chapters,
    topics: syllabus.topics,
    proficiencyBySubject: input.proficiencyBySubject,
    weakTopicIds: adaptiveSignals.weakTopicIds,
    dueFlashcardTopicIds: adaptiveSignals.dueFlashcardTopicIds,
    aiPriorityTopicCodes,
  });

  const createdPlan = await plannerRepo.createPlan({
    userId: authed.userId,
    title: input.title,
    targetExaminationId: input.targetExaminationId,
    targetDate,
    startDate,
    subjectIds: syllabus.subjects.map((s) => s.id),
    dailyStudyMinutes: input.dailyStudyMinutes,
    availableDaysOfWeek: Array.from(new Set(input.availableDaysOfWeek)).sort((a, b) => a - b),
    proficiencyBySubject: input.proficiencyBySubject,
    weeklyMilestones: roadmap.weeklyMilestones,
    aiSummary,
    status: 'active',
    completionPercent: 0,
  });

  const createdTasks = await plannerRepo.createTasksBulk(
    roadmap.tasks.map((draft) => ({
      ...draft,
      studyPlanId: createdPlan.id,
      userId: authed.userId,
    })),
  );

  return {
    plan: createdPlan,
    tasks: createdTasks,
    calendarByDate: buildCalendarBuckets(createdTasks, createdPlan.dailyStudyMinutes),
    weeklyMilestones: roadmap.weeklyMilestones,
    feasibility: roadmap.feasibility,
    adaptiveSignals,
    studyTips,
  };
}

/**
 * Updates study plan configuration, recalculates the schedule when targetDate/availability changes (`FR-PLAN-008`),
 * or reschedules missed/skipped tasks (`FR-PLAN-006`).
 */
export async function updateOrRecalculateStudyPlanForStudent(
  actor: AuthenticatedActor | null,
  planId: string,
  rawInput: unknown,
  options?: PlannerServiceOptions,
): Promise<StudyPlanDetailView> {
  const authed = requireAuth(actor);
  const input: UpdateStudyPlanInput = updateStudyPlanSchema.parse(rawInput);
  const { plannerRepo, curriculumRepo, quizRepo, flashcardRepo } = resolveDependencies(options);

  const existingPlan = await plannerRepo.findPlanById(planId);
  if (!existingPlan) {
    throw new AppError('NOT_FOUND', 'Study plan not found.', 404);
  }
  assertResourceOwnership(authed, existingPlan.userId);

  const updatedTargetDate = input.targetDate
    ? normalizeToUtcMidnight(input.targetDate)
    : existingPlan.targetDate;
  const updatedDailyMinutes = input.dailyStudyMinutes ?? existingPlan.dailyStudyMinutes;
  const updatedAvailableDays = input.availableDaysOfWeek
    ? Array.from(new Set(input.availableDaysOfWeek)).sort((a, b) => a - b)
    : existingPlan.availableDaysOfWeek;
  const updatedSubjectIds = input.subjectIds ?? existingPlan.subjectIds;
  const updatedProficiency = input.proficiencyBySubject ?? existingPlan.proficiencyBySubject;

  const syllabus = await loadSyllabusForSubjects(curriculumRepo, updatedSubjectIds);
  const adaptiveSignals = await collectVerifiedStudentSignals({
    userId: authed.userId,
    topics: syllabus.topics,
    quizRepo,
    flashcardRepo,
  });

  const existingTasks = await plannerRepo.listTasksByPlan(existingPlan.id, authed.userId);
  const subjectById = new Map(syllabus.subjects.map((s) => [s.id, s]));

  if (input.action === 'reschedule_missed') {
    const referenceDate = normalizeToUtcMidnight(input.referenceDate ?? new Date());
    const effectiveTarget =
      updatedTargetDate.getTime() >= referenceDate.getTime() ? updatedTargetDate : referenceDate;

    const updates = rescheduleRemainingTasksDeterministically({
      tasks: existingTasks,
      referenceDate,
      targetDate: effectiveTarget,
      dailyStudyMinutes: updatedDailyMinutes,
      availableDaysOfWeek: updatedAvailableDays,
      weakTopicIds: adaptiveSignals.weakTopicIds,
    });

    await Promise.all(
      updates.map((u) =>
        plannerRepo.updateTask(u.id, authed.userId, {
          scheduledDate: u.scheduledDate,
          scheduledDateKey: u.scheduledDateKey,
          priorityRank: u.priorityRank,
          status: u.status,
        }),
      ),
    );

    const refreshedTasks = await plannerRepo.listTasksByPlan(existingPlan.id, authed.userId);
    const milestones = buildWeeklyMilestones(refreshedTasks, subjectById);
    const completionPercent = calculateCompletionPercent(refreshedTasks);

    await plannerRepo.updatePlan(existingPlan.id, authed.userId, {
      title: input.title ?? existingPlan.title,
      targetDate: effectiveTarget,
      dailyStudyMinutes: updatedDailyMinutes,
      availableDaysOfWeek: updatedAvailableDays,
      weeklyMilestones: milestones,
      completionPercent,
      status: input.status ?? existingPlan.status,
    });

    return getStudyPlanDetailForStudent(authed, existingPlan.id, options);
  }

  const scheduleAffectingChange =
    input.action === 'recalculate' ||
    input.targetDate !== undefined ||
    input.dailyStudyMinutes !== undefined ||
    input.availableDaysOfWeek !== undefined ||
    input.subjectIds !== undefined ||
    input.proficiencyBySubject !== undefined;

  if (scheduleAffectingChange) {
    // Preserve completed tasks and regenerate remaining tasks deterministically (FR-PLAN-008)
    const completedTasks = existingTasks.filter((t) => t.status === 'completed');
    const completedTopicIds = completedTasks
      .map((t) => t.topicId)
      .filter((id): id is string => Boolean(id));

    const recalcStart = normalizeToUtcMidnight(
      input.referenceDate ??
        (existingPlan.startDate.getTime() > Date.now() ? existingPlan.startDate : new Date()),
    );
    const effectiveTarget =
      updatedTargetDate.getTime() >= recalcStart.getTime() ? updatedTargetDate : recalcStart;

    await plannerRepo.deleteNonCompletedTasksByPlan(existingPlan.id, authed.userId);

    const roadmap = generateDeterministicRoadmap({
      startDate: recalcStart,
      targetDate: effectiveTarget,
      dailyStudyMinutes: updatedDailyMinutes,
      availableDaysOfWeek: updatedAvailableDays,
      subjects: syllabus.subjects,
      chapters: syllabus.chapters,
      topics: syllabus.topics,
      proficiencyBySubject: updatedProficiency,
      weakTopicIds: adaptiveSignals.weakTopicIds,
      dueFlashcardTopicIds: adaptiveSignals.dueFlashcardTopicIds,
      completedTopicIds,
    });

    await plannerRepo.createTasksBulk(
      roadmap.tasks.map((draft) => ({
        ...draft,
        studyPlanId: existingPlan.id,
        userId: authed.userId,
      })),
    );

    const allTasksNow = await plannerRepo.listTasksByPlan(existingPlan.id, authed.userId);
    const milestones = buildWeeklyMilestones(allTasksNow, subjectById);
    const completionPercent = calculateCompletionPercent(allTasksNow);

    await plannerRepo.updatePlan(existingPlan.id, authed.userId, {
      title: input.title ?? existingPlan.title,
      targetExaminationId: input.targetExaminationId ?? existingPlan.targetExaminationId,
      targetDate: effectiveTarget,
      subjectIds: syllabus.subjects.map((s) => s.id),
      dailyStudyMinutes: updatedDailyMinutes,
      availableDaysOfWeek: updatedAvailableDays,
      proficiencyBySubject: updatedProficiency,
      weeklyMilestones: milestones,
      completionPercent,
      status: input.status ?? existingPlan.status,
    });

    return getStudyPlanDetailForStudent(authed, existingPlan.id, options);
  }

  await plannerRepo.updatePlan(existingPlan.id, authed.userId, {
    title: input.title ?? existingPlan.title,
    targetExaminationId: input.targetExaminationId ?? existingPlan.targetExaminationId,
    status: input.status ?? existingPlan.status,
  });

  return getStudyPlanDetailForStudent(authed, existingPlan.id, options);
}

/**
 * Adds a manual study task to an existing study plan (`FR-PLAN-007`).
 */
export async function createManualStudyTaskForStudent(
  actor: AuthenticatedActor | null,
  planId: string,
  rawInput: unknown,
  options?: PlannerServiceOptions,
): Promise<{ task: StudyTaskRecord; planCompletionPercent: number }> {
  const authed = requireAuth(actor);
  const input: CreateManualStudyTaskInput = createManualStudyTaskSchema.parse(rawInput);
  const { plannerRepo } = resolveDependencies(options);

  const plan = await plannerRepo.findPlanById(planId);
  if (!plan) {
    throw new AppError('NOT_FOUND', 'Study plan not found.', 404);
  }
  assertResourceOwnership(authed, plan.userId);

  const scheduledDate = normalizeToUtcMidnight(input.scheduledDate);
  const task = await plannerRepo.createTask({
    studyPlanId: plan.id,
    userId: authed.userId,
    subjectId: input.subjectId ?? plan.subjectIds[0],
    chapterId: input.chapterId,
    topicId: input.topicId,
    taskType: input.taskType,
    title: input.title,
    description: input.description ?? 'Custom study session added manually by student.',
    scheduledDate,
    scheduledDateKey: toDateKey(scheduledDate),
    durationMinutes: input.durationMinutes,
    priorityRank: input.priorityRank,
    status: 'pending',
    isManuallyEdited: true,
  });

  const allTasks = await plannerRepo.listTasksByPlan(plan.id, authed.userId);
  const completionPercent = calculateCompletionPercent(allTasks);
  await plannerRepo.updatePlan(plan.id, authed.userId, { completionPercent });

  return { task, planCompletionPercent: completionPercent };
}

/**
 * Updates a study task's status (`completed`, `skipped`, `rescheduled`, `pending`) or manual fields (`FR-PLAN-006`, `FR-PLAN-007`).
 */
export async function updateStudyTaskForStudent(
  actor: AuthenticatedActor | null,
  taskId: string,
  rawInput: unknown,
  options?: PlannerServiceOptions,
): Promise<{ task: StudyTaskRecord; planCompletionPercent: number }> {
  const authed = requireAuth(actor);
  const input: UpdateStudyTaskInput = updateStudyTaskSchema.parse(rawInput);
  const { plannerRepo } = resolveDependencies(options);

  const existing = await plannerRepo.findTaskById(taskId);
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Study task not found.', 404);
  }
  assertResourceOwnership(authed, existing.userId);

  const manualFieldChanged =
    input.title !== undefined ||
    input.description !== undefined ||
    input.taskType !== undefined ||
    input.scheduledDate !== undefined ||
    input.durationMinutes !== undefined ||
    input.priorityRank !== undefined;

  const nextScheduledDate = input.scheduledDate
    ? normalizeToUtcMidnight(input.scheduledDate)
    : existing.scheduledDate;

  let nextStatus = input.status ?? existing.status;
  if (
    input.scheduledDate &&
    toDateKey(nextScheduledDate) !== existing.scheduledDateKey &&
    input.status === undefined &&
    existing.status !== 'completed'
  ) {
    nextStatus = 'rescheduled';
  }

  const completedAt =
    nextStatus === 'completed'
      ? (existing.completedAt ?? new Date())
      : undefined;

  const updated = await plannerRepo.updateTask(existing.id, authed.userId, {
    title: input.title ?? existing.title,
    description: input.description ?? existing.description,
    taskType: input.taskType ?? existing.taskType,
    scheduledDate: nextScheduledDate,
    scheduledDateKey: toDateKey(nextScheduledDate),
    durationMinutes: input.durationMinutes ?? existing.durationMinutes,
    priorityRank: input.priorityRank ?? existing.priorityRank,
    status: nextStatus,
    completedAt,
    isManuallyEdited: existing.isManuallyEdited || manualFieldChanged,
  });

  if (!updated) {
    throw new AppError('NOT_FOUND', 'Unable to update study task.', 404);
  }

  const allTasks = await plannerRepo.listTasksByPlan(existing.studyPlanId, authed.userId);
  const completionPercent = calculateCompletionPercent(allTasks);
  await plannerRepo.updatePlan(existing.studyPlanId, authed.userId, {
    completionPercent,
    status: completionPercent === 100 && allTasks.length > 0 ? 'completed' : 'active',
  });

  return {
    task: updated,
    planCompletionPercent: completionPercent,
  };
}

/**
 * Deletes a single study task and updates the parent plan's completion percentage.
 */
export async function deleteStudyTaskForStudent(
  actor: AuthenticatedActor | null,
  taskId: string,
  options?: PlannerServiceOptions,
): Promise<{ deleted: boolean; planCompletionPercent: number }> {
  const authed = requireAuth(actor);
  const { plannerRepo } = resolveDependencies(options);

  const existing = await plannerRepo.findTaskById(taskId);
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Study task not found.', 404);
  }
  assertResourceOwnership(authed, existing.userId);

  const deleted = await plannerRepo.deleteTask(existing.id, authed.userId);
  const allTasks = await plannerRepo.listTasksByPlan(existing.studyPlanId, authed.userId);
  const completionPercent = calculateCompletionPercent(allTasks);
  await plannerRepo.updatePlan(existing.studyPlanId, authed.userId, { completionPercent });

  return { deleted, planCompletionPercent: completionPercent };
}

/**
 * Deletes a study plan and all its scheduled tasks (`studyPlans` + `studyTasks`).
 */
export async function deleteStudyPlanForStudent(
  actor: AuthenticatedActor | null,
  planId: string,
  options?: PlannerServiceOptions,
): Promise<{ deleted: boolean; planId: string }> {
  const authed = requireAuth(actor);
  const { plannerRepo } = resolveDependencies(options);

  const existing = await plannerRepo.findPlanById(planId);
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Study plan not found.', 404);
  }
  assertResourceOwnership(authed, existing.userId);

  const deleted = await plannerRepo.deletePlanAndTasks(existing.id, authed.userId);
  return { deleted, planId: existing.id };
}
