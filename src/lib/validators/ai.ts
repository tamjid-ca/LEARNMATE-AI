/**
 * LearnMate AI — Centralized AI Structured Output & Admin Config Zod Schemas
 * Implements SRS Section 4.12 (FR-ADMIN-006..009), Section 4.13 (FR-AI-003..009),
 * and Section 7.3 (Structured Output Validation).
 */

import { z } from 'zod';
import {
  AI_TASK_TYPES,
  DIFFICULTY_LEVELS,
  QUESTION_TYPES,
} from '../../types/domain.ts';

export const taskModelMapSchema = z
  .object({
    tutor: z.string().trim().min(2).max(120),
    explanation: z.string().trim().min(2).max(120),
    summarization: z.string().trim().min(2).max(120),
    quiz_generation: z.string().trim().min(2).max(120),
    quiz_evaluation: z.string().trim().min(2).max(120),
    flashcards: z.string().trim().min(2).max(120),
    planner: z.string().trim().min(2).max(120),
    document_qa: z.string().trim().min(2).max(120),
    recommendations: z.string().trim().min(2).max(120),
  })
  .partial();

export const updateAiPlatformConfigSchema = z
  .object({
    defaultModel: z.string().trim().min(2).max(120).optional(),
    taskModels: taskModelMapSchema.optional(),
    fallbackModels: z.array(z.string().trim().min(2).max(120)).min(1).max(10).optional(),
    dailyRequestLimitPerStudent: z.coerce.number().int().min(1).max(1000).optional(),
    dailyTokenLimitPerStudent: z.coerce.number().int().min(500).max(2_000_000).optional(),
    enableResponseCaching: z.boolean().optional(),
  })
  .strict();

export const upsertPromptTemplateSchema = z
  .object({
    taskType: z.enum(AI_TASK_TYPES),
    name: z.string().trim().min(3).max(140),
    systemPrompt: z.string().trim().min(10).max(8000),
    userPromptTemplate: z.string().trim().min(10).max(8000),
    temperature: z.coerce.number().min(0).max(1.5).default(0.3),
    maxOutputTokens: z.coerce.number().int().min(100).max(8000).default(2000),
    isActive: z.boolean().default(true),
  })
  .strict();

export const aiUsageLogQuerySchema = z.object({
  taskType: z.enum(AI_TASK_TYPES).optional(),
  status: z
    .enum(['success', 'validation_failed', 'rate_limited', 'provider_error', 'cached'])
    .optional(),
  userId: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * Structured AI Output Schemas (Section 7.3)
 */
function normalizeStructuredMaterialInput(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw;
  }
  const obj = { ...(raw as Record<string, unknown>) };

  // Support alternate content field names from varied OpenRouter models
  if (!obj.contentMarkdown) {
    const alt = obj.content ?? obj.markdown ?? obj.body ?? obj.notes;
    if (typeof alt === 'string') {
      obj.contentMarkdown = alt;
    }
  }

  const contentText = typeof obj.contentMarkdown === 'string' ? obj.contentMarkdown.trim() : '';

  // Ensure summary is present and clamped to 1200 characters
  const rawSummary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
  if (rawSummary.length >= 5) {
    obj.summary = rawSummary.slice(0, 1200);
  } else if (contentText.length >= 5) {
    const firstPlainLine =
      contentText
        .split('\n')
        .map((l) => l.replace(/^#+\s*/, '').trim())
        .find((l) => l.length >= 5) ?? contentText;
    obj.summary = firstPlainLine.slice(0, 300);
  }

  // Normalize keyTakeaways array
  if (Array.isArray(obj.keyTakeaways)) {
    const cleaned = obj.keyTakeaways
      .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
      .filter((s) => s.length >= 2)
      .slice(0, 15);
    obj.keyTakeaways =
      cleaned.length > 0 ? cleaned : ['Review the structured concepts and worked steps above.'];
  } else if (obj.keyTakeaways === undefined) {
    obj.keyTakeaways = ['Review the structured concepts and worked steps above.'];
  }

  // Normalize formulasOrDefinitions (handling string[] or object[])
  if (Array.isArray(obj.formulasOrDefinitions)) {
    obj.formulasOrDefinitions = obj.formulasOrDefinitions
      .map((item) => {
        if (typeof item === 'string') {
          const sepMatch = item.match(/^([^:—-]+)[:—-]\s*(.+)$/);
          if (sepMatch) {
            return { term: sepMatch[1]!.trim(), detail: sepMatch[2]!.trim() };
          }
          return { term: 'Concept', detail: item.trim() };
        }
        return item;
      })
      .filter((item) => {
        if (!item || typeof item !== 'object') return false;
        const entry = item as { term?: unknown; detail?: unknown };
        return (
          typeof entry.term === 'string' &&
          entry.term.trim().length >= 1 &&
          typeof entry.detail === 'string' &&
          entry.detail.trim().length >= 1
        );
      });
  }

  // Normalize practicePrompts
  if (Array.isArray(obj.practicePrompts)) {
    obj.practicePrompts = obj.practicePrompts
      .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
      .filter((s) => s.length >= 2);
  }

  return obj;
}

export interface StructuredMaterialOutput {
  title: string;
  summary: string;
  contentMarkdown: string;
  keyTakeaways: string[];
  formulasOrDefinitions: Array<{ term: string; detail: string }>;
  practicePrompts: string[];
}

const structuredMaterialOutputBaseSchema = z.object({
  title: z.string().trim().min(2).max(240),
  summary: z.string().trim().min(5).max(1200),
  contentMarkdown: z.string().trim().min(10),
  keyTakeaways: z.array(z.string().trim().min(2)).min(1).max(15),
  formulasOrDefinitions: z
    .array(
      z.object({
        term: z.string().trim().min(1),
        detail: z.string().trim().min(1),
      }),
    )
    .default([]),
  practicePrompts: z.array(z.string().trim().min(2)).default([]),
});

export const structuredMaterialOutputSchema = z.preprocess(
  normalizeStructuredMaterialInput,
  structuredMaterialOutputBaseSchema,
) as unknown as z.ZodType<StructuredMaterialOutput>;

export const structuredQuizQuestionSchema = z
  .object({
    questionType: z.enum(QUESTION_TYPES),
    difficulty: z.enum(DIFFICULTY_LEVELS),
    promptText: z.string().trim().min(5),
    options: z
      .array(
        z.object({
          id: z.string().trim().min(1),
          text: z.string().trim().min(1),
        }),
      )
      .default([]),
    correctOptionIds: z.array(z.string().trim().min(1)).default([]),
    expectedShortAnswerRubric: z.string().trim().optional(),
    explanation: z.string().trim().min(3),
    points: z.coerce.number().int().min(1).max(10).default(1),
  })
  .refine(
    (q) => {
      if (q.questionType === 'short_answer') {
        return Boolean(q.expectedShortAnswerRubric && q.expectedShortAnswerRubric.length >= 3);
      }
      if (q.options.length < 2 || q.correctOptionIds.length < 1) {
        return false;
      }
      const optionIdSet = new Set(q.options.map((o) => o.id));
      return q.correctOptionIds.every((cid) => optionIdSet.has(cid));
    },
    {
      message:
        'Objective questions must include options with valid in-bounds correctOptionIds; short_answer must include expectedShortAnswerRubric',
    },
  );

export const structuredQuizOutputSchema = z.object({
  title: z.string().trim().min(2).max(240),
  questions: z.array(structuredQuizQuestionSchema).min(1).max(50),
});

export const structuredShortAnswerEvaluationSchema = z.object({
  scoreRatio: z.number().min(0).max(1),
  isCorrect: z.boolean(),
  feedback: z.string().trim().min(3),
  missingConcepts: z.array(z.string().trim()).default([]),
});

export const structuredFlashcardOutputSchema = z.object({
  title: z.string().trim().min(2).max(240),
  cards: z
    .array(
      z.object({
        front: z.string().trim().min(2),
        back: z.string().trim().min(2),
        hint: z.string().trim().optional(),
      }),
    )
    .min(1)
    .max(50),
});

export const structuredPlannerSuggestionSchema = z.object({
  aiSummary: z.string().trim().min(5),
  priorityTopicCodes: z.array(z.string().trim().min(1)).default([]),
  studyTips: z.array(z.string().trim().min(2)).min(1).max(10),
});

export const structuredRecommendationOutputSchema = z.object({
  recommendations: z
    .array(
      z.object({
        title: z.string().trim().min(2),
        reason: z.string().trim().min(5),
        suggestedAction: z.string().trim().min(3),
        priority: z.enum(['high', 'medium', 'low']),
      }),
    )
    .min(1)
    .max(10),
});

/**
 * Extracts a JSON object or array from raw LLM text (stripping markdown code fences if present).
 */
export function extractJsonFromLLMText(rawText: string): unknown {
  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    // Attempt to locate outermost JSON object `{...}` or array `[...]`
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
    }
    throw new Error('Response did not contain valid JSON');
  }
}

export function validateStructuredAIOutput<T>(
  rawText: string,
  schema: z.ZodType<T>,
): { success: true; data: T } | { success: false; error: string } {
  try {
    const rawJson = extractJsonFromLLMText(rawText);
    const parsed = schema.safeParse(rawJson);
    if (!parsed.success) {
      return {
        success: false,
        error: JSON.stringify(parsed.error.flatten().fieldErrors),
      };
    }
    return {
      success: true,
      data: parsed.data,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Invalid JSON structure',
    };
  }
}
