/**
 * LearnMate AI — Custom Education System, Labels, Hierarchy, Examinations & Subjects Service
 * Enforces strict multi-tenant ownership isolation (`scope: 'custom'` + `ownerUserId`)
 * while preserving global admin-managed curriculum compatibility.
 */

import { randomBytes } from 'node:crypto';
import {
  buildHierarchyPreview,
  cloneDefaultLabels,
  DEFAULT_EDUCATION_LABELS,
  type EducationLabelDefinition,
  EDUCATION_HIERARCHY_PRESETS,
  type EducationPresetKey,
  type HierarchyLevelConfig,
} from '../../config/education-presets.ts';
import { AppError } from '../../lib/api/errors.ts';
import { requireAuth, type AuthenticatedActor } from '../../lib/auth/rbac.ts';
import {
  createCustomChapterSchema,
  createCustomEducationLevelSchema,
  createCustomEducationSystemSchema,
  createCustomExaminationSchema,
  createCustomSubjectSchema,
  createCustomTopicSchema,
  setActiveEducationSchema,
  updateCustomChapterSchema,
  updateCustomEducationLevelSchema,
  updateCustomEducationSystemSchema,
  updateCustomExaminationSchema,
  updateCustomSubjectSchema,
  updateCustomTopicSchema,
  upsertEducationLabelsSchema,
} from '../../lib/validators/custom-education.ts';
import type { CurriculumScope } from '../../types/domain.ts';
import {
  getActiveUserRepository,
  toPublicUserProfile,
  type PublicUserProfile,
  type UserRepository,
} from '../auth/user-repository.ts';
import {
  getActiveCurriculumRepository,
  type CurriculumRepository,
} from './curriculum-repository.ts';
import type {
  ChapterRecord,
  EducationLevelRecord,
  EducationSystemRecord,
  ExaminationRecord,
  SubjectRecord,
  TopicRecord,
} from './seed-data.ts';

interface OwnedCurriculumEntity {
  scope?: CurriculumScope;
  ownerUserId?: string;
}

/**
 * Verifies an actor may read/reference a curriculum entity (either `'global'` or own `'custom'`).
 */
export function assertCurriculumRecordReadable(
  record: OwnedCurriculumEntity | null | undefined,
  actor: AuthenticatedActor,
  label = 'Curriculum record',
): void {
  if (!record) {
    throw AppError.notFound(label);
  }
  const effectiveScope = record.scope ?? 'global';
  if (effectiveScope === 'custom' && record.ownerUserId !== actor.userId && actor.role !== 'admin') {
    throw AppError.forbidden(`You do not have permission to access this custom ${label.toLowerCase()}`);
  }
}

/**
 * Verifies an actor owns and may mutate/delete a personal `'custom'` entity (never global admin records).
 */
export function assertCustomRecordEditable(
  record: OwnedCurriculumEntity | null | undefined,
  actor: AuthenticatedActor,
  label = 'Curriculum record',
): void {
  if (!record) {
    throw AppError.notFound(label);
  }
  if ((record.scope ?? 'global') !== 'custom') {
    throw AppError.forbidden(
      `Standard ${label.toLowerCase()} records cannot be modified by students. Create a custom record instead.`,
    );
  }
  if (record.ownerUserId !== actor.userId) {
    throw AppError.forbidden(`You do not have permission to modify this custom ${label.toLowerCase()}`);
  }
}

export function buildCustomCode(prefix: string, name: string): string {
  const cleanSlug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 14);
  const suffix = randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${cleanSlug || 'ITEM'}-${suffix}`;
}

function labelsFromHierarchyLevels(levels: HierarchyLevelConfig[]): EducationLabelDefinition[] {
  return levels.map((lvl, idx) => ({
    key: lvl.key,
    defaultLabel: lvl.singularLabel,
    singular: lvl.singularLabel,
    plural: lvl.pluralLabel,
    order: typeof lvl.order === 'number' ? lvl.order : idx,
    required: lvl.required,
    allowMultiple: lvl.allowMultiple,
    isVisible: true,
  }));
}

function hierarchyLevelsFromLabels(labels: EducationLabelDefinition[]): HierarchyLevelConfig[] {
  return [...labels]
    .sort((a, b) => a.order - b.order)
    .map((l) => ({
      key: l.key,
      singularLabel: l.singular,
      pluralLabel: l.plural,
      order: l.order,
      required: l.required,
      allowMultiple: l.allowMultiple,
    }));
}

export async function getResolvedLabelsForUser(
  userId: string,
  educationSystemId: string | undefined,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
): Promise<{
  presetName: string;
  labels: EducationLabelDefinition[];
  hierarchyPreview: string;
  configId?: string;
}> {
  const savedConfig = await curriculumRepo.findLabelConfig(userId, educationSystemId);
  if (savedConfig && savedConfig.labels.length > 0) {
    return {
      presetName: savedConfig.presetName,
      labels: [...savedConfig.labels].sort((a, b) => a.order - b.order),
      hierarchyPreview: buildHierarchyPreview(savedConfig.labels),
      configId: savedConfig.id,
    };
  }

  if (educationSystemId) {
    const sys = await curriculumRepo.findEducationSystemById(educationSystemId);
    if (
      sys &&
      ((sys.scope ?? 'global') === 'global' || sys.ownerUserId === userId) &&
      sys.hierarchyLevels &&
      sys.hierarchyLevels.length > 0
    ) {
      const derived = labelsFromHierarchyLevels(sys.hierarchyLevels);
      return {
        presetName: sys.educationType ?? 'custom',
        labels: derived,
        hierarchyPreview: buildHierarchyPreview(derived),
      };
    }
  }

  const defaults = DEFAULT_EDUCATION_LABELS.map((item) => ({ ...item }));
  return {
    presetName: 'default',
    labels: defaults,
    hierarchyPreview: buildHierarchyPreview(defaults),
  };
}

export interface StudentEducationWorkspaceResponse {
  standardSystems: EducationSystemRecord[];
  customSystems: EducationSystemRecord[];
  archivedSystems: EducationSystemRecord[];
  activeSystemId?: string;
  activeLevelId?: string;
  activeExaminationId?: string;
  labels: EducationLabelDefinition[];
  presetName: string;
  hierarchyPreview: string;
  levels: EducationLevelRecord[];
  examinations: ExaminationRecord[];
  archivedExaminations: ExaminationRecord[];
  subjects: SubjectRecord[];
  archivedSubjects: SubjectRecord[];
  chapters: ChapterRecord[];
  topics: TopicRecord[];
  selectedSubjectIds: string[];
}

export async function getStudentEducationWorkspace(
  actor: AuthenticatedActor | null | undefined,
  options: { educationSystemId?: string } = {},
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
  userRepo: UserRepository = getActiveUserRepository(),
): Promise<StudentEducationWorkspaceResponse> {
  const verified = requireAuth(actor);
  const visibilityAll = { viewerUserId: verified.userId, scopeFilter: 'all' as const, includeArchived: true };

  const [user, allSystems] = await Promise.all([
    userRepo.findById(verified.userId),
    curriculumRepo.listEducationSystems(false, undefined, visibilityAll),
  ]);

  const standardSystems = allSystems.filter((s) => (s.scope ?? 'global') === 'global' && !s.isArchived);
  const customSystems = allSystems.filter(
    (s) => s.scope === 'custom' && s.ownerUserId === verified.userId && !s.isArchived,
  );
  const archivedSystems = allSystems.filter(
    (s) => s.scope === 'custom' && s.ownerUserId === verified.userId && Boolean(s.isArchived),
  );

  const requestedSysId = options.educationSystemId || user?.educationSystemId;
  const matchedActiveSys =
    allSystems.find((s) => s.id === requestedSysId) ??
    allSystems.find((s) => user?.onboardingMeta?.educationSystemCode && s.code === user.onboardingMeta.educationSystemCode) ??
    customSystems[0] ??
    standardSystems[0];

  const activeSystemId = matchedActiveSys?.id;

  const [labelInfo, levels, allExams, allSubjects, chapters, topicsRes] = await Promise.all([
    getResolvedLabelsForUser(verified.userId, activeSystemId, curriculumRepo),
    curriculumRepo.listEducationLevels(activeSystemId, false, {
      viewerUserId: verified.userId,
      scopeFilter: 'all',
    }),
    curriculumRepo.listExaminations({
      viewerUserId: verified.userId,
      scopeFilter: 'all',
      includeArchived: true,
    }),
    curriculumRepo.listSubjects({
      viewerUserId: verified.userId,
      scopeFilter: 'all',
      includeArchived: true,
    }),
    curriculumRepo.listChapters(undefined, false, {
      viewerUserId: verified.userId,
      scopeFilter: 'all',
    }),
    curriculumRepo.listTopics({
      viewerUserId: verified.userId,
      scopeFilter: 'all',
      page: 1,
      limit: 200,
    }),
  ]);

  return {
    standardSystems,
    customSystems,
    archivedSystems,
    activeSystemId,
    activeLevelId: user?.educationLevelId,
    activeExaminationId: user?.targetExaminationId,
    labels: labelInfo.labels,
    presetName: labelInfo.presetName,
    hierarchyPreview: labelInfo.hierarchyPreview,
    levels,
    examinations: allExams.filter((e) => !e.isArchived),
    archivedExaminations: allExams.filter((e) => Boolean(e.isArchived) && e.scope === 'custom'),
    subjects: allSubjects.filter((s) => !s.isArchived),
    archivedSubjects: allSubjects.filter((s) => Boolean(s.isArchived) && s.scope === 'custom'),
    chapters,
    topics: topicsRes.items,
    selectedSubjectIds: user?.selectedSubjectIds ?? [],
  };
}

export async function setActiveEducationSystemForStudent(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
  userRepo: UserRepository = getActiveUserRepository(),
): Promise<{ user: PublicUserProfile }> {
  const verified = requireAuth(actor);
  const parsed = setActiveEducationSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid active education selection', parsed.error.flatten());
  }
  const sys = await curriculumRepo.findEducationSystemById(parsed.data.educationSystemId);
  assertCurriculumRecordReadable(sys, verified, 'Education system');
  if (sys?.isArchived) {
    throw AppError.validation('Cannot activate an archived education system');
  }

  let levelCode: string | undefined;
  if (parsed.data.educationLevelId) {
    const lvl = await curriculumRepo.findEducationLevelById(parsed.data.educationLevelId);
    assertCurriculumRecordReadable(lvl, verified, 'Education level');
    levelCode = lvl?.code;
  }

  let examCode: string | undefined;
  if (parsed.data.targetExaminationId) {
    const exam = await curriculumRepo.findExaminationById(parsed.data.targetExaminationId);
    assertCurriculumRecordReadable(exam, verified, 'Examination');
    examCode = exam?.code;
  }

  const existingUser = await userRepo.findById(verified.userId);
  const updated = await userRepo.updateById(verified.userId, {
    educationSystemId: sys!.id,
    educationLevelId: parsed.data.educationLevelId ?? undefined,
    targetExaminationId: parsed.data.targetExaminationId ?? undefined,
    onboardingMeta: {
      ...existingUser?.onboardingMeta,
      educationSystemCode: sys!.code,
      ...(levelCode ? { educationLevelCode: levelCode } : {}),
      ...(examCode ? { targetExaminationCode: examCode } : {}),
    },
  });
  if (!updated) throw AppError.notFound('User account');
  return { user: toPublicUserProfile(updated) };
}

export async function createCustomEducationSystemForStudent(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
  userRepo: UserRepository = getActiveUserRepository(),
): Promise<{ system: EducationSystemRecord; labels: EducationLabelDefinition[] }> {
  const verified = requireAuth(actor);
  const parsed = createCustomEducationSystemSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid custom education system payload', parsed.error.flatten());
  }

  const data = parsed.data;
  const presetKey: EducationPresetKey = data.hierarchyPreset ?? 'default';
  const presetLabels = cloneDefaultLabels(presetKey);
  const hierarchyLevels =
    data.hierarchyLevels && data.hierarchyLevels.length > 0
      ? data.hierarchyLevels
      : hierarchyLevelsFromLabels(presetLabels);

  const code = data.code ?? buildCustomCode('SYS', data.name);
  let system: EducationSystemRecord;
  try {
    system = await curriculumRepo.createEducationSystem({
      code,
      name: data.name,
      description: data.description,
      country: data.country.toUpperCase(),
      supportedLanguages: [data.preferredLanguage, data.preferredLanguage === 'en' ? 'bn' : 'en'],
      scope: 'custom',
      ownerUserId: verified.userId,
      educationType: data.educationType,
      preferredLanguage: data.preferredLanguage,
      academicYear: data.academicYear,
      hierarchyLevels,
      isArchived: false,
      isActive: true,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Duplicate')) {
      throw AppError.conflict(`You already have a custom education system with code "${code}"`);
    }
    throw err;
  }

  const resolvedLabels =
    data.hierarchyLevels && data.hierarchyLevels.length > 0
      ? labelsFromHierarchyLevels(data.hierarchyLevels)
      : presetLabels;

  await curriculumRepo.upsertLabelConfig({
    userId: verified.userId,
    educationSystemId: system.id,
    presetName: presetKey,
    labels: resolvedLabels,
  });

  if (data.setAsActive) {
    const existingUser = await userRepo.findById(verified.userId);
    await userRepo.updateById(verified.userId, {
      educationSystemId: system.id,
      onboardingMeta: {
        ...existingUser?.onboardingMeta,
        educationSystemCode: system.code,
      },
    });
  }

  return { system, labels: resolvedLabels };
}

export async function updateCustomEducationSystemForStudent(
  actor: AuthenticatedActor | null | undefined,
  systemId: string,
  rawInput: unknown,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
): Promise<{ system: EducationSystemRecord }> {
  const verified = requireAuth(actor);
  const existing = await curriculumRepo.findEducationSystemById(systemId);
  assertCustomRecordEditable(existing, verified, 'Education system');

  const parsed = updateCustomEducationSystemSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid custom education system update payload', parsed.error.flatten());
  }

  const patch = {
    ...parsed.data,
    ...(parsed.data.country ? { country: parsed.data.country.toUpperCase() } : {}),
  };
  const updated = await curriculumRepo.updateEducationSystem(systemId, patch);
  if (!updated) throw AppError.notFound('Education system');
  return { system: updated };
}

export async function deleteCustomEducationSystemForStudent(
  actor: AuthenticatedActor | null | undefined,
  systemId: string,
  options: { forceCascade?: boolean } = {},
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
  userRepo: UserRepository = getActiveUserRepository(),
): Promise<{ deleted: true; systemId: string }> {
  const verified = requireAuth(actor);
  const existing = await curriculumRepo.findEducationSystemById(systemId);
  assertCustomRecordEditable(existing, verified, 'Education system');

  const visibilityCustom = {
    viewerUserId: verified.userId,
    scopeFilter: 'custom' as const,
    includeArchived: true,
  };
  const [levels, exams, subjects] = await Promise.all([
    curriculumRepo.listEducationLevels(systemId, true, visibilityCustom),
    curriculumRepo.listExaminations({
      educationSystemId: systemId,
      includeInactive: true,
      ...visibilityCustom,
    }),
    curriculumRepo.listSubjects({
      educationSystemId: systemId,
      includeInactive: true,
      ...visibilityCustom,
    }),
  ]);

  const descendantCount = levels.length + exams.length + subjects.length;
  if (descendantCount > 0 && !options.forceCascade) {
    throw AppError.conflict(
      `This custom system still contains ${subjects.length} subject(s), ${exams.length} examination(s), and ${levels.length} level(s). Archive it or confirm cascade deletion.`,
    );
  }

  if (options.forceCascade) {
    for (const subject of subjects) {
      const chapters = await curriculumRepo.listChapters(subject.id, true, visibilityCustom);
      for (const chapter of chapters) {
        const topicsRes = await curriculumRepo.listTopics({
          chapterId: chapter.id,
          includeInactive: true,
          page: 1,
          limit: 500,
          ...visibilityCustom,
        });
        for (const topic of topicsRes.items) {
          await curriculumRepo.deleteTopic(topic.id);
        }
        await curriculumRepo.deleteChapter(chapter.id);
      }
      await curriculumRepo.deleteSubject(subject.id);
    }
    for (const exam of exams) {
      await curriculumRepo.deleteExamination(exam.id);
    }
    for (const level of levels) {
      await curriculumRepo.deleteEducationLevel(level.id);
    }
  }

  await curriculumRepo.deleteLabelConfig(verified.userId, systemId);
  await curriculumRepo.deleteEducationSystem(systemId);

  const user = await userRepo.findById(verified.userId);
  if (user && user.educationSystemId === systemId) {
    const removedSubjectSet = new Set(subjects.map((s) => s.id));
    await userRepo.updateById(verified.userId, {
      educationSystemId: undefined,
      educationLevelId: undefined,
      targetExaminationId: undefined,
      selectedSubjectIds: (user.selectedSubjectIds ?? []).filter((id) => !removedSubjectSet.has(id)),
    });
  }

  return { deleted: true, systemId };
}

export async function getEducationLabelsForStudent(
  actor: AuthenticatedActor | null | undefined,
  educationSystemId?: string,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
  userRepo: UserRepository = getActiveUserRepository(),
) {
  const verified = requireAuth(actor);
  let targetSysId = educationSystemId;
  if (targetSysId) {
    const sys = await curriculumRepo.findEducationSystemById(targetSysId);
    assertCurriculumRecordReadable(sys, verified, 'Education system');
  } else {
    const user = await userRepo.findById(verified.userId);
    targetSysId = user?.educationSystemId;
  }
  const resolved = await getResolvedLabelsForUser(verified.userId, targetSysId, curriculumRepo);
  return {
    ...resolved,
    presets: EDUCATION_HIERARCHY_PRESETS,
  };
}

/**
 * Updates UI terminology labels cleanly without touching underlying curriculum entities.
 */
export async function upsertEducationLabelsForStudent(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
) {
  const verified = requireAuth(actor);
  const parsed = upsertEducationLabelsSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid education label configuration', parsed.error.flatten());
  }

  const data = parsed.data;
  if (data.educationSystemId) {
    const sys = await curriculumRepo.findEducationSystemById(data.educationSystemId);
    assertCurriculumRecordReadable(sys, verified, 'Education system');
  }

  const normalizedLabels: EducationLabelDefinition[] = [...data.labels]
    .sort((a, b) => a.order - b.order)
    .map((item, idx) => ({
      key: item.key,
      defaultLabel:
        item.defaultLabel ??
        DEFAULT_EDUCATION_LABELS.find((d) => d.key === item.key)?.defaultLabel ??
        item.singular,
      singular: item.singular,
      plural: item.plural,
      order: idx,
      required: item.required,
      allowMultiple: item.allowMultiple,
      isVisible: item.isVisible,
    }));

  const saved = await curriculumRepo.upsertLabelConfig({
    userId: verified.userId,
    educationSystemId: data.educationSystemId || undefined,
    presetName: data.presetName,
    labels: normalizedLabels,
  });

  // Update hierarchyLevels metadata only if this belongs to user's own custom system (never modifies entity names)
  if (data.educationSystemId) {
    const sys = await curriculumRepo.findEducationSystemById(data.educationSystemId);
    if (sys && sys.scope === 'custom' && sys.ownerUserId === verified.userId) {
      await curriculumRepo.updateEducationSystem(sys.id, {
        hierarchyLevels: hierarchyLevelsFromLabels(normalizedLabels.filter((l) => l.isVisible)),
      });
    }
  }

  return {
    config: saved,
    labels: saved.labels,
    hierarchyPreview: buildHierarchyPreview(saved.labels),
  };
}

export async function resetEducationLabelsForStudent(
  actor: AuthenticatedActor | null | undefined,
  educationSystemId?: string,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
) {
  const verified = requireAuth(actor);
  await curriculumRepo.deleteLabelConfig(verified.userId, educationSystemId || undefined);
  if (educationSystemId) {
    const sys = await curriculumRepo.findEducationSystemById(educationSystemId);
    if (sys && sys.scope === 'custom' && sys.ownerUserId === verified.userId) {
      await curriculumRepo.updateEducationSystem(sys.id, {
        hierarchyLevels: hierarchyLevelsFromLabels(DEFAULT_EDUCATION_LABELS.filter((l) => l.isVisible)),
      });
    }
  }
  const resolved = await getResolvedLabelsForUser(verified.userId, educationSystemId, curriculumRepo);
  return resolved;
}

export async function createCustomEducationLevelForStudent(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
): Promise<{ level: EducationLevelRecord }> {
  const verified = requireAuth(actor);
  const parsed = createCustomEducationLevelSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid custom education level payload', parsed.error.flatten());
  }

  const data = parsed.data;
  const sys = await curriculumRepo.findEducationSystemById(data.educationSystemId);
  assertCurriculumRecordReadable(sys, verified, 'Education system');

  const code = data.code ?? buildCustomCode('LVL', data.name);
  const level = await curriculumRepo.createEducationLevel({
    educationSystemId: sys!.id,
    code,
    name: data.name,
    description: data.description,
    hierarchyKey: data.hierarchyKey,
    scope: 'custom',
    ownerUserId: verified.userId,
    order: data.order,
    isArchived: false,
    isActive: true,
  });
  return { level };
}

export async function updateCustomEducationLevelForStudent(
  actor: AuthenticatedActor | null | undefined,
  levelId: string,
  rawInput: unknown,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
): Promise<{ level: EducationLevelRecord }> {
  const verified = requireAuth(actor);
  const existing = await curriculumRepo.findEducationLevelById(levelId);
  assertCustomRecordEditable(existing, verified, 'Education level');

  const parsed = updateCustomEducationLevelSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid custom education level update', parsed.error.flatten());
  }
  const updated = await curriculumRepo.updateEducationLevel(levelId, parsed.data);
  if (!updated) throw AppError.notFound('Education level');
  return { level: updated };
}

export async function deleteCustomEducationLevelForStudent(
  actor: AuthenticatedActor | null | undefined,
  levelId: string,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
): Promise<{ deleted: true; levelId: string }> {
  const verified = requireAuth(actor);
  const existing = await curriculumRepo.findEducationLevelById(levelId);
  assertCustomRecordEditable(existing, verified, 'Education level');

  const childSubjects = await curriculumRepo.listSubjects({
    educationLevelId: levelId,
    includeInactive: true,
    viewerUserId: verified.userId,
    scopeFilter: 'all',
  });
  if (childSubjects.length > 0) {
    throw AppError.conflict('Cannot delete level while subjects reference it');
  }
  await curriculumRepo.deleteEducationLevel(levelId);
  return { deleted: true, levelId };
}

export async function createCustomExaminationForStudent(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
): Promise<{ examination: ExaminationRecord }> {
  const verified = requireAuth(actor);
  const parsed = createCustomExaminationSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid custom examination payload', parsed.error.flatten());
  }
  const data = parsed.data;
  const sys = await curriculumRepo.findEducationSystemById(data.educationSystemId);
  assertCurriculumRecordReadable(sys, verified, 'Education system');

  if (data.educationLevelId) {
    const lvl = await curriculumRepo.findEducationLevelById(data.educationLevelId);
    assertCurriculumRecordReadable(lvl, verified, 'Education level');
  }
  for (const subjectId of data.subjectIds) {
    const subj = await curriculumRepo.findSubjectById(subjectId);
    assertCurriculumRecordReadable(subj, verified, 'Subject');
  }

  const code = data.code ?? buildCustomCode('EXM', data.name);
  const examination = await curriculumRepo.createExamination({
    educationSystemId: sys!.id,
    educationLevelId: data.educationLevelId || undefined,
    code,
    name: data.name,
    description: data.description,
    examDate: data.examDate ? new Date(data.examDate) : null,
    customLabelTag: data.customLabelTag,
    academicSession: data.academicSession,
    subjectIds: data.subjectIds,
    syllabusCoverage: data.syllabusCoverage,
    totalMarks: data.totalMarks,
    durationMinutes: data.durationMinutes,
    preparationGoals: data.preparationGoals,
    topicPriorities: data.topicPriorities,
    scope: 'custom',
    ownerUserId: verified.userId,
    isArchived: false,
    isActive: true,
  });

  // Back-link owned custom subjects cleanly when associated
  for (const subjectId of data.subjectIds) {
    const subj = await curriculumRepo.findSubjectById(subjectId);
    if (subj && subj.scope === 'custom' && subj.ownerUserId === verified.userId) {
      if (!subj.examinationIds.includes(examination.id)) {
        await curriculumRepo.updateSubject(subj.id, {
          examinationIds: [...subj.examinationIds, examination.id],
        });
      }
    }
  }

  return { examination };
}

export async function updateCustomExaminationForStudent(
  actor: AuthenticatedActor | null | undefined,
  examId: string,
  rawInput: unknown,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
): Promise<{ examination: ExaminationRecord }> {
  const verified = requireAuth(actor);
  const existing = await curriculumRepo.findExaminationById(examId);
  assertCustomRecordEditable(existing, verified, 'Examination');

  const parsed = updateCustomExaminationSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid custom examination update payload', parsed.error.flatten());
  }

  const data = parsed.data;
  if (data.subjectIds) {
    for (const subjectId of data.subjectIds) {
      const subj = await curriculumRepo.findSubjectById(subjectId);
      assertCurriculumRecordReadable(subj, verified, 'Subject');
    }
  }

  const updated = await curriculumRepo.updateExamination(examId, {
    ...(data.educationLevelId !== undefined
      ? { educationLevelId: data.educationLevelId || undefined }
      : {}),
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.customLabelTag !== undefined ? { customLabelTag: data.customLabelTag } : {}),
    ...(data.academicSession !== undefined ? { academicSession: data.academicSession } : {}),
    ...(data.examDate !== undefined
      ? { examDate: data.examDate ? new Date(data.examDate) : null }
      : {}),
    ...(data.subjectIds !== undefined ? { subjectIds: data.subjectIds } : {}),
    ...(data.syllabusCoverage !== undefined ? { syllabusCoverage: data.syllabusCoverage } : {}),
    ...(data.totalMarks !== undefined ? { totalMarks: data.totalMarks ?? undefined } : {}),
    ...(data.durationMinutes !== undefined
      ? { durationMinutes: data.durationMinutes ?? undefined }
      : {}),
    ...(data.preparationGoals !== undefined ? { preparationGoals: data.preparationGoals } : {}),
    ...(data.topicPriorities !== undefined ? { topicPriorities: data.topicPriorities } : {}),
    ...(data.isArchived !== undefined ? { isArchived: data.isArchived } : {}),
  });

  if (!updated) throw AppError.notFound('Examination');
  return { examination: updated };
}

export async function duplicateCustomExaminationForStudent(
  actor: AuthenticatedActor | null | undefined,
  examId: string,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
): Promise<{ examination: ExaminationRecord }> {
  const verified = requireAuth(actor);
  const existing = await curriculumRepo.findExaminationById(examId);
  assertCurriculumRecordReadable(existing, verified, 'Examination');

  const copyName = `${existing!.name} (Copy)`;
  const duplicated = await curriculumRepo.createExamination({
    educationSystemId: existing!.educationSystemId,
    educationLevelId: existing!.educationLevelId,
    code: buildCustomCode('EXM', existing!.name),
    name: copyName,
    description: existing!.description,
    examDate: existing!.examDate ?? null,
    customLabelTag: existing!.customLabelTag,
    academicSession: existing!.academicSession,
    subjectIds: [...(existing!.subjectIds ?? [])],
    syllabusCoverage: existing!.syllabusCoverage,
    totalMarks: existing!.totalMarks,
    durationMinutes: existing!.durationMinutes,
    preparationGoals: [...(existing!.preparationGoals ?? [])],
    topicPriorities: (existing!.topicPriorities ?? []).map((p) => ({ ...p })),
    scope: 'custom',
    ownerUserId: verified.userId,
    isArchived: false,
    isActive: true,
  });

  return { examination: duplicated };
}

export async function deleteCustomExaminationForStudent(
  actor: AuthenticatedActor | null | undefined,
  examId: string,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
  userRepo: UserRepository = getActiveUserRepository(),
): Promise<{ deleted: true; examId: string }> {
  const verified = requireAuth(actor);
  const existing = await curriculumRepo.findExaminationById(examId);
  assertCustomRecordEditable(existing, verified, 'Examination');

  // Safe relationship cleanup on owned custom subjects
  const customSubjects = await curriculumRepo.listSubjects({
    viewerUserId: verified.userId,
    scopeFilter: 'custom',
    includeArchived: true,
    includeInactive: true,
  });
  for (const subj of customSubjects) {
    if (subj.examinationIds.includes(examId)) {
      await curriculumRepo.updateSubject(subj.id, {
        examinationIds: subj.examinationIds.filter((id) => id !== examId),
      });
    }
  }

  await curriculumRepo.deleteExamination(examId);

  const user = await userRepo.findById(verified.userId);
  if (user && user.targetExaminationId === examId) {
    await userRepo.updateById(verified.userId, { targetExaminationId: undefined });
  }

  return { deleted: true, examId };
}

export async function createCustomSubjectForStudent(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
  userRepo: UserRepository = getActiveUserRepository(),
): Promise<{ subject: SubjectRecord }> {
  const verified = requireAuth(actor);
  const parsed = createCustomSubjectSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid custom subject payload', parsed.error.flatten());
  }

  const data = parsed.data;
  const sys = await curriculumRepo.findEducationSystemById(data.educationSystemId);
  assertCurriculumRecordReadable(sys, verified, 'Education system');
  if (data.educationLevelId) {
    const lvl = await curriculumRepo.findEducationLevelById(data.educationLevelId);
    assertCurriculumRecordReadable(lvl, verified, 'Education level');
  }
  for (const examId of data.examinationIds) {
    const exam = await curriculumRepo.findExaminationById(examId);
    assertCurriculumRecordReadable(exam, verified, 'Examination');
  }

  const code = data.code ?? buildCustomCode('SUB', data.name);
  const subject = await curriculumRepo.createSubject({
    educationSystemId: sys!.id,
    educationLevelId: data.educationLevelId || undefined,
    examinationIds: data.examinationIds,
    code,
    name: data.name,
    nameBn: data.nameBn,
    description: data.description,
    color: data.color,
    icon: data.icon,
    difficultyLevel: data.difficultyLevel,
    learningObjectives: data.learningObjectives,
    scope: 'custom',
    ownerUserId: verified.userId,
    order: data.order,
    isArchived: false,
    isActive: true,
  });

  // Back-link owned examinations if linked
  for (const examId of data.examinationIds) {
    const exam = await curriculumRepo.findExaminationById(examId);
    if (exam && exam.scope === 'custom' && exam.ownerUserId === verified.userId) {
      const current = exam.subjectIds ?? [];
      if (!current.includes(subject.id)) {
        await curriculumRepo.updateExamination(exam.id, { subjectIds: [...current, subject.id] });
      }
    }
  }

  const user = await userRepo.findById(verified.userId);
  if (user) {
    const nextSelected = Array.from(new Set([...(user.selectedSubjectIds ?? []), subject.id]));
    await userRepo.updateById(verified.userId, { selectedSubjectIds: nextSelected });
  }

  return { subject };
}

export async function updateCustomSubjectForStudent(
  actor: AuthenticatedActor | null | undefined,
  subjectId: string,
  rawInput: unknown,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
): Promise<{ subject: SubjectRecord }> {
  const verified = requireAuth(actor);
  const existing = await curriculumRepo.findSubjectById(subjectId);
  assertCustomRecordEditable(existing, verified, 'Subject');

  const parsed = updateCustomSubjectSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid custom subject update payload', parsed.error.flatten());
  }

  const { educationLevelId, ...subjectRest } = parsed.data;
  const updated = await curriculumRepo.updateSubject(subjectId, {
    ...subjectRest,
    ...(educationLevelId !== undefined
      ? { educationLevelId: educationLevelId || undefined }
      : {}),
  });
  if (!updated) throw AppError.notFound('Subject');
  return { subject: updated };
}

export async function deleteCustomSubjectForStudent(
  actor: AuthenticatedActor | null | undefined,
  subjectId: string,
  options: { forceCascade?: boolean } = {},
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
  userRepo: UserRepository = getActiveUserRepository(),
): Promise<{ deleted: true; subjectId: string }> {
  const verified = requireAuth(actor);
  const existing = await curriculumRepo.findSubjectById(subjectId);
  assertCustomRecordEditable(existing, verified, 'Subject');

  const visibilityCustom = {
    viewerUserId: verified.userId,
    scopeFilter: 'custom' as const,
    includeArchived: true,
  };
  const chapters = await curriculumRepo.listChapters(subjectId, true, visibilityCustom);
  if (chapters.length > 0 && !options.forceCascade) {
    throw AppError.conflict(
      `This custom subject contains ${chapters.length} chapter(s). Archive it or confirm cascade deletion.`,
    );
  }

  if (options.forceCascade) {
    for (const chapter of chapters) {
      const topicsRes = await curriculumRepo.listTopics({
        chapterId: chapter.id,
        includeInactive: true,
        page: 1,
        limit: 500,
        ...visibilityCustom,
      });
      for (const topic of topicsRes.items) {
        await curriculumRepo.deleteTopic(topic.id);
      }
      await curriculumRepo.deleteChapter(chapter.id);
    }
  }

  const customExams = await curriculumRepo.listExaminations({
    ...visibilityCustom,
    includeInactive: true,
  });
  for (const exam of customExams) {
    if (exam.subjectIds?.includes(subjectId)) {
      await curriculumRepo.updateExamination(exam.id, {
        subjectIds: exam.subjectIds.filter((id) => id !== subjectId),
      });
    }
  }

  await curriculumRepo.deleteSubject(subjectId);

  const user = await userRepo.findById(verified.userId);
  if (user && user.selectedSubjectIds?.includes(subjectId)) {
    await userRepo.updateById(verified.userId, {
      selectedSubjectIds: user.selectedSubjectIds.filter((id) => id !== subjectId),
    });
  }

  return { deleted: true, subjectId };
}

export async function createCustomChapterForStudent(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
): Promise<{ chapter: ChapterRecord }> {
  const verified = requireAuth(actor);
  const parsed = createCustomChapterSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid custom chapter payload', parsed.error.flatten());
  }

  const data = parsed.data;
  const parentSubject = await curriculumRepo.findSubjectById(data.subjectId);
  assertCustomRecordEditable(parentSubject, verified, 'Subject');

  const existingChapters = await curriculumRepo.listChapters(data.subjectId, true, {
    viewerUserId: verified.userId,
    scopeFilter: 'all',
    includeArchived: true,
  });
  const nextChapterNumber =
    data.chapterNumber ??
    (existingChapters.length > 0
      ? Math.max(...existingChapters.map((c) => c.chapterNumber)) + 1
      : 1);

  const chapter = await curriculumRepo.createChapter({
    subjectId: parentSubject!.id,
    chapterNumber: nextChapterNumber,
    title: data.title,
    titleBn: data.titleBn,
    description: data.description,
    learningObjectives: data.learningObjectives,
    scope: 'custom',
    ownerUserId: verified.userId,
    order: data.order || nextChapterNumber,
    isArchived: false,
    isActive: true,
  });

  return { chapter };
}

export async function updateCustomChapterForStudent(
  actor: AuthenticatedActor | null | undefined,
  chapterId: string,
  rawInput: unknown,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
): Promise<{ chapter: ChapterRecord }> {
  const verified = requireAuth(actor);
  const existing = await curriculumRepo.findChapterById(chapterId);
  assertCustomRecordEditable(existing, verified, 'Chapter');

  const parsed = updateCustomChapterSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid custom chapter update payload', parsed.error.flatten());
  }
  const updated = await curriculumRepo.updateChapter(chapterId, parsed.data);
  if (!updated) throw AppError.notFound('Chapter');
  return { chapter: updated };
}

export async function deleteCustomChapterForStudent(
  actor: AuthenticatedActor | null | undefined,
  chapterId: string,
  options: { forceCascade?: boolean } = {},
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
): Promise<{ deleted: true; chapterId: string }> {
  const verified = requireAuth(actor);
  const existing = await curriculumRepo.findChapterById(chapterId);
  assertCustomRecordEditable(existing, verified, 'Chapter');

  const topicsRes = await curriculumRepo.listTopics({
    chapterId,
    includeInactive: true,
    page: 1,
    limit: 500,
    viewerUserId: verified.userId,
    scopeFilter: 'custom',
    includeArchived: true,
  });
  if (topicsRes.total > 0 && !options.forceCascade) {
    throw AppError.conflict(
      `This chapter still contains ${topicsRes.total} topic(s). Archive it or confirm cascade deletion.`,
    );
  }

  if (options.forceCascade) {
    for (const topic of topicsRes.items) {
      await curriculumRepo.deleteTopic(topic.id);
    }
  }

  await curriculumRepo.deleteChapter(chapterId);
  return { deleted: true, chapterId };
}

export async function createCustomTopicForStudent(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
): Promise<{ topic: TopicRecord }> {
  const verified = requireAuth(actor);
  const parsed = createCustomTopicSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid custom topic payload', parsed.error.flatten());
  }

  const data = parsed.data;
  const [parentSubject, parentChapter] = await Promise.all([
    curriculumRepo.findSubjectById(data.subjectId),
    curriculumRepo.findChapterById(data.chapterId),
  ]);
  assertCustomRecordEditable(parentSubject, verified, 'Subject');
  assertCustomRecordEditable(parentChapter, verified, 'Chapter');
  if (parentChapter!.subjectId !== parentSubject!.id) {
    throw AppError.validation('Topic chapter does not belong to the selected subject');
  }

  const topic = await curriculumRepo.createTopic({
    subjectId: parentSubject!.id,
    chapterId: parentChapter!.id,
    code: data.code ?? buildCustomCode('TOP', data.title),
    title: data.title,
    titleBn: data.titleBn,
    description: data.description,
    learningObjectives: data.learningObjectives,
    prerequisiteTopicIds: [],
    difficulty: data.difficulty,
    estimatedMinutes: data.estimatedMinutes,
    keyConcepts: data.keyConcepts,
    curriculumReferences: data.curriculumReferences,
    syllabusWeightVerified: false,
    scope: 'custom',
    ownerUserId: verified.userId,
    order: data.order,
    isArchived: false,
    isActive: true,
  });

  return { topic };
}

export async function updateCustomTopicForStudent(
  actor: AuthenticatedActor | null | undefined,
  topicId: string,
  rawInput: unknown,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
): Promise<{ topic: TopicRecord }> {
  const verified = requireAuth(actor);
  const existing = await curriculumRepo.findTopicById(topicId);
  assertCustomRecordEditable(existing, verified, 'Topic');

  const parsed = updateCustomTopicSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid custom topic update payload', parsed.error.flatten());
  }

  const updated = await curriculumRepo.updateTopic(topicId, parsed.data);
  if (!updated) throw AppError.notFound('Topic');
  return { topic: updated };
}

export async function deleteCustomTopicForStudent(
  actor: AuthenticatedActor | null | undefined,
  topicId: string,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
  userRepo: UserRepository = getActiveUserRepository(),
): Promise<{ deleted: true; topicId: string }> {
  const verified = requireAuth(actor);
  const existing = await curriculumRepo.findTopicById(topicId);
  assertCustomRecordEditable(existing, verified, 'Topic');

  await curriculumRepo.deleteTopic(topicId);
  const user = await userRepo.findById(verified.userId);
  if (user && user.savedTopicIds.includes(topicId)) {
    await userRepo.updateById(verified.userId, {
      savedTopicIds: user.savedTopicIds.filter((id) => id !== topicId),
    });
  }
  return { deleted: true, topicId };
}
