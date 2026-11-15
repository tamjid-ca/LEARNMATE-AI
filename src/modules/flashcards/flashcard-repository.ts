/**
 * LearnMate AI — Flashcard Decks, Cards & Spaced Repetition Review Repository
 * Persists flashcardDecks, flashcards, and reviewLogs across MongoDB/Mongoose
 * and InMemory test stores.
 */

import { randomBytes } from 'node:crypto';
import mongoose, { type Types } from 'mongoose';
import { connectToDatabase } from '../../lib/database/mongoose.ts';
import type { FlashcardMasteryState } from '../../lib/validators/flashcards.ts';
import { getMongooseModel } from '../../models/index.ts';
import type {
  FlashcardRating,
  SupportedLanguage,
} from '../../types/domain.ts';

export interface FlashcardDeckRecord {
  id: string;
  userId: string;
  title: string;
  description?: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  uploadedMaterialId?: string;
  cardCount: number;
  language: SupportedLanguage;
  createdAt: Date;
  updatedAt: Date;
}

export interface FlashcardRecord {
  id: string;
  deckId: string;
  userId: string;
  topicId?: string;
  front: string;
  back: string;
  hint?: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: Date;
  lastReviewedAt?: Date;
  lastRating?: FlashcardRating;
  masteryState: FlashcardMasteryState;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewLogRecord {
  id: string;
  userId: string;
  deckId: string;
  flashcardId: string;
  rating: FlashcardRating;
  previousIntervalDays: number;
  newIntervalDays: number;
  previousEaseFactor: number;
  newEaseFactor: number;
  nextReviewAt: Date;
  reviewedAt: Date;
  durationMs?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FlashcardRepository {
  // Decks
  listDecksByUser(userId: string): Promise<FlashcardDeckRecord[]>;
  findDeckById(id: string): Promise<FlashcardDeckRecord | null>;
  createDeck(
    data: Omit<FlashcardDeckRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<FlashcardDeckRecord>;
  updateDeck(
    id: string,
    patch: Partial<Omit<FlashcardDeckRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<FlashcardDeckRecord | null>;
  deleteDeckAndCards(id: string, userId: string): Promise<boolean>;

  // Cards
  listCardsByDeck(deckId: string, userId: string): Promise<FlashcardRecord[]>;
  listCardsByUser(userId: string, deckId?: string): Promise<FlashcardRecord[]>;
  findCardById(id: string): Promise<FlashcardRecord | null>;
  createCardsBulk(
    items: Array<Omit<FlashcardRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<FlashcardRecord[]>;
  updateCard(
    id: string,
    patch: Partial<
      Omit<FlashcardRecord, 'id' | 'deckId' | 'userId' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<FlashcardRecord | null>;
  deleteCard(id: string, userId: string): Promise<boolean>;

  // Review Logs
  createReviewLog(
    data: Omit<ReviewLogRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ReviewLogRecord>;
  listReviewLogsByUser(userId: string, limit?: number): Promise<ReviewLogRecord[]>;
}

function generateHexId(): string {
  return randomBytes(12).toString('hex');
}

function toValidObjectIdOrUndefined(id?: string): Types.ObjectId | undefined {
  return id && mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : undefined;
}

function mapDocToDeck(doc: Record<string, unknown>): FlashcardDeckRecord {
  return {
    id: String(doc._id),
    userId: String(doc.userId ?? ''),
    title: String(doc.title ?? ''),
    description: doc.description ? String(doc.description) : undefined,
    subjectId: doc.subjectId ? String(doc.subjectId) : undefined,
    chapterId: doc.chapterId ? String(doc.chapterId) : undefined,
    topicId: doc.topicId ? String(doc.topicId) : undefined,
    uploadedMaterialId: doc.uploadedMaterialId ? String(doc.uploadedMaterialId) : undefined,
    cardCount: typeof doc.cardCount === 'number' ? doc.cardCount : 0,
    language: (doc.language as SupportedLanguage) ?? 'en',
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

function mapDocToCard(doc: Record<string, unknown>): FlashcardRecord {
  return {
    id: String(doc._id),
    deckId: String(doc.deckId ?? ''),
    userId: String(doc.userId ?? ''),
    topicId: doc.topicId ? String(doc.topicId) : undefined,
    front: String(doc.front ?? ''),
    back: String(doc.back ?? ''),
    hint: doc.hint ? String(doc.hint) : undefined,
    easeFactor: typeof doc.easeFactor === 'number' ? doc.easeFactor : 2.5,
    intervalDays: typeof doc.intervalDays === 'number' ? doc.intervalDays : 0,
    repetitions: typeof doc.repetitions === 'number' ? doc.repetitions : 0,
    nextReviewAt: doc.nextReviewAt ? new Date(String(doc.nextReviewAt)) : new Date(),
    lastReviewedAt: doc.lastReviewedAt ? new Date(String(doc.lastReviewedAt)) : undefined,
    lastRating: doc.lastRating ? (String(doc.lastRating) as FlashcardRating) : undefined,
    masteryState: (doc.masteryState as FlashcardMasteryState) ?? 'new',
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

function mapDocToReviewLog(doc: Record<string, unknown>): ReviewLogRecord {
  return {
    id: String(doc._id),
    userId: String(doc.userId ?? ''),
    deckId: String(doc.deckId ?? ''),
    flashcardId: String(doc.flashcardId ?? ''),
    rating: (doc.rating as FlashcardRating) ?? 'good',
    previousIntervalDays:
      typeof doc.previousIntervalDays === 'number' ? doc.previousIntervalDays : 0,
    newIntervalDays: typeof doc.newIntervalDays === 'number' ? doc.newIntervalDays : 0,
    previousEaseFactor:
      typeof doc.previousEaseFactor === 'number' ? doc.previousEaseFactor : 2.5,
    newEaseFactor: typeof doc.newEaseFactor === 'number' ? doc.newEaseFactor : 2.5,
    nextReviewAt: doc.nextReviewAt ? new Date(String(doc.nextReviewAt)) : new Date(),
    reviewedAt: doc.reviewedAt ? new Date(String(doc.reviewedAt)) : new Date(),
    durationMs: typeof doc.durationMs === 'number' ? doc.durationMs : undefined,
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

export class MongooseFlashcardRepository implements FlashcardRepository {
  async listDecksByUser(userId: string): Promise<FlashcardDeckRecord[]> {
    if (!mongoose.Types.ObjectId.isValid(userId)) return [];
    await connectToDatabase();
    const Model = getMongooseModel('flashcardDecks');
    const docs = await Model.find({
      userId: new mongoose.Types.ObjectId(userId),
    })
      .sort({ updatedAt: -1 })
      .lean();
    return docs.map(mapDocToDeck);
  }

  async findDeckById(id: string): Promise<FlashcardDeckRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    await connectToDatabase();
    const Model = getMongooseModel('flashcardDecks');
    const doc = await Model.findById(id).lean();
    return doc ? mapDocToDeck(doc) : null;
  }

  async createDeck(
    data: Omit<FlashcardDeckRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<FlashcardDeckRecord> {
    await connectToDatabase();
    const Model = getMongooseModel('flashcardDecks');
    const created = await Model.create({
      userId: new mongoose.Types.ObjectId(data.userId),
      title: data.title,
      description: data.description,
      subjectId: toValidObjectIdOrUndefined(data.subjectId),
      chapterId: toValidObjectIdOrUndefined(data.chapterId),
      topicId: toValidObjectIdOrUndefined(data.topicId),
      uploadedMaterialId: toValidObjectIdOrUndefined(data.uploadedMaterialId),
      cardCount: data.cardCount,
      language: data.language,
    });
    return mapDocToDeck(created as unknown as Record<string, unknown>);
  }

  async updateDeck(
    id: string,
    patch: Partial<Omit<FlashcardDeckRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<FlashcardDeckRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    await connectToDatabase();
    const Model = getMongooseModel('flashcardDecks');
    const updated = await Model.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
    return updated ? mapDocToDeck(updated) : null;
  }

  async deleteDeckAndCards(id: string, userId: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      return false;
    }
    await connectToDatabase();
    const deckObjId = new mongoose.Types.ObjectId(id);
    const userObjId = new mongoose.Types.ObjectId(userId);
    const CardModel = getMongooseModel('flashcards');
    const DeckModel = getMongooseModel('flashcardDecks');
    await CardModel.deleteMany({ deckId: deckObjId, userId: userObjId });
    const res = await DeckModel.deleteOne({ _id: deckObjId, userId: userObjId });
    return res.deletedCount > 0;
  }

  async listCardsByDeck(deckId: string, userId: string): Promise<FlashcardRecord[]> {
    if (
      !mongoose.Types.ObjectId.isValid(deckId) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return [];
    }
    await connectToDatabase();
    const Model = getMongooseModel('flashcards');
    const docs = await Model.find({
      deckId: new mongoose.Types.ObjectId(deckId),
      userId: new mongoose.Types.ObjectId(userId),
    })
      .sort({ createdAt: 1 })
      .lean();
    return docs.map(mapDocToCard);
  }

  async listCardsByUser(userId: string, deckId?: string): Promise<FlashcardRecord[]> {
    if (!mongoose.Types.ObjectId.isValid(userId)) return [];
    await connectToDatabase();
    const Model = getMongooseModel('flashcards');
    const query: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(userId),
    };
    if (deckId && mongoose.Types.ObjectId.isValid(deckId)) {
      query.deckId = new mongoose.Types.ObjectId(deckId);
    }
    const docs = await Model.find(query).sort({ nextReviewAt: 1 }).lean();
    return docs.map(mapDocToCard);
  }

  async findCardById(id: string): Promise<FlashcardRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    await connectToDatabase();
    const Model = getMongooseModel('flashcards');
    const doc = await Model.findById(id).lean();
    return doc ? mapDocToCard(doc) : null;
  }

  async createCardsBulk(
    items: Array<Omit<FlashcardRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<FlashcardRecord[]> {
    if (items.length === 0) return [];
    await connectToDatabase();
    const Model = getMongooseModel('flashcards');
    const created = await Promise.all(
      items.map((item) =>
        Model.create({
          deckId: new mongoose.Types.ObjectId(item.deckId),
          userId: new mongoose.Types.ObjectId(item.userId),
          topicId: toValidObjectIdOrUndefined(item.topicId),
          front: item.front,
          back: item.back,
          hint: item.hint,
          easeFactor: item.easeFactor,
          intervalDays: item.intervalDays,
          repetitions: item.repetitions,
          nextReviewAt: item.nextReviewAt,
          lastReviewedAt: item.lastReviewedAt,
          lastRating: item.lastRating,
          masteryState: item.masteryState,
        }),
      ),
    );
    return created.map((doc) => mapDocToCard(doc as unknown as Record<string, unknown>));
  }

  async updateCard(
    id: string,
    patch: Partial<
      Omit<FlashcardRecord, 'id' | 'deckId' | 'userId' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<FlashcardRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    await connectToDatabase();
    const Model = getMongooseModel('flashcards');
    const updated = await Model.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
    return updated ? mapDocToCard(updated) : null;
  }

  async deleteCard(id: string, userId: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      return false;
    }
    await connectToDatabase();
    const Model = getMongooseModel('flashcards');
    const res = await Model.deleteOne({
      _id: new mongoose.Types.ObjectId(id),
      userId: new mongoose.Types.ObjectId(userId),
    });
    return res.deletedCount > 0;
  }

  async createReviewLog(
    data: Omit<ReviewLogRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ReviewLogRecord> {
    await connectToDatabase();
    const Model = getMongooseModel('reviewLogs');
    const created = await Model.create({
      userId: new mongoose.Types.ObjectId(data.userId),
      deckId: new mongoose.Types.ObjectId(data.deckId),
      flashcardId: new mongoose.Types.ObjectId(data.flashcardId),
      rating: data.rating,
      previousIntervalDays: data.previousIntervalDays,
      newIntervalDays: data.newIntervalDays,
      previousEaseFactor: data.previousEaseFactor,
      newEaseFactor: data.newEaseFactor,
      nextReviewAt: data.nextReviewAt,
      reviewedAt: data.reviewedAt,
      durationMs: data.durationMs,
    });
    return mapDocToReviewLog(created as unknown as Record<string, unknown>);
  }

  async listReviewLogsByUser(userId: string, limit = 50): Promise<ReviewLogRecord[]> {
    if (!mongoose.Types.ObjectId.isValid(userId)) return [];
    await connectToDatabase();
    const Model = getMongooseModel('reviewLogs');
    const docs = await Model.find({
      userId: new mongoose.Types.ObjectId(userId),
    })
      .sort({ reviewedAt: -1 })
      .limit(limit)
      .lean();
    return docs.map(mapDocToReviewLog);
  }
}

export class InMemoryFlashcardRepository implements FlashcardRepository {
  private readonly decks = new Map<string, FlashcardDeckRecord>();
  private readonly cards = new Map<string, FlashcardRecord>();
  private readonly reviewLogs = new Map<string, ReviewLogRecord>();

  async listDecksByUser(userId: string): Promise<FlashcardDeckRecord[]> {
    return Array.from(this.decks.values())
      .filter((d) => d.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((d) => ({ ...d }));
  }

  async findDeckById(id: string): Promise<FlashcardDeckRecord | null> {
    const found = this.decks.get(id);
    return found ? { ...found } : null;
  }

  async createDeck(
    data: Omit<FlashcardDeckRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<FlashcardDeckRecord> {
    const now = new Date();
    const record: FlashcardDeckRecord = {
      ...data,
      id: generateHexId(),
      createdAt: now,
      updatedAt: now,
    };
    this.decks.set(record.id, record);
    return { ...record };
  }

  async updateDeck(
    id: string,
    patch: Partial<Omit<FlashcardDeckRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<FlashcardDeckRecord | null> {
    const existing = this.decks.get(id);
    if (!existing) return null;
    const updated: FlashcardDeckRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date(),
    };
    this.decks.set(id, updated);
    return { ...updated };
  }

  async deleteDeckAndCards(id: string, userId: string): Promise<boolean> {
    const existing = this.decks.get(id);
    if (!existing || existing.userId !== userId) return false;
    this.decks.delete(id);
    for (const [cardId, card] of this.cards.entries()) {
      if (card.deckId === id && card.userId === userId) {
        this.cards.delete(cardId);
      }
    }
    return true;
  }

  async listCardsByDeck(deckId: string, userId: string): Promise<FlashcardRecord[]> {
    return Array.from(this.cards.values())
      .filter((c) => c.deckId === deckId && c.userId === userId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((c) => ({ ...c }));
  }

  async listCardsByUser(userId: string, deckId?: string): Promise<FlashcardRecord[]> {
    return Array.from(this.cards.values())
      .filter((c) => c.userId === userId && (!deckId || c.deckId === deckId))
      .sort((a, b) => a.nextReviewAt.getTime() - b.nextReviewAt.getTime())
      .map((c) => ({ ...c }));
  }

  async findCardById(id: string): Promise<FlashcardRecord | null> {
    const found = this.cards.get(id);
    return found ? { ...found } : null;
  }

  async createCardsBulk(
    items: Array<Omit<FlashcardRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<FlashcardRecord[]> {
    const now = new Date();
    return items.map((item) => {
      const record: FlashcardRecord = {
        ...item,
        id: generateHexId(),
        createdAt: now,
        updatedAt: now,
      };
      this.cards.set(record.id, record);
      return { ...record };
    });
  }

  async updateCard(
    id: string,
    patch: Partial<
      Omit<FlashcardRecord, 'id' | 'deckId' | 'userId' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<FlashcardRecord | null> {
    const existing = this.cards.get(id);
    if (!existing) return null;
    const updated: FlashcardRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date(),
    };
    this.cards.set(id, updated);
    return { ...updated };
  }

  async deleteCard(id: string, userId: string): Promise<boolean> {
    const existing = this.cards.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.cards.delete(id);
  }

  async createReviewLog(
    data: Omit<ReviewLogRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ReviewLogRecord> {
    const now = new Date();
    const record: ReviewLogRecord = {
      ...data,
      id: generateHexId(),
      createdAt: now,
      updatedAt: now,
    };
    this.reviewLogs.set(record.id, record);
    return { ...record };
  }

  async listReviewLogsByUser(userId: string, limit = 50): Promise<ReviewLogRecord[]> {
    return Array.from(this.reviewLogs.values())
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.reviewedAt.getTime() - a.reviewedAt.getTime())
      .slice(0, limit)
      .map((r) => ({ ...r }));
  }
}

let fallbackFlashcardRepo: InMemoryFlashcardRepository | null = null;
let activeFlashcardRepoOverride: FlashcardRepository | null = null;

export function setActiveFlashcardRepository(repo: FlashcardRepository | null): void {
  activeFlashcardRepoOverride = repo;
}

export function getActiveFlashcardRepository(): FlashcardRepository {
  if (activeFlashcardRepoOverride) {
    return activeFlashcardRepoOverride;
  }
  if (process.env.MONGODB_URI?.trim()) {
    return new MongooseFlashcardRepository();
  }
  if (!fallbackFlashcardRepo) {
    fallbackFlashcardRepo = new InMemoryFlashcardRepository();
  }
  return fallbackFlashcardRepo;
}
