/**
 * LearnMate AI — Centralized Server-Side OpenRouter Gateway Client
 * Enforces SRS Section 4.13 (FR-AI-001, FR-AI-002, FR-AI-005, FR-AI-011) and Section 7.1.
 */

import { DEFAULT_OPENROUTER_BASE_URL, DEFAULT_OPENROUTER_MODEL } from './config.ts';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterCompletionRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  responseFormatJson?: boolean;
}

export interface OpenRouterCompletionResponse {
  content: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type OpenRouterTransport = (
  request: OpenRouterCompletionRequest,
) => Promise<OpenRouterCompletionResponse>;

/**
 * Strips any potential API key, Authorization header, or internal secret from error messages
 * before recording in aiUsageLogs or returning to callers.
 */
export function sanitizeProviderError(rawError: unknown): string {
  const msg = rawError instanceof Error ? rawError.message : String(rawError ?? 'Unknown AI error');
  return msg
    .replace(/sk-or-v1-[a-zA-Z0-9_-]+/gi, '[REDACTED_OPENROUTER_KEY]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]')
    .slice(0, 320);
}

export function getOpenRouterServerCredentials(
  env: Record<string, string | undefined> = process.env,
): { apiKey: string | null; baseUrl: string } {
  const apiKey = env.OPENROUTER_API_KEY?.trim() || null;
  const baseUrl = (env.OPENROUTER_BASE_URL?.trim() || DEFAULT_OPENROUTER_BASE_URL).replace(
    /\/+$/,
    '',
  );
  return { apiKey, baseUrl };
}

async function defaultFetchOpenRouterTransport(
  req: OpenRouterCompletionRequest,
): Promise<OpenRouterCompletionResponse> {
  const { apiKey, baseUrl } = getOpenRouterServerCredentials();
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured on the server');
  }

  const controller = new AbortController();
  const timeoutMs = req.timeoutMs ?? 30_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'LearnMate AI',
      },
      body: JSON.stringify({
        model: req.model || DEFAULT_OPENROUTER_MODEL,
        messages: req.messages,
        temperature: req.temperature ?? 0.3,
        max_tokens: req.maxTokens ?? 2000,
        ...(req.responseFormatJson ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `OpenRouter HTTP ${response.status}: ${sanitizeProviderError(errorText || response.statusText)}`,
      );
    }

    const data = (await response.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    const content = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!content) {
      throw new Error('OpenRouter returned an empty completion choice');
    }

    const promptTokens = data.usage?.prompt_tokens ?? 0;
    const completionTokens = data.usage?.completion_tokens ?? 0;
    const totalTokens = data.usage?.total_tokens ?? promptTokens + completionTokens;

    return {
      content,
      modelId: data.model || req.model,
      promptTokens,
      completionTokens,
      totalTokens,
    };
  } finally {
    clearTimeout(timer);
  }
}

let customTransportOverride: OpenRouterTransport | null = null;

export function setOpenRouterTransport(transport: OpenRouterTransport | null): void {
  customTransportOverride = transport;
}

export function getOpenRouterTransport(): OpenRouterTransport {
  return customTransportOverride ?? defaultFetchOpenRouterTransport;
}

/**
 * Formats a completed or streamed text response as a standard Server-Sent Events (SSE) ReadableStream.
 */
export function createSSEStreamFromText(
  text: string,
  modelId: string,
  extraMeta?: Record<string, unknown>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const words = text.split(/(?=\s+)/);
  const chunkSize = Math.max(1, Math.ceil(words.length / 8));

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < words.length; i += chunkSize) {
        const segment = words.slice(i, i + chunkSize).join('');
        const eventPayload = JSON.stringify({ chunk: segment });
        controller.enqueue(encoder.encode(`data: ${eventPayload}\n\n`));
      }
      const donePayload = JSON.stringify({
        done: true,
        modelId,
        ...(extraMeta ?? {}),
      });
      controller.enqueue(encoder.encode(`data: ${donePayload}\n\n`));
      controller.close();
    },
  });
}
