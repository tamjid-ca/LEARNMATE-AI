/**
 * LearnMate AI — Curriculum & Administrative CMS Repository
 * Supports both MongoDB/Mongoose (production) and pre-seeded InMemory (deterministic tests).
 */

import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { connectToDatabase } from '../../lib/database/mongoose.ts';
import { getMongooseModel } from '../../models/index.ts';
import type { DifficultyLevel, SupportedLanguage, UserRole } from '../../types/domain.ts';
import {
  type AuditLogRecord,
  type ChapterRecord,
  type EducationLevelRecord,
  type EducationSystemRecord,
  type ExaminationRecord,
  INITIAL_CHAPTERS,
  INITIAL_EDUCATION_LEVELS,
  INITIAL_EDUCATION_SYSTEMS,
  INITIAL_EXAMINATIONS,
  INITIAL_SUBJECTS,
  INITIAL_TOPICS,
  type SubjectRecord,
  type TopicRecord,
} from './seed-data.ts';

export interface TopicQueryFilter {
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
  listEducationSystems(includeInactive?: boolean, country?: string): Promise<EducationSystemRecord[]>;
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
    filters?: { educationSystemId?: string; educationLevelId?: string; includeInactive?: boolean },
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
  listSubjects(filters?: {
    educationSystemId?: string;
    educationLevelId?: string;
    examinationId?: string;
    includeInactive?: boolean;
  }): Promise<SubjectRecord[]>;
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
  listChapters(subjectId?: string, includeInactive?: boolean): Promise<ChapterRecord[]>;
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
    order: typeof doc.order === 'number' ? doc.order : 0,
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

function mapDocToExamination(doc: Record<string, unknown>): ExaminationRecord {
  return {
    id: String(doc._id),
    educationSystemId: String(doc.educationSystemId ?? ''),
    educationLevelId: String(doc.educationLevelId ?? ''),
    code: String(doc.code ?? ''),
    name: String(doc.name ?? ''),
    description: doc.description ? String(doc.description) : undefined,
    examDate: doc.examDate ? new Date(String(doc.examDate)) : null,
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

function mapDocToSubject(doc: Record<string, unknown>): SubjectRecord {
  return {
    id: String(doc._id),
    educationSystemId: String(doc.educationSystemId ?? ''),
    educationLevelId: String(doc.educationLevelId ?? ''),
    examinationIds: Array.isArray(doc.examinationIds)
      ? doc.examinationIds.map((id) => String(id))
      : [],
    code: String(doc.code ?? ''),
    name: String(doc.name ?? ''),
    nameBn: doc.nameBn ? String(doc.nameBn) : undefined,
    description: doc.description ? String(doc.description) : undefined,
    order: typeof doc.order === 'number' ? doc.order : 0,
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
    order: typeof doc.order === 'number' ? doc.order : 0,
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
    order: typeof doc.order === 'number' ? doc.order : 0,
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
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
  ): Promise<EducationSystemRecord[]> {
    await this.ensureSeeded();
    const Model = getMongooseModel('educationSystems');
    const filter: Record<string, unknown> = {};
    if (!includeInactive) filter.isActive = true;
    if (country) filter.country = country.toUpperCase();
    const docs = await Model.find(filter).sort({ code: 1 }).lean();
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
    const created = await Model.create(data);
    return mapDocToSystem(created as unknown as Record<string, unknown>);
  }

  async updateEducationSystem(
    id: string,
    patch: Partial<Omit<EducationSystemRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<EducationSystemRecord | null> {
    await this.ensureSeeded();
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const Model = getMongooseModel('educationSystems');
    const updated = await Model.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
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
  ): Promise<EducationLevelRecord[]> {
    await this.ensureSeeded();
    const Model = getMongooseModel('educationLevels');
    const filter: Record<string, unknown> = {};
    if (!includeInactive) filter.isActive = true;
    if (educationSystemId && mongoose.Types.ObjectId.isValid(educationSystemId)) {
      filter.educationSystemId = new mongoose.Types.ObjectId(educationSystemId);
    }
    const docs = await Model.find(filter).sort({ order: 1, code: 1 }).lean();
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

  async listExaminations(filters?: {
    educationSystemId?: string;
    educationLevelId?: string;
    includeInactive?: boolean;
  }): Promise<ExaminationRecord[]> {
    await this.ensureSeeded();
    const Model = getMongooseModel('examinations');
    const query: Record<string, unknown> = {};
    if (!filters?.includeInactive) query.isActive = true;
    if (filters?.educationSystemId && mongoose.Types.ObjectId.isValid(filters.educationSystemId)) {
      query.educationSystemId = new mongoose.Types.ObjectId(filters.educationSystemId);
    }
    if (filters?.educationLevelId && mongoose.Types.ObjectId.isValid(filters.educationLevelId)) {
      query.educationLevelId = new mongoose.Types.ObjectId(filters.educationLevelId);
    }
    const docs = await Model.find(query).sort({ examDate: 1, code: 1 }).lean();
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
    const created = await Model.create({
      ...data,
      educationSystemId: new mongoose.Types.ObjectId(data.educationSystemId),
      educationLevelId: new mongoose.Types.ObjectId(data.educationLevelId),
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
    if (patch.educationLevelId) {
      payload.educationLevelId = new mongoose.Types.ObjectId(patch.educationLevelId);
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

  async listSubjects(filters?: {
    educationSystemId?: string;
    educationLevelId?: string;
    examinationId?: string;
    includeInactive?: boolean;
  }): Promise<SubjectRecord[]> {
    await this.ensureSeeded();
    const Model = getMongooseModel('subjects');
    const query: Record<string, unknown> = {};
    if (!filters?.includeInactive) query.isActive = true;
    if (filters?.educationSystemId && mongoose.Types.ObjectId.isValid(filters.educationSystemId)) {
      query.educationSystemId = new mongoose.Types.ObjectId(filters.educationSystemId);
    }
    if (filters?.educationLevelId && mongoose.Types.ObjectId.isValid(filters.educationLevelId)) {
      query.educationLevelId = new mongoose.Types.ObjectId(filters.educationLevelId);
    }
    if (filters?.examinationId && mongoose.Types.ObjectId.isValid(filters.examinationId)) {
      query.examinationIds = new mongoose.Types.ObjectId(filters.examinationId);
    }
    const docs = await Model.find(query).sort({ order: 1, code: 1 }).lean();
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
    const created = await Model.create({
      ...data,
      educationSystemId: new mongoose.Types.ObjectId(data.educationSystemId),
      educationLevelId: new mongoose.Types.ObjectId(data.educationLevelId),
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
    if (patch.educationLevelId) {
      payload.educationLevelId = new mongoose.Types.ObjectId(patch.educationLevelId);
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

  async listChapters(subjectId?: string, includeInactive = false): Promise<ChapterRecord[]> {
    await this.ensureSeeded();
    const Model = getMongooseModel('chapters');
    const query: Record<string, unknown> = {};
    if (!includeInactive) query.isActive = true;
    if (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) {
      query.subjectId = new mongoose.Types.ObjectId(subjectId);
    }
    const docs = await Model.find(query).sort({ order: 1, chapterNumber: 1 }).lean();
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
    const query: Record<string, unknown> = {};
    if (!filter.includeInactive) query.isActive = true;
    if (filter.subjectId && mongoose.Types.ObjectId.isValid(filter.subjectId)) {
      query.subjectId = new mongoose.Types.ObjectId(filter.subjectId);
    }
    if (filter.chapterId && mongoose.Types.ObjectId.isValid(filter.chapterId)) {
      query.chapterId = new mongoose.Types.ObjectId(filter.chapterId);
    }
    if (filter.difficulty) {
      query.difficulty = filter.difficulty;
    }
    if (filter.topicIds) {
      const validIds = filter.topicIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      query._id = { $in: validIds };
    }
    if (filter.search?.trim()) {
      const escaped = filter.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { titleBn: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { code: { $regex: escaped, $options: 'i' } },
      ];
    }

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
  private readonly auditLogs: AuditLogRecord[] = [];

  constructor(seedWithDefaults = true) {
    if (seedWithDefaults) {
      for (const s of INITIAL_EDUCATION_SYSTEMS) this.systems.set(s.id, { ...s });
      for (const l of INITIAL_EDUCATION_LEVELS) this.levels.set(l.id, { ...l });
      for (const e of INITIAL_EXAMINATIONS) this.examinations.set(e.id, { ...e });
      for (const sub of INITIAL_SUBJECTS) {
        this.subjects.set(sub.id, { ...sub, examinationIds: [...sub.examinationIds] });
      }
      for (const c of INITIAL_CHAPTERS) this.chapters.set(c.id, { ...c });
      for (const t of INITIAL_TOPICS) {
        this.topics.set(t.id, {
          ...t,
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
  ): Promise<EducationSystemRecord[]> {
    return Array.from(this.systems.values())
      .filter((s) => (includeInactive || s.isActive) && (!country || s.country === country.toUpperCase()))
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
    for (const existing of this.systems.values()) {
      if (existing.code.toUpperCase() === data.code.toUpperCase()) {
        throw new Error(`Duplicate educationSystem code: ${data.code}`);
      }
    }
    const now = new Date();
    const record: EducationSystemRecord = {
      ...data,
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
  ): Promise<EducationLevelRecord[]> {
    return Array.from(this.levels.values())
      .filter(
        (l) =>
          (includeInactive || l.isActive) &&
          (!educationSystemId || l.educationSystemId === educationSystemId),
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
    for (const existing of this.levels.values()) {
      if (
        existing.educationSystemId === data.educationSystemId &&
        existing.code.toUpperCase() === data.code.toUpperCase()
      ) {
        throw new Error(`Duplicate educationLevel code: ${data.code}`);
      }
    }
    const now = new Date();
    const record: EducationLevelRecord = {
      ...data,
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

  async listExaminations(filters?: {
    educationSystemId?: string;
    educationLevelId?: string;
    includeInactive?: boolean;
  }): Promise<ExaminationRecord[]> {
    return Array.from(this.examinations.values())
      .filter(
        (e) =>
          (filters?.includeInactive || e.isActive) &&
          (!filters?.educationSystemId || e.educationSystemId === filters.educationSystemId) &&
          (!filters?.educationLevelId || e.educationLevelId === filters.educationLevelId),
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
    const now = new Date();
    const record: ExaminationRecord = {
      ...data,
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

  async listSubjects(filters?: {
    educationSystemId?: string;
    educationLevelId?: string;
    examinationId?: string;
    includeInactive?: boolean;
  }): Promise<SubjectRecord[]> {
    return Array.from(this.subjects.values())
      .filter(
        (s) =>
          (filters?.includeInactive || s.isActive) &&
          (!filters?.educationSystemId || s.educationSystemId === filters.educationSystemId) &&
          (!filters?.educationLevelId || s.educationLevelId === filters.educationLevelId) &&
          (!filters?.examinationId || s.examinationIds.includes(filters.examinationId)),
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
    const now = new Date();
    const record: SubjectRecord = {
      ...data,
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

  async listChapters(subjectId?: string, includeInactive = false): Promise<ChapterRecord[]> {
    return Array.from(this.chapters.values())
      .filter(
        (c) => (includeInactive || c.isActive) && (!subjectId || c.subjectId === subjectId),
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
    let all = Array.from(this.topics.values());
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
