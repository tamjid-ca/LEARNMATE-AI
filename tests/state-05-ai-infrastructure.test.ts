import { beforeEach, describe, expect, it } from 'vitest';
import {
  sanitizeProviderError,
  type OpenRouterCompletionRequest,
  type OpenRouterCompletionResponse,
} from '../src/lib/ai/openrouter-client.ts';
import {
  structuredQuizOutputSchema,
} from '../src/lib/validators/ai.ts';
import {
  InMemoryAIRepository,
  setActiveAIRepository,
} from '../src/modules/ai/ai-repository.ts';
import {
  executeAITask,
  executeStructuredAITask,
  getAdminAIConfig,
  getAdminAIUsageDashboard,
  listAdminPromptTemplates,
  streamAITask,
  updateAdminAIConfig,
  upsertAdminPromptTemplate,
} from '../src/modules/ai/ai-service.ts';

describe('State 05 — OpenRouter & Central AI Infrastructure Gate', () => {
  let aiRepo: InMemoryAIRepository;

  const studentActor = {
    userId: '66f000000000000000000801',
    email: 'student.ai@example.com',
    role: 'student' as const,
  };

  const adminActor = {
    userId: '66f000000000000000000802',
    email: 'admin.ai@learnmate.ai',
    role: 'admin' as const,
  };

  beforeEach(() => {
    aiRepo = new InMemoryAIRepository();
    setActiveAIRepository(aiRepo);
  });

  it('executes centralized AI tasks, interpolates prompt templates, caches reusable outputs, and logs telemetry', async () => {
    let transportCalls = 0;
    const mockTransport = async (
      req: OpenRouterCompletionRequest,
    ): Promise<OpenRouterCompletionResponse> => {
      transportCalls += 1;
      expect(req.messages[0]?.content).toContain('bn');
      expect(req.messages[1]?.content).toContain("Newton's Laws of Motion");
      return {
        content: 'নিউটনের দ্বিতীয় সূত্র অনুযায়ী F = ma।',
        modelId: req.model,
        promptTokens: 110,
        completionTokens: 45,
        totalTokens: 155,
      };
    };

    const first = await executeAITask(
      {
        userId: studentActor.userId,
        taskType: 'tutor',
        variables: {
          language: 'bn',
          depth: 'intermediate',
          curriculumContext: 'BD-NCTB > HSC > Physics',
          topicTitle: "Newton's Laws of Motion",
          userPrompt: 'Explain F = ma in Bangla.',
        },
      },
      aiRepo,
      mockTransport,
    );

    expect(first.cached).toBe(false);
    expect(first.content).toContain('F = ma');
    expect(first.totalTokens).toBe(155);
    expect(transportCalls).toBe(1);

    // Second identical call hits reusable cache without invoking OpenRouter again
    const second = await executeAITask(
      {
        userId: studentActor.userId,
        taskType: 'tutor',
        variables: {
          language: 'bn',
          depth: 'intermediate',
          curriculumContext: 'BD-NCTB > HSC > Physics',
          topicTitle: "Newton's Laws of Motion",
          userPrompt: 'Explain F = ma in Bangla.',
        },
      },
      aiRepo,
      mockTransport,
    );

    expect(second.cached).toBe(true);
    expect(transportCalls).toBe(1);

    const dashboard = await getAdminAIUsageDashboard(adminActor, { page: 1, limit: 10 }, aiRepo);
    expect(dashboard.summary.totalRequests).toBe(2);
    expect(dashboard.summary.cachedCount).toBe(1);
    expect(dashboard.summary.totalTokens).toBe(155);
  });

  it('validates structured AI outputs with Zod and performs bounded repair retries on malformed JSON (FR-AI-006)', async () => {
    let callCount = 0;
    const mockTransport = async (
      req: OpenRouterCompletionRequest,
    ): Promise<OpenRouterCompletionResponse> => {
      callCount += 1;
      if (callCount === 1) {
        // Attempt 1: returns invalid quiz question (correctOptionIds 'Z' is out of bounds)
        return {
          content: JSON.stringify({
            title: 'Broken Quiz',
            questions: [
              {
                questionType: 'single_mcq',
                difficulty: 'medium',
                promptText: 'What is the SI unit of force?',
                options: [
                  { id: 'A', text: 'Newton' },
                  { id: 'B', text: 'Joule' },
                ],
                correctOptionIds: ['Z'],
                explanation: 'Newton is kg·m/s².',
                points: 1,
              },
            ],
          }),
          modelId: req.model,
          promptTokens: 80,
          completionTokens: 60,
          totalTokens: 140,
        };
      }

      // Attempt 2: receives SCHEMA REPAIR REQUIRED prompt and returns valid JSON
      expect(req.messages[1]?.content).toContain('[SCHEMA REPAIR REQUIRED]');
      return {
        content: JSON.stringify({
          title: 'HSC Mechanics Practice Quiz',
          questions: [
            {
              questionType: 'single_mcq',
              difficulty: 'medium',
              promptText: 'What is the SI unit of force?',
              options: [
                { id: 'A', text: 'Newton' },
                { id: 'B', text: 'Joule' },
              ],
              correctOptionIds: ['A'],
              explanation: '1 Newton = 1 kg·m/s².',
              points: 1,
            },
          ],
        }),
        modelId: req.model,
        promptTokens: 95,
        completionTokens: 70,
        totalTokens: 165,
      };
    };

    const result = await executeStructuredAITask(
      {
        userId: studentActor.userId,
        taskType: 'quiz_generation',
        schema: structuredQuizOutputSchema,
        variables: {
          topicTitle: "Newton's Laws of Motion",
          curriculumContext: 'HSC Physics Ch 4',
          difficulty: 'medium',
          questionCount: 1,
          language: 'en',
          userPrompt: 'Focus on SI units',
        },
      },
      aiRepo,
      mockTransport,
    );

    expect(result.attemptsUsed).toBe(2);
    expect(result.data.questions).toHaveLength(1);
    expect(result.data.questions[0]?.correctOptionIds).toEqual(['A']);
  });

  it('routes to configured fallback models on primary model failure and redacts secrets from error logs (FR-AI-002, FR-AI-005)', async () => {
    await updateAdminAIConfig(
      adminActor,
      {
        taskModels: { explanation: 'primary-model/unavailable' },
        fallbackModels: ['openrouter/free-fallback'],
      },
      aiRepo,
    );

    const modelsTried: string[] = [];
    const mockTransport = async (
      req: OpenRouterCompletionRequest,
    ): Promise<OpenRouterCompletionResponse> => {
      modelsTried.push(req.model);
      if (req.model === 'primary-model/unavailable') {
        throw new Error('Provider 503 with key sk-or-v1-secret999888777 and Bearer secretToken123');
      }
      return {
        content: 'Fallback model explanation content.',
        modelId: req.model,
        promptTokens: 50,
        completionTokens: 50,
        totalTokens: 100,
      };
    };

    const res = await executeAITask(
      {
        userId: studentActor.userId,
        taskType: 'explanation',
        variables: {
          topicTitle: 'Carnot Cycle',
          curriculumContext: 'HSC Thermodynamics',
          materialType: 'topic_explanation',
          language: 'en',
          depth: 'intermediate',
          userPrompt: 'Explain efficiency formula',
        },
      },
      aiRepo,
      mockTransport,
    );

    expect(modelsTried).toEqual(['primary-model/unavailable', 'openrouter/free-fallback']);
    expect(res.fallbackUsed).toBe(true);
    expect(res.modelId).toBe('openrouter/free-fallback');

    const redacted = sanitizeProviderError(
      new Error('Failed with sk-or-v1-abcdef123456 and Bearer mySecretJwt'),
    );
    expect(redacted).not.toContain('sk-or-v1-abcdef123456');
    expect(redacted).not.toContain('mySecretJwt');
    expect(redacted).toContain('[REDACTED_OPENROUTER_KEY]');
  });

  it('enforces per-student daily AI request quotas and logs rate_limited events (FR-AI-007, FR-AI-009)', async () => {
    await updateAdminAIConfig(
      adminActor,
      {
        dailyRequestLimitPerStudent: 2,
        enableResponseCaching: false,
      },
      aiRepo,
    );

    const mockTransport = async (
      req: OpenRouterCompletionRequest,
    ): Promise<OpenRouterCompletionResponse> => ({
      content: 'Tutor reply',
      modelId: req.model,
      promptTokens: 20,
      completionTokens: 20,
      totalTokens: 40,
    });

    await executeAITask(
      {
        userId: studentActor.userId,
        taskType: 'tutor',
        variables: { userPrompt: 'Q1', language: 'en', depth: 'beginner' },
      },
      aiRepo,
      mockTransport,
    );
    await executeAITask(
      {
        userId: studentActor.userId,
        taskType: 'tutor',
        variables: { userPrompt: 'Q2', language: 'en', depth: 'beginner' },
      },
      aiRepo,
      mockTransport,
    );

    // 3rd request exceeds dailyRequestLimitPerStudent = 2
    await expect(
      executeAITask(
        {
          userId: studentActor.userId,
          taskType: 'tutor',
          variables: { userPrompt: 'Q3', language: 'en', depth: 'beginner' },
        },
        aiRepo,
        mockTransport,
      ),
    ).rejects.toMatchObject({ statusCode: 429, code: 'RATE_LIMITED' });

    const usage = await getAdminAIUsageDashboard(
      adminActor,
      { status: 'rate_limited', page: 1, limit: 10 },
      aiRepo,
    );
    expect(usage.logs).toHaveLength(1);
    expect(usage.logs[0]?.status).toBe('rate_limited');
  });

  it('supports SSE streaming and enforces RBAC on admin AI config, prompt versioning, and usage endpoints', async () => {
    // Student blocked from admin AI config & prompt management
    await expect(getAdminAIConfig(studentActor, aiRepo)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(listAdminPromptTemplates(studentActor, undefined, aiRepo)).rejects.toMatchObject({
      statusCode: 403,
    });

    // Admin publishes a new versioned prompt template
    const upserted = await upsertAdminPromptTemplate(
      adminActor,
      {
        taskType: 'tutor',
        name: 'LearnMate Contextual AI Subject Tutor v2',
        systemPrompt: 'You are LearnMate Tutor v2 ({{language}}, {{depth}}).',
        userPromptTemplate: 'Topic: {{topicTitle}} — Question: {{userPrompt}}',
        temperature: 0.35,
        maxOutputTokens: 1600,
        isActive: true,
      },
      aiRepo,
    );
    expect(upserted.template.version).toBe(2);

    // Stream AI task using the newly published v2 prompt template
    const { stream, result } = await streamAITask(
      {
        userId: studentActor.userId,
        taskType: 'tutor',
        variables: {
          language: 'en',
          depth: 'advanced',
          topicTitle: 'Boolean Algebra',
          userPrompt: "Prove De Morgan's first law.",
        },
      },
      aiRepo,
      async (req) => {
        expect(req.messages[0]?.content).toContain('LearnMate Tutor v2');
        return {
          content: "De Morgan's First Law states that NOT(A AND B) = (NOT A) OR (NOT B).",
          modelId: req.model,
          promptTokens: 30,
          completionTokens: 25,
          totalTokens: 55,
        };
      },
    );

    expect(result.content).toContain("De Morgan's First Law");
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let combinedSse = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      combinedSse += decoder.decode(value);
    }
    expect(combinedSse).toContain('data: {"chunk":');
    expect(combinedSse).toContain('"done":true');
  });
});
