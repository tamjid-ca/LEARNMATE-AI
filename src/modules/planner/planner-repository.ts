/**
 * LearnMate AI — Study Plans & Study Tasks Repository
 * Persists studyPlans and studyTasks across MongoDB/Mongoose and InMemory test stores.
 * Enforces strict userId ownership filtering on all queries.
 */

import { randomBytes } from 'node:crypto';
import mongoose, { type Types } from 'mongoose';
import { connectToDatabase } from '../../lib/database/mongoose.ts';
import { getMongooseModel } from '../../models/index.ts';
import type {
  ExplanationDepth,
  StudyPlanStatus,
  StudyTaskStatus,
  StudyTaskType,
} from '../../types/domain.ts';
import type { WeeklyMilestoneItem } from './scheduler-engine.ts';

export interface StudyPlanRecord {
  id: string;
  userId: string;
  title: string;
  targetExaminationId?: string;
  targetDate: Date;
  startDate: Date;
  subjectIds: string[];
  dailyStudyMinutes: number;
  availableDaysOfWeek: number[];
  proficiencyBySubject: Record<string, ExplanationDepth>;
  weeklyMilestones: WeeklyMilestoneItem[];
  aiSummary?: string;
  status: StudyPlanStatus;
  completionPercent: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudyTaskRecord {
  id: string;
  studyPlanId: string;
  userId: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  taskType: StudyTaskType;
  title: string;
  description?: string;
  scheduledDateKey: string;
  scheduledDate: Date;
  durationMinutes: number;
  priorityRank: number;
  status: StudyTaskStatus;
  completedAt?: Date;
  isManuallyEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudyPlanRepository {
  // Study Plans
  listPlansByUser(userId: string): Promise<StudyPlanRecord[]>;
  findPlanById(id: string): Promise<StudyPlanRecord | null>;
  createPlan(
    data: Omit<StudyPlanRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<StudyPlanRecord>;
  updatePlan(
    id: string,
    userId: string,
    patch: Partial<Omit<StudyPlanRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<StudyPlanRecord | null>;
  deletePlanAndTasks(id: string, userId: string): Promise<boolean>;

  // Study Tasks
  listTasksByPlan(studyPlanId: string, userId: string): Promise<StudyTaskRecord[]>;
  listTasksByUser(userId: string): Promise<StudyTaskRecord[]>;
  findTaskById(id: string): Promise<StudyTaskRecord | null>;
  createTask(
    data: Omit<StudyTaskRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<StudyTaskRecord>;
  createTasksBulk(
    items: Array<Omit<StudyTaskRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<StudyTaskRecord[]>;
  updateTask(
    id: string,
    userId: string,
    patch: Partial<
      Omit<StudyTaskRecord, 'id' | 'studyPlanId' | 'userId' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<StudyTaskRecord | null>;
  deleteTask(id: string, userId: string): Promise<boolean>;
  deleteNonCompletedTasksByPlan(studyPlanId: string, userId: string): Promise<number>;
}

function generateHexId(): string {
  return randomBytes(12).toString('hex');
}

function toValidObjectIdOrUndefined(id?: string): Types.ObjectId | undefined {
  return id && mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : undefined;
}

function unwrapMongooseDoc(doc: unknown): Record<string, unknown> {
  if (
    doc &&
    typeof doc === 'object' &&
    'toObject' in doc &&
    typeof (doc as { toObject: () => Record<string, unknown> }).toObject === 'function'
  ) {
    return (doc as { toObject: () => Record<string, unknown> }).toObject();
  }
  return (doc ?? {}) as Record<string, unknown>;
}

function mapDocToPlan(doc: Record<string, unknown>): StudyPlanRecord {
  const rawProficiency =
    doc.proficiencyBySubject && typeof doc.proficiencyBySubject === 'object'
      ? (doc.proficiencyBySubject as Record<string, ExplanationDepth>)
      : {};
  const rawMilestones = Array.isArray(doc.weeklyMilestones)
    ? (doc.weeklyMilestones as WeeklyMilestoneItem[])
    : [];

  return {
    id: String(doc._id),
    userId: String(doc.userId ?? ''),
    title: String(doc.title ?? ''),
    targetExaminationId: doc.targetExaminationId ? String(doc.targetExaminationId) : undefined,
    targetDate: doc.targetDate ? new Date(String(doc.targetDate)) : new Date(),
    startDate: doc.startDate ? new Date(String(doc.startDate)) : new Date(),
    subjectIds: Array.isArray(doc.subjectIds) ? doc.subjectIds.map(String) : [],
    dailyStudyMinutes: Number(doc.dailyStudyMinutes ?? 120),
    availableDaysOfWeek: Array.isArray(doc.availableDaysOfWeek)
      ? doc.availableDaysOfWeek.map(Number)
      : [0, 1, 2, 3, 4, 5, 6],
    proficiencyBySubject: { ...rawProficiency },
    weeklyMilestones: rawMilestones.map((m) => ({
      weekNumber: Number(m.weekNumber ?? 1),
      startDateKey: String(m.startDateKey ?? ''),
      endDateKey: String(m.endDateKey ?? ''),
      title: String(m.title ?? ''),
      focusSubjectNames: Array.isArray(m.focusSubjectNames)
        ? m.focusSubjectNames.map(String)
        : [],
      plannedMinutes: Number(m.plannedMinutes ?? 0),
      taskCount: Number(m.taskCount ?? 0),
    })),
    aiSummary: doc.aiSummary ? String(doc.aiSummary) : undefined,
    status: (doc.status as StudyPlanStatus) ?? 'active',
    completionPercent: Number(doc.completionPercent ?? 0),
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

function mapDocToTask(doc: Record<string, unknown>): StudyTaskRecord {
  return {
    id: String(doc._id),
    studyPlanId: String(doc.studyPlanId ?? ''),
    userId: String(doc.userId ?? ''),
    subjectId: doc.subjectId ? String(doc.subjectId) : undefined,
    chapterId: doc.chapterId ? String(doc.chapterId) : undefined,
    topicId: doc.topicId ? String(doc.topicId) : undefined,
    taskType: (doc.taskType as StudyTaskType) ?? 'learn_topic',
    title: String(doc.title ?? ''),
    description: doc.description ? String(doc.description) : undefined,
    scheduledDateKey: String(doc.scheduledDateKey ?? ''),
    scheduledDate: doc.scheduledDate ? new Date(String(doc.scheduledDate)) : new Date(),
    durationMinutes: Number(doc.durationMinutes ?? 45),
    priorityRank: Number(doc.priorityRank ?? 1),
    status: (doc.status as StudyTaskStatus) ?? 'pending',
    completedAt: doc.completedAt ? new Date(String(doc.completedAt)) : undefined,
    isManuallyEdited: Boolean(doc.isManuallyEdited),
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

export class MongooseStudyPlanRepository implements StudyPlanRepository {
  async listPlansByUser(userId: string): Promise<StudyPlanRecord[]> {
    if (!mongoose.Types.ObjectId.isValid(userId)) return [];
    await connectToDatabase();
    const Model = getMongooseModel('studyPlans');
    const docs = await Model.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map((d) => mapDocToPlan(d));
  }

  async findPlanById(id: string): Promise<StudyPlanRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    await connectToDatabase();
    const Model = getMongooseModel('studyPlans');
    const doc = await Model.findById(id).lean();
    return doc ? mapDocToPlan(doc) : null;
  }

  async createPlan(
    data: Omit<StudyPlanRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<StudyPlanRecord> {
    await connectToDatabase();
    const Model = getMongooseModel('studyPlans');
    const created = await Model.create({
      userId: new mongoose.Types.ObjectId(data.userId),
      title: data.title,
      targetExaminationId: toValidObjectIdOrUndefined(data.targetExaminationId),
      targetDate: data.targetDate,
      startDate: data.startDate,
      subjectIds: data.subjectIds
        .map((id) => toValidObjectIdOrUndefined(id))
        .filter((id): id is Types.ObjectId => Boolean(id)),
      dailyStudyMinutes: data.dailyStudyMinutes,
      availableDaysOfWeek: data.availableDaysOfWeek,
      proficiencyBySubject: data.proficiencyBySubject,
      weeklyMilestones: data.weeklyMilestones,
      aiSummary: data.aiSummary,
      status: data.status,
      completionPercent: data.completionPercent,
    });
    return mapDocToPlan(unwrapMongooseDoc(created));
  }

  async updatePlan(
    id: string,
    userId: string,
    patch: Partial<Omit<StudyPlanRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<StudyPlanRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      return null;
    }
    await connectToDatabase();
    const Model = getMongooseModel('studyPlans');
    const updateDoc: Record<string, unknown> = { ...patch };
    if (patch.targetExaminationId !== undefined) {
      updateDoc.targetExaminationId = toValidObjectIdOrUndefined(patch.targetExaminationId);
    }
    if (patch.subjectIds !== undefined) {
      updateDoc.subjectIds = patch.subjectIds
        .map((sid) => toValidObjectIdOrUndefined(sid))
        .filter((sid): sid is Types.ObjectId => Boolean(sid));
    }

    const updated = await Model.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), userId: new mongoose.Types.ObjectId(userId) },
      { $set: updateDoc },
      { new: true },
    ).lean();
    return updated ? mapDocToPlan(updated) : null;
  }

  async deletePlanAndTasks(id: string, userId: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      return false;
    }
    await connectToDatabase();
    const planObjId = new mongoose.Types.ObjectId(id);
    const userObjId = new mongoose.Types.ObjectId(userId);
    const PlanModel = getMongooseModel('studyPlans');
    const TaskModel = getMongooseModel('studyTasks');

    const res = await PlanModel.deleteOne({ _id: planObjId, userId: userObjId });
    if (res.deletedCount > 0) {
      await TaskModel.deleteMany({ studyPlanId: planObjId, userId: userObjId });
      return true;
    }
    return false;
  }

  async listTasksByPlan(studyPlanId: string, userId: string): Promise<StudyTaskRecord[]> {
    if (
      !mongoose.Types.ObjectId.isValid(studyPlanId) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return [];
    }
    await connectToDatabase();
    const Model = getMongooseModel('studyTasks');
    const docs = await Model.find({
      studyPlanId: new mongoose.Types.ObjectId(studyPlanId),
      userId: new mongoose.Types.ObjectId(userId),
    })
      .sort({ scheduledDate: 1, priorityRank: 1 })
      .lean();
    return docs.map((d) => mapDocToTask(d));
  }

  async listTasksByUser(userId: string): Promise<StudyTaskRecord[]> {
    if (!mongoose.Types.ObjectId.isValid(userId)) return [];
    await connectToDatabase();
    const Model = getMongooseModel('studyTasks');
    const docs = await Model.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ scheduledDate: 1, priorityRank: 1 })
      .lean();
    return docs.map((d) => mapDocToTask(d));
  }

  async findTaskById(id: string): Promise<StudyTaskRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    await connectToDatabase();
    const Model = getMongooseModel('studyTasks');
    const doc = await Model.findById(id).lean();
    return doc ? mapDocToTask(doc) : null;
  }

  async createTask(
    data: Omit<StudyTaskRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<StudyTaskRecord> {
    await connectToDatabase();
    const Model = getMongooseModel('studyTasks');
    const created = await Model.create({
      studyPlanId: new mongoose.Types.ObjectId(data.studyPlanId),
      userId: new mongoose.Types.ObjectId(data.userId),
      subjectId: toValidObjectIdOrUndefined(data.subjectId),
      chapterId: toValidObjectIdOrUndefined(data.chapterId),
      topicId: toValidObjectIdOrUndefined(data.topicId),
      taskType: data.taskType,
      title: data.title,
      description: data.description,
      scheduledDateKey: data.scheduledDateKey,
      scheduledDate: data.scheduledDate,
      durationMinutes: data.durationMinutes,
      priorityRank: data.priorityRank,
      status: data.status,
      completedAt: data.completedAt,
      isManuallyEdited: data.isManuallyEdited,
    });
    return mapDocToTask(unwrapMongooseDoc(created));
  }

  async createTasksBulk(
    items: Array<Omit<StudyTaskRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<StudyTaskRecord[]> {
    if (items.length === 0) return [];
    await connectToDatabase();
    const Model = getMongooseModel('studyTasks');
    const created = await Promise.all(
      items.map((data) =>
        Model.create({
          studyPlanId: new mongoose.Types.ObjectId(data.studyPlanId),
          userId: new mongoose.Types.ObjectId(data.userId),
          subjectId: toValidObjectIdOrUndefined(data.subjectId),
          chapterId: toValidObjectIdOrUndefined(data.chapterId),
          topicId: toValidObjectIdOrUndefined(data.topicId),
          taskType: data.taskType,
          title: data.title,
          description: data.description,
          scheduledDateKey: data.scheduledDateKey,
          scheduledDate: data.scheduledDate,
          durationMinutes: data.durationMinutes,
          priorityRank: data.priorityRank,
          status: data.status,
          completedAt: data.completedAt,
          isManuallyEdited: data.isManuallyEdited,
        }),
      ),
    );
    return created.map((doc) => mapDocToTask(unwrapMongooseDoc(doc)));
  }

  async updateTask(
    id: string,
    userId: string,
    patch: Partial<
      Omit<StudyTaskRecord, 'id' | 'studyPlanId' | 'userId' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<StudyTaskRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      return null;
    }
    await connectToDatabase();
    const Model = getMongooseModel('studyTasks');
    const updated = await Model.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), userId: new mongoose.Types.ObjectId(userId) },
      { $set: patch },
      { new: true },
    ).lean();
    return updated ? mapDocToTask(updated) : null;
  }

  async deleteTask(id: string, userId: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      return false;
    }
    await connectToDatabase();
    const Model = getMongooseModel('studyTasks');
    const res = await Model.deleteOne({
      _id: new mongoose.Types.ObjectId(id),
      userId: new mongoose.Types.ObjectId(userId),
    });
    return res.deletedCount > 0;
  }

  async deleteNonCompletedTasksByPlan(studyPlanId: string, userId: string): Promise<number> {
    if (
      !mongoose.Types.ObjectId.isValid(studyPlanId) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return 0;
    }
    await connectToDatabase();
    const Model = getMongooseModel('studyTasks');
    const res = await Model.deleteMany({
      studyPlanId: new mongoose.Types.ObjectId(studyPlanId),
      userId: new mongoose.Types.ObjectId(userId),
      status: { $ne: 'completed' },
    });
    return res.deletedCount ?? 0;
  }
}

export class InMemoryStudyPlanRepository implements StudyPlanRepository {
  private readonly plans = new Map<string, StudyPlanRecord>();
  private readonly tasks = new Map<string, StudyTaskRecord>();

  async listPlansByUser(userId: string): Promise<StudyPlanRecord[]> {
    return Array.from(this.plans.values())
      .filter((p) => p.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((p) => ({
        ...p,
        subjectIds: [...p.subjectIds],
        availableDaysOfWeek: [...p.availableDaysOfWeek],
        proficiencyBySubject: { ...p.proficiencyBySubject },
        weeklyMilestones: p.weeklyMilestones.map((m) => ({
          ...m,
          focusSubjectNames: [...m.focusSubjectNames],
        })),
      }));
  }

  async findPlanById(id: string): Promise<StudyPlanRecord | null> {
    const plan = this.plans.get(id);
    if (!plan) return null;
    return {
      ...plan,
      subjectIds: [...plan.subjectIds],
      availableDaysOfWeek: [...plan.availableDaysOfWeek],
      proficiencyBySubject: { ...plan.proficiencyBySubject },
      weeklyMilestones: plan.weeklyMilestones.map((m) => ({
        ...m,
        focusSubjectNames: [...m.focusSubjectNames],
      })),
    };
  }

  async createPlan(
    data: Omit<StudyPlanRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<StudyPlanRecord> {
    const now = new Date();
    const record: StudyPlanRecord = {
      ...data,
      id: generateHexId(),
      subjectIds: [...data.subjectIds],
      availableDaysOfWeek: [...data.availableDaysOfWeek],
      proficiencyBySubject: { ...data.proficiencyBySubject },
      weeklyMilestones: data.weeklyMilestones.map((m) => ({
        ...m,
        focusSubjectNames: [...m.focusSubjectNames],
      })),
      createdAt: now,
      updatedAt: now,
    };
    this.plans.set(record.id, record);
    return { ...record };
  }

  async updatePlan(
    id: string,
    userId: string,
    patch: Partial<Omit<StudyPlanRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<StudyPlanRecord | null> {
    const existing = this.plans.get(id);
    if (!existing || existing.userId !== userId) return null;
    const updated: StudyPlanRecord = {
      ...existing,
      ...patch,
      subjectIds: patch.subjectIds ? [...patch.subjectIds] : [...existing.subjectIds],
      availableDaysOfWeek: patch.availableDaysOfWeek
        ? [...patch.availableDaysOfWeek]
        : [...existing.availableDaysOfWeek],
      proficiencyBySubject: patch.proficiencyBySubject
        ? { ...patch.proficiencyBySubject }
        : { ...existing.proficiencyBySubject },
      weeklyMilestones: patch.weeklyMilestones
        ? patch.weeklyMilestones.map((m) => ({ ...m, focusSubjectNames: [...m.focusSubjectNames] }))
        : existing.weeklyMilestones.map((m) => ({
            ...m,
            focusSubjectNames: [...m.focusSubjectNames],
          })),
      updatedAt: new Date(),
    };
    this.plans.set(id, updated);
    return { ...updated };
  }

  async deletePlanAndTasks(id: string, userId: string): Promise<boolean> {
    const existing = this.plans.get(id);
    if (!existing || existing.userId !== userId) return false;
    this.plans.delete(id);
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.studyPlanId === id && task.userId === userId) {
        this.tasks.delete(taskId);
      }
    }
    return true;
  }

  async listTasksByPlan(studyPlanId: string, userId: string): Promise<StudyTaskRecord[]> {
    return Array.from(this.tasks.values())
      .filter((t) => t.studyPlanId === studyPlanId && t.userId === userId)
      .sort((a, b) => {
        const diff = a.scheduledDate.getTime() - b.scheduledDate.getTime();
        if (diff !== 0) return diff;
        return a.priorityRank - b.priorityRank;
      })
      .map((t) => ({ ...t }));
  }

  async listTasksByUser(userId: string): Promise<StudyTaskRecord[]> {
    return Array.from(this.tasks.values())
      .filter((t) => t.userId === userId)
      .sort((a, b) => {
        const diff = a.scheduledDate.getTime() - b.scheduledDate.getTime();
        if (diff !== 0) return diff;
        return a.priorityRank - b.priorityRank;
      })
      .map((t) => ({ ...t }));
  }

  async findTaskById(id: string): Promise<StudyTaskRecord | null> {
    const found = this.tasks.get(id);
    return found ? { ...found } : null;
  }

  async createTask(
    data: Omit<StudyTaskRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<StudyTaskRecord> {
    const now = new Date();
    const record: StudyTaskRecord = {
      ...data,
      id: generateHexId(),
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(record.id, record);
    return { ...record };
  }

  async createTasksBulk(
    items: Array<Omit<StudyTaskRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<StudyTaskRecord[]> {
    const created: StudyTaskRecord[] = [];
    for (const item of items) {
      created.push(await this.createTask(item));
    }
    return created;
  }

  async updateTask(
    id: string,
    userId: string,
    patch: Partial<
      Omit<StudyTaskRecord, 'id' | 'studyPlanId' | 'userId' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<StudyTaskRecord | null> {
    const existing = this.tasks.get(id);
    if (!existing || existing.userId !== userId) return null;
    const updated: StudyTaskRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date(),
    };
    this.tasks.set(id, updated);
    return { ...updated };
  }

  async deleteTask(id: string, userId: string): Promise<boolean> {
    const existing = this.tasks.get(id);
    if (!existing || existing.userId !== userId) return false;
    this.tasks.delete(id);
    return true;
  }

  async deleteNonCompletedTasksByPlan(studyPlanId: string, userId: string): Promise<number> {
    let count = 0;
    for (const [taskId, task] of this.tasks.entries()) {
      if (
        task.studyPlanId === studyPlanId &&
        task.userId === userId &&
        task.status !== 'completed'
      ) {
        this.tasks.delete(taskId);
        count += 1;
      }
    }
    return count;
  }

  reset(): void {
    this.plans.clear();
    this.tasks.clear();
  }
}

let sharedInMemoryPlannerRepo: InMemoryStudyPlanRepository | null = null;

export function getInMemoryStudyPlanRepository(): InMemoryStudyPlanRepository {
  if (!sharedInMemoryPlannerRepo) {
    sharedInMemoryPlannerRepo = new InMemoryStudyPlanRepository();
  }
  return sharedInMemoryPlannerRepo;
}

export function resetInMemoryStudyPlanStore(): void {
  sharedInMemoryPlannerRepo?.reset();
}

export function getDefaultStudyPlanRepository(): StudyPlanRepository {
  if (process.env.NODE_ENV === 'test' || !process.env.MONGODB_URI?.trim()) {
    return getInMemoryStudyPlanRepository();
  }
  return new MongooseStudyPlanRepository();
}
