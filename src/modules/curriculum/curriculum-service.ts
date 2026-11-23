/**
 * LearnMate AI — Curriculum & Administrative CMS Service
 * Implements SRS Section 4.3 (FR-CUR-001..009) and Section 4.12 (FR-ADMIN-001..004, FR-ADMIN-011).
 */

import type { EducationLabelDefinition } from '../../config/education-presets.ts';
import { AppError } from '../../lib/api/errors.ts';
import { buildPaginationMeta, type PaginationMeta } from '../../lib/api/response.ts';
import {
  hasPermission,
  requireAuth,
  requirePermission,
  type AuthenticatedActor,
} from '../../lib/auth/rbac.ts';
import {
  adminUpdateUserSchema,
  adminUserListQuerySchema,
  createCurriculumEntitySchema,
  curriculumFilterQuerySchema,
  curriculumImportRequestSchema,
  deleteCurriculumEntitySchema,
  toggleSavedTopicSchema,
  topicPayloadSchema,
  updateCurriculumEntitySchema,
} from '../../lib/validators/curriculum.ts';
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
import {
  assertCurriculumRecordReadable,
  getResolvedLabelsForUser,
} from './custom-education-service.ts';
import type {
  AuditLogRecord,
  ChapterRecord,
  EducationLevelRecord,
  EducationSystemRecord,
  ExaminationRecord,
  SubjectRecord,
  TopicRecord,
} from './seed-data.ts';

export interface CurriculumHierarchyResponse {
  educationSystems: EducationSystemRecord[];
  educationLevels: EducationLevelRecord[];
  examinations: ExaminationRecord[];
  subjects: SubjectRecord[];
  chapters: ChapterRecord[];
  topics: TopicRecord[];
  savedTopicIds: string[];
  labels: EducationLabelDefinition[];
  hierarchyPreview: string;
  meta: PaginationMeta;
}

export async function browseCurriculumHierarchy(
  actor: AuthenticatedActor | null | undefined,
  rawQuery: unknown,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
  userRepo: UserRepository = getActiveUserRepository(),
): Promise<CurriculumHierarchyResponse> {
  const verified = requireAuth(actor);
  const parsed = curriculumFilterQuerySchema.safeParse(rawQuery ?? {});
  if (!parsed.success) {
    throw AppError.validation('Invalid curriculum filter parameters', parsed.error.flatten());
  }

  const query = parsed.data;
  const allowInactive = Boolean(
    query.includeInactive && hasPermission(verified.role, 'curriculum:write'),
  );
  const visibility = { viewerUserId: verified.userId, scopeFilter: 'all' as const };

  const user = await userRepo.findById(verified.userId);
  const savedTopicIds = user?.savedTopicIds ?? [];
  const labelContextSystemId = query.educationSystemId || user?.educationSystemId;

  const [educationSystems, educationLevels, examinations, subjects, chapters, labelInfo] =
    await Promise.all([
      curriculumRepo.listEducationSystems(allowInactive, query.country, visibility),
      curriculumRepo.listEducationLevels(query.educationSystemId, allowInactive, visibility),
      curriculumRepo.listExaminations({
        educationSystemId: query.educationSystemId,
        educationLevelId: query.educationLevelId,
        includeInactive: allowInactive,
        ...visibility,
      }),
      curriculumRepo.listSubjects({
        educationSystemId: query.educationSystemId,
        educationLevelId: query.educationLevelId,
        examinationId: query.examinationId,
        includeInactive: allowInactive,
        ...visibility,
      }),
      curriculumRepo.listChapters(query.subjectId, allowInactive, visibility),
      getResolvedLabelsForUser(verified.userId, labelContextSystemId, curriculumRepo),
    ]);

  const topicResult = await curriculumRepo.listTopics({
    subjectId: query.subjectId,
    chapterId: query.chapterId,
    difficulty: query.difficulty,
    search: query.search,
    topicIds: query.savedOnly ? savedTopicIds : undefined,
    includeInactive: allowInactive,
    page: query.page,
    limit: query.limit,
    ...visibility,
  });

  return {
    educationSystems,
    educationLevels,
    examinations,
    subjects,
    chapters,
    topics: topicResult.items,
    savedTopicIds,
    labels: labelInfo.labels,
    hierarchyPreview: labelInfo.hierarchyPreview,
    meta: buildPaginationMeta(query.page, query.limit, topicResult.total),
  };
}

export async function listTopicsForUser(
  actor: AuthenticatedActor | null | undefined,
  rawQuery: unknown,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
  userRepo: UserRepository = getActiveUserRepository(),
): Promise<{ topics: TopicRecord[]; savedTopicIds: string[]; meta: PaginationMeta }> {
  const verified = requireAuth(actor);
  const parsed = curriculumFilterQuerySchema.safeParse(rawQuery ?? {});
  if (!parsed.success) {
    throw AppError.validation('Invalid topic filter parameters', parsed.error.flatten());
  }
  const query = parsed.data;
  const allowInactive = Boolean(
    query.includeInactive && hasPermission(verified.role, 'curriculum:write'),
  );
  const user = await userRepo.findById(verified.userId);
  const savedTopicIds = user?.savedTopicIds ?? [];

  const result = await curriculumRepo.listTopics({
    subjectId: query.subjectId,
    chapterId: query.chapterId,
    difficulty: query.difficulty,
    search: query.search,
    topicIds: query.savedOnly ? savedTopicIds : undefined,
    includeInactive: allowInactive,
    page: query.page,
    limit: query.limit,
    viewerUserId: verified.userId,
    scopeFilter: 'all',
  });

  return {
    topics: result.items,
    savedTopicIds,
    meta: buildPaginationMeta(query.page, query.limit, result.total),
  };
}

export async function getTopicDetailForUser(
  actor: AuthenticatedActor | null | undefined,
  topicId: string,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
  userRepo: UserRepository = getActiveUserRepository(),
): Promise<{
  topic: TopicRecord;
  subject: SubjectRecord | null;
  chapter: ChapterRecord | null;
  prerequisites: TopicRecord[];
  isSaved: boolean;
}> {
  const verified = requireAuth(actor);
  const topic = await curriculumRepo.findTopicById(topicId);
  assertCurriculumRecordReadable(topic, verified, 'Topic');
  if (!topic || (!topic.isActive && !hasPermission(verified.role, 'curriculum:write'))) {
    throw AppError.notFound('Topic');
  }

  const [subject, chapter, user] = await Promise.all([
    curriculumRepo.findSubjectById(topic.subjectId),
    curriculumRepo.findChapterById(topic.chapterId),
    userRepo.findById(verified.userId),
  ]);

  const prerequisites: TopicRecord[] = [];
  for (const prereqId of topic.prerequisiteTopicIds) {
    const found = await curriculumRepo.findTopicById(prereqId);
    if (found && ((found.scope ?? 'global') === 'global' || found.ownerUserId === verified.userId)) {
      prerequisites.push(found);
    }
  }

  return {
    topic,
    subject,
    chapter,
    prerequisites,
    isSaved: Boolean(user?.savedTopicIds.includes(topic.id)),
  };
}

export async function getSavedTopicsForStudent(
  actor: AuthenticatedActor | null | undefined,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
  userRepo: UserRepository = getActiveUserRepository(),
): Promise<{ savedTopicIds: string[]; topics: TopicRecord[] }> {
  const verified = requireAuth(actor);
  const user = await userRepo.findById(verified.userId);
  if (!user) {
    throw AppError.notFound('User account');
  }
  if (user.savedTopicIds.length === 0) {
    return { savedTopicIds: [], topics: [] };
  }
  const result = await curriculumRepo.listTopics({
    topicIds: user.savedTopicIds,
    page: 1,
    limit: 100,
    viewerUserId: verified.userId,
    scopeFilter: 'all',
  });
  return {
    savedTopicIds: user.savedTopicIds,
    topics: result.items,
  };
}

export async function toggleSavedTopicForStudent(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
  userRepo: UserRepository = getActiveUserRepository(),
): Promise<{ saved: boolean; savedTopicIds: string[] }> {
  const verified = requireAuth(actor);
  const parsed = toggleSavedTopicSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Valid topicId is required', parsed.error.flatten());
  }

  const topic = await curriculumRepo.findTopicById(parsed.data.topicId);
  assertCurriculumRecordReadable(topic, verified, 'Topic');
  if (!topic || !topic.isActive) {
    throw AppError.notFound('Topic');
  }

  const user = await userRepo.findById(verified.userId);
  if (!user) {
    throw AppError.notFound('User account');
  }

  const currentSet = new Set(user.savedTopicIds);
  let saved: boolean;
  if (currentSet.has(topic.id)) {
    currentSet.delete(topic.id);
    saved = false;
  } else {
    currentSet.add(topic.id);
    saved = true;
  }

  const nextSavedTopicIds = Array.from(currentSet);
  await userRepo.updateById(verified.userId, {
    savedTopicIds: nextSavedTopicIds,
  });

  return {
    saved,
    savedTopicIds: nextSavedTopicIds,
  };
}

export async function getAdminCurriculumSnapshot(
  actor: AuthenticatedActor | null | undefined,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
): Promise<{
  educationSystems: EducationSystemRecord[];
  educationLevels: EducationLevelRecord[];
  examinations: ExaminationRecord[];
  subjects: SubjectRecord[];
  chapters: ChapterRecord[];
  topics: TopicRecord[];
  auditLogs: AuditLogRecord[];
  counts: {
    systems: number;
    levels: number;
    examinations: number;
    subjects: number;
    chapters: number;
    topics: number;
  };
}> {
  requirePermission(actor, 'curriculum:write');

  const globalOnly = { scopeFilter: 'global' as const, includeArchived: true };
  const [educationSystems, educationLevels, examinations, subjects, chapters, topicRes, auditLogs] =
    await Promise.all([
      curriculumRepo.listEducationSystems(true, undefined, globalOnly),
      curriculumRepo.listEducationLevels(undefined, true, globalOnly),
      curriculumRepo.listExaminations({ includeInactive: true, ...globalOnly }),
      curriculumRepo.listSubjects({ includeInactive: true, ...globalOnly }),
      curriculumRepo.listChapters(undefined, true, globalOnly),
      curriculumRepo.listTopics({ includeInactive: true, page: 1, limit: 100, ...globalOnly }),
      curriculumRepo.listAuditLogs(40),
    ]);

  return {
    educationSystems,
    educationLevels,
    examinations,
    subjects,
    chapters,
    topics: topicRes.items,
    auditLogs,
    counts: {
      systems: educationSystems.length,
      levels: educationLevels.length,
      examinations: examinations.length,
      subjects: subjects.length,
      chapters: chapters.length,
      topics: topicRes.total,
    },
  };
}

export async function createCurriculumEntity(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
): Promise<{ entityType: string; record: unknown }> {
  const verified = requirePermission(actor, 'curriculum:write');
  const parsed = createCurriculumEntitySchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid curriculum entity payload', parsed.error.flatten());
  }

  const { entityType, data } = parsed.data;
  let createdRecord: { id: string } & Record<string, unknown>;

  switch (entityType) {
    case 'educationSystem': {
      createdRecord = (await curriculumRepo.createEducationSystem(data)) as unknown as {
        id: string;
      } & Record<string, unknown>;
      break;
    }
    case 'educationLevel': {
      const parentSystem = await curriculumRepo.findEducationSystemById(data.educationSystemId);
      if (!parentSystem) {
        throw AppError.validation('Referenced educationSystemId does not exist');
      }
      createdRecord = (await curriculumRepo.createEducationLevel(data)) as unknown as {
        id: string;
      } & Record<string, unknown>;
      break;
    }
    case 'examination': {
      const [parentSystem, parentLevel] = await Promise.all([
        curriculumRepo.findEducationSystemById(data.educationSystemId),
        curriculumRepo.findEducationLevelById(data.educationLevelId),
      ]);
      if (!parentSystem || !parentLevel || parentLevel.educationSystemId !== parentSystem.id) {
        throw AppError.validation(
          'Examination must reference a valid educationSystemId and matching educationLevelId',
        );
      }
      createdRecord = (await curriculumRepo.createExamination({
        ...data,
        examDate: data.examDate ? new Date(data.examDate) : null,
      })) as unknown as { id: string } & Record<string, unknown>;
      break;
    }
    case 'subject': {
      const [parentSystem, parentLevel] = await Promise.all([
        curriculumRepo.findEducationSystemById(data.educationSystemId),
        curriculumRepo.findEducationLevelById(data.educationLevelId),
      ]);
      if (!parentSystem || !parentLevel || parentLevel.educationSystemId !== parentSystem.id) {
        throw AppError.validation(
          'Subject must reference a valid educationSystemId and matching educationLevelId',
        );
      }
      createdRecord = (await curriculumRepo.createSubject(data)) as unknown as {
        id: string;
      } & Record<string, unknown>;
      break;
    }
    case 'chapter': {
      const parentSubject = await curriculumRepo.findSubjectById(data.subjectId);
      if (!parentSubject) {
        throw AppError.validation('Referenced subjectId does not exist');
      }
      createdRecord = (await curriculumRepo.createChapter(data)) as unknown as {
        id: string;
      } & Record<string, unknown>;
      break;
    }
    case 'topic': {
      const [parentSubject, parentChapter] = await Promise.all([
        curriculumRepo.findSubjectById(data.subjectId),
        curriculumRepo.findChapterById(data.chapterId),
      ]);
      if (!parentSubject || !parentChapter || parentChapter.subjectId !== parentSubject.id) {
        throw AppError.validation('Topic must reference a valid subjectId and matching chapterId');
      }
      for (const prereqId of data.prerequisiteTopicIds) {
        const prereq = await curriculumRepo.findTopicById(prereqId);
        if (!prereq) {
          throw AppError.validation(`Prerequisite topicId ${prereqId} does not exist`);
        }
      }
      createdRecord = (await curriculumRepo.createTopic(data)) as unknown as {
        id: string;
      } & Record<string, unknown>;
      break;
    }
  }

  await curriculumRepo.recordAuditLog({
    actorId: verified.userId,
    actorRole: verified.role,
    action: `curriculum.${entityType}.create`,
    targetCollection: `${entityType}s`,
    targetId: createdRecord.id,
    metadata: { entityType },
  });

  return {
    entityType,
    record: createdRecord,
  };
}

export async function updateCurriculumEntity(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
): Promise<{ entityType: string; record: unknown }> {
  const verified = requirePermission(actor, 'curriculum:write');
  const parsed = updateCurriculumEntitySchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid curriculum update payload', parsed.error.flatten());
  }

  const { entityType, id, data } = parsed.data;
  let updatedRecord: unknown = null;

  switch (entityType) {
    case 'educationSystem':
      updatedRecord = await curriculumRepo.updateEducationSystem(id, data);
      break;
    case 'educationLevel':
      updatedRecord = await curriculumRepo.updateEducationLevel(id, data);
      break;
    case 'examination': {
      const { examDate, ...rest } = data;
      updatedRecord = await curriculumRepo.updateExamination(id, {
        ...rest,
        ...(examDate !== undefined ? { examDate: examDate ? new Date(examDate) : null } : {}),
      });
      break;
    }
    case 'subject':
      updatedRecord = await curriculumRepo.updateSubject(id, data);
      break;
    case 'chapter':
      updatedRecord = await curriculumRepo.updateChapter(id, data);
      break;
    case 'topic':
      updatedRecord = await curriculumRepo.updateTopic(id, data);
      break;
  }

  if (!updatedRecord) {
    throw AppError.notFound(entityType);
  }

  await curriculumRepo.recordAuditLog({
    actorId: verified.userId,
    actorRole: verified.role,
    action: `curriculum.${entityType}.update`,
    targetCollection: `${entityType}s`,
    targetId: id,
    metadata: { updatedFields: Object.keys(data) },
  });

  return {
    entityType,
    record: updatedRecord,
  };
}

export async function deleteCurriculumEntity(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
): Promise<{ deleted: true; entityType: string; id: string }> {
  const verified = requirePermission(actor, 'curriculum:write');
  const parsed = deleteCurriculumEntitySchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid curriculum delete payload', parsed.error.flatten());
  }

  const { entityType, id } = parsed.data;

  // Enforce referential integrity before deleting parent nodes
  if (entityType === 'educationSystem') {
    const childLevels = await curriculumRepo.listEducationLevels(id, true);
    if (childLevels.length > 0) {
      throw AppError.conflict(
        'Cannot delete education system while it still contains education levels',
      );
    }
  } else if (entityType === 'educationLevel') {
    const childSubjects = await curriculumRepo.listSubjects({
      educationLevelId: id,
      includeInactive: true,
    });
    if (childSubjects.length > 0) {
      throw AppError.conflict('Cannot delete education level while it still contains subjects');
    }
  } else if (entityType === 'subject') {
    const childChapters = await curriculumRepo.listChapters(id, true);
    if (childChapters.length > 0) {
      throw AppError.conflict('Cannot delete subject while it still contains chapters');
    }
  } else if (entityType === 'chapter') {
    const childTopics = await curriculumRepo.listTopics({
      chapterId: id,
      includeInactive: true,
      page: 1,
      limit: 1,
    });
    if (childTopics.total > 0) {
      throw AppError.conflict('Cannot delete chapter while it still contains topics');
    }
  }

  let deleted = false;
  switch (entityType) {
    case 'educationSystem':
      deleted = await curriculumRepo.deleteEducationSystem(id);
      break;
    case 'educationLevel':
      deleted = await curriculumRepo.deleteEducationLevel(id);
      break;
    case 'examination':
      deleted = await curriculumRepo.deleteExamination(id);
      break;
    case 'subject':
      deleted = await curriculumRepo.deleteSubject(id);
      break;
    case 'chapter':
      deleted = await curriculumRepo.deleteChapter(id);
      break;
    case 'topic':
      deleted = await curriculumRepo.deleteTopic(id);
      break;
  }

  if (!deleted) {
    throw AppError.notFound(entityType);
  }

  await curriculumRepo.recordAuditLog({
    actorId: verified.userId,
    actorRole: verified.role,
    action: `curriculum.${entityType}.delete`,
    targetCollection: `${entityType}s`,
    targetId: id,
  });

  return { deleted: true, entityType, id };
}

function escapeCsvCell(value: unknown): string {
  const raw = String(value ?? '');
  if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export async function exportCurriculumData(
  actor: AuthenticatedActor | null | undefined,
  format: 'json' | 'csv' = 'json',
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
): Promise<{
  format: 'json' | 'csv';
  exportedAt: string;
  bundle?: {
    educationSystems: EducationSystemRecord[];
    educationLevels: EducationLevelRecord[];
    examinations: ExaminationRecord[];
    subjects: SubjectRecord[];
    chapters: ChapterRecord[];
    topics: TopicRecord[];
  };
  csvText?: string;
}> {
  requirePermission(actor, 'curriculum:write');

  const globalOnly = { scopeFilter: 'global' as const, includeArchived: true };
  const [educationSystems, educationLevels, examinations, subjects, chapters, topicRes] =
    await Promise.all([
      curriculumRepo.listEducationSystems(true, undefined, globalOnly),
      curriculumRepo.listEducationLevels(undefined, true, globalOnly),
      curriculumRepo.listExaminations({ includeInactive: true, ...globalOnly }),
      curriculumRepo.listSubjects({ includeInactive: true, ...globalOnly }),
      curriculumRepo.listChapters(undefined, true, globalOnly),
      curriculumRepo.listTopics({ includeInactive: true, page: 1, limit: 500, ...globalOnly }),
    ]);

  const exportedAt = new Date().toISOString();

  if (format === 'csv') {
    const header = [
      'code',
      'title',
      'titleBn',
      'subjectId',
      'chapterId',
      'difficulty',
      'estimatedMinutes',
      'keyConcepts',
      'learningObjectives',
    ].join(',');
    const rows = topicRes.items.map((t) =>
      [
        escapeCsvCell(t.code),
        escapeCsvCell(t.title),
        escapeCsvCell(t.titleBn ?? ''),
        escapeCsvCell(t.subjectId),
        escapeCsvCell(t.chapterId),
        escapeCsvCell(t.difficulty),
        escapeCsvCell(t.estimatedMinutes),
        escapeCsvCell(t.keyConcepts.join(' | ')),
        escapeCsvCell(t.learningObjectives.join(' | ')),
      ].join(','),
    );
    return {
      format: 'csv',
      exportedAt,
      csvText: [header, ...rows].join('\n'),
    };
  }

  return {
    format: 'json',
    exportedAt,
    bundle: {
      educationSystems,
      educationLevels,
      examinations,
      subjects,
      chapters,
      topics: topicRes.items,
    },
  };
}

export async function importCurriculumData(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
): Promise<{
  importedCounts: {
    educationSystems: number;
    educationLevels: number;
    examinations: number;
    subjects: number;
    chapters: number;
    topics: number;
  };
}> {
  const verified = requirePermission(actor, 'curriculum:write');
  const parsed = curriculumImportRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid curriculum import payload', parsed.error.flatten());
  }

  const importedCounts = {
    educationSystems: 0,
    educationLevels: 0,
    examinations: 0,
    subjects: 0,
    chapters: 0,
    topics: 0,
  };

  if (parsed.data.format === 'json') {
    const { bundle } = parsed.data;
    for (const sys of bundle.educationSystems) {
      await curriculumRepo.createEducationSystem(sys);
      importedCounts.educationSystems += 1;
    }
    for (const lvl of bundle.educationLevels) {
      await curriculumRepo.createEducationLevel(lvl);
      importedCounts.educationLevels += 1;
    }
    for (const exam of bundle.examinations) {
      await curriculumRepo.createExamination({
        ...exam,
        examDate: exam.examDate ? new Date(exam.examDate) : null,
      });
      importedCounts.examinations += 1;
    }
    for (const sub of bundle.subjects) {
      await curriculumRepo.createSubject(sub);
      importedCounts.subjects += 1;
    }
    for (const chap of bundle.chapters) {
      await curriculumRepo.createChapter(chap);
      importedCounts.chapters += 1;
    }
    for (const top of bundle.topics) {
      await curriculumRepo.createTopic(top);
      importedCounts.topics += 1;
    }
  } else {
    const { csvText, defaultSubjectId, defaultChapterId } = parsed.data;
    const [subject, chapter] = await Promise.all([
      curriculumRepo.findSubjectById(defaultSubjectId),
      curriculumRepo.findChapterById(defaultChapterId),
    ]);
    if (!subject || !chapter || chapter.subjectId !== subject.id) {
      throw AppError.validation('CSV import requires a valid defaultSubjectId and defaultChapterId');
    }

    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      throw AppError.validation('CSV payload must contain a header row and at least one topic row');
    }

    const headers = lines[0]!.split(',').map((h) => h.trim());
    for (let i = 1; i < lines.length; i += 1) {
      const cols = lines[i]!.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const rowMap: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowMap[h] = cols[idx] ?? '';
      });

      const validatedTopic = topicPayloadSchema.safeParse({
        subjectId: rowMap.subjectId || defaultSubjectId,
        chapterId: rowMap.chapterId || defaultChapterId,
        code: rowMap.code,
        title: rowMap.title,
        titleBn: rowMap.titleBn || undefined,
        description: rowMap.description || undefined,
        difficulty: (rowMap.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
        estimatedMinutes: rowMap.estimatedMinutes ? Number(rowMap.estimatedMinutes) : 45,
        keyConcepts: rowMap.keyConcepts
          ? rowMap.keyConcepts
              .split('|')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        learningObjectives: rowMap.learningObjectives
          ? rowMap.learningObjectives
              .split('|')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        order: i,
        isActive: true,
      });

      if (!validatedTopic.success) {
        throw AppError.validation(
          `CSV validation failed on row ${i + 1}`,
          validatedTopic.error.flatten(),
        );
      }

      await curriculumRepo.createTopic(validatedTopic.data);
      importedCounts.topics += 1;
    }
  }

  await curriculumRepo.recordAuditLog({
    actorId: verified.userId,
    actorRole: verified.role,
    action: `curriculum.import.${parsed.data.format}`,
    targetCollection: 'topics',
    metadata: importedCounts,
  });

  return { importedCounts };
}

export async function listUsersForAdmin(
  actor: AuthenticatedActor | null | undefined,
  rawQuery: unknown,
  userRepo: UserRepository = getActiveUserRepository(),
): Promise<{ users: PublicUserProfile[]; meta: PaginationMeta }> {
  requirePermission(actor, 'admin:users');
  const parsed = adminUserListQuerySchema.safeParse(rawQuery ?? {});
  if (!parsed.success) {
    throw AppError.validation('Invalid admin user filter query', parsed.error.flatten());
  }

  const query = parsed.data;
  const result = await userRepo.listUsers(query);
  return {
    users: result.items.map(toPublicUserProfile),
    meta: buildPaginationMeta(query.page, query.limit, result.total),
  };
}

export async function updateUserRoleAndStatusForAdmin(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  userRepo: UserRepository = getActiveUserRepository(),
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
): Promise<{ user: PublicUserProfile }> {
  const verified = requirePermission(actor, 'admin:users');
  const parsed = adminUpdateUserSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid user role/status update payload', parsed.error.flatten());
  }

  const { userId, role, status } = parsed.data;
  if (userId === verified.userId) {
    if (role && role !== 'admin') {
      throw AppError.validation('Administrators cannot demote their own active account');
    }
    if (status && status !== 'active') {
      throw AppError.validation('Administrators cannot suspend or delete their own active account');
    }
  }

  const updated = await userRepo.updateById(userId, {
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
  });

  if (!updated) {
    throw AppError.notFound('User account');
  }

  await curriculumRepo.recordAuditLog({
    actorId: verified.userId,
    actorRole: verified.role,
    action: 'admin.user.update_permissions',
    targetCollection: 'users',
    targetId: userId,
    metadata: { role, status },
  });

  return {
    user: toPublicUserProfile(updated),
  };
}
