/**
 * LearnMate AI — Centralized OpenRouter & AI Task Configuration Architecture
 * Grounded in docs/PROJECT_SRS.md Section 7.
 */

import type { AITaskType } from '../../types/domain.ts';

export const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';

export interface AITaskConfig {
  taskType: AITaskType;
  envOverrideKey: string;
  defaultModel: string;
  fallbackModels: readonly string[];
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  maxValidationRetries: number;
  supportsStreaming: boolean;
  requiresStructuredOutput: boolean;
}

export const AI_TASK_REGISTRY: Record<AITaskType, AITaskConfig> = {
  tutor: {
    taskType: 'tutor',
    envOverrideKey: 'AI_MODEL_TUTOR',
    defaultModel: DEFAULT_OPENROUTER_MODEL,
    fallbackModels: [DEFAULT_OPENROUTER_MODEL],
    temperature: 0.4,
    maxOutputTokens: 1800,
    timeoutMs: 30_000,
    maxValidationRetries: 1,
    supportsStreaming: true,
    requiresStructuredOutput: false,
  },
  explanation: {
    taskType: 'explanation',
    envOverrideKey: 'AI_MODEL_EXPLANATION',
    defaultModel: DEFAULT_OPENROUTER_MODEL,
    fallbackModels: [DEFAULT_OPENROUTER_MODEL],
    temperature: 0.3,
    maxOutputTokens: 2400,
    timeoutMs: 35_000,
    maxValidationRetries: 2,
    supportsStreaming: true,
    requiresStructuredOutput: true,
  },
  summarization: {
    taskType: 'summarization',
    envOverrideKey: 'AI_MODEL_SUMMARIZATION',
    defaultModel: DEFAULT_OPENROUTER_MODEL,
    fallbackModels: [DEFAULT_OPENROUTER_MODEL],
    temperature: 0.2,
    maxOutputTokens: 2400,
    timeoutMs: 35_000,
    maxValidationRetries: 2,
    supportsStreaming: false,
    requiresStructuredOutput: true,
  },
  quiz_generation: {
    taskType: 'quiz_generation',
    envOverrideKey: 'AI_MODEL_QUIZ_GENERATION',
    defaultModel: DEFAULT_OPENROUTER_MODEL,
    fallbackModels: [DEFAULT_OPENROUTER_MODEL],
    temperature: 0.3,
    maxOutputTokens: 3000,
    timeoutMs: 40_000,
    maxValidationRetries: 2,
    supportsStreaming: false,
    requiresStructuredOutput: true,
  },
  quiz_evaluation: {
    taskType: 'quiz_evaluation',
    envOverrideKey: 'AI_MODEL_QUIZ_EVALUATION',
    defaultModel: DEFAULT_OPENROUTER_MODEL,
    fallbackModels: [DEFAULT_OPENROUTER_MODEL],
    temperature: 0.1,
    maxOutputTokens: 1200,
    timeoutMs: 25_000,
    maxValidationRetries: 2,
    supportsStreaming: false,
    requiresStructuredOutput: true,
  },
  flashcards: {
    taskType: 'flashcards',
    envOverrideKey: 'AI_MODEL_FLASHCARDS',
    defaultModel: DEFAULT_OPENROUTER_MODEL,
    fallbackModels: [DEFAULT_OPENROUTER_MODEL],
    temperature: 0.3,
    maxOutputTokens: 2200,
    timeoutMs: 30_000,
    maxValidationRetries: 2,
    supportsStreaming: false,
    requiresStructuredOutput: true,
  },
  planner: {
    taskType: 'planner',
    envOverrideKey: 'AI_MODEL_PLANNER',
    defaultModel: DEFAULT_OPENROUTER_MODEL,
    fallbackModels: [DEFAULT_OPENROUTER_MODEL],
    temperature: 0.2,
    maxOutputTokens: 2000,
    timeoutMs: 30_000,
    maxValidationRetries: 2,
    supportsStreaming: false,
    requiresStructuredOutput: true,
  },
  document_qa: {
    taskType: 'document_qa',
    envOverrideKey: 'AI_MODEL_DOCUMENT_QA',
    defaultModel: DEFAULT_OPENROUTER_MODEL,
    fallbackModels: [DEFAULT_OPENROUTER_MODEL],
    temperature: 0.2,
    maxOutputTokens: 1800,
    timeoutMs: 30_000,
    maxValidationRetries: 2,
    supportsStreaming: true,
    requiresStructuredOutput: true,
  },
  recommendations: {
    taskType: 'recommendations',
    envOverrideKey: 'AI_MODEL_RECOMMENDATIONS',
    defaultModel: DEFAULT_OPENROUTER_MODEL,
    fallbackModels: [DEFAULT_OPENROUTER_MODEL],
    temperature: 0.2,
    maxOutputTokens: 1200,
    timeoutMs: 25_000,
    maxValidationRetries: 2,
    supportsStreaming: false,
    requiresStructuredOutput: true,
  },
};

export function resolveTaskModel(
  taskType: AITaskType,
  env: Record<string, string | undefined> = process.env,
): string {
  const cfg = AI_TASK_REGISTRY[taskType];
  const explicitTaskModel = env[cfg.envOverrideKey]?.trim();
  if (explicitTaskModel) {
    return explicitTaskModel;
  }
  const defaultEnvModel = env.OPENROUTER_DEFAULT_MODEL?.trim();
  return defaultEnvModel || cfg.defaultModel;
}

/**
 * Wraps untrusted document chunks in explicit XML-like delimiters to defend
 * against indirect prompt injection (SRS Section 7.6 & 10.2 NFR-SEC-011).
 */
export function wrapUntrustedDocumentChunk(
  chunkId: string,
  pageNumber: number | null,
  content: string,
): string {
  const sanitized = content.replace(/<\/?untrusted_document_chunk[^>]*>/gi, '[escaped_tag]');
  const pageAttr = pageNumber !== null ? ` page="${pageNumber}"` : '';
  return `<untrusted_document_chunk id="${chunkId}"${pageAttr}>\n${sanitized}\n</untrusted_document_chunk>`;
}
