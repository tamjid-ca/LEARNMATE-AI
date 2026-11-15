/**
 * LearnMate AI — Centralized AI Infrastructure Repository
 * Manages promptTemplates, aiUsageLogs, appSettings (AI platform config), and response caching
 * across MongoDB/Mongoose and InMemory test stores.
 */

import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { DEFAULT_OPENROUTER_MODEL, resolveTaskModel } from '../../lib/ai/config.ts';
import { DEFAULT_PROMPT_TEMPLATES } from '../../lib/ai/prompt-templates.ts';
import { connectToDatabase } from '../../lib/database/mongoose.ts';
import { getMongooseModel } from '../../models/index.ts';
import { AI_TASK_TYPES, type AITaskType, type UserRole } from '../../types/domain.ts';

export type AIUsageStatus =
  | 'success'
  | 'validation_failed'
  | 'rate_limited'
  | 'provider_error'
  | 'cached';

export interface AIPlatformConfig {
  defaultModel: string;
  taskModels: Record<AITaskType, string>;
  fallbackModels: string[];
  dailyRequestLimitPerStudent: number;
  dailyTokenLimitPerStudent: number;
  enableResponseCaching: boolean;
  updatedAt: Date;
}

export interface PromptTemplateRecord {
  id: string;
  taskType: AITaskType;
  name: string;
  version: number;
  systemPrompt: string;
  userPromptTemplate: string;
  temperature: number;
  maxOutputTokens: number;
  isActive: boolean;
  updatedByUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIUsageLogRecord {
  id: string;
  userId?: string;
  taskType: AITaskType;
  modelId: string;
  fallbackUsed: boolean;
  status: AIUsageStatus;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  sanitizedError?: string;
  createdAt: Date;
}

export interface UsageLogQueryFilter {
  taskType?: AITaskType;
  status?: AIUsageStatus;
  userId?: string;
  page: number;
  limit: number;
}

export interface AIRepository {
  getPlatformConfig(): Promise<AIPlatformConfig>;
  updatePlatformConfig(
    patch: Partial<Omit<AIPlatformConfig, 'updatedAt'>>,
    updatedByUserId?: string,
  ): Promise<AIPlatformConfig>;

  listPromptTemplates(taskType?: AITaskType): Promise<PromptTemplateRecord[]>;
  getActivePromptTemplate(taskType: AITaskType): Promise<PromptTemplateRecord>;
  upsertPromptTemplate(
    input: {
      taskType: AITaskType;
      name: string;
      systemPrompt: string;
      userPromptTemplate: string;
      temperature: number;
      maxOutputTokens: number;
      isActive: boolean;
    },
    updatedByUserId?: string,
  ): Promise<PromptTemplateRecord>;

  recordUsageLog(
    entry: Omit<AIUsageLogRecord, 'id' | 'createdAt'>,
  ): Promise<AIUsageLogRecord>;
  listUsageLogs(
    filter: UsageLogQueryFilter,
  ): Promise<{ items: AIUsageLogRecord[]; total: number }>;
  getUserDailyUsageStats(
    userId: string,
    sinceDate: Date,
  ): Promise<{ requestCount: number; totalTokens: number }>;

  getCachedOutput(cacheKey: string): Promise<{ text: string; modelId: string } | null>;
  setCachedOutput(cacheKey: string, value: { text: string; modelId: string }): Promise<void>;

  recordAuditLog(entry: {
    actorId: string;
    actorRole: UserRole;
    action: string;
    targetCollection?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

const AI_CONFIG_SETTING_KEY = 'ai_platform_config';

export function buildDefaultPlatformConfig(
  env: Record<string, string | undefined> = process.env,
): AIPlatformConfig {
  const taskModels = {} as Record<AITaskType, string>;
  for (const task of AI_TASK_TYPES) {
    taskModels[task] = resolveTaskModel(task, env);
  }
  return {
    defaultModel: env.OPENROUTER_DEFAULT_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL,
    taskModels,
    fallbackModels: [DEFAULT_OPENROUTER_MODEL],
    dailyRequestLimitPerStudent: 50,
    dailyTokenLimitPerStudent: 120_000,
    enableResponseCaching: true,
    updatedAt: new Date(),
  };
}

function mapDocToPromptTemplate(doc: Record<string, unknown>): PromptTemplateRecord {
  return {
    id: String(doc._id),
    taskType: (doc.taskType as AITaskType) ?? 'tutor',
    name: String(doc.name ?? ''),
    version: typeof doc.version === 'number' ? doc.version : 1,
    systemPrompt: String(doc.systemPrompt ?? ''),
    userPromptTemplate: String(doc.userPromptTemplate ?? ''),
    temperature: typeof doc.temperature === 'number' ? doc.temperature : 0.3,
    maxOutputTokens: typeof doc.maxOutputTokens === 'number' ? doc.maxOutputTokens : 2000,
    isActive: doc.isActive !== false,
    updatedByUserId: doc.updatedByUserId ? String(doc.updatedByUserId) : undefined,
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

function mapDocToUsageLog(doc: Record<string, unknown>): AIUsageLogRecord {
  return {
    id: String(doc._id),
    userId: doc.userId ? String(doc.userId) : undefined,
    taskType: (doc.taskType as AITaskType) ?? 'tutor',
    modelId: String(doc.modelId ?? DEFAULT_OPENROUTER_MODEL),
    fallbackUsed: Boolean(doc.fallbackUsed),
    status: (doc.status as AIUsageStatus) ?? 'success',
    latencyMs: typeof doc.latencyMs === 'number' ? doc.latencyMs : 0,
    promptTokens: typeof doc.promptTokens === 'number' ? doc.promptTokens : 0,
    completionTokens: typeof doc.completionTokens === 'number' ? doc.completionTokens : 0,
    totalTokens: typeof doc.totalTokens === 'number' ? doc.totalTokens : 0,
    sanitizedError: doc.sanitizedError ? String(doc.sanitizedError) : undefined,
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
  };
}

let mongoAISeededPromise: Promise<void> | null = null;

export class MongooseAIRepository implements AIRepository {
  private async ensureSeeded(): Promise<void> {
    if (!mongoAISeededPromise) {
      mongoAISeededPromise = (async () => {
        await connectToDatabase();
        const PromptModel = getMongooseModel('promptTemplates');
        const count = await PromptModel.countDocuments({});
        if (count === 0) {
          for (const seed of Object.values(DEFAULT_PROMPT_TEMPLATES)) {
            await PromptModel.findOneAndUpdate(
              { taskType: seed.taskType, version: seed.version },
              {
                $setOnInsert: {
                  _id: new mongoose.Types.ObjectId(seed.id),
                  taskType: seed.taskType,
                  name: seed.name,
                  version: seed.version,
                  systemPrompt: seed.systemPrompt,
                  userPromptTemplate: seed.userPromptTemplate,
                  temperature: seed.temperature,
                  maxOutputTokens: seed.maxOutputTokens,
                  isActive: seed.isActive,
                },
              },
              { upsert: true, new: true },
            );
          }
        }
      })().catch((err) => {
        mongoAISeededPromise = null;
        throw err;
      });
    }
    await mongoAISeededPromise;
  }

  async getPlatformConfig(): Promise<AIPlatformConfig> {
    await this.ensureSeeded();
    const SettingsModel = getMongooseModel('appSettings');
    const doc = await SettingsModel.findOne({ key: AI_CONFIG_SETTING_KEY }).lean();
    const defaults = buildDefaultPlatformConfig();
    if (!doc || !doc.value || typeof doc.value !== 'object') {
      return defaults;
    }
    const val = doc.value as Partial<AIPlatformConfig>;
    return {
      defaultModel: val.defaultModel ?? defaults.defaultModel,
      taskModels: {
        ...defaults.taskModels,
        ...(val.taskModels ?? {}),
      },
      fallbackModels:
        Array.isArray(val.fallbackModels) && val.fallbackModels.length > 0
          ? val.fallbackModels
          : defaults.fallbackModels,
      dailyRequestLimitPerStudent:
        typeof val.dailyRequestLimitPerStudent === 'number'
          ? val.dailyRequestLimitPerStudent
          : defaults.dailyRequestLimitPerStudent,
      dailyTokenLimitPerStudent:
        typeof val.dailyTokenLimitPerStudent === 'number'
          ? val.dailyTokenLimitPerStudent
          : defaults.dailyTokenLimitPerStudent,
      enableResponseCaching:
        typeof val.enableResponseCaching === 'boolean'
          ? val.enableResponseCaching
          : defaults.enableResponseCaching,
      updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
    };
  }

  async updatePlatformConfig(
    patch: Partial<Omit<AIPlatformConfig, 'updatedAt'>>,
    updatedByUserId?: string,
  ): Promise<AIPlatformConfig> {
    const current = await this.getPlatformConfig();
    const merged: AIPlatformConfig = {
      defaultModel: patch.defaultModel ?? current.defaultModel,
      taskModels: {
        ...current.taskModels,
        ...(patch.taskModels ?? {}),
      },
      fallbackModels: patch.fallbackModels ?? current.fallbackModels,
      dailyRequestLimitPerStudent:
        patch.dailyRequestLimitPerStudent ?? current.dailyRequestLimitPerStudent,
      dailyTokenLimitPerStudent:
        patch.dailyTokenLimitPerStudent ?? current.dailyTokenLimitPerStudent,
      enableResponseCaching: patch.enableResponseCaching ?? current.enableResponseCaching,
      updatedAt: new Date(),
    };

    const SettingsModel = getMongooseModel('appSettings');
    await SettingsModel.findOneAndUpdate(
      { key: AI_CONFIG_SETTING_KEY },
      {
        $set: {
          key: AI_CONFIG_SETTING_KEY,
          value: merged,
          description: 'Centralized OpenRouter model routing, fallbacks, and daily student quotas',
          ...(updatedByUserId && mongoose.Types.ObjectId.isValid(updatedByUserId)
            ? { updatedByUserId: new mongoose.Types.ObjectId(updatedByUserId) }
            : {}),
        },
      },
      { upsert: true, new: true },
    );

    return merged;
  }

  async listPromptTemplates(taskType?: AITaskType): Promise<PromptTemplateRecord[]> {
    await this.ensureSeeded();
    const PromptModel = getMongooseModel('promptTemplates');
    const filter: Record<string, unknown> = {};
    if (taskType) filter.taskType = taskType;
    const docs = await PromptModel.find(filter).sort({ taskType: 1, version: -1 }).lean();
    return docs.map(mapDocToPromptTemplate);
  }

  async getActivePromptTemplate(taskType: AITaskType): Promise<PromptTemplateRecord> {
    await this.ensureSeeded();
    const PromptModel = getMongooseModel('promptTemplates');
    const doc = await PromptModel.findOne({ taskType, isActive: true })
      .sort({ version: -1 })
      .lean();
    if (doc) {
      return mapDocToPromptTemplate(doc);
    }
    const seed = DEFAULT_PROMPT_TEMPLATES[taskType];
    return {
      ...seed,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async upsertPromptTemplate(
    input: {
      taskType: AITaskType;
      name: string;
      systemPrompt: string;
      userPromptTemplate: string;
      temperature: number;
      maxOutputTokens: number;
      isActive: boolean;
    },
    updatedByUserId?: string,
  ): Promise<PromptTemplateRecord> {
    await this.ensureSeeded();
    const PromptModel = getMongooseModel('promptTemplates');
    const existingList = await PromptModel.find({ taskType: input.taskType })
      .sort({ version: -1 })
      .limit(1)
      .lean();
    const nextVersion =
      existingList.length > 0 && typeof existingList[0]?.version === 'number'
        ? Number(existingList[0].version) + 1
        : 1;

    const created = await PromptModel.create({
      ...input,
      version: nextVersion,
      ...(updatedByUserId && mongoose.Types.ObjectId.isValid(updatedByUserId)
        ? { updatedByUserId: new mongoose.Types.ObjectId(updatedByUserId) }
        : {}),
    });
    return mapDocToPromptTemplate(created as unknown as Record<string, unknown>);
  }

  async recordUsageLog(
    entry: Omit<AIUsageLogRecord, 'id' | 'createdAt'>,
  ): Promise<AIUsageLogRecord> {
    await connectToDatabase();
    const UsageModel = getMongooseModel('aiUsageLogs');
    const created = await UsageModel.create({
      ...entry,
      ...(entry.userId && mongoose.Types.ObjectId.isValid(entry.userId)
        ? { userId: new mongoose.Types.ObjectId(entry.userId) }
        : { userId: undefined }),
    });
    return mapDocToUsageLog(created as unknown as Record<string, unknown>);
  }

  async listUsageLogs(
    filter: UsageLogQueryFilter,
  ): Promise<{ items: AIUsageLogRecord[]; total: number }> {
    await connectToDatabase();
    const UsageModel = getMongooseModel('aiUsageLogs');
    const query: Record<string, unknown> = {};
    if (filter.taskType) query.taskType = filter.taskType;
    if (filter.status) query.status = filter.status;
    if (filter.userId && mongoose.Types.ObjectId.isValid(filter.userId)) {
      query.userId = new mongoose.Types.ObjectId(filter.userId);
    }

    const skip = Math.max(0, (filter.page - 1) * filter.limit);
    const [docs, total] = await Promise.all([
      UsageModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(filter.limit).lean(),
      UsageModel.countDocuments(query),
    ]);
    return {
      items: docs.map(mapDocToUsageLog),
      total,
    };
  }

  async getUserDailyUsageStats(
    userId: string,
    sinceDate: Date,
  ): Promise<{ requestCount: number; totalTokens: number }> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return { requestCount: 0, totalTokens: 0 };
    }
    await connectToDatabase();
    const UsageModel = getMongooseModel('aiUsageLogs');
    const docs = await UsageModel.find({
      userId: new mongoose.Types.ObjectId(userId),
      createdAt: { $gte: sinceDate },
    }).lean();
    let totalTokens = 0;
    for (const d of docs) {
      totalTokens += typeof d.totalTokens === 'number' ? d.totalTokens : 0;
    }
    return {
      requestCount: docs.length,
      totalTokens,
    };
  }

  async getCachedOutput(cacheKey: string): Promise<{ text: string; modelId: string } | null> {
    await connectToDatabase();
    const SettingsModel = getMongooseModel('appSettings');
    const doc = await SettingsModel.findOne({ key: `ai_cache:${cacheKey}` }).lean();
    if (!doc || !doc.value || typeof doc.value !== 'object') return null;
    const val = doc.value as { text?: string; modelId?: string };
    if (!val.text) return null;
    return {
      text: val.text,
      modelId: val.modelId ?? DEFAULT_OPENROUTER_MODEL,
    };
  }

  async setCachedOutput(
    cacheKey: string,
    value: { text: string; modelId: string },
  ): Promise<void> {
    await connectToDatabase();
    const SettingsModel = getMongooseModel('appSettings');
    await SettingsModel.findOneAndUpdate(
      { key: `ai_cache:${cacheKey}` },
      {
        $set: {
          key: `ai_cache:${cacheKey}`,
          value,
          description: 'Cached AI output',
        },
      },
      { upsert: true, new: true },
    );
  }

  async recordAuditLog(entry: {
    actorId: string;
    actorRole: UserRole;
    action: string;
    targetCollection?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await connectToDatabase();
    const AuditModel = getMongooseModel('auditLogs');
    const actorObjId = mongoose.Types.ObjectId.isValid(entry.actorId)
      ? new mongoose.Types.ObjectId(entry.actorId)
      : new mongoose.Types.ObjectId('66f000000000000000000001');
    await AuditModel.create({
      actorId: actorObjId,
      actorRole: entry.actorRole,
      action: entry.action,
      targetCollection: entry.targetCollection,
      targetId: entry.targetId,
      metadata: entry.metadata,
    });
  }
}

export class InMemoryAIRepository implements AIRepository {
  private config: AIPlatformConfig = buildDefaultPlatformConfig();
  private readonly prompts = new Map<string, PromptTemplateRecord>();
  private readonly usageLogs: AIUsageLogRecord[] = [];
  private readonly cache = new Map<string, { text: string; modelId: string }>();

  constructor() {
    const now = new Date();
    for (const seed of Object.values(DEFAULT_PROMPT_TEMPLATES)) {
      this.prompts.set(seed.id, {
        ...seed,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  async getPlatformConfig(): Promise<AIPlatformConfig> {
    return {
      ...this.config,
      taskModels: { ...this.config.taskModels },
      fallbackModels: [...this.config.fallbackModels],
    };
  }

  async updatePlatformConfig(
    patch: Partial<Omit<AIPlatformConfig, 'updatedAt'>>,
  ): Promise<AIPlatformConfig> {
    this.config = {
      defaultModel: patch.defaultModel ?? this.config.defaultModel,
      taskModels: {
        ...this.config.taskModels,
        ...(patch.taskModels ?? {}),
      },
      fallbackModels: patch.fallbackModels
        ? [...patch.fallbackModels]
        : [...this.config.fallbackModels],
      dailyRequestLimitPerStudent:
        patch.dailyRequestLimitPerStudent ?? this.config.dailyRequestLimitPerStudent,
      dailyTokenLimitPerStudent:
        patch.dailyTokenLimitPerStudent ?? this.config.dailyTokenLimitPerStudent,
      enableResponseCaching: patch.enableResponseCaching ?? this.config.enableResponseCaching,
      updatedAt: new Date(),
    };
    return this.getPlatformConfig();
  }

  async listPromptTemplates(taskType?: AITaskType): Promise<PromptTemplateRecord[]> {
    return Array.from(this.prompts.values())
      .filter((p) => !taskType || p.taskType === taskType)
      .sort((a, b) => a.taskType.localeCompare(b.taskType) || b.version - a.version)
      .map((p) => ({ ...p }));
  }

  async getActivePromptTemplate(taskType: AITaskType): Promise<PromptTemplateRecord> {
    const matches = Array.from(this.prompts.values())
      .filter((p) => p.taskType === taskType && p.isActive)
      .sort((a, b) => b.version - a.version);
    if (matches[0]) {
      return { ...matches[0] };
    }
    const seed = DEFAULT_PROMPT_TEMPLATES[taskType];
    return {
      ...seed,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async upsertPromptTemplate(
    input: {
      taskType: AITaskType;
      name: string;
      systemPrompt: string;
      userPromptTemplate: string;
      temperature: number;
      maxOutputTokens: number;
      isActive: boolean;
    },
    updatedByUserId?: string,
  ): Promise<PromptTemplateRecord> {
    const existing = Array.from(this.prompts.values())
      .filter((p) => p.taskType === input.taskType)
      .sort((a, b) => b.version - a.version);
    const nextVersion = existing[0] ? existing[0].version + 1 : 1;
    const now = new Date();
    const record: PromptTemplateRecord = {
      id: randomBytes(12).toString('hex'),
      ...input,
      version: nextVersion,
      updatedByUserId,
      createdAt: now,
      updatedAt: now,
    };
    this.prompts.set(record.id, record);
    return { ...record };
  }

  async recordUsageLog(
    entry: Omit<AIUsageLogRecord, 'id' | 'createdAt'>,
  ): Promise<AIUsageLogRecord> {
    const record: AIUsageLogRecord = {
      ...entry,
      id: randomBytes(12).toString('hex'),
      createdAt: new Date(),
    };
    this.usageLogs.unshift(record);
    return { ...record };
  }

  async listUsageLogs(
    filter: UsageLogQueryFilter,
  ): Promise<{ items: AIUsageLogRecord[]; total: number }> {
    let all = [...this.usageLogs];
    if (filter.taskType) all = all.filter((l) => l.taskType === filter.taskType);
    if (filter.status) all = all.filter((l) => l.status === filter.status);
    if (filter.userId) all = all.filter((l) => l.userId === filter.userId);
    const total = all.length;
    const skip = Math.max(0, (filter.page - 1) * filter.limit);
    const items = all.slice(skip, skip + filter.limit).map((l) => ({ ...l }));
    return { items, total };
  }

  async getUserDailyUsageStats(
    userId: string,
    sinceDate: Date,
  ): Promise<{ requestCount: number; totalTokens: number }> {
    const matching = this.usageLogs.filter(
      (l) => l.userId === userId && l.createdAt.getTime() >= sinceDate.getTime(),
    );
    const totalTokens = matching.reduce((acc, l) => acc + l.totalTokens, 0);
    return {
      requestCount: matching.length,
      totalTokens,
    };
  }

  async getCachedOutput(cacheKey: string): Promise<{ text: string; modelId: string } | null> {
    const found = this.cache.get(cacheKey);
    return found ? { ...found } : null;
  }

  async setCachedOutput(
    cacheKey: string,
    value: { text: string; modelId: string },
  ): Promise<void> {
    this.cache.set(cacheKey, { ...value });
  }

  async recordAuditLog(): Promise<void> {
    // Handled in memory for AI config tests
  }
}

let fallbackAIRepo: InMemoryAIRepository | null = null;
let activeAIRepoOverride: AIRepository | null = null;

export function setActiveAIRepository(repo: AIRepository | null): void {
  activeAIRepoOverride = repo;
}

export function getActiveAIRepository(): AIRepository {
  if (activeAIRepoOverride) {
    return activeAIRepoOverride;
  }
  if (process.env.MONGODB_URI?.trim()) {
    return new MongooseAIRepository();
  }
  if (!fallbackAIRepo) {
    fallbackAIRepo = new InMemoryAIRepository();
  }
  return fallbackAIRepo;
}
