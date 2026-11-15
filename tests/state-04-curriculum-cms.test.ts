import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryUserRepository, setActiveUserRepository } from '../src/modules/auth/user-repository.ts';
import { registerStudentAccount } from '../src/modules/auth/auth-service.ts';
import {
  InMemoryCurriculumRepository,
  setActiveCurriculumRepository,
} from '../src/modules/curriculum/curriculum-repository.ts';
import {
  browseCurriculumHierarchy,
  createCurriculumEntity,
  deleteCurriculumEntity,
  exportCurriculumData,
  getAdminCurriculumSnapshot,
  getSavedTopicsForStudent,
  getTopicDetailForUser,
  importCurriculumData,
  listTopicsForUser,
  listUsersForAdmin,
  toggleSavedTopicForStudent,
  updateCurriculumEntity,
  updateUserRoleAndStatusForAdmin,
} from '../src/modules/curriculum/curriculum-service.ts';
import { SEED_IDS } from '../src/modules/curriculum/seed-data.ts';

describe('State 04 — Curriculum & Administrative CMS Gate', () => {
  let userRepo: InMemoryUserRepository;
  let curriculumRepo: InMemoryCurriculumRepository;

  const studentActor = {
    userId: '',
    email: 'student.hsc@example.com',
    role: 'student' as const,
  };

  const contentManagerActor = {
    userId: '66f000000000000000000901',
    email: 'cm@learnmate.ai',
    role: 'content_manager' as const,
  };

  const adminActor = {
    userId: '66f000000000000000000902',
    email: 'admin@learnmate.ai',
    role: 'admin' as const,
  };

  beforeEach(async () => {
    userRepo = new InMemoryUserRepository();
    curriculumRepo = new InMemoryCurriculumRepository(true);
    setActiveUserRepository(userRepo);
    setActiveCurriculumRepository(curriculumRepo);

    const reg = await registerStudentAccount(
      {
        fullName: 'Nusrat Jahan',
        email: studentActor.email,
        password: 'SafePassword123',
        preferredLanguage: 'bn',
        timezone: 'Asia/Dhaka',
      },
      userRepo,
    );
    studentActor.userId = reg.user.id;
  });

  it('allows students to browse the 6-tier Bangladesh syllabus hierarchy with pagination and prerequisite resolution', async () => {
    const hierarchy = await browseCurriculumHierarchy(
      studentActor,
      {
        educationSystemId: SEED_IDS.systems.bdNctb,
        educationLevelId: SEED_IDS.levels.hsc,
        subjectId: SEED_IDS.subjects.hscPhysics,
        page: 1,
        limit: 2,
      },
      curriculumRepo,
      userRepo,
    );

    expect(hierarchy.educationSystems.some((s) => s.code === 'BD-NCTB')).toBe(true);
    expect(hierarchy.educationLevels.some((l) => l.code === 'HSC')).toBe(true);
    expect(hierarchy.examinations.some((e) => e.code === 'HSC-2027')).toBe(true);
    expect(hierarchy.subjects.some((s) => s.code === 'HSC-PHY')).toBe(true);
    expect(hierarchy.chapters.some((c) => c.title === 'Mechanics')).toBe(true);
    expect(hierarchy.topics).toHaveLength(2);
    expect(hierarchy.meta.total).toBe(4);
    expect(hierarchy.meta.totalPages).toBe(2);

    // Inspect Conservation of Momentum topic and verify prerequisite Newton's Laws is resolved
    const detail = await getTopicDetailForUser(
      studentActor,
      SEED_IDS.topics.conservationOfMomentum,
      curriculumRepo,
      userRepo,
    );
    expect(detail.topic.title).toContain('Conservation of Momentum');
    expect(detail.subject?.name).toBe('Physics');
    expect(detail.chapter?.title).toBe('Mechanics');
    expect(detail.prerequisites).toHaveLength(1);
    expect(detail.prerequisites[0]?.id).toBe(SEED_IDS.topics.newtonsLaws);
  });

  it('allows students to save and unsave topics in their personal learning list (FR-CUR-008)', async () => {
    const saveRes = await toggleSavedTopicForStudent(
      studentActor,
      { topicId: SEED_IDS.topics.newtonsLaws },
      curriculumRepo,
      userRepo,
    );
    expect(saveRes.saved).toBe(true);
    expect(saveRes.savedTopicIds).toContain(SEED_IDS.topics.newtonsLaws);

    const savedList = await getSavedTopicsForStudent(studentActor, curriculumRepo, userRepo);
    expect(savedList.topics).toHaveLength(1);
    expect(savedList.topics[0]?.code).toBe('PHY-MECH-01');

    const filteredSaved = await listTopicsForUser(
      studentActor,
      { savedOnly: true, page: 1, limit: 10 },
      curriculumRepo,
      userRepo,
    );
    expect(filteredSaved.topics).toHaveLength(1);

    const unsaveRes = await toggleSavedTopicForStudent(
      studentActor,
      { topicId: SEED_IDS.topics.newtonsLaws },
      curriculumRepo,
      userRepo,
    );
    expect(unsaveRes.saved).toBe(false);
    expect(unsaveRes.savedTopicIds).toHaveLength(0);
  });

  it('allows administrators and content managers to create, update, and delete across all 6 hierarchy levels while enforcing referential integrity and audit logging', async () => {
    // 1. Create a new Education System -> Level -> Exam -> Subject -> Chapter -> Topic
    const sys = await createCurriculumEntity(
      contentManagerActor,
      {
        entityType: 'educationSystem',
        data: {
          code: 'BD-MADRASAH',
          name: 'Bangladesh Madrasah Education Board',
          country: 'BD',
          supportedLanguages: ['en', 'bn'],
          isActive: true,
        },
      },
      curriculumRepo,
    );
    const sysId = (sys.record as { id: string }).id;

    const lvl = await createCurriculumEntity(
      contentManagerActor,
      {
        entityType: 'educationLevel',
        data: {
          educationSystemId: sysId,
          code: 'ALIM',
          name: 'Alim (Class 11–12)',
          order: 1,
          isActive: true,
        },
      },
      curriculumRepo,
    );
    const lvlId = (lvl.record as { id: string }).id;

    const exam = await createCurriculumEntity(
      contentManagerActor,
      {
        entityType: 'examination',
        data: {
          educationSystemId: sysId,
          educationLevelId: lvlId,
          code: 'ALIM-2027',
          name: 'Alim Board Exam 2027',
          examDate: '2027-07-01',
          isActive: true,
        },
      },
      curriculumRepo,
    );
    const examId = (exam.record as { id: string }).id;

    const sub = await createCurriculumEntity(
      contentManagerActor,
      {
        entityType: 'subject',
        data: {
          educationSystemId: sysId,
          educationLevelId: lvlId,
          examinationIds: [examId],
          code: 'ALIM-PHY',
          name: 'Alim Physics',
          nameBn: 'আলিম পদার্থবিজ্ঞান',
          order: 1,
          isActive: true,
        },
      },
      curriculumRepo,
    );
    const subId = (sub.record as { id: string }).id;

    const chap = await createCurriculumEntity(
      contentManagerActor,
      {
        entityType: 'chapter',
        data: {
          subjectId: subId,
          chapterNumber: 1,
          title: 'Physical World & Measurement',
          titleBn: 'ভৌত জগৎ ও পরিমাপ',
          order: 1,
          isActive: true,
        },
      },
      curriculumRepo,
    );
    const chapId = (chap.record as { id: string }).id;

    const top = await createCurriculumEntity(
      contentManagerActor,
      {
        entityType: 'topic',
        data: {
          subjectId: subId,
          chapterId: chapId,
          code: 'ALIM-PHY-01',
          title: 'Vernier & Screw Gauge Error Analysis',
          titleBn: 'ভার্নিয়ার ও স্ক্রু গজের ত্রুটি বিশ্লেষণ',
          difficulty: 'easy',
          estimatedMinutes: 35,
          learningObjectives: ['Compute instrumental and percentage errors'],
          keyConcepts: ['Least Count', 'Backlash Error'],
          prerequisiteTopicIds: [],
          curriculumReferences: ['BMEB Alim Physics Ch 1'],
          syllabusWeightVerified: true,
          syllabusPriorityScore: 80,
          order: 1,
          isActive: true,
        },
      },
      curriculumRepo,
    );
    const topId = (top.record as { id: string }).id;

    // 2. Verify referential integrity: cannot delete chapter while it still contains a topic
    await expect(
      deleteCurriculumEntity(
        adminActor,
        { entityType: 'chapter', id: chapId },
        curriculumRepo,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });

    // 3. Update topic and then delete topic -> chapter
    const updatedTop = await updateCurriculumEntity(
      adminActor,
      {
        entityType: 'topic',
        id: topId,
        data: { estimatedMinutes: 50, difficulty: 'medium' },
      },
      curriculumRepo,
    );
    expect((updatedTop.record as { estimatedMinutes: number }).estimatedMinutes).toBe(50);

    await deleteCurriculumEntity(adminActor, { entityType: 'topic', id: topId }, curriculumRepo);
    const delChap = await deleteCurriculumEntity(
      adminActor,
      { entityType: 'chapter', id: chapId },
      curriculumRepo,
    );
    expect(delChap.deleted).toBe(true);

    // 4. Verify audit logs recorded every mutation
    const snapshot = await getAdminCurriculumSnapshot(adminActor, curriculumRepo);
    expect(snapshot.auditLogs.length).toBeGreaterThanOrEqual(8);
  });

  it('exports and imports curriculum data in both JSON and CSV formats (FR-CUR-009)', async () => {
    const jsonExport = await exportCurriculumData(adminActor, 'json', curriculumRepo);
    expect(jsonExport.format).toBe('json');
    expect(jsonExport.bundle?.topics.length).toBeGreaterThanOrEqual(9);

    const csvExport = await exportCurriculumData(adminActor, 'csv', curriculumRepo);
    expect(csvExport.format).toBe('csv');
    expect(csvExport.csvText).toContain('PHY-MECH-01');

    const csvImport = await importCurriculumData(
      adminActor,
      {
        format: 'csv',
        defaultSubjectId: SEED_IDS.subjects.hscPhysics,
        defaultChapterId: SEED_IDS.chapters.hscPhysMechanics,
        csvText: [
          'code,title,titleBn,difficulty,estimatedMinutes,keyConcepts,learningObjectives',
          'PHY-MECH-99,Angular Momentum & Torque,কৌণিক ভরবেগ ও টর্ক,hard,55,Torque τ = r × F | Moment of Inertia,Calculate moment of inertia using parallel and perpendicular axis theorems',
        ].join('\n'),
      },
      curriculumRepo,
    );

    expect(csvImport.importedCounts.topics).toBe(1);

    const searchRes = await listTopicsForUser(
      studentActor,
      { search: 'Torque', page: 1, limit: 10 },
      curriculumRepo,
      userRepo,
    );
    expect(searchRes.topics.some((t) => t.code === 'PHY-MECH-99')).toBe(true);
  });

  it('enforces server-side RBAC permissions for student, content_manager, and admin roles (FR-ADMIN-003)', async () => {
    // Student cannot mutate curriculum
    await expect(
      createCurriculumEntity(
        studentActor,
        {
          entityType: 'educationSystem',
          data: { code: 'HACK', name: 'Unauthorized', country: 'BD' },
        },
        curriculumRepo,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    // Content manager cannot manage user permissions
    await expect(
      listUsersForAdmin(contentManagerActor, {}, userRepo),
    ).rejects.toMatchObject({ statusCode: 403 });

    // Admin can list users and promote student to content_manager
    const listed = await listUsersForAdmin(adminActor, { page: 1, limit: 20 }, userRepo);
    expect(listed.users).toHaveLength(1);

    const promoted = await updateUserRoleAndStatusForAdmin(
      adminActor,
      { userId: studentActor.userId, role: 'content_manager' },
      userRepo,
      curriculumRepo,
    );
    expect(promoted.user.role).toBe('content_manager');

    // Admin cannot demote their own active account
    await expect(
      updateUserRoleAndStatusForAdmin(
        adminActor,
        { userId: adminActor.userId, role: 'student' },
        userRepo,
        curriculumRepo,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
