import { beforeEach, describe, expect, it } from 'vitest';
import type {
  OpenRouterCompletionRequest,
  OpenRouterCompletionResponse,
} from '../src/lib/ai/openrouter-client.ts';
import { buildHierarchyPreview, cloneDefaultLabels } from '../src/config/education-presets.ts';
import { backfillCustomEducationDefaults } from '../src/lib/database/migrations/custom-education-migration.ts';
import {
  InMemoryAIRepository,
  setActiveAIRepository,
} from '../src/modules/ai/ai-repository.ts';
import { InMemoryAnalyticsRepository } from '../src/modules/analytics/analytics-repository.ts';
import {
  getStudentAnalyticsDashboard,
  recordTopicStudyActivityForStudent,
} from '../src/modules/analytics/analytics-service.ts';
import {
  completeOnboardingWorkflow,
  registerStudentAccount,
} from '../src/modules/auth/auth-service.ts';
import {
  InMemoryUserRepository,
  setActiveUserRepository,
} from '../src/modules/auth/user-repository.ts';
import {
  InMemoryCurriculumRepository,
  setActiveCurriculumRepository,
} from '../src/modules/curriculum/curriculum-repository.ts';
import {
  browseCurriculumHierarchy,
  getAdminCurriculumSnapshot,
  getTopicDetailForUser,
  toggleSavedTopicForStudent,
} from '../src/modules/curriculum/curriculum-service.ts';
import {
  createCustomChapterForStudent,
  createCustomEducationSystemForStudent,
  createCustomExaminationForStudent,
  createCustomSubjectForStudent,
  createCustomTopicForStudent,
  deleteCustomEducationSystemForStudent,
  deleteCustomExaminationForStudent,
  deleteCustomSubjectForStudent,
  duplicateCustomExaminationForStudent,
  getEducationLabelsForStudent,
  getStudentEducationWorkspace,
  resetEducationLabelsForStudent,
  updateCustomEducationSystemForStudent,
  updateCustomExaminationForStudent,
  upsertEducationLabelsForStudent,
} from '../src/modules/curriculum/custom-education-service.ts';
import { SEED_IDS } from '../src/modules/curriculum/seed-data.ts';
import {
  InMemoryDocumentRepository,
  setActiveDocumentRepository,
} from '../src/modules/documents/document-repository.ts';
import { uploadAndProcessDocumentForStudent } from '../src/modules/documents/document-service.ts';
import {
  InMemoryFlashcardRepository,
  setActiveFlashcardRepository,
} from '../src/modules/flashcards/flashcard-repository.ts';
import { createManualDeckForStudent } from '../src/modules/flashcards/flashcard-service.ts';
import { InMemoryStudyPlanRepository } from '../src/modules/planner/planner-repository.ts';
import { createStudyPlanForStudent } from '../src/modules/planner/planner-service.ts';
import {
  InMemoryQuizRepository,
  setActiveQuizRepository,
} from '../src/modules/quizzes/quiz-repository.ts';
import { generateQuizForStudent } from '../src/modules/quizzes/quiz-service.ts';
import {
  InMemoryTutorMaterialsRepository,
  setActiveTutorMaterialsRepository,
} from '../src/modules/tutor/tutor-materials-repository.ts';
import {
  createConversationForStudent,
  generateLearningMaterialForStudent,
} from '../src/modules/tutor/tutor-materials-service.ts';

describe('Phase 01 — Custom Education System, Labels, Exams & Subjects Gate', () => {
  let userRepo: InMemoryUserRepository;
  let curriculumRepo: InMemoryCurriculumRepository;
  let aiRepo: InMemoryAIRepository;
  let tutorRepo: InMemoryTutorMaterialsRepository;
  let quizRepo: InMemoryQuizRepository;
  let flashcardRepo: InMemoryFlashcardRepository;
  let plannerRepo: InMemoryStudyPlanRepository;
  let docRepo: InMemoryDocumentRepository;
  let analyticsRepo: InMemoryAnalyticsRepository;

  const studentA = {
    userId: '',
    email: 'custom.a@learnmate.ai',
    role: 'student' as const,
  };

  const studentB = {
    userId: '',
    email: 'custom.b@learnmate.ai',
    role: 'student' as const,
  };

  const adminActor = {
    userId: '66f000000000000000000999',
    email: 'admin@learnmate.ai',
    role: 'admin' as const,
  };

  beforeEach(async () => {
    userRepo = new InMemoryUserRepository();
    curriculumRepo = new InMemoryCurriculumRepository(true);
    aiRepo = new InMemoryAIRepository();
    tutorRepo = new InMemoryTutorMaterialsRepository();
    quizRepo = new InMemoryQuizRepository();
    flashcardRepo = new InMemoryFlashcardRepository();
    plannerRepo = new InMemoryStudyPlanRepository();
    docRepo = new InMemoryDocumentRepository();
    analyticsRepo = new InMemoryAnalyticsRepository();

    setActiveUserRepository(userRepo);
    setActiveCurriculumRepository(curriculumRepo);
    setActiveAIRepository(aiRepo);
    setActiveTutorMaterialsRepository(tutorRepo);
    setActiveQuizRepository(quizRepo);
    setActiveFlashcardRepository(flashcardRepo);
    setActiveDocumentRepository(docRepo);

    const regA = await registerStudentAccount(
      {
        fullName: 'Student A',
        email: studentA.email,
        password: 'StrongPassword123',
      },
      userRepo,
    );
    studentA.userId = regA.user.id;

    const regB = await registerStudentAccount(
      {
        fullName: 'Student B',
        email: studentB.email,
        password: 'StrongPassword123',
      },
      userRepo,
    );
    studentB.userId = regB.user.id;
  });

  it('supports Option A/B onboarding with custom education systems & real persisted subjects while preserving standard global data', async () => {
    const onboardingResult = await completeOnboardingWorkflow(
      studentA,
      {
        country: 'BD',
        educationMode: 'custom',
        educationSystemCode: 'CSE-SEM-2026',
        educationLevelCode: 'UNIVERSITY',
        targetExaminationCode: 'CSE 3rd Year Final 2027',
        customSystem: {
          name: 'BUET CSE Undergraduate Curriculum',
          description: 'Personal semester study tracker',
          educationType: 'university',
          academicYear: '2026-2027',
          hierarchyPreset: 'university',
        },
        selectedSubjects: ['Operating Systems', 'Distributed Systems'],
        preferredLanguage: 'en',
        dailyStudyMinutes: 150,
        learningPreferences: ['conceptual_learning', 'problem_solving'],
        timezone: 'Asia/Dhaka',
      },
      userRepo,
      curriculumRepo,
    );

    expect(onboardingResult.user.onboardingCompleted).toBe(true);
    expect(onboardingResult.user.educationSystemId).toBeDefined();
    expect(onboardingResult.user.selectedSubjectIds?.length).toBe(2);

    const workspace = await getStudentEducationWorkspace(studentA, {}, curriculumRepo, userRepo);
    expect(workspace.standardSystems.some((s) => s.id === SEED_IDS.systems.bdNctb)).toBe(true);
    expect(
      workspace.customSystems.some((s) => s.name === 'BUET CSE Undergraduate Curriculum'),
    ).toBe(true);
    expect(workspace.subjects.some((s) => s.name === 'Operating Systems' && s.scope === 'custom')).toBe(
      true,
    );
    expect(
      workspace.examinations.some((e) => e.name === 'CSE 3rd Year Final 2027' && e.scope === 'custom'),
    ).toBe(true);
  });

  it('customizes, reorders, and resets education labels without mutating underlying curriculum entities', async () => {
    const { system } = await createCustomEducationSystemForStudent(
      studentA,
      {
        name: 'My Self-Learning Path',
        educationType: 'self_learning',
        hierarchyPreset: 'self_learning',
      },
      curriculumRepo,
      userRepo,
    );

    const { subject } = await createCustomSubjectForStudent(
      studentA,
      {
        educationSystemId: system.id,
        name: 'Rust Systems Programming',
        color: '#7c3aed',
        icon: 'cpu',
        difficultyLevel: 'hard',
        learningObjectives: ['Master ownership and lifetimes'],
      },
      curriculumRepo,
      userRepo,
    );

    const { chapter } = await createCustomChapterForStudent(
      studentA,
      {
        subjectId: subject.id,
        title: 'Borrow Checker Internals',
      },
      curriculumRepo,
    );

    // Customize labels: Subject -> Course, Chapter -> Unit, move Subject ahead of Examination
    const baseLabels = cloneDefaultLabels('default');
    const customized = baseLabels.map((lbl) => {
      if (lbl.key === 'subject') {
        return { ...lbl, singular: 'Course', plural: 'Courses', order: 2, isVisible: true };
      }
      if (lbl.key === 'chapter') {
        return { ...lbl, singular: 'Unit', plural: 'Units', order: 3, isVisible: true };
      }
      if (lbl.key === 'examination') {
        return { ...lbl, order: 4, isVisible: true };
      }
      return lbl;
    });

    const saved = await upsertEducationLabelsForStudent(
      studentA,
      {
        educationSystemId: system.id,
        presetName: 'custom',
        labels: customized,
      },
      curriculumRepo,
    );

    expect(saved.hierarchyPreview).toContain('Course → Unit → Examination');

    // Underlying entities must retain their exact academic names cleanly
    const persistedSubject = await curriculumRepo.findSubjectById(subject.id);
    const persistedChapter = await curriculumRepo.findChapterById(chapter.id);
    expect(persistedSubject?.name).toBe('Rust Systems Programming');
    expect(persistedChapter?.title).toBe('Borrow Checker Internals');

    // browseCurriculumHierarchy returns dynamic labels for UI rendering
    const hierarchy = await browseCurriculumHierarchy(
      studentA,
      { educationSystemId: system.id, page: 1, limit: 10 },
      curriculumRepo,
      userRepo,
    );
    expect(hierarchy.labels.find((l) => l.key === 'subject')?.singular).toBe('Course');
    expect(buildHierarchyPreview(hierarchy.labels)).toContain('Course → Unit');

    // Resetting restores default labels cleanly while subject/chapter stay intact
    const reset = await resetEducationLabelsForStudent(studentA, system.id, curriculumRepo);
    expect(reset.labels.find((l) => l.key === 'subject')?.singular).toBe('Subject');
    expect((await curriculumRepo.findSubjectById(subject.id))?.name).toBe(
      'Rust Systems Programming',
    );
  });

  it('supports editing, duplicating, archiving, and safe relationship deletion for custom systems, exams, and subjects', async () => {
    const { system } = await createCustomEducationSystemForStudent(
      studentA,
      { name: 'Coaching Batch A', educationType: 'competitive', hierarchyPreset: 'competitive' },
      curriculumRepo,
      userRepo,
    );

    const { subject } = await createCustomSubjectForStudent(
      studentA,
      { educationSystemId: system.id, name: 'Engineering Math' },
      curriculumRepo,
      userRepo,
    );

    const { examination } = await createCustomExaminationForStudent(
      studentA,
      {
        educationSystemId: system.id,
        name: 'Admission Mock Test 2027',
        academicSession: '2026-2027',
        subjectIds: [subject.id],
        syllabusCoverage: 'Calculus and Linear Algebra',
        totalMarks: 200,
        durationMinutes: 120,
        preparationGoals: ['Score above 85%'],
      },
      curriculumRepo,
    );

    // Duplicate & update custom exam
    const dup = await duplicateCustomExaminationForStudent(studentA, examination.id, curriculumRepo);
    expect(dup.examination.name).toBe('Admission Mock Test 2027 (Copy)');
    expect(dup.examination.id).not.toBe(examination.id);

    const editedExam = await updateCustomExaminationForStudent(
      studentA,
      dup.examination.id,
      { isArchived: true, totalMarks: 250 },
      curriculumRepo,
    );
    expect(editedExam.examination.isArchived).toBe(true);
    expect(editedExam.examination.totalMarks).toBe(250);

    // Delete original exam unlinks it from custom subject cleanly
    await deleteCustomExaminationForStudent(studentA, examination.id, curriculumRepo, userRepo);
    const reloadedSubj = await curriculumRepo.findSubjectById(subject.id);
    expect(reloadedSubj?.examinationIds).not.toContain(examination.id);

    // System with child subject refuses non-cascade delete (409)
    await expect(
      deleteCustomEducationSystemForStudent(
        studentA,
        system.id,
        { forceCascade: false },
        curriculumRepo,
        userRepo,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });

    // Archive and unarchive custom system cleanly
    const archived = await updateCustomEducationSystemForStudent(
      studentA,
      system.id,
      { isArchived: true },
      curriculumRepo,
    );
    expect(archived.system.isArchived).toBe(true);

    // Delete with forceCascade cleans children cleanly
    const deletedSys = await deleteCustomEducationSystemForStudent(
      studentA,
      system.id,
      { forceCascade: true },
      curriculumRepo,
      userRepo,
    );
    expect(deletedSys.deleted).toBe(true);
    expect(await curriculumRepo.findSubjectById(subject.id)).toBeNull();
  });

  it('enforces strict multi-tenant ownership across custom records and admin CMS isolation', async () => {
    const { system } = await createCustomEducationSystemForStudent(
      studentA,
      { name: 'Private Certification Track', educationType: 'certification' },
      curriculumRepo,
      userRepo,
    );
    const { subject } = await createCustomSubjectForStudent(
      studentA,
      { educationSystemId: system.id, name: 'Private Kubernetes Security' },
      curriculumRepo,
      userRepo,
    );
    const { chapter } = await createCustomChapterForStudent(
      studentA,
      { subjectId: subject.id, title: 'Cluster Hardening' },
      curriculumRepo,
    );
    const { topic } = await createCustomTopicForStudent(
      studentA,
      {
        subjectId: subject.id,
        chapterId: chapter.id,
        title: 'RBAC Least Privilege',
        keyConcepts: ['RoleBinding', 'ServiceAccount'],
      },
      curriculumRepo,
    );

    // Student B cannot browse Student A's custom records
    const hierarchyB = await browseCurriculumHierarchy(studentB, {}, curriculumRepo, userRepo);
    expect(hierarchyB.educationSystems.some((s) => s.id === system.id)).toBe(false);
    expect(hierarchyB.subjects.some((s) => s.id === subject.id)).toBe(false);

    // Student B gets 403 accessing or mutating Student A's custom records
    await expect(getTopicDetailForUser(studentB, topic.id, curriculumRepo, userRepo)).rejects.toMatchObject(
      { statusCode: 403 },
    );
    await expect(
      toggleSavedTopicForStudent(studentB, { topicId: topic.id }, curriculumRepo, userRepo),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(deleteCustomSubjectForStudent(studentB, subject.id, { forceCascade: true }, curriculumRepo, userRepo)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(getEducationLabelsForStudent(studentB, system.id, curriculumRepo, userRepo)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(
      recordTopicStudyActivityForStudent(studentB, { topicId: topic.id, studyTimeMinutesDelta: 10 }, {
        curriculumRepo,
        analyticsRepo,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    // Student A cannot modify global admin curriculum records (403)
    await expect(
      updateCustomEducationSystemForStudent(
        studentA,
        SEED_IDS.systems.bdNctb,
        { name: 'Hijacked Global' },
        curriculumRepo,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    // Admin CMS snapshot only lists global syllabus entities, never leaking Student A custom data
    const adminSnapshot = await getAdminCurriculumSnapshot(adminActor, curriculumRepo);
    expect(adminSnapshot.subjects.some((s) => s.id === subject.id)).toBe(false);
  });

  it('integrates Student A custom examinations and subjects across Tutor, Materials, Quiz, Flashcards, Study Planner, Documents & Analytics', async () => {
    const { system } = await createCustomEducationSystemForStudent(
      studentA,
      { name: 'Integrated Custom Track', educationType: 'custom' },
      curriculumRepo,
      userRepo,
    );
    const { examination } = await createCustomExaminationForStudent(
      studentA,
      { educationSystemId: system.id, name: 'Personal Final Exam 2027' },
      curriculumRepo,
    );
    const { subject } = await createCustomSubjectForStudent(
      studentA,
      { educationSystemId: system.id, examinationIds: [examination.id], name: 'Distributed Databases' },
      curriculumRepo,
      userRepo,
    );
    const { chapter } = await createCustomChapterForStudent(
      studentA,
      { subjectId: subject.id, title: 'Consensus Protocols' },
      curriculumRepo,
    );
    const { topic } = await createCustomTopicForStudent(
      studentA,
      {
        subjectId: subject.id,
        chapterId: chapter.id,
        title: 'Raft Leader Election',
        estimatedMinutes: 45,
        keyConcepts: ['Term', 'Heartbeat', 'Quorum'],
      },
      curriculumRepo,
    );

    const mockTransport = async (
      req: OpenRouterCompletionRequest,
    ): Promise<OpenRouterCompletionResponse> => {
      const sysMsg = req.messages[0]?.content ?? '';
      if (sysMsg.includes('Quiz')) {
        return {
          modelId: req.model,
          promptTokens: 50,
          completionTokens: 80,
          totalTokens: 130,
          content: JSON.stringify({
            title: 'Raft Consensus Practice Quiz',
            questions: [
              {
                questionType: 'single_mcq',
                difficulty: 'medium',
                promptText: 'What ensures at most one leader is elected per term in Raft?',
                options: [
                  { id: 'A', text: 'Majority quorum vote' },
                  { id: 'B', text: 'Global clock sync' },
                ],
                correctOptionIds: ['A'],
                explanation: 'A candidate needs votes from a strict majority of cluster nodes.',
                points: 1,
              },
            ],
          }),
        };
      }
      if (sysMsg.includes('Planner') || sysMsg.includes('Study Plan') || req.messages[1]?.content.includes('Daily Study Minutes')) {
        return {
          modelId: req.model,
          promptTokens: 40,
          completionTokens: 60,
          totalTokens: 100,
          content: JSON.stringify({
            aiSummary: 'Focus on Raft quorum safety first.',
            priorityTopicCodes: [topic.code],
            studyTips: ['Trace split-vote election timeouts carefully.'],
          }),
        };
      }
      return {
        modelId: req.model,
        promptTokens: 40,
        completionTokens: 80,
        totalTokens: 120,
        content: JSON.stringify({
          title: 'Raft Consensus Study Guide',
          summary: 'Raft separates leader election, log replication, and safety.',
          keyTakeaways: ['Each server votes for at most one candidate per term'],
          formulasOrDefinitions: [{ term: 'Quorum', detail: 'Floor(N/2) + 1 servers' }],
          practicePrompts: ['Explain split votes in a 4-node cluster.'],
        }),
      };
    };

    // 1. AI Tutor context resolves custom topic cleanly
    const tutorSession = await createConversationForStudent(
      studentA,
      {
        topicId: topic.id,
        initialMessage: 'Explain Raft split votes.',
        language: 'en',
        explanationDepth: 'intermediate',
      },
      tutorRepo,
      curriculumRepo,
      aiRepo,
      mockTransport,
    );
    expect(tutorSession.conversation.subjectId).toBe(subject.id);

    // 2. Study Materials generation works with custom topic
    const materialRes = await generateLearningMaterialForStudent(
      studentA,
      {
        topicId: topic.id,
        materialType: 'topic_explanation',
        language: 'en',
        explanationDepth: 'intermediate',
      },
      tutorRepo,
      curriculumRepo,
      aiRepo,
      mockTransport,
    );
    expect(materialRes.material.subjectId).toBe(subject.id);

    // 3. Quiz generation works with custom topic
    const quizRes = await generateQuizForStudent(
      studentA,
      {
        topicIds: [topic.id],
        mode: 'practice',
        difficulty: 'medium',
        questionCount: 1,
        questionTypes: ['single_mcq'],
        language: 'en',
      },
      quizRepo,
      curriculumRepo,
      tutorRepo,
      aiRepo,
      mockTransport,
    );
    expect(quizRes.quiz.subjectId).toBe(subject.id);

    // 4. Flashcards work with custom subject/topic
    const flashRes = await createManualDeckForStudent(
      studentA,
      {
        title: 'Raft Key Terms',
        subjectId: subject.id,
        chapterId: chapter.id,
        topicId: topic.id,
        language: 'en',
        cards: [{ front: 'What is a Raft Term?', back: 'Monotonically increasing logical clock epoch.' }],
      },
      flashcardRepo,
      curriculumRepo,
    );
    expect(flashRes.deck.subjectId).toBe(subject.id);

    // 5. Study Planner integrates custom examination & custom subject cleanly
    const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const planRes = await createStudyPlanForStudent(
      studentA,
      {
        title: 'Distributed DB Exam Prep',
        targetExaminationId: examination.id,
        targetDate: futureDate,
        dailyStudyMinutes: 90,
        availableDaysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        subjectIds: [subject.id],
        proficiencyBySubject: { [subject.id]: 'intermediate' },
        language: 'en',
      },
      {
        plannerRepo,
        curriculumRepo,
        quizRepo,
        flashcardRepo,
        aiOptions: { repository: aiRepo, fetchImpl: mockTransport },
      },
    );
    expect(planRes.plan.targetExaminationId).toBe(examination.id);
    expect(planRes.plan.subjectIds).toContain(subject.id);
    expect(planRes.tasks.length).toBeGreaterThan(0);

    // 6. Document upload links to custom topic & Analytics tracks custom subject progress
    const docRes = await uploadAndProcessDocumentForStudent(
      studentA,
      {
        title: 'Raft Notes',
        originalFilename: 'raft-notes.txt',
        mimeType: 'text/plain',
        byteSize: 120,
        rawContent: 'Raft uses randomized election timeouts to resolve split votes cleanly.',
        subjectId: subject.id,
        topicId: topic.id,
      },
      docRepo,
      curriculumRepo,
    );
    expect(docRes.document.subjectId).toBe(subject.id);

    await recordTopicStudyActivityForStudent(
      studentA,
      { topicId: topic.id, markCompleted: true, studyTimeMinutesDelta: 30 },
      { curriculumRepo, analyticsRepo, userRepo },
    );
    const dashA = await getStudentAnalyticsDashboard(
      studentA,
      {},
      {
        curriculumRepo,
        analyticsRepo,
        userRepo,
        quizRepo,
        flashcardRepo,
        plannerRepo,
        aiRepo,
      },
    );
    expect(dashA.subjectPerformance.some((s) => s.subjectId === subject.id)).toBe(true);

    // Student B cannot use Student A's custom examination in Study Planner
    await expect(
      createStudyPlanForStudent(
        studentB,
        {
          title: 'Stolen Exam Plan',
          targetExaminationId: examination.id,
          targetDate: futureDate,
          dailyStudyMinutes: 90,
          availableDaysOfWeek: [1, 2, 3],
          subjectIds: [subject.id],
          proficiencyBySubject: { [subject.id]: 'beginner' },
          language: 'en',
        },
        { plannerRepo, curriculumRepo, quizRepo, flashcardRepo },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('executes backfillCustomEducationDefaults idempotently without mutating existing custom fields', () => {
    const legacySystems = [
      { code: 'BD-NCTB', name: 'Bangladesh NCTB' },
      { code: 'CUS-1', name: 'Custom System', scope: 'custom', isArchived: true, educationType: 'university' },
    ];
    const firstPass = backfillCustomEducationDefaults(legacySystems, { isEducationSystem: true });
    expect(firstPass.updatedCount).toBe(1);
    expect(firstPass.records[0]?.scope).toBe('global');
    expect(firstPass.records[0]?.isArchived).toBe(false);
    expect(firstPass.records[0]?.educationType).toBe('standard');
    expect(firstPass.records[1]?.scope).toBe('custom');
    expect(firstPass.records[1]?.isArchived).toBe(true);

    const secondPass = backfillCustomEducationDefaults(firstPass.records, { isEducationSystem: true });
    expect(secondPass.updatedCount).toBe(0);
  });
});
