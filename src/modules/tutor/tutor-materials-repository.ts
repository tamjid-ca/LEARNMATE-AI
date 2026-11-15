/**
 * LearnMate AI — AI Tutor & Learning Materials Repository
 * Persists conversations, messages, generatedContents, and feedbackReports
 * across MongoDB/Mongoose and InMemory test stores.
 */

import { randomBytes } from 'node:crypto';
import mongoose, { type Types } from 'mongoose';
import { connectToDatabase } from '../../lib/database/mongoose.ts';
import { getMongooseModel } from '../../models/index.ts';
import type {
  ExplanationDepth,
  MaterialType,
  SupportedLanguage,
} from '../../types/domain.ts';

export interface ConversationRecord {
  id: string;
  userId: string;
  title: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  uploadedMaterialId?: string;
  language: SupportedLanguage;
  explanationDepth: ExplanationDepth;
  messageCount: number;
  lastMessageAt?: Date | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SourceReferenceItem {
  title: string;
  locator?: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelId?: string;
  isDocumentGrounded: boolean;
  sourceReferences: SourceReferenceItem[];
  feedbackRating?: 'helpful' | 'unhelpful' | 'flagged';
  createdAt: Date;
  updatedAt: Date;
}

export interface StructuredMaterialSections {
  summary: string;
  keyTakeaways: string[];
  formulasOrDefinitions: Array<{ term: string; detail: string }>;
  practicePrompts: string[];
}

export interface GeneratedContentRecord {
  id: string;
  userId: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  uploadedMaterialId?: string;
  materialType: MaterialType;
  title: string;
  contentMarkdown: string;
  structuredSections?: StructuredMaterialSections;
  language: SupportedLanguage;
  explanationDepth: ExplanationDepth;
  modelId: string;
  isSavedToLibrary: boolean;
  isPublishedByAdmin: boolean;
  isFlagged: boolean;
  cacheKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaterialQueryFilter {
  userId: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  materialType?: MaterialType;
  language?: SupportedLanguage;
  savedOnly?: boolean;
  page: number;
  limit: number;
}

export interface TutorMaterialsRepository {
  // Conversations
  listConversationsByUser(
    userId: string,
    includeArchived?: boolean,
  ): Promise<ConversationRecord[]>;
  findConversationById(id: string): Promise<ConversationRecord | null>;
  createConversation(
    data: Omit<ConversationRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ConversationRecord>;
  updateConversation(
    id: string,
    patch: Partial<Omit<ConversationRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ConversationRecord | null>;
  deleteConversationAndMessages(id: string, userId: string): Promise<boolean>;

  // Messages
  listMessagesByConversation(conversationId: string, userId: string): Promise<MessageRecord[]>;
  findMessageById(id: string): Promise<MessageRecord | null>;
  createMessage(
    data: Omit<MessageRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MessageRecord>;
  updateMessageFeedback(
    id: string,
    feedbackRating: 'helpful' | 'unhelpful' | 'flagged',
  ): Promise<MessageRecord | null>;

  // Generated Learning Materials
  listMaterialsByUser(
    filter: MaterialQueryFilter,
  ): Promise<{ items: GeneratedContentRecord[]; total: number }>;
  findMaterialById(id: string): Promise<GeneratedContentRecord | null>;
  findMaterialByCacheKey(
    userId: string,
    cacheKey: string,
  ): Promise<GeneratedContentRecord | null>;
  createMaterial(
    data: Omit<GeneratedContentRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<GeneratedContentRecord>;
  updateMaterial(
    id: string,
    patch: Partial<Omit<GeneratedContentRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<GeneratedContentRecord | null>;
  deleteMaterial(id: string, userId: string): Promise<boolean>;

  // Admin Content Moderation & Feedback Reports
  listAdminModerationMaterials(limit?: number): Promise<GeneratedContentRecord[]>;
  recordFeedbackReport(input: {
    userId: string;
    targetType: 'message' | 'generated_content';
    targetId: string;
    reason: string;
  }): Promise<void>;
}

function generateHexId(): string {
  return randomBytes(12).toString('hex');
}

function toValidObjectIdOrUndefined(id?: string): Types.ObjectId | undefined {
  return id && mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : undefined;
}

function mapDocToConversation(doc: Record<string, unknown>): ConversationRecord {
  return {
    id: String(doc._id),
    userId: String(doc.userId ?? ''),
    title: String(doc.title ?? ''),
    subjectId: doc.subjectId ? String(doc.subjectId) : undefined,
    chapterId: doc.chapterId ? String(doc.chapterId) : undefined,
    topicId: doc.topicId ? String(doc.topicId) : undefined,
    uploadedMaterialId: doc.uploadedMaterialId ? String(doc.uploadedMaterialId) : undefined,
    language: (doc.language as SupportedLanguage) ?? 'en',
    explanationDepth: (doc.explanationDepth as ExplanationDepth) ?? 'intermediate',
    messageCount: typeof doc.messageCount === 'number' ? doc.messageCount : 0,
    lastMessageAt: doc.lastMessageAt ? new Date(String(doc.lastMessageAt)) : null,
    isArchived: Boolean(doc.isArchived),
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

function mapDocToMessage(doc: Record<string, unknown>): MessageRecord {
  return {
    id: String(doc._id),
    conversationId: String(doc.conversationId ?? ''),
    userId: String(doc.userId ?? ''),
    role: (doc.role as MessageRecord['role']) ?? 'user',
    content: String(doc.content ?? ''),
    modelId: doc.modelId ? String(doc.modelId) : undefined,
    isDocumentGrounded: Boolean(doc.isDocumentGrounded),
    sourceReferences: Array.isArray(doc.sourceReferences)
      ? (doc.sourceReferences as SourceReferenceItem[])
      : [],
    feedbackRating: doc.feedbackRating as MessageRecord['feedbackRating'] | undefined,
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

function mapDocToGeneratedContent(doc: Record<string, unknown>): GeneratedContentRecord {
  return {
    id: String(doc._id),
    userId: String(doc.userId ?? ''),
    subjectId: doc.subjectId ? String(doc.subjectId) : undefined,
    chapterId: doc.chapterId ? String(doc.chapterId) : undefined,
    topicId: doc.topicId ? String(doc.topicId) : undefined,
    uploadedMaterialId: doc.uploadedMaterialId ? String(doc.uploadedMaterialId) : undefined,
    materialType: (doc.materialType as MaterialType) ?? 'topic_explanation',
    title: String(doc.title ?? ''),
    contentMarkdown: String(doc.contentMarkdown ?? ''),
    structuredSections: (doc.structuredSections as StructuredMaterialSections) ?? undefined,
    language: (doc.language as SupportedLanguage) ?? 'en',
    explanationDepth: (doc.explanationDepth as ExplanationDepth) ?? 'intermediate',
    modelId: String(doc.modelId ?? 'openrouter/free'),
    isSavedToLibrary: doc.isSavedToLibrary !== false,
    isPublishedByAdmin: Boolean(doc.isPublishedByAdmin),
    isFlagged: Boolean(doc.isFlagged),
    cacheKey: doc.cacheKey ? String(doc.cacheKey) : undefined,
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

export class MongooseTutorMaterialsRepository implements TutorMaterialsRepository {
  async listConversationsByUser(
    userId: string,
    includeArchived = false,
  ): Promise<ConversationRecord[]> {
    if (!mongoose.Types.ObjectId.isValid(userId)) return [];
    await connectToDatabase();
    const Model = getMongooseModel('conversations');
    const query: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(userId),
    };
    if (!includeArchived) {
      query.isArchived = false;
    }
    const docs = await Model.find(query).sort({ updatedAt: -1 }).limit(100).lean();
    return docs.map(mapDocToConversation);
  }

  async findConversationById(id: string): Promise<ConversationRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    await connectToDatabase();
    const Model = getMongooseModel('conversations');
    const doc = await Model.findById(id).lean();
    return doc ? mapDocToConversation(doc) : null;
  }

  async createConversation(
    data: Omit<ConversationRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ConversationRecord> {
    await connectToDatabase();
    const Model = getMongooseModel('conversations');
    const created = await Model.create({
      userId: new mongoose.Types.ObjectId(data.userId),
      title: data.title,
      subjectId: toValidObjectIdOrUndefined(data.subjectId),
      chapterId: toValidObjectIdOrUndefined(data.chapterId),
      topicId: toValidObjectIdOrUndefined(data.topicId),
      uploadedMaterialId: toValidObjectIdOrUndefined(data.uploadedMaterialId),
      language: data.language,
      explanationDepth: data.explanationDepth,
      messageCount: data.messageCount,
      lastMessageAt: data.lastMessageAt ?? new Date(),
      isArchived: data.isArchived,
    });
    return mapDocToConversation(created as unknown as Record<string, unknown>);
  }

  async updateConversation(
    id: string,
    patch: Partial<Omit<ConversationRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ConversationRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    await connectToDatabase();
    const Model = getMongooseModel('conversations');
    const updated = await Model.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
    return updated ? mapDocToConversation(updated) : null;
  }

  async deleteConversationAndMessages(id: string, userId: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      return false;
    }
    await connectToDatabase();
    const convObjId = new mongoose.Types.ObjectId(id);
    const userObjId = new mongoose.Types.ObjectId(userId);
    const MessageModel = getMongooseModel('messages');
    const ConvModel = getMongooseModel('conversations');
    await MessageModel.deleteMany({ conversationId: convObjId, userId: userObjId });
    const res = await ConvModel.deleteOne({ _id: convObjId, userId: userObjId });
    return res.deletedCount > 0;
  }

  async listMessagesByConversation(
    conversationId: string,
    userId: string,
  ): Promise<MessageRecord[]> {
    if (
      !mongoose.Types.ObjectId.isValid(conversationId) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return [];
    }
    await connectToDatabase();
    const Model = getMongooseModel('messages');
    const docs = await Model.find({
      conversationId: new mongoose.Types.ObjectId(conversationId),
      userId: new mongoose.Types.ObjectId(userId),
    })
      .sort({ createdAt: 1 })
      .lean();
    return docs.map(mapDocToMessage);
  }

  async findMessageById(id: string): Promise<MessageRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    await connectToDatabase();
    const Model = getMongooseModel('messages');
    const doc = await Model.findById(id).lean();
    return doc ? mapDocToMessage(doc) : null;
  }

  async createMessage(
    data: Omit<MessageRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MessageRecord> {
    await connectToDatabase();
    const Model = getMongooseModel('messages');
    const created = await Model.create({
      conversationId: new mongoose.Types.ObjectId(data.conversationId),
      userId: new mongoose.Types.ObjectId(data.userId),
      role: data.role,
      content: data.content,
      modelId: data.modelId,
      isDocumentGrounded: data.isDocumentGrounded,
      sourceReferences: data.sourceReferences,
      feedbackRating: data.feedbackRating,
    });
    return mapDocToMessage(created as unknown as Record<string, unknown>);
  }

  async updateMessageFeedback(
    id: string,
    feedbackRating: 'helpful' | 'unhelpful' | 'flagged',
  ): Promise<MessageRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    await connectToDatabase();
    const Model = getMongooseModel('messages');
    const updated = await Model.findByIdAndUpdate(
      id,
      { $set: { feedbackRating } },
      { new: true },
    ).lean();
    return updated ? mapDocToMessage(updated) : null;
  }

  async listMaterialsByUser(
    filter: MaterialQueryFilter,
  ): Promise<{ items: GeneratedContentRecord[]; total: number }> {
    if (!mongoose.Types.ObjectId.isValid(filter.userId)) {
      return { items: [], total: 0 };
    }
    await connectToDatabase();
    const Model = getMongooseModel('generatedContents');
    const query: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(filter.userId),
    };
    if (filter.savedOnly) query.isSavedToLibrary = true;
    if (filter.subjectId && mongoose.Types.ObjectId.isValid(filter.subjectId)) {
      query.subjectId = new mongoose.Types.ObjectId(filter.subjectId);
    }
    if (filter.chapterId && mongoose.Types.ObjectId.isValid(filter.chapterId)) {
      query.chapterId = new mongoose.Types.ObjectId(filter.chapterId);
    }
    if (filter.topicId && mongoose.Types.ObjectId.isValid(filter.topicId)) {
      query.topicId = new mongoose.Types.ObjectId(filter.topicId);
    }
    if (filter.materialType) query.materialType = filter.materialType;
    if (filter.language) query.language = filter.language;

    const skip = Math.max(0, (filter.page - 1) * filter.limit);
    const [docs, total] = await Promise.all([
      Model.find(query).sort({ createdAt: -1 }).skip(skip).limit(filter.limit).lean(),
      Model.countDocuments(query),
    ]);
    return {
      items: docs.map(mapDocToGeneratedContent),
      total,
    };
  }

  async findMaterialById(id: string): Promise<GeneratedContentRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    await connectToDatabase();
    const Model = getMongooseModel('generatedContents');
    const doc = await Model.findById(id).lean();
    return doc ? mapDocToGeneratedContent(doc) : null;
  }

  async findMaterialByCacheKey(
    userId: string,
    cacheKey: string,
  ): Promise<GeneratedContentRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(userId)) return null;
    await connectToDatabase();
    const Model = getMongooseModel('generatedContents');
    const doc = await Model.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      cacheKey,
    }).lean();
    return doc ? mapDocToGeneratedContent(doc) : null;
  }

  async createMaterial(
    data: Omit<GeneratedContentRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<GeneratedContentRecord> {
    await connectToDatabase();
    const Model = getMongooseModel('generatedContents');
    const created = await Model.create({
      userId: new mongoose.Types.ObjectId(data.userId),
      subjectId: toValidObjectIdOrUndefined(data.subjectId),
      chapterId: toValidObjectIdOrUndefined(data.chapterId),
      topicId: toValidObjectIdOrUndefined(data.topicId),
      uploadedMaterialId: toValidObjectIdOrUndefined(data.uploadedMaterialId),
      materialType: data.materialType,
      title: data.title,
      contentMarkdown: data.contentMarkdown,
      structuredSections: data.structuredSections,
      language: data.language,
      explanationDepth: data.explanationDepth,
      modelId: data.modelId,
      isSavedToLibrary: data.isSavedToLibrary,
      isPublishedByAdmin: data.isPublishedByAdmin,
      isFlagged: data.isFlagged,
      cacheKey: data.cacheKey,
    });
    return mapDocToGeneratedContent(created as unknown as Record<string, unknown>);
  }

  async updateMaterial(
    id: string,
    patch: Partial<Omit<GeneratedContentRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<GeneratedContentRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    await connectToDatabase();
    const Model = getMongooseModel('generatedContents');
    const updated = await Model.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
    return updated ? mapDocToGeneratedContent(updated) : null;
  }

  async deleteMaterial(id: string, userId: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      return false;
    }
    await connectToDatabase();
    const Model = getMongooseModel('generatedContents');
    const res = await Model.deleteOne({
      _id: new mongoose.Types.ObjectId(id),
      userId: new mongoose.Types.ObjectId(userId),
    });
    return res.deletedCount > 0;
  }

  async listAdminModerationMaterials(limit = 50): Promise<GeneratedContentRecord[]> {
    await connectToDatabase();
    const Model = getMongooseModel('generatedContents');
    const docs = await Model.find({}).sort({ isFlagged: -1, createdAt: -1 }).limit(limit).lean();
    return docs.map(mapDocToGeneratedContent);
  }

  async recordFeedbackReport(input: {
    userId: string;
    targetType: 'message' | 'generated_content';
    targetId: string;
    reason: string;
  }): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(input.userId)) return;
    await connectToDatabase();
    const FeedbackModel = getMongooseModel('feedbackReports');
    await FeedbackModel.create({
      userId: new mongoose.Types.ObjectId(input.userId),
      targetType: input.targetType,
      targetId: toValidObjectIdOrUndefined(input.targetId),
      reason: input.reason,
      status: 'open',
    });
  }
}

export class InMemoryTutorMaterialsRepository implements TutorMaterialsRepository {
  private readonly conversations = new Map<string, ConversationRecord>();
  private readonly messages = new Map<string, MessageRecord>();
  private readonly materials = new Map<string, GeneratedContentRecord>();
  public readonly feedbackReports: Array<{
    userId: string;
    targetType: 'message' | 'generated_content';
    targetId: string;
    reason: string;
    createdAt: Date;
  }> = [];

  async listConversationsByUser(
    userId: string,
    includeArchived = false,
  ): Promise<ConversationRecord[]> {
    return Array.from(this.conversations.values())
      .filter((c) => c.userId === userId && (includeArchived || !c.isArchived))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((c) => ({ ...c }));
  }

  async findConversationById(id: string): Promise<ConversationRecord | null> {
    const found = this.conversations.get(id);
    return found ? { ...found } : null;
  }

  async createConversation(
    data: Omit<ConversationRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ConversationRecord> {
    const now = new Date();
    const record: ConversationRecord = {
      ...data,
      id: generateHexId(),
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.set(record.id, record);
    return { ...record };
  }

  async updateConversation(
    id: string,
    patch: Partial<Omit<ConversationRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ConversationRecord | null> {
    const existing = this.conversations.get(id);
    if (!existing) return null;
    const updated: ConversationRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date(),
    };
    this.conversations.set(id, updated);
    return { ...updated };
  }

  async deleteConversationAndMessages(id: string, userId: string): Promise<boolean> {
    const existing = this.conversations.get(id);
    if (!existing || existing.userId !== userId) return false;
    this.conversations.delete(id);
    for (const [msgId, msg] of this.messages.entries()) {
      if (msg.conversationId === id && msg.userId === userId) {
        this.messages.delete(msgId);
      }
    }
    return true;
  }

  async listMessagesByConversation(
    conversationId: string,
    userId: string,
  ): Promise<MessageRecord[]> {
    return Array.from(this.messages.values())
      .filter((m) => m.conversationId === conversationId && m.userId === userId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((m) => ({
        ...m,
        sourceReferences: [...m.sourceReferences],
      }));
  }

  async findMessageById(id: string): Promise<MessageRecord | null> {
    const found = this.messages.get(id);
    return found ? { ...found, sourceReferences: [...found.sourceReferences] } : null;
  }

  async createMessage(
    data: Omit<MessageRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MessageRecord> {
    const now = new Date();
    const record: MessageRecord = {
      ...data,
      sourceReferences: [...data.sourceReferences],
      id: generateHexId(),
      createdAt: now,
      updatedAt: now,
    };
    this.messages.set(record.id, record);
    return { ...record };
  }

  async updateMessageFeedback(
    id: string,
    feedbackRating: 'helpful' | 'unhelpful' | 'flagged',
  ): Promise<MessageRecord | null> {
    const existing = this.messages.get(id);
    if (!existing) return null;
    const updated: MessageRecord = {
      ...existing,
      feedbackRating,
      updatedAt: new Date(),
    };
    this.messages.set(id, updated);
    return { ...updated };
  }

  async listMaterialsByUser(
    filter: MaterialQueryFilter,
  ): Promise<{ items: GeneratedContentRecord[]; total: number }> {
    let all = Array.from(this.materials.values()).filter((m) => m.userId === filter.userId);
    if (filter.savedOnly) all = all.filter((m) => m.isSavedToLibrary);
    if (filter.subjectId) all = all.filter((m) => m.subjectId === filter.subjectId);
    if (filter.chapterId) all = all.filter((m) => m.chapterId === filter.chapterId);
    if (filter.topicId) all = all.filter((m) => m.topicId === filter.topicId);
    if (filter.materialType) all = all.filter((m) => m.materialType === filter.materialType);
    if (filter.language) all = all.filter((m) => m.language === filter.language);

    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = all.length;
    const skip = Math.max(0, (filter.page - 1) * filter.limit);
    const items = all.slice(skip, skip + filter.limit).map((m) => ({ ...m }));
    return { items, total };
  }

  async findMaterialById(id: string): Promise<GeneratedContentRecord | null> {
    const found = this.materials.get(id);
    return found ? { ...found } : null;
  }

  async findMaterialByCacheKey(
    userId: string,
    cacheKey: string,
  ): Promise<GeneratedContentRecord | null> {
    for (const m of this.materials.values()) {
      if (m.userId === userId && m.cacheKey === cacheKey) {
        return { ...m };
      }
    }
    return null;
  }

  async createMaterial(
    data: Omit<GeneratedContentRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<GeneratedContentRecord> {
    const now = new Date();
    const record: GeneratedContentRecord = {
      ...data,
      id: generateHexId(),
      createdAt: now,
      updatedAt: now,
    };
    this.materials.set(record.id, record);
    return { ...record };
  }

  async updateMaterial(
    id: string,
    patch: Partial<Omit<GeneratedContentRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<GeneratedContentRecord | null> {
    const existing = this.materials.get(id);
    if (!existing) return null;
    const updated: GeneratedContentRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date(),
    };
    this.materials.set(id, updated);
    return { ...updated };
  }

  async deleteMaterial(id: string, userId: string): Promise<boolean> {
    const existing = this.materials.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.materials.delete(id);
  }

  async listAdminModerationMaterials(limit = 50): Promise<GeneratedContentRecord[]> {
    return Array.from(this.materials.values())
      .sort((a, b) => Number(b.isFlagged) - Number(a.isFlagged) || b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map((m) => ({ ...m }));
  }

  async recordFeedbackReport(input: {
    userId: string;
    targetType: 'message' | 'generated_content';
    targetId: string;
    reason: string;
  }): Promise<void> {
    this.feedbackReports.push({
      ...input,
      createdAt: new Date(),
    });
  }
}

let fallbackTutorMaterialsRepo: InMemoryTutorMaterialsRepository | null = null;
let activeTutorMaterialsRepoOverride: TutorMaterialsRepository | null = null;

export function setActiveTutorMaterialsRepository(repo: TutorMaterialsRepository | null): void {
  activeTutorMaterialsRepoOverride = repo;
}

export function getActiveTutorMaterialsRepository(): TutorMaterialsRepository {
  if (activeTutorMaterialsRepoOverride) {
    return activeTutorMaterialsRepoOverride;
  }
  if (process.env.MONGODB_URI?.trim()) {
    return new MongooseTutorMaterialsRepository();
  }
  if (!fallbackTutorMaterialsRepo) {
    fallbackTutorMaterialsRepo = new InMemoryTutorMaterialsRepository();
  }
  return fallbackTutorMaterialsRepo;
}
