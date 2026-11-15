import { beforeEach, describe, expect, it } from 'vitest';
import type {
  OpenRouterCompletionRequest,
  OpenRouterCompletionResponse,
} from '../src/lib/ai/openrouter-client.ts';
import {
  InMemoryAIRepository,
  setActiveAIRepository,
} from '../src/modules/ai/ai-repository.ts';
import {
  InMemoryCurriculumRepository,
  setActiveCurriculumRepository,
} from '../src/modules/curriculum/curriculum-repository.ts';
import { SEED_IDS } from '../src/modules/curriculum/seed-data.ts';
import {
  InMemoryFlashcardRepository,
  setActiveFlashcardRepository,
} from '../src/modules/flashcards/flashcard-repository.ts';
import { InMemoryStudyPlanRepository } from '../src/modules/planner/planner-repository.ts';
import {
  createManualStudyTaskForStudent,
  createStudyPlanForStudent,
  deleteStudyPlanForStudent,
  getStudyPlanDetailForStudent,
  listStudyPlansForStudent,
  updateOrRecalculateStudyPlanForStudent,
  updateStudyTaskForStudent,
} from '../src/modules/planner/planner-service.ts';
import {
  enumerateAvailableStudyDates,
  generateDeterministicRoadmap,
  prioritizeTopicsDeterministically,
} from '../src/modules/planner/scheduler-engine.ts';
import {
  InMemoryQuizRepository,
  setActiveQuizRepository,
} from '../src/modules/quizzes/quiz-repository.ts';

describe('State 10 — Personalized Study Planner & Preparation Roadmap Gate', () => {
  let plannerRepo: InMemoryStudyPlanRepository;
  let curriculumRepo: InMemoryCurriculumRepository;
  let quizRepo: InMemoryQuizRepository;
  let flashcardRepo: InMemoryFlashcardRepository;
  let aiRepo: InMemoryAIRepository;

  const studentA = {
    userId: '66f000000000000000000c01',
    email: 'student.planner.a@example.com',
    role: 'student' as const,
  };

  const studentB = {
    userId: '66f000000000000000000c02',
    email: 'student.planner.b@example.com',
    role: 'student' as const,
  };

  const mockPlannerFetch = async (
    req: OpenRouterCompletionRequest,
  ): Promise<OpenRouterCompletionResponse> => ({
    modelId: req.model,
    content: JSON.stringify({
      aiSummary:
        'Focus on Newtonian mechanics foundations first, then consolidate thermodynamics with regular active recall checkpoints.',
      priorityTopicCodes: ['PHY-MECH-101', 'PHY-THERM-201'],
      studyTips: [
        'Solve 5 numerical problems immediately after reviewing Newtons Laws.',
        'Review formula flashcards before attempting timed chapter quizzes.',
      ],
    }),
    promptTokens: 120,
    completionTokens: 85,
    totalTokens: 205,
  });

  beforeEach(() => {
    plannerRepo = new InMemoryStudyPlanRepository();
    curriculumRepo = new InMemoryCurriculumRepository();
    quizRepo = new InMemoryQuizRepository();
    flashcardRepo = new InMemoryFlashcardRepository();
    aiRepo = new InMemoryAIRepository();

    setActiveCurriculumRepository(curriculumRepo);
    setActiveQuizRepository(quizRepo);
    setActiveFlashcardRepository(flashcardRepo);
    setActiveAIRepository(aiRepo);
  });

  it('allocates available study dates deterministically, respects prerequisites, and never invents official exam weightings (FR-PLAN-003..004, FR-PLAN-011)', async () => {
    const startDate = new Date('2026-04-06T00:00:00.000Z'); // Monday
    const targetDate = new Date('2026-04-19T00:00:00.000Z'); // 2 weeks

    // Mon (1), Wed (3), Fri (5) -> 6 study days across 2 weeks
    const studyDates = enumerateAvailableStudyDates(startDate, targetDate, [1, 3, 5]);
    expect(studyDates).toHaveLength(6);
    expect(studyDates.every((d) => [1, 3, 5].includes(d.getUTCDay()))).toBe(true);

    const physicsSubjects = (await curriculumRepo.listSubjects()).filter(
      (s) => s.id === SEED_IDS.subjects.hscPhysics,
    );
    const physicsChapters = await curriculumRepo.listChapters(SEED_IDS.subjects.hscPhysics);
    const physicsTopics = (
      await curriculumRepo.listTopics({
        subjectId: SEED_IDS.subjects.hscPhysics,
        page: 1,
        limit: 50,
      })
    ).items;

    // Verify FR-PLAN-011: unverified syllabusPriorityScore is ignored while verified weight is respected
    const unverifiedHighScore = {
      ...physicsTopics[0]!,
      id: 'topic-unverified',
      code: 'UNVERIFIED-01',
      prerequisiteTopicIds: [],
      syllabusWeightVerified: false,
      syllabusPriorityScore: 999,
      difficulty: 'easy' as const,
      order: 10,
    };
    const verifiedScoreTopic = {
      ...physicsTopics[0]!,
      id: 'topic-verified',
      code: 'VERIFIED-01',
      prerequisiteTopicIds: [],
      syllabusWeightVerified: true,
      syllabusPriorityScore: 20,
      difficulty: 'easy' as const,
      order: 20,
    };

    const prioritized = prioritizeTopicsDeterministically({
      topics: [unverifiedHighScore, verifiedScoreTopic],
    });
    expect(prioritized[0]?.id).toBe('topic-verified');

    const roadmap = generateDeterministicRoadmap({
      startDate,
      targetDate,
      dailyStudyMinutes: 120,
      availableDaysOfWeek: [1, 3, 5],
      subjects: physicsSubjects,
      chapters: physicsChapters,
      topics: physicsTopics,
    });

    expect(roadmap.tasks.length).toBeGreaterThanOrEqual(physicsTopics.length + 2);
    expect(roadmap.tasks.some((t) => t.taskType === 'learn_topic')).toBe(true);
    expect(roadmap.tasks.some((t) => t.taskType === 'mock_exam')).toBe(true);
    expect(roadmap.tasks.some((t) => t.taskType === 'final_revision')).toBe(true);
    expect(roadmap.weeklyMilestones.length).toBeGreaterThanOrEqual(1);
    expect(roadmap.feasibility.weightingPolicyNote).toContain('FR-PLAN-011');
  });

  it('creates an adaptive study plan prioritizing verified weak topics from quizzes and overdue flashcards (FR-PLAN-001..005, FR-PLAN-009..010)', async () => {
    // 1. Seed a submitted quiz attempt flagging lawsOfThermodynamics as a weak topic
    const quiz = await quizRepo.createQuiz({
      userId: studentA.userId,
      title: 'Thermodynamics Diagnostic Quiz',
      mode: 'practice',
      subjectId: SEED_IDS.subjects.hscPhysics,
      topicIds: [SEED_IDS.topics.lawsOfThermodynamics],
      difficulty: 'medium',
      questionTypes: ['single_mcq'],
      questionCount: 1,
      negativeMarkingFactor: 0,
      feedbackTiming: 'after_submission',
      language: 'en',
    });

    await quizRepo.createAttempt({
      quizId: quiz.id,
      userId: studentA.userId,
      status: 'submitted',
      startedAt: new Date('2026-04-01T10:00:00.000Z'),
      submittedAt: new Date('2026-04-01T10:10:00.000Z'),
      durationSeconds: 600,
      responses: [],
      totalPointsPossible: 1,
      scoreEarned: 0,
      accuracyPercent: 0,
      weakTopicIds: [SEED_IDS.topics.lawsOfThermodynamics],
      recommendedTopicIds: [SEED_IDS.topics.lawsOfThermodynamics],
    });

    // 2. Seed an overdue flashcard for conservationOfMomentum
    const deck = await flashcardRepo.createDeck({
      userId: studentA.userId,
      title: 'Mechanics Deck',
      subjectId: SEED_IDS.subjects.hscPhysics,
      topicId: SEED_IDS.topics.conservationOfMomentum,
      cardCount: 1,
      language: 'en',
    });

    await flashcardRepo.createCardsBulk([
      {
        deckId: deck.id,
        userId: studentA.userId,
        topicId: SEED_IDS.topics.conservationOfMomentum,
        front: 'State law of conservation of linear momentum.',
        back: 'Total momentum of an isolated system remains constant.',
        easeFactor: 2.3,
        intervalDays: 1,
        repetitions: 1,
        nextReviewAt: new Date('2026-01-01T00:00:00.000Z'), // Overdue
        masteryState: 'difficult',
      },
    ]);

    const serviceOptions = {
      plannerRepo,
      curriculumRepo,
      quizRepo,
      flashcardRepo,
      aiOptions: { repository: aiRepo, fetchImpl: mockPlannerFetch },
    };

    const detail = await createStudyPlanForStudent(
      studentA,
      {
        title: 'HSC Physics Intensive Plan',
        targetExaminationId: SEED_IDS.examinations.hsc2027,
        startDate: '2026-04-06',
        targetDate: '2026-04-27',
        subjectIds: [SEED_IDS.subjects.hscPhysics],
        dailyStudyMinutes: 120,
        availableDaysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        proficiencyBySubject: {
          [SEED_IDS.subjects.hscPhysics]: 'beginner',
        },
        language: 'en',
      },
      serviceOptions,
    );

    expect(detail.plan.title).toBe('HSC Physics Intensive Plan');
    expect(detail.adaptiveSignals.weakTopicIds).toContain(
      SEED_IDS.topics.lawsOfThermodynamics,
    );
    expect(detail.adaptiveSignals.dueFlashcardCount).toBe(1);
    expect(detail.adaptiveSignals.dueFlashcardTopicIds).toContain(
      SEED_IDS.topics.conservationOfMomentum,
    );

    // First scheduled task should be the overdue flashcard review
    expect(detail.tasks[0]?.taskType).toBe('flashcard_review');
    expect(detail.tasks[0]?.title).toContain('Overdue Flashcard Review');

    // Weak topic is scheduled as Priority Remediation
    const weakTask = detail.tasks.find(
      (t) =>
        t.topicId === SEED_IDS.topics.lawsOfThermodynamics &&
        t.title.includes('Priority Remediation'),
    );
    expect(weakTask).toBeDefined();
    expect(detail.calendarByDate.length).toBeGreaterThan(0);
    expect(detail.weeklyMilestones.length).toBeGreaterThan(0);
  });

  it('supports task completion, manual editing, rescheduling missed tasks, schedule recalculation, and user isolation (FR-PLAN-006..008)', async () => {
    const serviceOptions = {
      plannerRepo,
      curriculumRepo,
      quizRepo,
      flashcardRepo,
      aiOptions: { repository: aiRepo, fetchImpl: mockPlannerFetch },
    };

    const created = await createStudyPlanForStudent(
      studentA,
      {
        title: 'HSC Higher Math & Physics Plan',
        startDate: '2026-05-01',
        targetDate: '2026-05-15',
        subjectIds: [SEED_IDS.subjects.hscHigherMath],
        dailyStudyMinutes: 90,
        availableDaysOfWeek: [1, 2, 3, 4, 5],
      },
      serviceOptions,
    );

    const firstTask = created.tasks[0]!;
    const secondTask = created.tasks[1]!;

    // 1. Mark first task as completed (FR-PLAN-006)
    const completedRes = await updateStudyTaskForStudent(
      studentA,
      firstTask.id,
      { status: 'completed' },
      serviceOptions,
    );
    expect(completedRes.task.status).toBe('completed');
    expect(completedRes.task.completedAt).toBeDefined();
    expect(completedRes.planCompletionPercent).toBeGreaterThan(0);

    // 2. Manually edit second task (FR-PLAN-007)
    const editedRes = await updateStudyTaskForStudent(
      studentA,
      secondTask.id,
      {
        title: 'Custom Edited Calculus Integration Session',
        durationMinutes: 60,
        scheduledDate: '2026-05-06',
      },
      serviceOptions,
    );
    expect(editedRes.task.title).toBe('Custom Edited Calculus Integration Session');
    expect(editedRes.task.isManuallyEdited).toBe(true);
    expect(editedRes.task.durationMinutes).toBe(60);

    // 3. Add a custom manual task (FR-PLAN-007)
    const manualCreated = await createManualStudyTaskForStudent(
      studentA,
      created.plan.id,
      {
        title: 'Past Paper Timed Drill',
        taskType: 'mock_exam',
        scheduledDate: '2026-05-08',
        durationMinutes: 60,
      },
      serviceOptions,
    );
    expect(manualCreated.task.isManuallyEdited).toBe(true);
    expect(manualCreated.task.taskType).toBe('mock_exam');

    // 4. Mark second task as skipped and reschedule missed tasks (FR-PLAN-006, FR-PLAN-008)
    await updateStudyTaskForStudent(
      studentA,
      secondTask.id,
      { status: 'skipped' },
      serviceOptions,
    );

    const rescheduledDetail = await updateOrRecalculateStudyPlanForStudent(
      studentA,
      created.plan.id,
      {
        action: 'reschedule_missed',
        referenceDate: '2026-05-07',
      },
      serviceOptions,
    );
    const rescheduledTask = rescheduledDetail.tasks.find((t) => t.id === secondTask.id);
    expect(rescheduledTask?.status).toBe('rescheduled');
    expect(rescheduledTask).toBeDefined();
    expect((rescheduledTask?.scheduledDateKey ?? '') >= '2026-05-07').toBe(true);

    // 5. Recalculate plan when targetDate & dailyStudyMinutes change while preserving completed tasks (FR-PLAN-008)
    const recalculatedDetail = await updateOrRecalculateStudyPlanForStudent(
      studentA,
      created.plan.id,
      {
        action: 'recalculate',
        targetDate: '2026-05-28',
        dailyStudyMinutes: 150,
        referenceDate: '2026-05-07',
      },
      serviceOptions,
    );
    expect(recalculatedDetail.plan.dailyStudyMinutes).toBe(150);
    expect(recalculatedDetail.plan.targetDate.toISOString().slice(0, 10)).toBe('2026-05-28');
    expect(
      recalculatedDetail.tasks.some((t) => t.id === firstTask.id && t.status === 'completed'),
    ).toBe(true);

    // 6. Cross-user isolation check
    const studentBList = await listStudyPlansForStudent(studentB, serviceOptions);
    expect(studentBList.plans).toHaveLength(0);

    await expect(
      getStudyPlanDetailForStudent(studentB, created.plan.id, serviceOptions),
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      updateStudyTaskForStudent(
        studentB,
        firstTask.id,
        { status: 'pending' },
        serviceOptions,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      deleteStudyPlanForStudent(studentB, created.plan.id, serviceOptions),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
