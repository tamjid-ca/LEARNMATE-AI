/**
 * LearnMate AI — Progress Records & In-App Notifications Repository
 * Persists progressRecords and notifications across MongoDB/Mongoose and InMemory test stores.
 * Enforces strict userId ownership filtering and deduplicated notification creation.
 */

import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { connectToDatabase } from '../../lib/database/mongoose.ts';
import { getMongooseModel } from '../../models/index.ts';
import type { NotificationType } from '../../types/domain.ts';

export type MasteryBand = 'unstarted' | 'weak' | 'developing' | 'strong';

export interface ProgressRecord {
  id: string;
  userId: string;
  subjectId: string;
  chapterId: string;
  topicId: string;
  isCompleted: boolean;
  completedAt?: Date;
  studyTimeMinutes: number;
  quizAttemptsCount: number;
  quizAverageAccuracy: number;
  flashcardReviewsCount: number;
  estimatedMasteryScore: number;
  masteryBand: MasteryBand;
  lastActivityAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  isRead: boolean;
  readAt?: Date;
  dedupeKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertProgressInput {
  userId: string;
  subjectId: string;
  chapterId: string;
  topicId: string;
  isCompleted: boolean;
  completedAt?: Date;
  studyTimeMinutes: number;
  quizAttemptsCount: number;
  quizAverageAccuracy: number;
  flashcardReviewsCount: number;
  estimatedMasteryScore: number;
  masteryBand: MasteryBand;
  lastActivityAt?: Date;
}

export interface CreateNotificationInput {
  userId: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  dedupeKey?: string;
}

export interface AnalyticsRepository {
  // Progress Records
  listProgressByUser(userId: string): Promise<ProgressRecord[]>;
  findProgressByTopic(userId: string, topicId: string): Promise<ProgressRecord | null>;
  upsertProgress(input: UpsertProgressInput): Promise<ProgressRecord>;

  // Notifications
  listNotificationsByUser(userId: string, limit?: number): Promise<NotificationRecord[]>;
  findNotificationById(id: string): Promise<NotificationRecord | null>;
  createNotificationIfNotExists(input: CreateNotificationInput): Promise<NotificationRecord>;
  markNotificationRead(id: string, userId: string): Promise<NotificationRecord | null>;
  markAllNotificationsRead(userId: string): Promise<number>;
}

function generateHexId(): string {
  return randomBytes(12).toString('hex');
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

function mapDocToProgress(doc: Record<string, unknown>): ProgressRecord {
  return {
    id: String(doc._id),
    userId: String(doc.userId ?? ''),
    subjectId: String(doc.subjectId ?? ''),
    chapterId: String(doc.chapterId ?? ''),
    topicId: String(doc.topicId ?? ''),
    isCompleted: Boolean(doc.isCompleted),
    completedAt: doc.completedAt ? new Date(String(doc.completedAt)) : undefined,
    studyTimeMinutes: Number(doc.studyTimeMinutes ?? 0),
    quizAttemptsCount: Number(doc.quizAttemptsCount ?? 0),
    quizAverageAccuracy: Number(doc.quizAverageAccuracy ?? 0),
    flashcardReviewsCount: Number(doc.flashcardReviewsCount ?? 0),
    estimatedMasteryScore: Number(doc.estimatedMasteryScore ?? 0),
    masteryBand: (doc.masteryBand as MasteryBand) ?? 'unstarted',
    lastActivityAt: doc.lastActivityAt ? new Date(String(doc.lastActivityAt)) : undefined,
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

function mapDocToNotification(doc: Record<string, unknown>): NotificationRecord {
  return {
    id: String(doc._id),
    userId: String(doc.userId ?? ''),
    notificationType: (doc.notificationType as NotificationType) ?? 'study_reminder',
    title: String(doc.title ?? ''),
    message: String(doc.message ?? ''),
    actionUrl: doc.actionUrl ? String(doc.actionUrl) : undefined,
    isRead: Boolean(doc.isRead),
    readAt: doc.readAt ? new Date(String(doc.readAt)) : undefined,
    dedupeKey: doc.dedupeKey ? String(doc.dedupeKey) : undefined,
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

export class MongooseAnalyticsRepository implements AnalyticsRepository {
  async listProgressByUser(userId: string): Promise<ProgressRecord[]> {
    if (!mongoose.Types.ObjectId.isValid(userId)) return [];
    await connectToDatabase();
    const Model = getMongooseModel('progressRecords');
    const docs = await Model.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .lean();
    return docs.map((d) => mapDocToProgress(d));
  }

  async findProgressByTopic(userId: string, topicId: string): Promise<ProgressRecord | null> {
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(topicId)
    ) {
      return null;
    }
    await connectToDatabase();
    const Model = getMongooseModel('progressRecords');
    const doc = await Model.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      topicId: new mongoose.Types.ObjectId(topicId),
    }).lean();
    return doc ? mapDocToProgress(doc) : null;
  }

  async upsertProgress(input: UpsertProgressInput): Promise<ProgressRecord> {
    await connectToDatabase();
    const Model = getMongooseModel('progressRecords');
    const userObjId = new mongoose.Types.ObjectId(input.userId);
    const topicObjId = new mongoose.Types.ObjectId(input.topicId);
    const subjectObjId = new mongoose.Types.ObjectId(input.subjectId);
    const chapterObjId = new mongoose.Types.ObjectId(input.chapterId);

    const updated = await Model.findOneAndUpdate(
      { userId: userObjId, topicId: topicObjId },
      {
        $set: {
          subjectId: subjectObjId,
          chapterId: chapterObjId,
          isCompleted: input.isCompleted,
          completedAt: input.completedAt,
          studyTimeMinutes: input.studyTimeMinutes,
          quizAttemptsCount: input.quizAttemptsCount,
          quizAverageAccuracy: input.quizAverageAccuracy,
          flashcardReviewsCount: input.flashcardReviewsCount,
          estimatedMasteryScore: input.estimatedMasteryScore,
          masteryBand: input.masteryBand,
          lastActivityAt: input.lastActivityAt,
        },
      },
      { upsert: true, new: true },
    ).lean();

    return mapDocToProgress(unwrapMongooseDoc(updated));
  }

  async listNotificationsByUser(userId: string, limit = 50): Promise<NotificationRecord[]> {
    if (!mongoose.Types.ObjectId.isValid(userId)) return [];
    await connectToDatabase();
    const Model = getMongooseModel('notifications');
    const docs = await Model.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return docs.map((d) => mapDocToNotification(d));
  }

  async findNotificationById(id: string): Promise<NotificationRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    await connectToDatabase();
    const Model = getMongooseModel('notifications');
    const doc = await Model.findById(id).lean();
    return doc ? mapDocToNotification(doc) : null;
  }

  async createNotificationIfNotExists(
    input: CreateNotificationInput,
  ): Promise<NotificationRecord> {
    await connectToDatabase();
    const Model = getMongooseModel('notifications');
    const userObjId = new mongoose.Types.ObjectId(input.userId);

    if (input.dedupeKey) {
      const existing = await Model.findOne({
        userId: userObjId,
        dedupeKey: input.dedupeKey,
      }).lean();
      if (existing) {
        return mapDocToNotification(existing);
      }
    }

    const created = await Model.create({
      userId: userObjId,
      notificationType: input.notificationType,
      title: input.title,
      message: input.message,
      actionUrl: input.actionUrl,
      isRead: false,
      dedupeKey: input.dedupeKey,
    });
    return mapDocToNotification(unwrapMongooseDoc(created));
  }

  async markNotificationRead(id: string, userId: string): Promise<NotificationRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      return null;
    }
    await connectToDatabase();
    const Model = getMongooseModel('notifications');
    const updated = await Model.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), userId: new mongoose.Types.ObjectId(userId) },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true },
    ).lean();
    return updated ? mapDocToNotification(updated) : null;
  }

  async markAllNotificationsRead(userId: string): Promise<number> {
    if (!mongoose.Types.ObjectId.isValid(userId)) return 0;
    await connectToDatabase();
    const Model = getMongooseModel('notifications');
    const userObjId = new mongoose.Types.ObjectId(userId);
    const unreadDocs = await Model.find({ userId: userObjId, isRead: false }).lean();
    if (unreadDocs.length === 0) return 0;
    const now = new Date();
    await Promise.all(
      unreadDocs.map((doc) =>
        Model.findOneAndUpdate(
          { _id: doc._id, userId: userObjId },
          { $set: { isRead: true, readAt: now } },
        ).lean(),
      ),
    );
    return unreadDocs.length;
  }
}

export class InMemoryAnalyticsRepository implements AnalyticsRepository {
  private readonly progressStore = new Map<string, ProgressRecord>();
  private readonly notificationStore = new Map<string, NotificationRecord>();

  async listProgressByUser(userId: string): Promise<ProgressRecord[]> {
    return Array.from(this.progressStore.values())
      .filter((p) => p.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((p) => ({ ...p }));
  }

  async findProgressByTopic(userId: string, topicId: string): Promise<ProgressRecord | null> {
    for (const record of this.progressStore.values()) {
      if (record.userId === userId && record.topicId === topicId) {
        return { ...record };
      }
    }
    return null;
  }

  async upsertProgress(input: UpsertProgressInput): Promise<ProgressRecord> {
    const existing = await this.findProgressByTopic(input.userId, input.topicId);
    const now = new Date();
    if (existing) {
      const updated: ProgressRecord = {
        ...existing,
        ...input,
        updatedAt: now,
      };
      this.progressStore.set(existing.id, updated);
      return { ...updated };
    }

    const created: ProgressRecord = {
      ...input,
      id: generateHexId(),
      createdAt: now,
      updatedAt: now,
    };
    this.progressStore.set(created.id, created);
    return { ...created };
  }

  async listNotificationsByUser(userId: string, limit = 50): Promise<NotificationRecord[]> {
    return Array.from(this.notificationStore.values())
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map((n) => ({ ...n }));
  }

  async findNotificationById(id: string): Promise<NotificationRecord | null> {
    const found = this.notificationStore.get(id);
    return found ? { ...found } : null;
  }

  async createNotificationIfNotExists(
    input: CreateNotificationInput,
  ): Promise<NotificationRecord> {
    if (input.dedupeKey) {
      for (const existing of this.notificationStore.values()) {
        if (existing.userId === input.userId && existing.dedupeKey === input.dedupeKey) {
          return { ...existing };
        }
      }
    }

    const now = new Date();
    const record: NotificationRecord = {
      id: generateHexId(),
      userId: input.userId,
      notificationType: input.notificationType,
      title: input.title,
      message: input.message,
      actionUrl: input.actionUrl,
      isRead: false,
      dedupeKey: input.dedupeKey,
      createdAt: now,
      updatedAt: now,
    };
    this.notificationStore.set(record.id, record);
    return { ...record };
  }

  async markNotificationRead(id: string, userId: string): Promise<NotificationRecord | null> {
    const existing = this.notificationStore.get(id);
    if (!existing || existing.userId !== userId) return null;
    const now = new Date();
    const updated: NotificationRecord = {
      ...existing,
      isRead: true,
      readAt: now,
      updatedAt: now,
    };
    this.notificationStore.set(id, updated);
    return { ...updated };
  }

  async markAllNotificationsRead(userId: string): Promise<number> {
    let count = 0;
    const now = new Date();
    for (const [id, record] of this.notificationStore.entries()) {
      if (record.userId === userId && !record.isRead) {
        this.notificationStore.set(id, {
          ...record,
          isRead: true,
          readAt: now,
          updatedAt: now,
        });
        count += 1;
      }
    }
    return count;
  }

  reset(): void {
    this.progressStore.clear();
    this.notificationStore.clear();
  }
}

let sharedInMemoryAnalyticsRepo: InMemoryAnalyticsRepository | null = null;

export function getInMemoryAnalyticsRepository(): InMemoryAnalyticsRepository {
  if (!sharedInMemoryAnalyticsRepo) {
    sharedInMemoryAnalyticsRepo = new InMemoryAnalyticsRepository();
  }
  return sharedInMemoryAnalyticsRepo;
}

export function resetInMemoryAnalyticsStore(): void {
  sharedInMemoryAnalyticsRepo?.reset();
}

export function getDefaultAnalyticsRepository(): AnalyticsRepository {
  if (process.env.NODE_ENV === 'test' || !process.env.MONGODB_URI?.trim()) {
    return getInMemoryAnalyticsRepository();
  }
  return new MongooseAnalyticsRepository();
}
