/**
 * LearnMate AI — Centralized AI Orchestration & Admin Governance Service
 * Implements SRS Section 4.12 (FR-ADMIN-006..009), Section 4.13 (FR-AI-001..011), and Section 7.
 */

import { createHash } from 'node:crypto';
import type { z } from 'zod';
import { AI_TASK_REGISTRY } from '../../lib/ai/config.ts';
import {
  createSSEStreamFromText,
  getOpenRouterTransport,
  sanitizeProviderError,
  type OpenRouterMessage,
  type OpenRouterTransport,
} from '../../lib/ai/openrouter-client.ts';
import { interpolatePromptTemplate } from '../../lib/ai/prompt-templates.ts';
import { AppError } from '../../lib/api/errors.ts';
import { buildPaginationMeta, type PaginationMeta } from '../../lib/api/response.ts';
import { requirePermission, type AuthenticatedActor } from '../../lib/auth/rbac.ts';
import {
  aiUsageLogQuerySchema,
  updateAiPlatformConfigSchema,
  upsertPromptTemplateSchema,
  validateStructuredAIOutput,
} from '../../lib/validators/ai.ts';
import type { AITaskType } from '../../types/domain.ts';
import {
  getActiveAIRepository,
  type AIPlatformConfig,
  type AIRepository,
  type AIUsageLogRecord,
  type PromptTemplateRecord,
} from './ai-repository.ts';

export interface ExecuteAITaskInput {
  userId?: string;
  taskType: AITaskType;
  variables: Record<string, string | number | undefined>;
  conversationHistory?: OpenRouterMessage[];
  cacheKey?: string;
  bypassCache?: boolean;
  temperatureOverride?: number;
  maxTokensOverride?: number;
}

export interface ExecuteAITaskResult {
  content: string;
  modelId: string;
  fallbackUsed: boolean;
  cached: boolean;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ExecuteStructuredAITaskInput<T> extends ExecuteAITaskInput {
  schema: z.ZodType<T>;
}

export interface ExecuteStructuredAITaskResult<T> extends ExecuteAITaskResult {
  data: T;
  attemptsUsed: number;
}

export function computeAICacheKey(
  taskType: AITaskType,
  variables: Record<string, string | number | undefined>,
): string {
  const sortedEntries = Object.entries(variables)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  const digest = createHash('sha256')
    .update(JSON.stringify({ taskType, sortedEntries }))
    .digest('hex')
    .slice(0, 32);
  return `${taskType}:${digest}`;
}

async function enforceUserDailyQuota(
  userId: string | undefined,
  taskType: AITaskType,
  platformConfig: AIPlatformConfig,
  repo: AIRepository,
): Promise<void> {
  if (!userId) return;
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const stats = await repo.getUserDailyUsageStats(userId, startOfDay);
  if (stats.requestCount >= platformConfig.dailyRequestLimitPerStudent) {
    await repo.recordUsageLog({
      userId,
      taskType,
      modelId: platformConfig.taskModels[taskType] || platformConfig.defaultModel,
      fallbackUsed: false,
      status: 'rate_limited',
      latencyMs: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      sanitizedError: `Daily AI request limit (${platformConfig.dailyRequestLimitPerStudent}) reached`,
    });
    throw AppError.rateLimited(
      `You have reached your daily limit of ${platformConfig.dailyRequestLimitPerStudent} AI generations. Please try again tomorrow.`,
    );
  }

  if (stats.totalTokens >= platformConfig.dailyTokenLimitPerStudent) {
    await repo.recordUsageLog({
      userId,
      taskType,
      modelId: platformConfig.taskModels[taskType] || platformConfig.defaultModel,
      fallbackUsed: false,
      status: 'rate_limited',
      latencyMs: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      sanitizedError: `Daily AI token quota (${platformConfig.dailyTokenLimitPerStudent}) reached`,
    });
    throw AppError.rateLimited(
      'You have reached your daily AI token allowance. Please continue studying saved materials and try again tomorrow.',
    );
  }
}

function buildCandidateModelChain(
  taskType: AITaskType,
  platformConfig: AIPlatformConfig,
): string[] {
  const primary =
    platformConfig.taskModels[taskType] ||
    platformConfig.defaultModel ||
    AI_TASK_REGISTRY[taskType].defaultModel;
  const candidates = [
    primary,
    ...platformConfig.fallbackModels,
    ...AI_TASK_REGISTRY[taskType].fallbackModels,
  ];
  // Deduplicate while keeping order, but ensure at least 2 attempts if only 1 unique model id exists
  const unique = Array.from(new Set(candidates.filter(Boolean)));
  return unique.length > 0 ? unique : ['openrouter/free'];
}

export async function executeAITask(
  input: ExecuteAITaskInput,
  repo: AIRepository = getActiveAIRepository(),
  transport: OpenRouterTransport = getOpenRouterTransport(),
): Promise<ExecuteAITaskResult> {
  const platformConfig = await repo.getPlatformConfig();
  await enforceUserDailyQuota(input.userId, input.taskType, platformConfig, repo);

  const effectiveCacheKey =
    input.cacheKey ??
    (platformConfig.enableResponseCaching && !input.conversationHistory?.length
      ? computeAICacheKey(input.taskType, input.variables)
      : undefined);

  if (platformConfig.enableResponseCaching && !input.bypassCache && effectiveCacheKey) {
    const cached = await repo.getCachedOutput(effectiveCacheKey);
    if (cached) {
      await repo.recordUsageLog({
        userId: input.userId,
        taskType: input.taskType,
        modelId: cached.modelId,
        fallbackUsed: false,
        status: 'cached',
        latencyMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });
      return {
        content: cached.text,
        modelId: cached.modelId,
        fallbackUsed: false,
        cached: true,
        latencyMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };
    }
  }

  const template = await repo.getActivePromptTemplate(input.taskType);
  const taskCfg = AI_TASK_REGISTRY[input.taskType];
  const systemMessage = interpolatePromptTemplate(template.systemPrompt, input.variables);
  const userMessage = interpolatePromptTemplate(template.userPromptTemplate, input.variables);

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: systemMessage },
    ...(input.conversationHistory ?? []),
    { role: 'user', content: userMessage },
  ];

  const candidateModels = buildCandidateModelChain(input.taskType, platformConfig);
  const startedAt = Date.now();
  let lastError: unknown = null;

  for (let idx = 0; idx < candidateModels.length; idx += 1) {
    const model = candidateModels[idx]!;
    const fallbackUsed = idx > 0;
    try {
      const response = await transport({
        model,
        messages,
        temperature: input.temperatureOverride ?? template.temperature ?? taskCfg.temperature,
        maxTokens: input.maxTokensOverride ?? template.maxOutputTokens ?? taskCfg.maxOutputTokens,
        timeoutMs: taskCfg.timeoutMs,
        responseFormatJson: taskCfg.requiresStructuredOutput,
      });

      const latencyMs = Math.max(1, Date.now() - startedAt);
      await repo.recordUsageLog({
        userId: input.userId,
        taskType: input.taskType,
        modelId: response.modelId,
        fallbackUsed,
        status: 'success',
        latencyMs,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        totalTokens: response.totalTokens,
      });

      if (platformConfig.enableResponseCaching && effectiveCacheKey) {
        await repo.setCachedOutput(effectiveCacheKey, {
          text: response.content,
          modelId: response.modelId,
        });
      }

      return {
        content: response.content,
        modelId: response.modelId,
        fallbackUsed,
        cached: false,
        latencyMs,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        totalTokens: response.totalTokens,
      };
    } catch (err) {
      lastError = err;
    }
  }

  const latencyMs = Math.max(1, Date.now() - startedAt);
  const sanitizedError = sanitizeProviderError(lastError);
  await repo.recordUsageLog({
    userId: input.userId,
    taskType: input.taskType,
    modelId: candidateModels[0] ?? 'openrouter/free',
    fallbackUsed: candidateModels.length > 1,
    status: 'provider_error',
    latencyMs,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    sanitizedError,
  });

  throw AppError.aiProvider(
    'The AI study service is temporarily unavailable or rate-limited. Please try again shortly.',
    { reason: sanitizedError },
  );
}

export async function executeStructuredAITask<T>(
  input: ExecuteStructuredAITaskInput<T>,
  repo: AIRepository = getActiveAIRepository(),
  transport: OpenRouterTransport = getOpenRouterTransport(),
): Promise<ExecuteStructuredAITaskResult<T>> {
  const platformConfig = await repo.getPlatformConfig();
  await enforceUserDailyQuota(input.userId, input.taskType, platformConfig, repo);

  const effectiveCacheKey =
    input.cacheKey ??
    (platformConfig.enableResponseCaching
      ? computeAICacheKey(input.taskType, input.variables)
      : undefined);

  if (platformConfig.enableResponseCaching && !input.bypassCache && effectiveCacheKey) {
    const cached = await repo.getCachedOutput(effectiveCacheKey);
    if (cached) {
      const validatedCache = validateStructuredAIOutput(cached.text, input.schema);
      if (validatedCache.success) {
        await repo.recordUsageLog({
          userId: input.userId,
          taskType: input.taskType,
          modelId: cached.modelId,
          fallbackUsed: false,
          status: 'cached',
          latencyMs: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        });
        return {
          data: validatedCache.data,
          content: cached.text,
          modelId: cached.modelId,
          fallbackUsed: false,
          cached: true,
          latencyMs: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          attemptsUsed: 0,
        };
      }
    }
  }

  const template = await repo.getActivePromptTemplate(input.taskType);
  const taskCfg = AI_TASK_REGISTRY[input.taskType];
  const systemMessage = interpolatePromptTemplate(template.systemPrompt, input.variables);
  const baseUserMessage = interpolatePromptTemplate(template.userPromptTemplate, input.variables);

  const candidateModels = buildCandidateModelChain(input.taskType, platformConfig);
  const maxAttempts = Math.min(3, Math.max(1, taskCfg.maxValidationRetries + 1));
  const startedAt = Date.now();

  let repairHint = '';
  let lastValidationError = '';
  let lastProviderError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const model = candidateModels[Math.min(attempt - 1, candidateModels.length - 1)]!;
    const fallbackUsed = attempt > 1;
    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemMessage },
      {
        role: 'user',
        content: repairHint
          ? `${baseUserMessage}\n\n[SCHEMA REPAIR REQUIRED]: Your previous response failed validation (${repairHint}). Return ONLY valid JSON matching the required schema.`
          : baseUserMessage,
      },
    ];

    try {
      const response = await transport({
        model,
        messages,
        temperature: input.temperatureOverride ?? template.temperature ?? taskCfg.temperature,
        maxTokens: input.maxTokensOverride ?? template.maxOutputTokens ?? taskCfg.maxOutputTokens,
        timeoutMs: taskCfg.timeoutMs,
        responseFormatJson: true,
      });

      const validation = validateStructuredAIOutput(response.content, input.schema);
      if (validation.success) {
        const latencyMs = Math.max(1, Date.now() - startedAt);
        await repo.recordUsageLog({
          userId: input.userId,
          taskType: input.taskType,
          modelId: response.modelId,
          fallbackUsed,
          status: 'success',
          latencyMs,
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          totalTokens: response.totalTokens,
        });

        if (platformConfig.enableResponseCaching && effectiveCacheKey) {
          await repo.setCachedOutput(effectiveCacheKey, {
            text: response.content,
            modelId: response.modelId,
          });
        }

        return {
          data: validation.data,
          content: response.content,
          modelId: response.modelId,
          fallbackUsed,
          cached: false,
          latencyMs,
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          totalTokens: response.totalTokens,
          attemptsUsed: attempt,
        };
      }

      lastValidationError = validation.error;
      repairHint = validation.error;
    } catch (err) {
      lastProviderError = err;
      repairHint = sanitizeProviderError(err);
    }
  }

  const latencyMs = Math.max(1, Date.now() - startedAt);
  const status = lastValidationError ? 'validation_failed' : 'provider_error';
  const sanitizedError = sanitizeProviderError(
    lastValidationError || lastProviderError || 'Structured output validation failed',
  );

  await repo.recordUsageLog({
    userId: input.userId,
    taskType: input.taskType,
    modelId: candidateModels[0] ?? 'openrouter/free',
    fallbackUsed: maxAttempts > 1,
    status,
    latencyMs,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    sanitizedError,
  });

  throw AppError.aiProvider(
    lastValidationError
      ? 'The AI model returned an invalid structure after bounded repair retries. Please try again.'
      : 'The AI study service is temporarily unavailable or rate-limited.',
    { status, reason: sanitizedError },
  );
}

export async function streamAITask(
  input: ExecuteAITaskInput,
  repo: AIRepository = getActiveAIRepository(),
  transport: OpenRouterTransport = getOpenRouterTransport(),
): Promise<{
  stream: ReadableStream<Uint8Array>;
  result: ExecuteAITaskResult;
}> {
  const result = await executeAITask(input, repo, transport);
  const stream = createSSEStreamFromText(result.content, result.modelId, {
    fallbackUsed: result.fallbackUsed,
    cached: result.cached,
  });
  return { stream, result };
}

/**
 * Administrative AI Configuration, Prompt Template, and Usage Observability Services
 */
export async function getAdminAIConfig(
  actor: AuthenticatedActor | null | undefined,
  repo: AIRepository = getActiveAIRepository(),
): Promise<{
  config: AIPlatformConfig;
  taskRegistry: typeof AI_TASK_REGISTRY;
  openRouterKeyConfigured: boolean;
}> {
  requirePermission(actor, 'admin:ai_config');
  const config = await repo.getPlatformConfig();
  return {
    config,
    taskRegistry: AI_TASK_REGISTRY,
    openRouterKeyConfigured: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
  };
}

export async function updateAdminAIConfig(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  repo: AIRepository = getActiveAIRepository(),
): Promise<{ config: AIPlatformConfig }> {
  const verified = requirePermission(actor, 'admin:ai_config');
  const parsed = updateAiPlatformConfigSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid AI platform configuration payload', parsed.error.flatten());
  }

  const current = await repo.getPlatformConfig();
  const nextTaskModels = parsed.data.taskModels
    ? ({ ...current.taskModels, ...parsed.data.taskModels } as Record<AITaskType, string>)
    : undefined;

  const updated = await repo.updatePlatformConfig(
    {
      ...(parsed.data.defaultModel !== undefined ? { defaultModel: parsed.data.defaultModel } : {}),
      ...(nextTaskModels !== undefined ? { taskModels: nextTaskModels } : {}),
      ...(parsed.data.fallbackModels !== undefined
        ? { fallbackModels: parsed.data.fallbackModels }
        : {}),
      ...(parsed.data.dailyRequestLimitPerStudent !== undefined
        ? { dailyRequestLimitPerStudent: parsed.data.dailyRequestLimitPerStudent }
        : {}),
      ...(parsed.data.dailyTokenLimitPerStudent !== undefined
        ? { dailyTokenLimitPerStudent: parsed.data.dailyTokenLimitPerStudent }
        : {}),
      ...(parsed.data.enableResponseCaching !== undefined
        ? { enableResponseCaching: parsed.data.enableResponseCaching }
        : {}),
    },
    verified.userId,
  );

  await repo.recordAuditLog({
    actorId: verified.userId,
    actorRole: verified.role,
    action: 'admin.ai_config.update',
    targetCollection: 'appSettings',
    targetId: 'ai_platform_config',
    metadata: parsed.data as Record<string, unknown>,
  });

  return { config: updated };
}

export async function listAdminPromptTemplates(
  actor: AuthenticatedActor | null | undefined,
  taskType?: AITaskType,
  repo: AIRepository = getActiveAIRepository(),
): Promise<{ templates: PromptTemplateRecord[] }> {
  requirePermission(actor, 'admin:prompts');
  const templates = await repo.listPromptTemplates(taskType);
  return { templates };
}

export async function upsertAdminPromptTemplate(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  repo: AIRepository = getActiveAIRepository(),
): Promise<{ template: PromptTemplateRecord }> {
  const verified = requirePermission(actor, 'admin:prompts');
  const parsed = upsertPromptTemplateSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid prompt template payload', parsed.error.flatten());
  }

  const created = await repo.upsertPromptTemplate(parsed.data, verified.userId);
  await repo.recordAuditLog({
    actorId: verified.userId,
    actorRole: verified.role,
    action: 'admin.prompt_template.upsert',
    targetCollection: 'promptTemplates',
    targetId: created.id,
    metadata: { taskType: created.taskType, version: created.version },
  });

  return { template: created };
}

export async function getAdminAIUsageDashboard(
  actor: AuthenticatedActor | null | undefined,
  rawQuery: unknown,
  repo: AIRepository = getActiveAIRepository(),
): Promise<{
  logs: AIUsageLogRecord[];
  summary: {
    totalRequests: number;
    totalTokens: number;
    averageLatencyMs: number;
    errorCount: number;
    cachedCount: number;
    rateLimitedCount: number;
    byStatus: Record<string, number>;
    byTask: Record<string, number>;
  };
  meta: PaginationMeta;
}> {
  requirePermission(actor, 'admin:usage_logs');
  const parsed = aiUsageLogQuerySchema.safeParse(rawQuery ?? {});
  if (!parsed.success) {
    throw AppError.validation('Invalid AI usage log filter parameters', parsed.error.flatten());
  }

  const query = parsed.data;
  const { items, total } = await repo.listUsageLogs(query);

  let totalTokens = 0;
  let totalLatency = 0;
  let errorCount = 0;
  let cachedCount = 0;
  let rateLimitedCount = 0;
  const byStatus: Record<string, number> = {};
  const byTask: Record<string, number> = {};

  for (const log of items) {
    totalTokens += log.totalTokens;
    totalLatency += log.latencyMs;
    byStatus[log.status] = (byStatus[log.status] ?? 0) + 1;
    byTask[log.taskType] = (byTask[log.taskType] ?? 0) + 1;

    if (log.status === 'provider_error' || log.status === 'validation_failed') {
      errorCount += 1;
    } else if (log.status === 'cached') {
      cachedCount += 1;
    } else if (log.status === 'rate_limited') {
      rateLimitedCount += 1;
    }
  }

  return {
    logs: items,
    summary: {
      totalRequests: total,
      totalTokens,
      averageLatencyMs: items.length > 0 ? Math.round(totalLatency / items.length) : 0,
      errorCount,
      cachedCount,
      rateLimitedCount,
      byStatus,
      byTask,
    },
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}
