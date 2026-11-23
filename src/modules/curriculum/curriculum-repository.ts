/**
 * LearnMate AI — Curriculum & Administrative CMS Repository
 * Supports both MongoDB/Mongoose (production) and pre-seeded InMemory (deterministic tests).
 */

import { randomBytes } from 'node:crypto';
import mongoose, { type Types } from 'mongoose';
import type { EducationLabelDefinition, HierarchyLevelConfig } from '../../config/education-presets.ts';
import { connectToDatabase } from '../../lib/database/mongoose.ts';
import { getMongooseModel } from '../../models/index.ts';
import type {
  CurriculumScope,
  DifficultyLevel,
  EducationSystemType,
  SupportedLanguage,
  TopicPriority,
  UserRole,
} from '../../types/domain.ts';
import {
  type AuditLogRecord,
  type ChapterRecord,
  type EducationLabelConfigRecord,
  type EducationLevelRecord,
  type EducationSystemRecord,
  type ExaminationRecord,
  type ExaminationTopicPriority,
  INITIAL_CHAPTERS,
  INITIAL_EDUCATION_LEVELS,
  INITIAL_EDUCATION_SYSTEMS,
  INITIAL_EXAMINATIONS,
  INITIAL_SUBJECTS,
  INITIAL_TOPICS,
  type SubjectRecord,
  type TopicRecord,
} from './seed-data.ts';

export interface CurriculumVisibilityFilter {
  viewerUserId?: string;
  scopeFilter?: 'all' | 'global' | 'custom';
  includeArchived?: boolean;
}

export interface TopicQueryFilter extends CurriculumVisibilityFilter {
  subjectId?: string;
  chapterId?: string;
  difficulty?: DifficultyLevel;
  search?: string;
  topicIds?: string[];
  includeInactive?: boolean;
  page: number;
  limit: number;
}

export interface CurriculumRepository {
  // Education Systems
  listEducationSystems(
    includeInactive?: boolean,
    country?: string,
    visibility?: CurriculumVisibilityFilter,
  ): Promise<EducationSystemRecord[]>;
  findEducationSystemById(id: string): Promise<EducationSystemRecord | null>;
  createEducationSystem(
    data: Omit<EducationSystemRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<EducationSystemRecord>;
  updateEducationSystem(
    id: string,
    patch: Partial<Omit<EducationSystemRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<EducationSystemRecord | null>;
  deleteEducationSystem(id: string): Promise<boolean>;

  // Education Levels
  listEducationLevels(
    educationSystemId?: string,
    includeInactive?: boolean,
    visibility?: CurriculumVisibilityFilter,
  ): Promise<EducationLevelRecord[]>;
  findEducationLevelById(id: string): Promise<EducationLevelRecord | null>;
  createEducationLevel(
    data: Omit<EducationLevelRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<EducationLevelRecord>;
  updateEducationLevel(
    id: string,
    patch: Partial<Omit<EducationLevelRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<EducationLevelRecord | null>;
  deleteEducationLevel(id: string): Promise<boolean>;

  // Examinations
  listExaminations(
    filters?: CurriculumVisibilityFilter & {
      educationSystemId?: string;
      educationLevelId?: string;
      includeInactive?: boolean;
    },
  ): Promise<ExaminationRecord[]>;
  findExaminationById(id: string): Promise<ExaminationRecord | null>;
  createExamination(
    data: Omit<ExaminationRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ExaminationRecord>;
  updateExamination(
    id: string,
    patch: Partial<Omit<ExaminationRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ExaminationRecord | null>;
  deleteExamination(id: string): Promise<boolean>;

  // Subjects
  listSubjects(
    filters?: CurriculumVisibilityFilter & {
      educationSystemId?: string;
      educationLevelId?: string;
      examinationId?: string;
      includeInactive?: boolean;
    },
  ): Promise<SubjectRecord[]>;
  findSubjectById(id: string): Promise<SubjectRecord | null>;
  createSubject(
    data: Omit<SubjectRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SubjectRecord>;
  updateSubject(
    id: string,
    patch: Partial<Omit<SubjectRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<SubjectRecord | null>;
  deleteSubject(id: string): Promise<boolean>;

  // Chapters
  listChapters(
    subjectId?: string,
    includeInactive?: boolean,
    visibility?: CurriculumVisibilityFilter,
  ): Promise<ChapterRecord[]>;
  findChapterById(id: string): Promise<ChapterRecord | null>;
  createChapter(
    data: Omit<ChapterRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ChapterRecord>;
  updateChapter(
    id: string,
    patch: Partial<Omit<ChapterRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ChapterRecord | null>;
  deleteChapter(id: string): Promise<boolean>;

  // Topics
  listTopics(filter: TopicQueryFilter): Promise<{ items: TopicRecord[]; total: number }>;
  findTopicById(id: string): Promise<TopicRecord | null>;
  createTopic(data: Omit<TopicRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<TopicRecord>;
  updateTopic(
    id: string,
    patch: Partial<Omit<TopicRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<TopicRecord | null>;
  deleteTopic(id: string): Promise<boolean>;

  // Education Label Configurations
  findLabelConfig(
    userId: string,
    educationSystemId?: string,
  ): Promise<EducationLabelConfigRecord | null>;
  listLabelConfigsByUser(userId: string): Promise<EducationLabelConfigRecord[]>;
  upsertLabelConfig(data: {
    userId: string;
    educationSystemId?: string;
    presetName: string;
    labels: EducationLabelDefinition[];
  }): Promise<EducationLabelConfigRecord>;
  deleteLabelConfig(userId: string, educationSystemId?: string): Promise<boolean>;

  // Audit Logs
  recordAuditLog(entry: {
    actorId: string;
    actorRole: UserRole;
    action: string;
    targetCollection?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditLogRecord>;
  listAuditLogs(limit?: number): Promise<AuditLogRecord[]>;
}

function generateHexObjectId(): string {
  return randomBytes(12).toString('hex');
}

function toObjectIdIfValid(id: string | undefined): Types.ObjectId | undefined {
  return id && mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : undefined;
}

function normalizeScope(value: unknown): CurriculumScope {
  return value === 'custom' ? 'custom' : 'global';
}

function mapHierarchyLevels(raw: unknown): HierarchyLevelConfig[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item, idx) => ({
      key: String(item.key ?? `level_${idx + 1}`),
      singularLabel: String(item.singularLabel ?? 'Level'),
      pluralLabel: String(item.pluralLabel ?? 'Levels'),
      order: typeof item.order === 'number' ? item.order : idx,
      required: item.required !== false,
      allowMultiple: Boolean(item.allowMultiple),
    }));
}

function mapTopicPriorities(raw: unknown): ExaminationTopicPriority[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      topicId: String(item.topicId ?? ''),
      priority:
        item.priority === 'high' || item.priority === 'low' ? (item.priority as TopicPriority) : 'medium',
    }))
    .filter((p) => p.topicId.length > 0);
}

function mapDocToSystem(doc: Record<string, unknown>): EducationSystemRecord {
  return {
    id: String(doc._id),
    code: String(doc.code ?? ''),
    name: String(doc.name ?? ''),
    country: String(doc.country ?? 'BD'),
    description: doc.description ? String(doc.description) : undefined,
    supportedLanguages: Array.isArray(doc.supportedLanguages)
      ? (doc.supportedLanguages as SupportedLanguage[])
      : ['en', 'bn'],
    scope: normalizeScope(doc.scope),
    ownerUserId: doc.ownerUserId ? String(doc.ownerUserId) : undefined,
    educationType: (doc.educationType as EducationSystemType) ?? 'standard',
    preferredLanguage: doc.preferredLanguage ? (doc.preferredLanguage as SupportedLanguage) : 'en',
    academicYear: doc.academicYear ? String(doc.academicYear) : undefined,
    hierarchyLevels: mapHierarchyLevels(doc.hierarchyLevels),
    isArchived: Boolean(doc.isArchived),
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

function mapDocToLevel(doc: Record<string, unknown>): EducationLevelRecord {
  return {
    id: String(doc._id),
    educationSystemId: String(doc.educationSystemId ?? ''),
    code: String(doc.code ?? ''),
    name: String(doc.name ?? ''),
    description: doc.description ? String(doc.description) : undefined,
    hierarchyKey: doc.hierarchyKey ? String(doc.hierarchyKey) : undefined,
    parentLevelId: doc.parentLevelId ? String(doc.parentLevelId) : undefined,
    scope: normalizeScope(doc.scope),
    ownerUserId: doc.ownerUserId ? String(doc.ownerUserId) : undefined,
    order: typeof doc.order === 'number' ? doc.order : 0,
    isArchived: Boolean(doc.isArchived),
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

function mapDocToExamination(doc: Record<string, unknown>): ExaminationRecord {
  return {
    id: String(doc._id),
    educationSystemId: String(doc.educationSystemId ?? ''),
    educationLevelId: doc.educationLevelId ? String(doc.educationLevelId) : undefined,
    code: String(doc.code ?? ''),
    name: String(doc.name ?? ''),
    description: doc.description ? String(doc.description) : undefined,
    examDate: doc.examDate ? new Date(String(doc.examDate)) : null,
    customLabelTag: doc.customLabelTag ? String(doc.customLabelTag) : undefined,
    academicSession: doc.academicSession ? String(doc.academicSession) : undefined,
    subjectIds: Array.isArray(doc.subjectIds) ? doc.subjectIds.map((id) => String(id)) : undefined,
    syllabusCoverage: doc.syllabusCoverage ? String(doc.syllabusCoverage) : undefined,
    totalMarks: typeof doc.totalMarks === 'number' ? doc.totalMarks : undefined,
    durationMinutes: typeof doc.durationMinutes === 'number' ? doc.durationMinutes : undefined,
    preparationGoals: Array.isArray(doc.preparationGoals)
      ? doc.preparationGoals.map(String)
      : undefined,
    topicPriorities: mapTopicPriorities(doc.topicPriorities),
    scope: normalizeScope(doc.scope),
    ownerUserId: doc.ownerUserId ? String(doc.ownerUserId) : undefined,
    isArchived: Boolean(doc.isArchived),
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

function mapDocToSubject(doc: Record<string, unknown>): SubjectRecord {
  return {
    id: String(doc._id),
    educationSystemId: String(doc.educationSystemId ?? ''),
    educationLevelId: doc.educationLevelId ? String(doc.educationLevelId) : undefined,
    examinationIds: Array.isArray(doc.examinationIds)
      ? doc.examinationIds.map((id) => String(id))
      : [],
    code: String(doc.code ?? ''),
    name: String(doc.name ?? ''),
    nameBn: doc.nameBn ? String(doc.nameBn) : undefined,
    description: doc.description ? String(doc.description) : undefined,
    color: doc.color ? String(doc.color) : undefined,
    icon: doc.icon ? String(doc.icon) : undefined,
    difficultyLevel: (doc.difficultyLevel as DifficultyLevel) ?? undefined,
    learningObjectives: Array.isArray(doc.learningObjectives)
      ? doc.learningObjectives.map(String)
      : undefined,
    scope: normalizeScope(doc.scope),
    ownerUserId: doc.ownerUserId ? String(doc.ownerUserId) : undefined,
    order: typeof doc.order === 'number' ? doc.order : 0,
    isArchived: Boolean(doc.isArchived),
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

function mapDocToChapter(doc: Record<string, unknown>): ChapterRecord {
  return {
    id: String(doc._id),
    subjectId: String(doc.subjectId ?? ''),
    chapterNumber: typeof doc.chapterNumber === 'number' ? doc.chapterNumber : 1,
    title: String(doc.title ?? ''),
    titleBn: doc.titleBn ? String(doc.titleBn) : undefined,
    description: doc.description ? String(doc.description) : undefined,
    learningObjectives: Array.isArray(doc.learningObjectives)
      ? doc.learningObjectives.map(String)
      : undefined,
    scope: normalizeScope(doc.scope),
    ownerUserId: doc.ownerUserId ? String(doc.ownerUserId) : undefined,
    order: typeof doc.order === 'number' ? doc.order : 0,
    isArchived: Boolean(doc.isArchived),
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

function mapDocToTopic(doc: Record<string, unknown>): TopicRecord {
  return {
    id: String(doc._id),
    subjectId: String(doc.subjectId ?? ''),
    chapterId: String(doc.chapterId ?? ''),
    code: String(doc.code ?? ''),
    title: String(doc.title ?? ''),
    titleBn: doc.titleBn ? String(doc.titleBn) : undefined,
    description: doc.description ? String(doc.description) : undefined,
    learningObjectives: Array.isArray(doc.learningObjectives)
      ? doc.learningObjectives.map(String)
      : [],
    prerequisiteTopicIds: Array.isArray(doc.prerequisiteTopicIds)
      ? doc.prerequisiteTopicIds.map(String)
      : [],
    difficulty: (doc.difficulty as DifficultyLevel) ?? 'medium',
    estimatedMinutes: typeof doc.estimatedMinutes === 'number' ? doc.estimatedMinutes : 45,
    keyConcepts: Array.isArray(doc.keyConcepts) ? doc.keyConcepts.map(String) : [],
    curriculumReferences: Array.isArray(doc.curriculumReferences)
      ? doc.curriculumReferences.map(String)
      : [],
    syllabusWeightVerified: Boolean(doc.syllabusWeightVerified),
    syllabusPriorityScore:
      typeof doc.syllabusPriorityScore === 'number' ? doc.syllabusPriorityScore : undefined,
    scope: normalizeScope(doc.scope),
    ownerUserId: doc.ownerUserId ? String(doc.ownerUserId) : undefined,
    order: typeof doc.order === 'number' ? doc.order : 0,
    isArchived: Boolean(doc.isArchived),
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

function mapDocToLabelConfig(doc: Record<string, unknown>): EducationLabelConfigRecord {
  const rawLabels = Array.isArray(doc.labels) ? doc.labels : [];
  return {
    id: String(doc._id),
    userId: String(doc.userId ?? ''),
    educationSystemId: doc.educationSystemId ? String(doc.educationSystemId) : undefined,
    presetName: String(doc.presetName ?? 'default'),
    labels: rawLabels
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item, idx) => ({
        key: String(item.key ?? `label_${idx}`),
        defaultLabel: String(item.defaultLabel ?? item.singular ?? 'Label'),
        singular: String(item.singular ?? item.defaultLabel ?? 'Label'),
        plural: String(item.plural ?? item.singular ?? 'Labels'),
        order: typeof item.order === 'number' ? item.order : idx,
        required: Boolean(item.required),
        allowMultiple: Boolean(item.allowMultiple),
        isVisible: item.isVisible !== false,
      })),
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

function buildMongoVisibilityClauses(visibility?: CurriculumVisibilityFilter): Record<string, unknown>[] {
  const clauses: Record<string, unknown>[] = [];
  if (!visibility?.includeArchived) {
    clauses.push({ isArchived: { $ne: true } });
  }

  const scopeFilter = visibility?.scopeFilter ?? 'all';
  const viewerId = toObjectIdIfValid(visibility?.viewerUserId);

  if (scopeFilter === 'custom') {
    if (!viewerId) {
      clauses.push({ _id: null });
    } else {
      clauses.push({ scope: 'custom', ownerUserId: viewerId });
    }
  } else if (scopeFilter === 'global' || !viewerId) {
    clauses.push({ $or: [{ scope: 'global' }, { scope: { $exists: false } }] });
  } else {
    clauses.push({
      $or: [
        { scope: 'global' },
        { scope: { $exists: false } },
        { scope: 'custom', ownerUserId: viewerId },
      ],
    });
  }

  return clauses;
}

function matchesInMemoryVisibility(
  record: { scope?: CurriculumScope; ownerUserId?: string; isArchived?: boolean },
  visibility?: CurriculumVisibilityFilter,
): boolean {
  if (!visibility?.includeArchived && record.isArchived) {
    return false;
  }
  const effectiveScope = record.scope ?? 'global';
  const scopeFilter = visibility?.scopeFilter ?? 'all';
  const viewerUserId = visibility?.viewerUserId;

  if (scopeFilter === 'custom') {
    return Boolean(viewerUserId && effectiveScope === 'custom' && record.ownerUserId === viewerUserId);
  }
  if (scopeFilter === 'global' || !viewerUserId) {
    return effectiveScope === 'global';
  }
  return effectiveScope === 'global' || (effectiveScope === 'custom' && record.ownerUserId === viewerUserId);
}

function mapDocToAuditLog(doc: Record<string, unknown>): AuditLogRecord {
  return {
    id: String(doc._id),
    actorId: String(doc.actorId ?? ''),
    actorRole: (doc.actorRole as UserRole) ?? 'admin',
    action: String(doc.action ?? ''),
    targetCollection: doc.targetCollection ? String(doc.targetCollection) : undefined,
    targetId: doc.targetId ? String(doc.targetId) : undefined,
    metadata: (doc.metadata as Record<string, unknown>) ?? undefined,
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
  };
}

let mongoSeededPromise: Promise<void> | null = null;

function isDuplicateKeyError(err: unknown): boolean {
  return Boolean(
    err && typeof err === 'object' && (err as { code?: number | string }).code === 11000,
  );
}

export class MongooseCurriculumRepository implements CurriculumRepository {
  private async ensureSeeded(): Promise<void> {
    if (!mongoSeededPromise) {
      mongoSeededPromise = (async () => {
        await connectToDatabase();
        const SystemModel = getMongooseModel('educationSystems');
        const LevelModel = getMongooseModel('educationLevels');
        const ExamModel = getMongooseModel('examinations');
        const SubjectModel = getMongooseModel('subjects');
        const ChapterModel = getMongooseModel('chapters');
        const TopicModel = getMongooseModel('topics');

        const [sysCount, lvlCount, examCount, subCount, chapCount, topicCount] = await Promise.all([
          SystemModel.countDocuments({}),
          LevelModel.countDocuments({}),
          ExamModel.countDocuments({}),
          SubjectModel.countDocuments({}),
          ChapterModel.countDocuments({}),
          TopicModel.countDocuments({}),
        ]);

        if (sysCount === 0) {
          for (const item of INITIAL_EDUCATION_SYSTEMS) {
            const { id, createdAt: _c, updatedAt: _u, ...rest } = item;
            void _c;
            void _u;
            try {
              await SystemModel.findOneAndUpdate(
                { _id: new mongoose.Types.ObjectId(id) },
                { $setOnInsert: { ...rest, _id: new mongoose.Types.ObjectId(id) } },
                { upsert: true, new: true },
              );
            } catch (err) {
              if (!isDuplicateKeyError(err)) throw err;
            }
          }
        }

        if (lvlCount === 0) {
          for (const item of INITIAL_EDUCATION_LEVELS) {
            const { id, createdAt: _c, updatedAt: _u, ...rest } = item;
            void _c;
            void _u;
            try {
              await LevelModel.findOneAndUpdate(
                { _id: new mongoose.Types.ObjectId(id) },
                {
                  $setOnInsert: {
                    ...rest,
                    _id: new mongoose.Types.ObjectId(id),
                    educationSystemId: new mongoose.Types.ObjectId(item.educationSystemId),
                  },
                },
                { upsert: true, new: true },
              );
            } catch (err) {
              if (!isDuplicateKeyError(err)) throw err;
            }
          }
        }

        if (examCount === 0) {
          for (const item of INITIAL_EXAMINATIONS) {
            const { id, createdAt: _c, updatedAt: _u, ...rest } = item;
            void _c;
            void _u;
            try {
              await ExamModel.findOneAndUpdate(
                { _id: new mongoose.Types.ObjectId(id) },
                {
                  $setOnInsert: {
                    ...rest,
                    _id: new mongoose.Types.ObjectId(id),
                    educationSystemId: new mongoose.Types.ObjectId(item.educationSystemId),
                    educationLevelId: new mongoose.Types.ObjectId(item.educationLevelId),
                  },
                },
                { upsert: true, new: true },
              );
            } catch (err) {
              if (!isDuplicateKeyError(err)) throw err;
            }
          }
        }

        if (subCount === 0) {
          for (const item of INITIAL_SUBJECTS) {
            const { id, createdAt: _c, updatedAt: _u, ...rest } = item;
            void _c;
            void _u;
            try {
              await SubjectModel.findOneAndUpdate(
                { _id: new mongoose.Types.ObjectId(id) },
                {
                  $setOnInsert: {
                    ...rest,
                    _id: new mongoose.Types.ObjectId(id),
                    educationSystemId: new mongoose.Types.ObjectId(item.educationSystemId),
                    educationLevelId: new mongoose.Types.ObjectId(item.educationLevelId),
                    examinationIds: item.examinationIds.map((eid) => new mongoose.Types.ObjectId(eid)),
                  },
                },
                { upsert: true, new: true },
              );
            } catch (err) {
              if (!isDuplicateKeyError(err)) throw err;
            }
          }
        }

        if (chapCount === 0) {
          for (const item of INITIAL_CHAPTERS) {
            const { id, createdAt: _c, updatedAt: _u, ...rest } = item;
            void _c;
            void _u;
            try {
              await ChapterModel.findOneAndUpdate(
                { _id: new mongoose.Types.ObjectId(id) },
                {
                  $setOnInsert: {
                    ...rest,
                    _id: new mongoose.Types.ObjectId(id),
                    subjectId: new mongoose.Types.ObjectId(item.subjectId),
                  },
                },
                { upsert: true, new: true },
              );
            } catch (err) {
              if (!isDuplicateKeyError(err)) throw err;
            }
          }
        }

        if (topicCount === 0) {
          for (const item of INITIAL_TOPICS) {
            const { id, createdAt: _c, updatedAt: _u, ...rest } = item;
            void _c;
            void _u;
            try {
              await TopicModel.findOneAndUpdate(
                { _id: new mongoose.Types.ObjectId(id) },
                {
                  $setOnInsert: {
                    ...rest,
                    _id: new mongoose.Types.ObjectId(id),
                    subjectId: new mongoose.Types.ObjectId(item.subjectId),
                    chapterId: new mongoose.Types.ObjectId(item.chapterId),
                    prerequisiteTopicIds: item.prerequisiteTopicIds.map(
                      (pid) => new mongoose.Types.ObjectId(pid),
                    ),
                  },
                },
                { upsert: true, new: true },
              );
            } catch (err) {
              if (!isDuplicateKeyError(err)) throw err;
            }
          }
        }
      })().catch((err) => {
        mongoSeededPromise = null;
        throw err;
      });
    }
    await mongoSeededPromise;
  }

  async listEducationSystems(
    includeInactive = false,
    country?: string,
    visibility?: CurriculumVisibilityFilter,
  ): Promise<EducationSystemRecord[]> {
    await this.ensureSeeded();
    const Model = getMongooseModel('educationSystems');
    const clauses = buildMongoVisibilityClauses(visibility);
    if (!includeInactive) clauses.push({ isActive: true });
    if (country) clauses.push({ country: country.toUpperCase() });
    const docs = await Model.find(clauses.length === 1 ? clauses[0]! : { $and: clauses })
      .sort({ scope: 1, code: 1 })
      .lean();
    return docs.map(mapDocToSystem);
  }

  async findEducationSystemById(id: string): Promise<EducationSystemRecord | null> {
    await this.ensureSeeded();
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const Model = getMongooseModel('educationSystems');
    const doc = await Model.findById(id).lean();
    return doc ? mapDocToSystem(doc) : null;
  }

  async createEducationSystem(
    data: Omit<EducationSystemRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<EducationSystemRecord> {
    await this.ensureSeeded();
    const Model = getMongooseModel('educationSystems');
    const created = await Model.create({
      ...data,
      scope: data.scope ?? 'global',
      isArchived: data.isArchived ?? false,
      educationType: data.educationType ?? 'standard',
      ...(data.ownerUserId ? { ownerUserId: toObjectIdIfValid(data.ownerUserId) } : {}),
    });
    return mapDocToSystem(created as unknown as Record<string, unknown>);
  }

  async updateEducationSystem(
    id: string,
    patch: Partial<Omit<EducationSystemRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<EducationSystemRecord | null> {
    await this.ensureSeeded();
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const Model = getMongooseModel('educationSystems');
    const payload: Record<string, unknown> = { ...patch };
    if (patch.ownerUserId) payload.ownerUserId = toObjectIdIfValid(patch.ownerUserId);
    const updated = await Model.findByIdAndUpdate(id, { $set: payload }, { new: true }).lean();
    return updated ? mapDocToSystem(updated) : null;
  }

  async deleteEducationSystem(id: string): Promise<boolean> {
    await this.ensureSeeded();
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const Model = getMongooseModel('educationSystems');
    const res = await Model.deleteOne({ _id: new mongoose.Types.ObjectId(id) });
    return res.deletedCount > 0;
  }

  async listEducationLevels(
    educationSystemId?: string,
    includeInactive = false,
    visibility?: CurriculumVisibilityFilter,
  ): Promise<EducationLevelRecord[]> {
    await this.ensureSeeded();
    const Model = getMongooseModel('educationLevels');
    const clauses = buildMongoVisibilityClauses(visibility);
    if (!includeInactive) clauses.push({ isActive: true });
    if (educationSystemId && mongoose.Types.ObjectId.isValid(educationSystemId)) {
      clauses.push({ educationSystemId: new mongoose.Types.ObjectId(educationSystemId) });
    }
    const docs = await Model.find(clauses.length === 1 ? clauses[0]! : { $and: clauses })
      .sort({ order: 1, code: 1 })
      .lean();
    return docs.map(mapDocToLevel);
  }

  async findEducationLevelById(id: string): Promise<EducationLevelRecord | null> {
    await this.ensureSeeded();
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const Model = getMongooseModel('educationLevels');
    const doc = await Model.findById(id).lean();
    return doc ? mapDocToLevel(doc) : null;
  }

  async createEducationLevel(
    data: Omit<EducationLevelRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<EducationLevelRecord> {
    await this.ensureSeeded();
    const Model = getMongooseModel('educationLevels');
    const created = await Model.create({
      ...data,
      scope: data.scope ?? 'global',
      isArchived: data.isArchived ?? false,
      ...(data.ownerUserId ? { ownerUserId: toObjectIdIfValid(data.ownerUserId) } : {}),
      ...(data.parentLevelId ? { parentLevelId: toObjectIdIfValid(data.parentLevelId) } : {}),
      educationSystemId: new mongoose.Types.ObjectId(data.educationSystemId),
    });
    return mapDocToLevel(created as unknown as Record<string, unknown>);
  }

  async updateEducationLevel(
    id: string,
    patch: Partial<Omit<EducationLevelRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<EducationLevelRecord | null> {
    await this.ensureSeeded();
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const Model = getMongooseModel('educationLevels');
    const payload: Record<string, unknown> = { ...patch };
    if (patch.educationSystemId) {
      payload.educationSystemId = new mongoose.Types.ObjectId(patch.educationSystemId);
    }
    if (patch.parentLevelId) {
      payload.parentLevelId = toObjectIdIfValid(patch.parentLevelId);
    }
    if (patch.ownerUserId) {
      payload.ownerUserId = toObjectIdIfValid(patch.ownerUserId);
    }
    const updated = await Model.findByIdAndUpdate(id, { $set: payload }, { new: true }).lean();
    return updated ? mapDocToLevel(updated) : null;
  }

  async deleteEducationLevel(id: string): Promise<boolean> {
    await this.ensureSeeded();
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const Model = getMongooseModel('educationLevels');
    const res = await Model.deleteOne({ _id: new mongoose.Types.ObjectId(id) });
    return res.deletedCount > 0;
  }

  async listExaminations(
    filters?: CurriculumVisibilityFilter & {
      educationSystemId?: string;
      educationLevelId?: string;
      includeInactive?: boolean;
    },
  ): Promise<ExaminationRecord[]> {
    await this.ensureSeeded();
    const Model = getMongooseModel('examinations');
    const clauses = buildMongoVisibilityClauses(filters);
    if (!filters?.includeInactive) clauses.push({ isActive: true });
    if (filters?.educationSystemId && mongoose.Types.ObjectId.isValid(filters.educationSystemId)) {
      clauses.push({ educationSystemId: new mongoose.Types.ObjectId(filters.educationSystemId) });
    }
    if (filters?.educationLevelId && mongoose.Types.ObjectId.isValid(filters.educationLevelId)) {
      clauses.push({ educationLevelId: new mongoose.Types.ObjectId(filters.educationLevelId) });
    }
    const docs = await Model.find(clauses.length === 1 ? clauses[0]! : { $and: clauses })
      .sort({ examDate: 1, code: 1 })
      .lean();
    return docs.map(mapDocToExamination);
  }

  async findExaminationById(id: string): Promise<ExaminationRecord | null> {
    await this.ensureSeeded();
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const Model = getMongooseModel('examinations');
    const doc = await Model.findById(id).lean();
    return doc ? mapDocToExamination(doc) : null;
  }

  async createExamination(
    data: Omit<ExaminationRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ExaminationRecord> {
    await this.ensureSeeded();
    const Model = getMongooseModel('examinations');
    const { educationLevelId, subjectIds, ownerUserId, ...rest } = data;
    const created = await Model.create({
      ...rest,
      scope: data.scope ?? 'global',
      isArchived: data.isArchived ?? false,
      educationSystemId: new mongoose.Types.ObjectId(data.educationSystemId),
      ...(toObjectIdIfValid(educationLevelId)
        ? { educationLevelId: toObjectIdIfValid(educationLevelId) }
        : {}),
      ...(toObjectIdIfValid(ownerUserId) ? { ownerUserId: toObjectIdIfValid(ownerUserId) } : {}),
      ...(Array.isArray(subjectIds)
        ? {
            subjectIds: subjectIds
              .filter((sid) => mongoose.Types.ObjectId.isValid(sid))
              .map((sid) => new mongoose.Types.ObjectId(sid)),
          }
        : {}),
    });
    return mapDocToExamination(created as unknown as Record<string, unknown>);
  }

  async updateExamination(
    id: string,
    patch: Partial<Omit<ExaminationRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ExaminationRecord | null> {
    await this.ensureSeeded();
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const Model = getMongooseModel('examinations');
    const payload: Record<string, unknown> = { ...patch };
    if (patch.educationSystemId) {
      payload.educationSystemId = new mongoose.Types.ObjectId(patch.educationSystemId);
    }
    if (patch.educationLevelId !== undefined) {
      payload.educationLevelId = toObjectIdIfValid(patch.educationLevelId);
    }
    if (patch.ownerUserId) {
      payload.ownerUserId = toObjectIdIfValid(patch.ownerUserId);
    }
    if (patch.subjectIds) {
      payload.subjectIds = patch.subjectIds
        .filter((sid) => mongoose.Types.ObjectId.isValid(sid))
        .map((sid) => new mongoose.Types.ObjectId(sid));
    }
    const updated = await Model.findByIdAndUpdate(id, { $set: payload }, { new: true }).lean();
    return updated ? mapDocToExamination(updated) : null;
  }

  async deleteExamination(id: string): Promise<boolean> {
    await this.ensureSeeded();
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const Model = getMongooseModel('examinations');
    const res = await Model.deleteOne({ _id: new mongoose.Types.ObjectId(id) });
    return res.deletedCount > 0;
  }

  async listSubjects(
    filters?: CurriculumVisibilityFilter & {
      educationSystemId?: string;
      educationLevelId?: string;
      examinationId?: string;
      includeInactive?: boolean;
    },
  ): Promise<SubjectRecord[]> {
    await this.ensureSeeded();
    const Model = getMongooseModel('subjects');
    const clauses = buildMongoVisibilityClauses(filters);
    if (!filters?.includeInactive) clauses.push({ isActive: true });
    if (filters?.educationSystemId && mongoose.Types.ObjectId.isValid(filters.educationSystemId)) {
      clauses.push({ educationSystemId: new mongoose.Types.ObjectId(filters.educationSystemId) });
    }
    if (filters?.educationLevelId && mongoose.Types.ObjectId.isValid(filters.educationLevelId)) {
      clauses.push({ educationLevelId: new mongoose.Types.ObjectId(filters.educationLevelId) });
    }
    if (filters?.examinationId && mongoose.Types.ObjectId.isValid(filters.examinationId)) {
      clauses.push({ examinationIds: new mongoose.Types.ObjectId(filters.examinationId) });
    }
    const docs = await Model.find(clauses.length === 1 ? clauses[0]! : { $and: clauses })
      .sort({ order: 1, code: 1 })
      .lean();
    return docs.map(mapDocToSubject);
  }

  async findSubjectById(id: string): Promise<SubjectRecord | null> {
    await this.ensureSeeded();
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const Model = getMongooseModel('subjects');
    const doc = await Model.findById(id).lean();
    return doc ? mapDocToSubject(doc) : null;
  }

  async createSubject(
    data: Omit<SubjectRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SubjectRecord> {
    await this.ensureSeeded();
    const Model = getMongooseModel('subjects');
    const { educationLevelId, ownerUserId, ...rest } = data;
    const created = await Model.create({
      ...rest,
      scope: data.scope ?? 'global',
      isArchived: data.isArchived ?? false,
      educationSystemId: new mongoose.Types.ObjectId(data.educationSystemId),
      ...(toObjectIdIfValid(educationLevelId)
        ? { educationLevelId: toObjectIdIfValid(educationLevelId) }
        : {}),
      ...(toObjectIdIfValid(ownerUserId) ? { ownerUserId: toObjectIdIfValid(ownerUserId) } : {}),
      examinationIds: data.examinationIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id)),
    });
    return mapDocToSubject(created as unknown as Record<string, unknown>);
  }

  async updateSubject(
    id: string,
    patch: Partial<Omit<SubjectRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<SubjectRecord | null> {
    await this.ensureSeeded();
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const Model = getMongooseModel('subjects');
    const payload: Record<string, unknown> = { ...patch };
    if (patch.educationSystemId) {
      payload.educationSystemId = new mongoose.Types.ObjectId(patch.educationSystemId);
    }
    if (patch.educationLevelId !== undefined) {
      payload.educationLevelId = toObjectIdIfValid(patch.educationLevelId);
    }
    if (patch.ownerUserId) {
      payload.ownerUserId = toObjectIdIfValid(patch.ownerUserId);
    }
    if (patch.examinationIds) {
      payload.examinationIds = patch.examinationIds
        .filter((eid) => mongoose.Types.ObjectId.isValid(eid))
        .map((eid) => new mongoose.Types.ObjectId(eid));
    }
    const updated = await Model.findByIdAndUpdate(id, { $set: payload }, { new: true }).lean();
    return updated ? mapDocToSubject(updated) : null;
  }

  async deleteSubject(id: string): Promise<boolean> {
    await this.ensureSeeded();
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const Model = getMongooseModel('subjects');
    const res = await Model.deleteOne({ _id: new mongoose.Types.ObjectId(id) });
    return res.deletedCount > 0;
  }

  async listChapters(
    subjectId?: string,
    includeInactive = false,
    visibility?: CurriculumVisibilityFilter,
  ): Promise<ChapterRecord[]> {
    await this.ensureSeeded();
    const Model = getMongooseModel('chapters');
    const clauses = buildMongoVisibilityClauses(visibility);
    if (!includeInactive) clauses.push({ isActive: true });
    if (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) {
      clauses.push({ subjectId: new mongoose.Types.ObjectId(subjectId) });
    }
    const docs = await Model.find(clauses.length === 1 ? clauses[0]! : { $and: clauses })
      .sort({ order: 1, chapterNumber: 1 })
      .lean();
    return docs.map(mapDocToChapter);
  }

  async findChapterById(id: string): Promise<ChapterRecord | null> {
    await this.ensureSeeded();
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const Model = getMongooseModel('chapters');
    const doc = await Model.findById(id).lean();
    return doc ? mapDocToChapter(doc) : null;
  }

  async createChapter(
    data: Omit<ChapterRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ChapterRecord> {
    await this.ensureSeeded();
    const Model = getMongooseModel('chapters');
    const created = await Model.create({
      ...data,
      scope: data.scope ?? 'global',
      isArchived: data.isArchived ?? false,
      ...(data.ownerUserId ? { ownerUserId: toObjectIdIfValid(data.ownerUserId) } : {}),
      subjectId: new mongoose.Types.ObjectId(data.subjectId),
    });
    return mapDocToChapter(created as unknown as Record<string, unknown>);
  }

  async updateChapter(
    id: string,
    patch: Partial<Omit<ChapterRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ChapterRecord | null> {
    await this.ensureSeeded();
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const Model = getMongooseModel('chapters');
    const payload: Record<string, unknown> = { ...patch };
    if (patch.subjectId) {
      payload.subjectId = new mongoose.Types.ObjectId(patch.subjectId);
    }
    if (patch.ownerUserId) {
      payload.ownerUserId = toObjectIdIfValid(patch.ownerUserId);
    }
    const updated = await Model.findByIdAndUpdate(id, { $set: payload }, { new: true }).lean();
    return updated ? mapDocToChapter(updated) : null;
  }

  async deleteChapter(id: string): Promise<boolean> {
    await this.ensureSeeded();
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const Model = getMongooseModel('chapters');
    const res = await Model.deleteOne({ _id: new mongoose.Types.ObjectId(id) });
    return res.deletedCount > 0;
  }

  async listTopics(filter: TopicQueryFilter): Promise<{ items: TopicRecord[]; total: number }> {
    await this.ensureSeeded();
    const Model = getMongooseModel('topics');
    const clauses = buildMongoVisibilityClauses(filter);
    if (!filter.includeInactive) clauses.push({ isActive: true });
    if (filter.subjectId && mongoose.Types.ObjectId.isValid(filter.subjectId)) {
      clauses.push({ subjectId: new mongoose.Types.ObjectId(filter.subjectId) });
    }
    if (filter.chapterId && mongoose.Types.ObjectId.isValid(filter.chapterId)) {
      clauses.push({ chapterId: new mongoose.Types.ObjectId(filter.chapterId) });
    }
    if (filter.difficulty) {
      clauses.push({ difficulty: filter.difficulty });
    }
    if (filter.topicIds) {
      const validIds = filter.topicIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      clauses.push({ _id: { $in: validIds } });
    }
    if (filter.search?.trim()) {
      const escaped = filter.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      clauses.push({
        $or: [
          { title: { $regex: escaped, $options: 'i' } },
          { titleBn: { $regex: escaped, $options: 'i' } },
          { description: { $regex: escaped, $options: 'i' } },
          { code: { $regex: escaped, $options: 'i' } },
        ],
      });
    }

    const query = clauses.length === 1 ? clauses[0]! : { $and: clauses };
    const skip = Math.max(0, (filter.page - 1) * filter.limit);
    const [docs, total] = await Promise.all([
      Model.find(query).sort({ order: 1, code: 1 }).skip(skip).limit(filter.limit).lean(),
      Model.countDocuments(query),
    ]);
    return {
      items: docs.map(mapDocToTopic),
      total,
    };
  }

  async findTopicById(id: string): Promise<TopicRecord | null> {
    await this.ensureSeeded();
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const Model = getMongooseModel('topics');
    const doc = await Model.findById(id).lean();
    return doc ? mapDocToTopic(doc) : null;
  }

  async createTopic(
    data: Omit<TopicRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<TopicRecord> {
    await this.ensureSeeded();
    const Model = getMongooseModel('topics');
    const created = await Model.create({
      ...data,
      scope: data.scope ?? 'global',
      isArchived: data.isArchived ?? false,
      ...(data.ownerUserId ? { ownerUserId: toObjectIdIfValid(data.ownerUserId) } : {}),
      subjectId: new mongoose.Types.ObjectId(data.subjectId),
      chapterId: new mongoose.Types.ObjectId(data.chapterId),
      prerequisiteTopicIds: data.prerequisiteTopicIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id)),
    });
    return mapDocToTopic(created as unknown as Record<string, unknown>);
  }

  async updateTopic(
    id: string,
    patch: Partial<Omit<TopicRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<TopicRecord | null> {
    await this.ensureSeeded();
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const Model = getMongooseModel('topics');
    const payload: Record<string, unknown> = { ...patch };
    if (patch.subjectId) {
      payload.subjectId = new mongoose.Types.ObjectId(patch.subjectId);
    }
    if (patch.chapterId) {
      payload.chapterId = new mongoose.Types.ObjectId(patch.chapterId);
    }
    if (patch.ownerUserId) {
      payload.ownerUserId = toObjectIdIfValid(patch.ownerUserId);
    }
    if (patch.prerequisiteTopicIds) {
      payload.prerequisiteTopicIds = patch.prerequisiteTopicIds
        .filter((pid) => mongoose.Types.ObjectId.isValid(pid))
        .map((pid) => new mongoose.Types.ObjectId(pid));
    }
    const updated = await Model.findByIdAndUpdate(id, { $set: payload }, { new: true }).lean();
    return updated ? mapDocToTopic(updated) : null;
  }

  async deleteTopic(id: string): Promise<boolean> {
    await this.ensureSeeded();
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const Model = getMongooseModel('topics');
    const res = await Model.deleteOne({ _id: new mongoose.Types.ObjectId(id) });
    return res.deletedCount > 0;
  }

  async findLabelConfig(
    userId: string,
    educationSystemId?: string,
  ): Promise<EducationLabelConfigRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(userId)) return null;
    await connectToDatabase();
    const Model = getMongooseModel('educationLabelConfigs');
    const sysObjId = toObjectIdIfValid(educationSystemId);
    if (sysObjId) {
      const specific = await Model.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        educationSystemId: sysObjId,
      }).lean();
      if (specific) return mapDocToLabelConfig(specific);
    }
    const fallback = await Model.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      educationSystemId: null,
    }).lean();
    return fallback ? mapDocToLabelConfig(fallback) : null;
  }

  async listLabelConfigsByUser(userId: string): Promise<EducationLabelConfigRecord[]> {
    if (!mongoose.Types.ObjectId.isValid(userId)) return [];
    await connectToDatabase();
    const Model = getMongooseModel('educationLabelConfigs');
    const docs = await Model.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .lean();
    return docs.map(mapDocToLabelConfig);
  }

  async upsertLabelConfig(data: {
    userId: string;
    educationSystemId?: string;
    presetName: string;
    labels: EducationLabelDefinition[];
  }): Promise<EducationLabelConfigRecord> {
    if (!mongoose.Types.ObjectId.isValid(data.userId)) {
      throw new Error('Valid userId is required for education label config');
    }
    await connectToDatabase();
    const Model = getMongooseModel('educationLabelConfigs');
    const sysObjId = toObjectIdIfValid(data.educationSystemId) ?? null;
    const updated = await Model.findOneAndUpdate(
      {
        userId: new mongoose.Types.ObjectId(data.userId),
        educationSystemId: sysObjId,
      },
      {
        $set: {
          presetName: data.presetName,
          labels: data.labels,
        },
        $setOnInsert: {
          userId: new mongoose.Types.ObjectId(data.userId),
          educationSystemId: sysObjId,
        },
      },
      { upsert: true, new: true },
    ).lean();
    return mapDocToLabelConfig(updated ?? {});
  }

  async deleteLabelConfig(userId: string, educationSystemId?: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(userId)) return false;
    await connectToDatabase();
    const Model = getMongooseModel('educationLabelConfigs');
    const sysObjId = toObjectIdIfValid(educationSystemId) ?? null;
    const res = await Model.deleteOne({
      userId: new mongoose.Types.ObjectId(userId),
      educationSystemId: sysObjId,
    });
    return res.deletedCount > 0;
  }

  async recordAuditLog(entry: {
    actorId: string;
    actorRole: UserRole;
    action: string;
    targetCollection?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditLogRecord> {
    await connectToDatabase();
    const Model = getMongooseModel('auditLogs');
    const actorObjId = mongoose.Types.ObjectId.isValid(entry.actorId)
      ? new mongoose.Types.ObjectId(entry.actorId)
      : new mongoose.Types.ObjectId('66f000000000000000000001');
    const created = await Model.create({
      actorId: actorObjId,
      actorRole: entry.actorRole,
      action: entry.action,
      targetCollection: entry.targetCollection,
      targetId: entry.targetId,
      metadata: entry.metadata,
    });
    return mapDocToAuditLog(created as unknown as Record<string, unknown>);
  }

  async listAuditLogs(limit = 50): Promise<AuditLogRecord[]> {
    await connectToDatabase();
    const Model = getMongooseModel('auditLogs');
    const docs = await Model.find({}).sort({ createdAt: -1 }).limit(limit).lean();
    return docs.map(mapDocToAuditLog);
  }
}

export class InMemoryCurriculumRepository implements CurriculumRepository {
  private readonly systems = new Map<string, EducationSystemRecord>();
  private readonly levels = new Map<string, EducationLevelRecord>();
  private readonly examinations = new Map<string, ExaminationRecord>();
  private readonly subjects = new Map<string, SubjectRecord>();
  private readonly chapters = new Map<string, ChapterRecord>();
  private readonly topics = new Map<string, TopicRecord>();
  private readonly labelConfigs = new Map<string, EducationLabelConfigRecord>();
  private readonly auditLogs: AuditLogRecord[] = [];

  constructor(seedWithDefaults = true) {
    if (seedWithDefaults) {
      for (const s of INITIAL_EDUCATION_SYSTEMS) {
        this.systems.set(s.id, { ...s, scope: 'global', isArchived: false, educationType: 'standard' });
      }
      for (const l of INITIAL_EDUCATION_LEVELS) {
        this.levels.set(l.id, { ...l, scope: 'global', isArchived: false });
      }
      for (const e of INITIAL_EXAMINATIONS) {
        this.examinations.set(e.id, { ...e, scope: 'global', isArchived: false });
      }
      for (const sub of INITIAL_SUBJECTS) {
        this.subjects.set(sub.id, {
          ...sub,
          scope: 'global',
          isArchived: false,
          examinationIds: [...sub.examinationIds],
        });
      }
      for (const c of INITIAL_CHAPTERS) {
        this.chapters.set(c.id, { ...c, scope: 'global', isArchived: false });
      }
      for (const t of INITIAL_TOPICS) {
        this.topics.set(t.id, {
          ...t,
          scope: 'global',
          isArchived: false,
          learningObjectives: [...t.learningObjectives],
          prerequisiteTopicIds: [...t.prerequisiteTopicIds],
          keyConcepts: [...t.keyConcepts],
          curriculumReferences: [...t.curriculumReferences],
        });
      }
    }
  }

  async listEducationSystems(
    includeInactive = false,
    country?: string,
    visibility?: CurriculumVisibilityFilter,
  ): Promise<EducationSystemRecord[]> {
    return Array.from(this.systems.values())
      .filter(
        (s) =>
          (includeInactive || s.isActive) &&
          (!country || s.country === country.toUpperCase()) &&
          matchesInMemoryVisibility(s, visibility),
      )
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((s) => ({ ...s }));
  }

  async findEducationSystemById(id: string): Promise<EducationSystemRecord | null> {
    const found = this.systems.get(id);
    return found ? { ...found } : null;
  }

  async createEducationSystem(
    data: Omit<EducationSystemRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<EducationSystemRecord> {
    const scope = data.scope ?? 'global';
    for (const existing of this.systems.values()) {
      if (
        (existing.scope ?? 'global') === scope &&
        existing.ownerUserId === data.ownerUserId &&
        existing.code.toUpperCase() === data.code.toUpperCase()
      ) {
        throw new Error(`Duplicate educationSystem code: ${data.code}`);
      }
    }
    const now = new Date();
    const record: EducationSystemRecord = {
      ...data,
      scope,
      isArchived: data.isArchived ?? false,
      educationType: data.educationType ?? 'standard',
      id: generateHexObjectId(),
      createdAt: now,
      updatedAt: now,
    };
    this.systems.set(record.id, record);
    return { ...record };
  }

  async updateEducationSystem(
    id: string,
    patch: Partial<Omit<EducationSystemRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<EducationSystemRecord | null> {
    const existing = this.systems.get(id);
    if (!existing) return null;
    const updated: EducationSystemRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date(),
    };
    this.systems.set(id, updated);
    return { ...updated };
  }

  async deleteEducationSystem(id: string): Promise<boolean> {
    return this.systems.delete(id);
  }

  async listEducationLevels(
    educationSystemId?: string,
    includeInactive = false,
    visibility?: CurriculumVisibilityFilter,
  ): Promise<EducationLevelRecord[]> {
    return Array.from(this.levels.values())
      .filter(
        (l) =>
          (includeInactive || l.isActive) &&
          (!educationSystemId || l.educationSystemId === educationSystemId) &&
          matchesInMemoryVisibility(l, visibility),
      )
      .sort((a, b) => a.order - b.order || a.code.localeCompare(b.code))
      .map((l) => ({ ...l }));
  }

  async findEducationLevelById(id: string): Promise<EducationLevelRecord | null> {
    const found = this.levels.get(id);
    return found ? { ...found } : null;
  }

  async createEducationLevel(
    data: Omit<EducationLevelRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<EducationLevelRecord> {
    const scope = data.scope ?? 'global';
    for (const existing of this.levels.values()) {
      if (
        existing.educationSystemId === data.educationSystemId &&
        (existing.scope ?? 'global') === scope &&
        existing.ownerUserId === data.ownerUserId &&
        existing.code.toUpperCase() === data.code.toUpperCase()
      ) {
        throw new Error(`Duplicate educationLevel code: ${data.code}`);
      }
    }
    const now = new Date();
    const record: EducationLevelRecord = {
      ...data,
      scope,
      isArchived: data.isArchived ?? false,
      id: generateHexObjectId(),
      createdAt: now,
      updatedAt: now,
    };
    this.levels.set(record.id, record);
    return { ...record };
  }

  async updateEducationLevel(
    id: string,
    patch: Partial<Omit<EducationLevelRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<EducationLevelRecord | null> {
    const existing = this.levels.get(id);
    if (!existing) return null;
    const updated: EducationLevelRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date(),
    };
    this.levels.set(id, updated);
    return { ...updated };
  }

  async deleteEducationLevel(id: string): Promise<boolean> {
    return this.levels.delete(id);
  }

  async listExaminations(
    filters?: CurriculumVisibilityFilter & {
      educationSystemId?: string;
      educationLevelId?: string;
      includeInactive?: boolean;
    },
  ): Promise<ExaminationRecord[]> {
    return Array.from(this.examinations.values())
      .filter(
        (e) =>
          (filters?.includeInactive || e.isActive) &&
          (!filters?.educationSystemId || e.educationSystemId === filters.educationSystemId) &&
          (!filters?.educationLevelId || e.educationLevelId === filters.educationLevelId) &&
          matchesInMemoryVisibility(e, filters),
      )
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((e) => ({ ...e }));
  }

  async findExaminationById(id: string): Promise<ExaminationRecord | null> {
    const found = this.examinations.get(id);
    return found ? { ...found } : null;
  }

  async createExamination(
    data: Omit<ExaminationRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ExaminationRecord> {
    const scope = data.scope ?? 'global';
    for (const existing of this.examinations.values()) {
      if (
        existing.educationSystemId === data.educationSystemId &&
        (existing.scope ?? 'global') === scope &&
        existing.ownerUserId === data.ownerUserId &&
        existing.code.toUpperCase() === data.code.toUpperCase()
      ) {
        throw new Error(`Duplicate examination code: ${data.code}`);
      }
    }
    const now = new Date();
    const record: ExaminationRecord = {
      ...data,
      scope,
      isArchived: data.isArchived ?? false,
      id: generateHexObjectId(),
      createdAt: now,
      updatedAt: now,
    };
    this.examinations.set(record.id, record);
    return { ...record };
  }

  async updateExamination(
    id: string,
    patch: Partial<Omit<ExaminationRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ExaminationRecord | null> {
    const existing = this.examinations.get(id);
    if (!existing) return null;
    const updated: ExaminationRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date(),
    };
    this.examinations.set(id, updated);
    return { ...updated };
  }

  async deleteExamination(id: string): Promise<boolean> {
    return this.examinations.delete(id);
  }

  async listSubjects(
    filters?: CurriculumVisibilityFilter & {
      educationSystemId?: string;
      educationLevelId?: string;
      examinationId?: string;
      includeInactive?: boolean;
    },
  ): Promise<SubjectRecord[]> {
    return Array.from(this.subjects.values())
      .filter(
        (s) =>
          (filters?.includeInactive || s.isActive) &&
          (!filters?.educationSystemId || s.educationSystemId === filters.educationSystemId) &&
          (!filters?.educationLevelId || s.educationLevelId === filters.educationLevelId) &&
          (!filters?.examinationId || s.examinationIds.includes(filters.examinationId)) &&
          matchesInMemoryVisibility(s, filters),
      )
      .sort((a, b) => a.order - b.order || a.code.localeCompare(b.code))
      .map((s) => ({ ...s, examinationIds: [...s.examinationIds] }));
  }

  async findSubjectById(id: string): Promise<SubjectRecord | null> {
    const found = this.subjects.get(id);
    return found ? { ...found, examinationIds: [...found.examinationIds] } : null;
  }

  async createSubject(
    data: Omit<SubjectRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SubjectRecord> {
    const scope = data.scope ?? 'global';
    for (const existing of this.subjects.values()) {
      if (
        existing.educationSystemId === data.educationSystemId &&
        (existing.scope ?? 'global') === scope &&
        existing.ownerUserId === data.ownerUserId &&
        existing.code.toUpperCase() === data.code.toUpperCase()
      ) {
        throw new Error(`Duplicate subject code: ${data.code}`);
      }
    }
    const now = new Date();
    const record: SubjectRecord = {
      ...data,
      scope,
      isArchived: data.isArchived ?? false,
      examinationIds: [...data.examinationIds],
      id: generateHexObjectId(),
      createdAt: now,
      updatedAt: now,
    };
    this.subjects.set(record.id, record);
    return { ...record, examinationIds: [...record.examinationIds] };
  }

  async updateSubject(
    id: string,
    patch: Partial<Omit<SubjectRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<SubjectRecord | null> {
    const existing = this.subjects.get(id);
    if (!existing) return null;
    const updated: SubjectRecord = {
      ...existing,
      ...patch,
      examinationIds: patch.examinationIds ? [...patch.examinationIds] : [...existing.examinationIds],
      updatedAt: new Date(),
    };
    this.subjects.set(id, updated);
    return { ...updated, examinationIds: [...updated.examinationIds] };
  }

  async deleteSubject(id: string): Promise<boolean> {
    return this.subjects.delete(id);
  }

  async listChapters(
    subjectId?: string,
    includeInactive = false,
    visibility?: CurriculumVisibilityFilter,
  ): Promise<ChapterRecord[]> {
    return Array.from(this.chapters.values())
      .filter(
        (c) =>
          (includeInactive || c.isActive) &&
          (!subjectId || c.subjectId === subjectId) &&
          matchesInMemoryVisibility(c, visibility),
      )
      .sort((a, b) => a.order - b.order || a.chapterNumber - b.chapterNumber)
      .map((c) => ({ ...c }));
  }

  async findChapterById(id: string): Promise<ChapterRecord | null> {
    const found = this.chapters.get(id);
    return found ? { ...found } : null;
  }

  async createChapter(
    data: Omit<ChapterRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ChapterRecord> {
    const now = new Date();
    const record: ChapterRecord = {
      ...data,
      scope: data.scope ?? 'global',
      isArchived: data.isArchived ?? false,
      id: generateHexObjectId(),
      createdAt: now,
      updatedAt: now,
    };
    this.chapters.set(record.id, record);
    return { ...record };
  }

  async updateChapter(
    id: string,
    patch: Partial<Omit<ChapterRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ChapterRecord | null> {
    const existing = this.chapters.get(id);
    if (!existing) return null;
    const updated: ChapterRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date(),
    };
    this.chapters.set(id, updated);
    return { ...updated };
  }

  async deleteChapter(id: string): Promise<boolean> {
    return this.chapters.delete(id);
  }

  async listTopics(filter: TopicQueryFilter): Promise<{ items: TopicRecord[]; total: number }> {
    let all = Array.from(this.topics.values()).filter((t) =>
      matchesInMemoryVisibility(t, filter),
    );
    if (!filter.includeInactive) {
      all = all.filter((t) => t.isActive);
    }
    if (filter.subjectId) {
      all = all.filter((t) => t.subjectId === filter.subjectId);
    }
    if (filter.chapterId) {
      all = all.filter((t) => t.chapterId === filter.chapterId);
    }
    if (filter.difficulty) {
      all = all.filter((t) => t.difficulty === filter.difficulty);
    }
    if (filter.topicIds) {
      const idSet = new Set(filter.topicIds);
      all = all.filter((t) => idSet.has(t.id));
    }
    if (filter.search?.trim()) {
      const q = filter.search.trim().toLowerCase();
      all = all.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.titleBn ?? '').toLowerCase().includes(q) ||
          (t.description ?? '').toLowerCase().includes(q) ||
          t.code.toLowerCase().includes(q) ||
          t.keyConcepts.some((k) => k.toLowerCase().includes(q)),
      );
    }

    all.sort((a, b) => a.order - b.order || a.code.localeCompare(b.code));
    const total = all.length;
    const skip = Math.max(0, (filter.page - 1) * filter.limit);
    const items = all.slice(skip, skip + filter.limit).map((t) => ({
      ...t,
      learningObjectives: [...t.learningObjectives],
      prerequisiteTopicIds: [...t.prerequisiteTopicIds],
      keyConcepts: [...t.keyConcepts],
      curriculumReferences: [...t.curriculumReferences],
    }));
    return { items, total };
  }

  async findTopicById(id: string): Promise<TopicRecord | null> {
    const found = this.topics.get(id);
    if (!found) return null;
    return {
      ...found,
      learningObjectives: [...found.learningObjectives],
      prerequisiteTopicIds: [...found.prerequisiteTopicIds],
      keyConcepts: [...found.keyConcepts],
      curriculumReferences: [...found.curriculumReferences],
    };
  }

  async createTopic(
    data: Omit<TopicRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<TopicRecord> {
    const now = new Date();
    const record: TopicRecord = {
      ...data,
      scope: data.scope ?? 'global',
      isArchived: data.isArchived ?? false,
      learningObjectives: [...data.learningObjectives],
      prerequisiteTopicIds: [...data.prerequisiteTopicIds],
      keyConcepts: [...data.keyConcepts],
      curriculumReferences: [...data.curriculumReferences],
      id: generateHexObjectId(),
      createdAt: now,
      updatedAt: now,
    };
    this.topics.set(record.id, record);
    return { ...record };
  }

  async updateTopic(
    id: string,
    patch: Partial<Omit<TopicRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<TopicRecord | null> {
    const existing = this.topics.get(id);
    if (!existing) return null;
    const updated: TopicRecord = {
      ...existing,
      ...patch,
      learningObjectives: patch.learningObjectives
        ? [...patch.learningObjectives]
        : [...existing.learningObjectives],
      prerequisiteTopicIds: patch.prerequisiteTopicIds
        ? [...patch.prerequisiteTopicIds]
        : [...existing.prerequisiteTopicIds],
      keyConcepts: patch.keyConcepts ? [...patch.keyConcepts] : [...existing.keyConcepts],
      curriculumReferences: patch.curriculumReferences
        ? [...patch.curriculumReferences]
        : [...existing.curriculumReferences],
      updatedAt: new Date(),
    };
    this.topics.set(id, updated);
    return { ...updated };
  }

  async deleteTopic(id: string): Promise<boolean> {
    return this.topics.delete(id);
  }

  private getLabelKey(userId: string, educationSystemId?: string): string {
    return `${userId}:${educationSystemId ?? 'global_default'}`;
  }

  async findLabelConfig(
    userId: string,
    educationSystemId?: string,
  ): Promise<EducationLabelConfigRecord | null> {
    if (educationSystemId) {
      const specific = this.labelConfigs.get(this.getLabelKey(userId, educationSystemId));
      if (specific) return { ...specific, labels: specific.labels.map((l) => ({ ...l })) };
    }
    const fallback = this.labelConfigs.get(this.getLabelKey(userId, undefined));
    return fallback ? { ...fallback, labels: fallback.labels.map((l) => ({ ...l })) } : null;
  }

  async listLabelConfigsByUser(userId: string): Promise<EducationLabelConfigRecord[]> {
    return Array.from(this.labelConfigs.values())
      .filter((c) => c.userId === userId)
      .map((c) => ({ ...c, labels: c.labels.map((l) => ({ ...l })) }));
  }

  async upsertLabelConfig(data: {
    userId: string;
    educationSystemId?: string;
    presetName: string;
    labels: EducationLabelDefinition[];
  }): Promise<EducationLabelConfigRecord> {
    const key = this.getLabelKey(data.userId, data.educationSystemId);
    const existing = this.labelConfigs.get(key);
    const now = new Date();
    const record: EducationLabelConfigRecord = {
      id: existing?.id ?? generateHexObjectId(),
      userId: data.userId,
      educationSystemId: data.educationSystemId,
      presetName: data.presetName,
      labels: data.labels.map((l) => ({ ...l })),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.labelConfigs.set(key, record);
    return { ...record, labels: record.labels.map((l) => ({ ...l })) };
  }

  async deleteLabelConfig(userId: string, educationSystemId?: string): Promise<boolean> {
    return this.labelConfigs.delete(this.getLabelKey(userId, educationSystemId));
  }

  async recordAuditLog(entry: {
    actorId: string;
    actorRole: UserRole;
    action: string;
    targetCollection?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditLogRecord> {
    const record: AuditLogRecord = {
      id: generateHexObjectId(),
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      action: entry.action,
      targetCollection: entry.targetCollection,
      targetId: entry.targetId,
      metadata: entry.metadata,
      createdAt: new Date(),
    };
    this.auditLogs.unshift(record);
    return { ...record };
  }

  async listAuditLogs(limit = 50): Promise<AuditLogRecord[]> {
    return this.auditLogs.slice(0, limit).map((a) => ({ ...a }));
  }
}

let fallbackCurriculumRepo: InMemoryCurriculumRepository | null = null;
let activeCurriculumRepoOverride: CurriculumRepository | null = null;

export function setActiveCurriculumRepository(repo: CurriculumRepository | null): void {
  activeCurriculumRepoOverride = repo;
}

export function getActiveCurriculumRepository(): CurriculumRepository {
  if (activeCurriculumRepoOverride) {
    return activeCurriculumRepoOverride;
  }
  if (process.env.MONGODB_URI?.trim()) {
    return new MongooseCurriculumRepository();
  }
  if (!fallbackCurriculumRepo) {
    fallbackCurriculumRepo = new InMemoryCurriculumRepository(true);
  }
  return fallbackCurriculumRepo;
}
