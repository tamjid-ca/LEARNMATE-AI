import { beforeEach, describe, expect, it } from 'vitest';
import type {
  OpenRouterCompletionRequest,
  OpenRouterCompletionResponse,
} from '../src/lib/ai/openrouter-client.ts';
import {
  InMemoryAIRepository,
  setActiveAIRepository,
} from '../src/modules/ai/ai-repository.ts';
import {
  InMemoryCurriculumRepository,
  setActiveCurriculumRepository,
} from '../src/modules/curriculum/curriculum-repository.ts';
import { SEED_IDS } from '../src/modules/curriculum/seed-data.ts';
import {
  InMemoryTutorMaterialsRepository,
  setActiveTutorMaterialsRepository,
} from '../src/modules/tutor/tutor-materials-repository.ts';
import {
  createConversationForStudent,
  deleteConversationForStudent,
  deleteLearningMaterialForStudent,
  generateLearningMaterialForStudent,
  getConversationDetailForStudent,
  listConversationsForStudent,
  listLearningMaterialsForStudent,
  listModerationMaterialsForAdmin,
  moderateMaterialForAdmin,
  rateTutorMessageForStudent,
  sendTutorMessageForStudent,
  updateConversationForStudent,
  updateLearningMaterialForStudent,
} from '../src/modules/tutor/tutor-materials-service.ts';

describe('State 06 — AI Tutor & Learning Materials Gate', () => {
  let tutorRepo: InMemoryTutorMaterialsRepository;
  let curriculumRepo: InMemoryCurriculumRepository;
  let aiRepo: InMemoryAIRepository;

  const studentA = {
    userId: '66f000000000000000000901',
    email: 'student.a@example.com',
    role: 'student' as const,
  };

  const studentB = {
    userId: '66f000000000000000000902',
    email: 'student.b@example.com',
    role: 'student' as const,
  };

  const adminActor = {
    userId: '66f000000000000000000903',
    email: 'admin.moderator@learnmate.ai',
    role: 'admin' as const,
  };

  const physicsTopicId = SEED_IDS.topics.newtonsLaws;

  beforeEach(() => {
    tutorRepo = new InMemoryTutorMaterialsRepository();
    curriculumRepo = new InMemoryCurriculumRepository();
    aiRepo = new InMemoryAIRepository();

    setActiveTutorMaterialsRepository(tutorRepo);
    setActiveCurriculumRepository(curriculumRepo);
    setActiveAIRepository(aiRepo);
  });

  it('creates curriculum-contextual tutor conversations, preserves multi-turn history, attaches source references, and supports SSE streaming (FR-TUTOR-001..011)', async () => {
    const capturedRequests: OpenRouterCompletionRequest[] = [];
    const mockTransport = async (
      req: OpenRouterCompletionRequest,
    ): Promise<OpenRouterCompletionResponse> => {
      capturedRequests.push(req);
      return {
        content:
          capturedRequests.length === 1
            ? 'Step 1: Identify net external force. Step 2: Apply F = ma.'
            : 'নিউটনের দ্বিতীয় সূত্র থেকে ত্বরণ a = F / m নির্ণয় করা যায়।',
        modelId: req.model,
        promptTokens: 90,
        completionTokens: 45,
        totalTokens: 135,
      };
    };

    // Create conversation with initial message in step_by_step style
    const created = await createConversationForStudent(
      studentA,
      {
        topicId: physicsTopicId,
        language: 'en',
        explanationDepth: 'intermediate',
        responseStyle: 'step_by_step',
        initialMessage: 'How do I calculate acceleration when mass and force are given?',
      },
      tutorRepo,
      curriculumRepo,
      aiRepo,
      mockTransport,
    );

    expect(created.conversation.topicId).toBe(physicsTopicId);
    expect(created.conversation.messageCount).toBe(2);
    expect(created.messages).toHaveLength(2);
    expect(created.messages[0]?.role).toBe('user');
    expect(created.messages[1]?.role).toBe('assistant');
    expect(created.messages[1]?.sourceReferences.length).toBeGreaterThan(0);
    expect(capturedRequests[0]?.messages[1]?.content).toContain('Step-by-Step Solution');

    // Follow-up turn in Bangla with SSE streaming enabled; verify prior history is included
    const secondTurn = await sendTutorMessageForStudent(
      studentA,
      created.conversation.id,
      {
        content: 'এখন বাংলায় সংক্ষেপে বলো।',
        language: 'bn',
        explanationDepth: 'beginner',
        responseStyle: 'revision',
        stream: true,
      },
      tutorRepo,
      curriculumRepo,
      aiRepo,
      mockTransport,
    );

    expect(secondTurn.conversation.language).toBe('bn');
    expect(secondTurn.conversation.explanationDepth).toBe('beginner');
    expect(secondTurn.conversation.messageCount).toBe(4);
    expect(secondTurn.assistantMessage.content).toContain('a = F / m');
    expect(secondTurn.stream).toBeDefined();

    // Verify multi-turn conversation history was passed to OpenRouter on turn 2
    expect(capturedRequests[1]?.messages.length).toBeGreaterThanOrEqual(4);
  });

  it('supports conversation rename, message feedback & flagging to feedbackReports, and cascading deletion (FR-TUTOR-008, FR-TUTOR-012)', async () => {
    const mockTransport = async (
      req: OpenRouterCompletionRequest,
    ): Promise<OpenRouterCompletionResponse> => ({
      content: 'Tutor response for feedback test.',
      modelId: req.model,
      promptTokens: 30,
      completionTokens: 20,
      totalTokens: 50,
    });

    const { conversation, messages } = await createConversationForStudent(
      studentA,
      {
        topicId: physicsTopicId,
        language: 'en',
        explanationDepth: 'intermediate',
        initialMessage: 'Explain impulse and momentum.',
      },
      tutorRepo,
      curriculumRepo,
      aiRepo,
      mockTransport,
    );

    const assistantMsg = messages[1]!;

    // Rename conversation
    const renamed = await updateConversationForStudent(
      studentA,
      conversation.id,
      { title: 'HSC Physics: Impulse & Momentum Review' },
      tutorRepo,
    );
    expect(renamed.conversation.title).toBe('HSC Physics: Impulse & Momentum Review');

    // Flag assistant message and verify feedback report is recorded
    const rated = await rateTutorMessageForStudent(
      studentA,
      assistantMsg.id,
      {
        feedbackRating: 'flagged',
        reason: 'Formula sign convention needs clarification',
      },
      tutorRepo,
    );
    expect(rated.message.feedbackRating).toBe('flagged');
    expect(tutorRepo.feedbackReports).toHaveLength(1);
    expect(tutorRepo.feedbackReports[0]?.targetType).toBe('message');
    expect(tutorRepo.feedbackReports[0]?.targetId).toBe(assistantMsg.id);

    // Delete conversation and verify messages are purged
    await deleteConversationForStudent(studentA, conversation.id, tutorRepo);
    const remaining = await listConversationsForStudent(studentA, true, tutorRepo);
    expect(remaining.conversations).toHaveLength(0);
  });

  it('generates structured learning materials across catalog types, caches saved materials, and regenerates when requested (FR-MAT-002, FR-MAT-006)', async () => {
    let aiCallCount = 0;
    const mockTransport = async (
      req: OpenRouterCompletionRequest,
    ): Promise<OpenRouterCompletionResponse> => {
      aiCallCount += 1;
      return {
        content: JSON.stringify({
          title: `Newton's Laws Formula Sheet (v${aiCallCount})`,
          summary: 'Essential mechanics equations for HSC Physics Paper 1.',
          contentMarkdown: '### Core Equations\n- Force: $F = ma$\n- Impulse: $J = F \\Delta t$',
          keyTakeaways: [
            'Net force is directly proportional to rate of change of momentum.',
            'Action and reaction act on different bodies.',
          ],
          formulasOrDefinitions: [
            { term: 'Second Law', detail: 'F = dp/dt = ma' },
            { term: 'Impulse', detail: 'J = Δp = m(v - u)' },
          ],
          practicePrompts: [
            'Calculate the acceleration of a 5 kg mass under a 20 N net force.',
          ],
        }),
        modelId: req.model,
        promptTokens: 110,
        completionTokens: 95,
        totalTokens: 205,
      };
    };

    const first = await generateLearningMaterialForStudent(
      studentA,
      {
        topicId: physicsTopicId,
        materialType: 'formula_sheet',
        language: 'en',
        explanationDepth: 'intermediate',
        saveToLibrary: true,
        regenerate: false,
      },
      tutorRepo,
      curriculumRepo,
      aiRepo,
      mockTransport,
    );

    expect(first.reusedCache).toBe(false);
    expect(first.material.materialType).toBe('formula_sheet');
    expect(first.material.title).toContain('v1');
    expect(first.material.contentMarkdown).toContain('## Key Takeaways');
    expect(first.material.contentMarkdown).toContain('## Formulas & Important Definitions');
    expect(first.material.structuredSections?.formulasOrDefinitions).toHaveLength(2);
    expect(aiCallCount).toBe(1);

    // Duplicate generation without regenerate=true returns the cached library record
    const cached = await generateLearningMaterialForStudent(
      studentA,
      {
        topicId: physicsTopicId,
        materialType: 'formula_sheet',
        language: 'en',
        explanationDepth: 'intermediate',
        saveToLibrary: true,
        regenerate: false,
      },
      tutorRepo,
      curriculumRepo,
      aiRepo,
      mockTransport,
    );
    expect(cached.reusedCache).toBe(true);
    expect(cached.material.id).toBe(first.material.id);
    expect(aiCallCount).toBe(1);

    // Regenerate=true bypasses cache and creates a fresh study note
    const regenerated = await generateLearningMaterialForStudent(
      studentA,
      {
        topicId: physicsTopicId,
        materialType: 'formula_sheet',
        language: 'en',
        explanationDepth: 'intermediate',
        saveToLibrary: true,
        regenerate: true,
      },
      tutorRepo,
      curriculumRepo,
      aiRepo,
      mockTransport,
    );
    expect(regenerated.reusedCache).toBe(false);
    expect(regenerated.material.title).toContain('v2');
    expect(aiCallCount).toBe(2);
  });

  it('enforces personal library CRUD, ownership isolation between students, and admin content moderation (FR-MAT-005, FR-ADMIN-005)', async () => {
    const mockTransport = async (
      req: OpenRouterCompletionRequest,
    ): Promise<OpenRouterCompletionResponse> => ({
      content: JSON.stringify({
        title: 'Chapter Summary: Newtonian Mechanics',
        summary: 'High-yield revision notes for HSC exam preparation.',
        contentMarkdown: 'Newtonian mechanics links force, mass, and motion.',
        keyTakeaways: ['Inertia depends on mass.'],
        formulasOrDefinitions: [{ term: 'Momentum', detail: 'p = mv' }],
        practicePrompts: ['State the law of conservation of linear momentum.'],
      }),
      modelId: req.model,
      promptTokens: 80,
      completionTokens: 60,
      totalTokens: 140,
    });

    const generated = await generateLearningMaterialForStudent(
      studentA,
      {
        topicId: physicsTopicId,
        materialType: 'chapter_summary',
        language: 'en',
        explanationDepth: 'intermediate',
        saveToLibrary: true,
        regenerate: false,
      },
      tutorRepo,
      curriculumRepo,
      aiRepo,
      mockTransport,
    );

    const convA = await createConversationForStudent(
      studentA,
      { topicId: physicsTopicId, language: 'en', explanationDepth: 'intermediate' },
      tutorRepo,
      curriculumRepo,
      aiRepo,
      mockTransport,
    );

    // Student B cannot access or modify Student A's conversation or study material
    await expect(
      getConversationDetailForStudent(studentB, convA.conversation.id, tutorRepo),
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      updateLearningMaterialForStudent(
        studentB,
        generated.material.id,
        { title: 'Unauthorized Edit' },
        tutorRepo,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      deleteLearningMaterialForStudent(studentB, generated.material.id, tutorRepo),
    ).rejects.toMatchObject({ statusCode: 403 });

    // Student A updates their own note and flags it for review
    const updated = await updateLearningMaterialForStudent(
      studentA,
      generated.material.id,
      {
        title: 'Edited Summary: Newtonian Mechanics + Personal Notes',
        isFlagged: true,
      },
      tutorRepo,
    );
    expect(updated.material.title).toContain('Personal Notes');
    expect(updated.material.isFlagged).toBe(true);

    // Student A is blocked from admin content moderation endpoint
    await expect(listModerationMaterialsForAdmin(studentA, tutorRepo)).rejects.toMatchObject({
      statusCode: 403,
    });

    // Admin reviews and publishes the material while clearing the flag
    const adminQueue = await listModerationMaterialsForAdmin(adminActor, tutorRepo);
    expect(adminQueue.materials.length).toBeGreaterThanOrEqual(1);

    const moderated = await moderateMaterialForAdmin(
      adminActor,
      {
        materialId: generated.material.id,
        isFlagged: false,
        isPublishedByAdmin: true,
      },
      tutorRepo,
    );
    expect(moderated.material.isFlagged).toBe(false);
    expect(moderated.material.isPublishedByAdmin).toBe(true);

    // Student A lists and deletes their material
    const listed = await listLearningMaterialsForStudent(
      studentA,
      { materialType: 'chapter_summary', savedOnly: true, page: 1, limit: 10 },
      tutorRepo,
    );
    expect(listed.materials).toHaveLength(1);

    await deleteLearningMaterialForStudent(studentA, generated.material.id, tutorRepo);
    const afterDelete = await listLearningMaterialsForStudent(
      studentA,
      { page: 1, limit: 10 },
      tutorRepo,
    );
    expect(afterDelete.materials).toHaveLength(0);
  });
});
