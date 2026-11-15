/**
 * LearnMate AI — Uploaded Materials & Document Chunks Repository
 * Persists uploadedMaterials and documentChunks across MongoDB/Mongoose
 * and InMemory test stores with strict userId isolation (FR-DOC-004, FR-DOC-010, FR-DOC-011).
 */

import { randomBytes } from 'node:crypto';
import mongoose, { type Types } from 'mongoose';
import { connectToDatabase } from '../../lib/database/mongoose.ts';
import { getMongooseModel } from '../../models/index.ts';
import type {
  DocumentFormat,
  DocumentProcessingStatus,
} from '../../types/domain.ts';

export interface UploadedMaterialRecord {
  id: string;
  userId: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  title: string;
  originalFilename: string;
  format: DocumentFormat;
  mimeType: string;
  byteSize: number;
  storageProvider: 'vercel_blob' | 'local_disk';
  storageKey: string;
  processingStatus: DocumentProcessingStatus;
  extractionStatus: 'pending' | 'completed' | 'failed';
  chunkingStatus: 'pending' | 'completed' | 'failed';
  pageCount?: number;
  chunkCount: number;
  retryCount: number;
  errorMessage?: string;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentChunkRecord {
  id: string;
  materialId: string;
  userId: string;
  chunkIndex: number;
  pageNumber?: number;
  sectionHeading?: string;
  content: string;
  tokenEstimate: number;
  keywords: string[];
  embedding?: number[];
  embeddingModel?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentRepository {
  // Uploaded Materials
  listMaterialsByUser(userId: string): Promise<UploadedMaterialRecord[]>;
  findMaterialById(id: string): Promise<UploadedMaterialRecord | null>;
  createMaterial(
    data: Omit<UploadedMaterialRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<UploadedMaterialRecord>;
  updateMaterial(
    id: string,
    patch: Partial<
      Omit<UploadedMaterialRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<UploadedMaterialRecord | null>;

  // Document Chunks
  createChunksBulk(
    items: Array<Omit<DocumentChunkRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<DocumentChunkRecord[]>;
  listChunksByMaterial(materialId: string, userId: string): Promise<DocumentChunkRecord[]>;
  deleteChunksByMaterial(materialId: string, userId: string): Promise<number>;
}

function generateHexId(): string {
  return randomBytes(12).toString('hex');
}

function toValidObjectIdOrUndefined(id?: string): Types.ObjectId | undefined {
  return id && mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : undefined;
}

function mapDocToUploadedMaterial(doc: Record<string, unknown>): UploadedMaterialRecord {
  return {
    id: String(doc._id),
    userId: String(doc.userId ?? ''),
    subjectId: doc.subjectId ? String(doc.subjectId) : undefined,
    chapterId: doc.chapterId ? String(doc.chapterId) : undefined,
    topicId: doc.topicId ? String(doc.topicId) : undefined,
    title: String(doc.title ?? ''),
    originalFilename: String(doc.originalFilename ?? ''),
    format: (doc.format as DocumentFormat) ?? 'txt',
    mimeType: String(doc.mimeType ?? 'text/plain'),
    byteSize: typeof doc.byteSize === 'number' ? doc.byteSize : 0,
    storageProvider:
      doc.storageProvider === 'vercel_blob' ? 'vercel_blob' : 'local_disk',
    storageKey: String(doc.storageKey ?? ''),
    processingStatus: (doc.processingStatus as DocumentProcessingStatus) ?? 'uploaded',
    extractionStatus:
      doc.extractionStatus === 'completed' || doc.extractionStatus === 'failed'
        ? doc.extractionStatus
        : 'pending',
    chunkingStatus:
      doc.chunkingStatus === 'completed' || doc.chunkingStatus === 'failed'
        ? doc.chunkingStatus
        : 'pending',
    pageCount: typeof doc.pageCount === 'number' ? doc.pageCount : undefined,
    chunkCount: typeof doc.chunkCount === 'number' ? doc.chunkCount : 0,
    retryCount: typeof doc.retryCount === 'number' ? doc.retryCount : 0,
    errorMessage: doc.errorMessage ? String(doc.errorMessage) : undefined,
    deletedAt: doc.deletedAt ? new Date(String(doc.deletedAt)) : undefined,
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

function mapDocToChunk(doc: Record<string, unknown>): DocumentChunkRecord {
  const rawKeywords = Array.isArray(doc.keywords) ? doc.keywords : [];
  const rawEmbedding = Array.isArray(doc.embedding) ? doc.embedding : undefined;
  return {
    id: String(doc._id),
    materialId: String(doc.materialId ?? ''),
    userId: String(doc.userId ?? ''),
    chunkIndex: typeof doc.chunkIndex === 'number' ? doc.chunkIndex : 0,
    pageNumber: typeof doc.pageNumber === 'number' ? doc.pageNumber : undefined,
    sectionHeading: doc.sectionHeading ? String(doc.sectionHeading) : undefined,
    content: String(doc.content ?? ''),
    tokenEstimate: typeof doc.tokenEstimate === 'number' ? doc.tokenEstimate : 1,
    keywords: rawKeywords.map((k) => String(k)),
    embedding: rawEmbedding ? rawEmbedding.map((n) => Number(n)) : undefined,
    embeddingModel: doc.embeddingModel ? String(doc.embeddingModel) : undefined,
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

export class MongooseDocumentRepository implements DocumentRepository {
  async listMaterialsByUser(userId: string): Promise<UploadedMaterialRecord[]> {
    if (!mongoose.Types.ObjectId.isValid(userId)) return [];
    await connectToDatabase();
    const Model = getMongooseModel('uploadedMaterials');
    const docs = await Model.find({
      userId: new mongoose.Types.ObjectId(userId),
      processingStatus: { $ne: 'deleted' },
    })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map(mapDocToUploadedMaterial);
  }

  async findMaterialById(id: string): Promise<UploadedMaterialRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    await connectToDatabase();
    const Model = getMongooseModel('uploadedMaterials');
    const doc = await Model.findById(id).lean();
    return doc ? mapDocToUploadedMaterial(doc) : null;
  }

  async createMaterial(
    data: Omit<UploadedMaterialRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<UploadedMaterialRecord> {
    await connectToDatabase();
    const Model = getMongooseModel('uploadedMaterials');
    const created = await Model.create({
      userId: new mongoose.Types.ObjectId(data.userId),
      subjectId: toValidObjectIdOrUndefined(data.subjectId),
      chapterId: toValidObjectIdOrUndefined(data.chapterId),
      topicId: toValidObjectIdOrUndefined(data.topicId),
      title: data.title,
      originalFilename: data.originalFilename,
      format: data.format,
      mimeType: data.mimeType,
      byteSize: data.byteSize,
      storageProvider: data.storageProvider,
      storageKey: data.storageKey,
      processingStatus: data.processingStatus,
      extractionStatus: data.extractionStatus,
      chunkingStatus: data.chunkingStatus,
      pageCount: data.pageCount,
      chunkCount: data.chunkCount,
      retryCount: data.retryCount,
      errorMessage: data.errorMessage,
      deletedAt: data.deletedAt,
    });
    return mapDocToUploadedMaterial(created as unknown as Record<string, unknown>);
  }

  async updateMaterial(
    id: string,
    patch: Partial<
      Omit<UploadedMaterialRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<UploadedMaterialRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    await connectToDatabase();
    const Model = getMongooseModel('uploadedMaterials');
    const updated = await Model.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
    return updated ? mapDocToUploadedMaterial(updated) : null;
  }

  async createChunksBulk(
    items: Array<Omit<DocumentChunkRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<DocumentChunkRecord[]> {
    if (items.length === 0) return [];
    await connectToDatabase();
    const Model = getMongooseModel('documentChunks');
    const created = await Promise.all(
      items.map((item) =>
        Model.create({
          materialId: new mongoose.Types.ObjectId(item.materialId),
          userId: new mongoose.Types.ObjectId(item.userId),
          chunkIndex: item.chunkIndex,
          pageNumber: item.pageNumber,
          sectionHeading: item.sectionHeading,
          content: item.content,
          tokenEstimate: item.tokenEstimate,
          keywords: item.keywords,
          embedding: item.embedding,
          embeddingModel: item.embeddingModel,
        }),
      ),
    );
    return created.map((doc) => mapDocToChunk(doc as unknown as Record<string, unknown>));
  }

  async listChunksByMaterial(
    materialId: string,
    userId: string,
  ): Promise<DocumentChunkRecord[]> {
    if (
      !mongoose.Types.ObjectId.isValid(materialId) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return [];
    }
    await connectToDatabase();
    const Model = getMongooseModel('documentChunks');
    const docs = await Model.find({
      materialId: new mongoose.Types.ObjectId(materialId),
      userId: new mongoose.Types.ObjectId(userId),
    })
      .sort({ chunkIndex: 1 })
      .lean();
    return docs.map(mapDocToChunk);
  }

  async deleteChunksByMaterial(materialId: string, userId: string): Promise<number> {
    if (
      !mongoose.Types.ObjectId.isValid(materialId) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return 0;
    }
    await connectToDatabase();
    const Model = getMongooseModel('documentChunks');
    const res = await Model.deleteMany({
      materialId: new mongoose.Types.ObjectId(materialId),
      userId: new mongoose.Types.ObjectId(userId),
    });
    return res.deletedCount;
  }
}

export class InMemoryDocumentRepository implements DocumentRepository {
  private readonly materials = new Map<string, UploadedMaterialRecord>();
  private readonly chunks = new Map<string, DocumentChunkRecord>();

  async listMaterialsByUser(userId: string): Promise<UploadedMaterialRecord[]> {
    return Array.from(this.materials.values())
      .filter((m) => m.userId === userId && m.processingStatus !== 'deleted')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((m) => ({ ...m }));
  }

  async findMaterialById(id: string): Promise<UploadedMaterialRecord | null> {
    const found = this.materials.get(id);
    return found ? { ...found } : null;
  }

  async createMaterial(
    data: Omit<UploadedMaterialRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<UploadedMaterialRecord> {
    const now = new Date();
    const record: UploadedMaterialRecord = {
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
    patch: Partial<
      Omit<UploadedMaterialRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<UploadedMaterialRecord | null> {
    const existing = this.materials.get(id);
    if (!existing) return null;
    const updated: UploadedMaterialRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date(),
    };
    this.materials.set(id, updated);
    return { ...updated };
  }

  async createChunksBulk(
    items: Array<Omit<DocumentChunkRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<DocumentChunkRecord[]> {
    const now = new Date();
    return items.map((item) => {
      const record: DocumentChunkRecord = {
        ...item,
        keywords: [...item.keywords],
        embedding: item.embedding ? [...item.embedding] : undefined,
        id: generateHexId(),
        createdAt: now,
        updatedAt: now,
      };
      this.chunks.set(record.id, record);
      return { ...record };
    });
  }

  async listChunksByMaterial(
    materialId: string,
    userId: string,
  ): Promise<DocumentChunkRecord[]> {
    return Array.from(this.chunks.values())
      .filter((c) => c.materialId === materialId && c.userId === userId)
      .sort((a, b) => a.chunkIndex - b.chunkIndex)
      .map((c) => ({
        ...c,
        keywords: [...c.keywords],
        embedding: c.embedding ? [...c.embedding] : undefined,
      }));
  }

  async deleteChunksByMaterial(materialId: string, userId: string): Promise<number> {
    let deletedCount = 0;
    for (const [id, chunk] of this.chunks.entries()) {
      if (chunk.materialId === materialId && chunk.userId === userId) {
        this.chunks.delete(id);
        deletedCount += 1;
      }
    }
    return deletedCount;
  }
}

let fallbackDocumentRepo: InMemoryDocumentRepository | null = null;
let activeDocumentRepoOverride: DocumentRepository | null = null;

export function setActiveDocumentRepository(repo: DocumentRepository | null): void {
  activeDocumentRepoOverride = repo;
}

export function getActiveDocumentRepository(): DocumentRepository {
  if (activeDocumentRepoOverride) {
    return activeDocumentRepoOverride;
  }
  if (process.env.MONGODB_URI?.trim()) {
    return new MongooseDocumentRepository();
  }
  if (!fallbackDocumentRepo) {
    fallbackDocumentRepo = new InMemoryDocumentRepository();
  }
  return fallbackDocumentRepo;
}
