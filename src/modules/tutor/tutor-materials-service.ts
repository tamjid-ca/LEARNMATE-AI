/**
 * LearnMate AI — AI Subject Tutor & Learning Materials Service
 * Implements SRS Section 4.4 (FR-TUTOR-001..012), Section 4.5 (FR-MAT-001..007),
 * and Section 4.12 (FR-ADMIN-005, FR-ADMIN-012).
 */

import { LEARNING_MATERIAL_CATALOG, TUTOR_STYLE_OPTIONS } from '../../config/learning-materials-catalog.ts';
import {
  getOpenRouterTransport,
  type OpenRouterMessage,
  type OpenRouterTransport,
} from '../../lib/ai/openrouter-client.ts';
import { AppError } from '../../lib/api/errors.ts';
import { buildPaginationMeta, type PaginationMeta } from '../../lib/api/response.ts';
import {
  assertResourceOwnership,
  requireAuth,
  requirePermission,
  type AuthenticatedActor,
} from '../../lib/auth/rbac.ts';
import { structuredMaterialOutputSchema } from '../../lib/validators/ai.ts';
import {
  adminModerateMaterialSchema,
  createConversationSchema,
  generateMaterialSchema,
  materialFilterQuerySchema,
  rateTutorMessageSchema,
  sendTutorMessageSchema,
  updateConversationSchema,
  updateMaterialSchema,
  type TutorResponseStyle,
} from '../../lib/validators/tutor-materials.ts';
import type { AITaskType, MaterialType } from '../../types/domain.ts';
import {
  getActiveAIRepository,
  type AIRepository,
} from '../ai/ai-repository.ts';
import {
  computeAICacheKey,
  executeAITask,
  executeStructuredAITask,
  streamAITask,
} from '../ai/ai-service.ts';
import {
  getActiveCurriculumRepository,
  type CurriculumRepository,
} from '../curriculum/curriculum-repository.ts';
import {
  getActiveTutorMaterialsRepository,
  type ConversationRecord,
  type GeneratedContentRecord,
  type MessageRecord,
  type SourceReferenceItem,
  type TutorMaterialsRepository,
} from './tutor-materials-repository.ts';

interface ResolvedAcademicContext {
  curriculumContextText: string;
  topicTitle: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  sourceReferences: SourceReferenceItem[];
}

async function resolveAcademicContext(
  ids: { subjectId?: string; chapterId?: string; topicId?: string },
  curriculumRepo: CurriculumRepository,
): Promise<ResolvedAcademicContext> {
  const topic = ids.topicId ? await curriculumRepo.findTopicById(ids.topicId) : null;
  const effectiveChapterId = topic?.chapterId ?? ids.chapterId;
  const effectiveSubjectId = topic?.subjectId ?? ids.subjectId;

  const [chapter, subject] = await Promise.all([
    effectiveChapterId ? curriculumRepo.findChapterById(effectiveChapterId) : Promise.resolve(null),
    effectiveSubjectId ? curriculumRepo.findSubjectById(effectiveSubjectId) : Promise.resolve(null),
  ]);

  const parts: string[] = [];
  if (subject) parts.push(`Subject: ${subject.name} (${subject.code})`);
  if (chapter) parts.push(`Chapter ${chapter.chapterNumber}: ${chapter.title}`);
  if (topic) {
    parts.push(`Topic: ${topic.title} (${topic.code})`);
    if (topic.keyConcepts.length > 0) {
      parts.push(`Key Concepts: ${topic.keyConcepts.join(', ')}`);
    }
    if (topic.learningObjectives.length > 0) {
      parts.push(`Objectives: ${topic.learningObjectives.join('; ')}`);
    }
  }

  const sourceReferences: SourceReferenceItem[] = (topic?.curriculumReferences ?? []).map(
    (ref) => ({
      title: ref,
      locator: topic ? `${topic.code} · ${topic.title}` : undefined,
    }),
  );

  return {
    curriculumContextText: parts.length > 0 ? parts.join(' | ') : 'General Academic Study',
    topicTitle: topic?.title ?? chapter?.title ?? subject?.name ?? 'General Academic Inquiry',
    subjectId: effectiveSubjectId,
    chapterId: effectiveChapterId,
    topicId: topic?.id ?? ids.topicId,
    sourceReferences,
  };
}

function buildTutorStyleDirective(style: TutorResponseStyle): string {
  const found = TUTOR_STYLE_OPTIONS.find((s) => s.value === style);
  switch (style) {
    case 'step_by_step':
      return '[Pedagogical Mode: Step-by-Step Solution — Break the reasoning or calculation into numbered steps with justification.]';
    case 'examples':
      return '[Pedagogical Mode: Worked Examples — Provide concrete academic and numerical examples with solutions.]';
    case 'definitions':
      return '[Pedagogical Mode: Key Definitions — Provide concise, exam-ready textbook definitions and key terms.]';
    case 'comparison':
      return '[Pedagogical Mode: Comparison — Contrast the concepts clearly using structured bullet points or a markdown table.]';
    case 'application':
      return '[Pedagogical Mode: Practical Application — Explain real-world scientific, engineering, or policy applications.]';
    case 'revision':
      return '[Pedagogical Mode: Revision Guidance — Highlight high-yield exam takeaways, common pitfalls, and quick recall tips.]';
    case 'follow_up':
      return '[Pedagogical Mode: Follow-Up Practice — Explain the concept and end with 2 self-check follow-up questions for the student.]';
    case 'explanation':
    default:
      return `[Pedagogical Mode: ${found?.labelEn ?? 'Concept Explanation'}]`;
  }
}

export async function listConversationsForStudent(
  actor: AuthenticatedActor | null | undefined,
  includeArchived = false,
  repo: TutorMaterialsRepository = getActiveTutorMaterialsRepository(),
): Promise<{ conversations: ConversationRecord[] }> {
  const verified = requireAuth(actor);
  const conversations = await repo.listConversationsByUser(verified.userId, includeArchived);
  return { conversations };
}

export async function createConversationForStudent(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  repo: TutorMaterialsRepository = getActiveTutorMaterialsRepository(),
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
  aiRepo: AIRepository = getActiveAIRepository(),
  transport: OpenRouterTransport = getOpenRouterTransport(),
): Promise<{
  conversation: ConversationRecord;
  messages: MessageRecord[];
}> {
  const verified = requireAuth(actor);
  const parsed = createConversationSchema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    throw AppError.validation('Invalid conversation creation payload', parsed.error.flatten());
  }

  const data = parsed.data;
  const context = await resolveAcademicContext(
    {
      subjectId: data.subjectId,
      chapterId: data.chapterId,
      topicId: data.topicId,
    },
    curriculumRepo,
  );

  const defaultTitle =
    data.title ||
    (data.initialMessage
      ? data.initialMessage.slice(0, 64)
      : `${context.topicTitle} — Tutor Session`);

  const conversation = await repo.createConversation({
    userId: verified.userId,
    title: defaultTitle,
    subjectId: context.subjectId,
    chapterId: context.chapterId,
    topicId: context.topicId,
    uploadedMaterialId: data.uploadedMaterialId,
    language: data.language,
    explanationDepth: data.explanationDepth,
    messageCount: 0,
    lastMessageAt: new Date(),
    isArchived: false,
  });

  if (data.initialMessage) {
    const turn = await sendTutorMessageForStudent(
      verified,
      conversation.id,
      {
        content: data.initialMessage,
        language: data.language,
        explanationDepth: data.explanationDepth,
        responseStyle: data.responseStyle ?? 'explanation',
        stream: false,
      },
      repo,
      curriculumRepo,
      aiRepo,
      transport,
    );
    return {
      conversation: turn.conversation,
      messages: [turn.userMessage, turn.assistantMessage],
    };
  }

  return {
    conversation,
    messages: [],
  };
}

export async function getConversationDetailForStudent(
  actor: AuthenticatedActor | null | undefined,
  conversationId: string,
  repo: TutorMaterialsRepository = getActiveTutorMaterialsRepository(),
): Promise<{
  conversation: ConversationRecord;
  messages: MessageRecord[];
}> {
  const verified = requireAuth(actor);
  const conversation = await repo.findConversationById(conversationId);
  if (!conversation) {
    throw AppError.notFound('Conversation');
  }
  assertResourceOwnership(verified, conversation.userId);
  const messages = await repo.listMessagesByConversation(conversation.id, verified.userId);
  return { conversation, messages };
}

export async function updateConversationForStudent(
  actor: AuthenticatedActor | null | undefined,
  conversationId: string,
  rawInput: unknown,
  repo: TutorMaterialsRepository = getActiveTutorMaterialsRepository(),
): Promise<{ conversation: ConversationRecord }> {
  const verified = requireAuth(actor);
  const existing = await repo.findConversationById(conversationId);
  if (!existing) {
    throw AppError.notFound('Conversation');
  }
  assertResourceOwnership(verified, existing.userId);

  const parsed = updateConversationSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid conversation update payload', parsed.error.flatten());
  }

  const updated = await repo.updateConversation(conversationId, parsed.data);
  if (!updated) {
    throw AppError.notFound('Conversation');
  }
  return { conversation: updated };
}

export async function deleteConversationForStudent(
  actor: AuthenticatedActor | null | undefined,
  conversationId: string,
  repo: TutorMaterialsRepository = getActiveTutorMaterialsRepository(),
): Promise<{ deleted: true; conversationId: string }> {
  const verified = requireAuth(actor);
  const existing = await repo.findConversationById(conversationId);
  if (!existing) {
    throw AppError.notFound('Conversation');
  }
  assertResourceOwnership(verified, existing.userId);

  await repo.deleteConversationAndMessages(conversationId, verified.userId);
  return { deleted: true, conversationId };
}

export async function sendTutorMessageForStudent(
  actor: AuthenticatedActor | null | undefined,
  conversationId: string,
  rawInput: unknown,
  repo: TutorMaterialsRepository = getActiveTutorMaterialsRepository(),
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
  aiRepo: AIRepository = getActiveAIRepository(),
  transport: OpenRouterTransport = getOpenRouterTransport(),
): Promise<{
  conversation: ConversationRecord;
  userMessage: MessageRecord;
  assistantMessage: MessageRecord;
  stream?: ReadableStream<Uint8Array>;
}> {
  const verified = requireAuth(actor);
  const conversation = await repo.findConversationById(conversationId);
  if (!conversation) {
    throw AppError.notFound('Conversation');
  }
  assertResourceOwnership(verified, conversation.userId);

  const parsed = sendTutorMessageSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid tutor message payload', parsed.error.flatten());
  }

  const { content, responseStyle, stream } = parsed.data;
  const activeLanguage = parsed.data.language ?? conversation.language;
  const activeDepth = parsed.data.explanationDepth ?? conversation.explanationDepth;

  const priorMessages = await repo.listMessagesByConversation(conversation.id, verified.userId);
  const historyWindow: OpenRouterMessage[] = priorMessages.slice(-8).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const context = await resolveAcademicContext(
    {
      subjectId: conversation.subjectId,
      chapterId: conversation.chapterId,
      topicId: conversation.topicId,
    },
    curriculumRepo,
  );

  const userMessage = await repo.createMessage({
    conversationId: conversation.id,
    userId: verified.userId,
    role: 'user',
    content,
    isDocumentGrounded: Boolean(conversation.uploadedMaterialId),
    sourceReferences: [],
  });

  const styleDirective = buildTutorStyleDirective(responseStyle);
  const taskInput = {
    userId: verified.userId,
    taskType: 'tutor' as const,
    conversationHistory: historyWindow,
    variables: {
      language: activeLanguage,
      depth: activeDepth,
      curriculumContext: context.curriculumContextText,
      topicTitle: context.topicTitle,
      userPrompt: `${styleDirective}\n\n${content}`,
    },
  };

  let aiResultContent: string;
  let aiModelId: string;
  let sseStream: ReadableStream<Uint8Array> | undefined;

  if (stream) {
    const streamed = await streamAITask(taskInput, aiRepo, transport);
    aiResultContent = streamed.result.content;
    aiModelId = streamed.result.modelId;
    sseStream = streamed.stream;
  } else {
    const executed = await executeAITask(taskInput, aiRepo, transport);
    aiResultContent = executed.content;
    aiModelId = executed.modelId;
  }

  const assistantMessage = await repo.createMessage({
    conversationId: conversation.id,
    userId: verified.userId,
    role: 'assistant',
    content: aiResultContent,
    modelId: aiModelId,
    isDocumentGrounded: Boolean(conversation.uploadedMaterialId),
    sourceReferences: context.sourceReferences,
  });

  const updatedConversation =
    (await repo.updateConversation(conversation.id, {
      language: activeLanguage,
      explanationDepth: activeDepth,
      messageCount: priorMessages.length + 2,
      lastMessageAt: new Date(),
    })) ?? conversation;

  return {
    conversation: updatedConversation,
    userMessage,
    assistantMessage,
    ...(sseStream ? { stream: sseStream } : {}),
  };
}

export async function rateTutorMessageForStudent(
  actor: AuthenticatedActor | null | undefined,
  messageId: string,
  rawInput: unknown,
  repo: TutorMaterialsRepository = getActiveTutorMaterialsRepository(),
): Promise<{ message: MessageRecord }> {
  const verified = requireAuth(actor);
  const existing = await repo.findMessageById(messageId);
  if (!existing) {
    throw AppError.notFound('Message');
  }
  assertResourceOwnership(verified, existing.userId);

  const parsed = rateTutorMessageSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid message feedback payload', parsed.error.flatten());
  }

  const updated = await repo.updateMessageFeedback(messageId, parsed.data.feedbackRating);
  if (!updated) {
    throw AppError.notFound('Message');
  }

  if (parsed.data.feedbackRating === 'flagged') {
    await repo.recordFeedbackReport({
      userId: verified.userId,
      targetType: 'message',
      targetId: messageId,
      reason: parsed.data.reason || 'Student flagged AI tutor response for review',
    });
  }

  return { message: updated };
}

/**
 * AI Learning Materials Generator & Personal Library Service (FR-MAT-001..007)
 */
function resolveTaskTypeForMaterial(materialType: MaterialType): AITaskType {
  const explanationTypes: readonly MaterialType[] = [
    'topic_explanation',
    'key_concepts',
    'examples',
    'conceptual_faq',
  ];
  return explanationTypes.includes(materialType) ? 'explanation' : 'summarization';
}

function formatStructuredMaterialMarkdown(
  materialType: MaterialType,
  structured: {
    title: string;
    summary: string;
    contentMarkdown: string;
    keyTakeaways: string[];
    formulasOrDefinitions?: Array<{ term: string; detail: string }>;
    practicePrompts?: string[];
  },
): string {
  const catalogEntry = LEARNING_MATERIAL_CATALOG.find((m) => m.type === materialType);
  const blocks: string[] = [
    `# ${structured.title}`,
    `> **${catalogEntry?.labelEn ?? materialType}**: ${structured.summary}`,
    '',
    structured.contentMarkdown,
  ];

  if (structured.keyTakeaways.length > 0) {
    blocks.push('', '## Key Takeaways');
    for (const takeaway of structured.keyTakeaways) {
      blocks.push(`- ${takeaway}`);
    }
  }

  const formulas = structured.formulasOrDefinitions ?? [];
  if (formulas.length > 0) {
    blocks.push('', '## Formulas & Important Definitions');
    for (const item of formulas) {
      blocks.push(`- **${item.term}**: ${item.detail}`);
    }
  }

  const prompts = structured.practicePrompts ?? [];
  if (prompts.length > 0) {
    blocks.push('', '## Self-Check Practice Questions');
    for (const prompt of prompts) {
      blocks.push(`1. ${prompt}`);
    }
  }

  return blocks.join('\n');
}

export async function generateLearningMaterialForStudent(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  repo: TutorMaterialsRepository = getActiveTutorMaterialsRepository(),
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
  aiRepo: AIRepository = getActiveAIRepository(),
  transport: OpenRouterTransport = getOpenRouterTransport(),
): Promise<{ material: GeneratedContentRecord; reusedCache: boolean }> {
  const verified = requireAuth(actor);
  const parsed = generateMaterialSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid learning material generation payload', parsed.error.flatten());
  }

  const data = parsed.data;
  const topic = await curriculumRepo.findTopicById(data.topicId);
  if (!topic) {
    throw AppError.notFound('Topic');
  }

  const context = await resolveAcademicContext(
    {
      subjectId: data.subjectId ?? topic.subjectId,
      chapterId: data.chapterId ?? topic.chapterId,
      topicId: topic.id,
    },
    curriculumRepo,
  );

  const taskType = resolveTaskTypeForMaterial(data.materialType);
  const variables = {
    topicTitle: context.topicTitle,
    curriculumContext: context.curriculumContextText,
    materialType: data.materialType,
    language: data.language,
    depth: data.explanationDepth,
    userPrompt: data.customInstructions || 'Follow official board and exam syllabus standards.',
  };

  const cacheKey = computeAICacheKey(taskType, variables);
  if (!data.regenerate && !data.customInstructions) {
    const existingSaved = await repo.findMaterialByCacheKey(verified.userId, cacheKey);
    if (existingSaved) {
      return {
        material: existingSaved,
        reusedCache: true,
      };
    }
  }

  const aiGenerated = await executeStructuredAITask(
    {
      userId: verified.userId,
      taskType,
      schema: structuredMaterialOutputSchema,
      variables,
      cacheKey,
      bypassCache: data.regenerate,
    },
    aiRepo,
    transport,
  );

  const fullMarkdown = formatStructuredMaterialMarkdown(data.materialType, aiGenerated.data);

  const created = await repo.createMaterial({
    userId: verified.userId,
    subjectId: context.subjectId,
    chapterId: context.chapterId,
    topicId: context.topicId,
    uploadedMaterialId: data.uploadedMaterialId,
    materialType: data.materialType,
    title: aiGenerated.data.title,
    contentMarkdown: fullMarkdown,
    structuredSections: {
      summary: aiGenerated.data.summary,
      keyTakeaways: aiGenerated.data.keyTakeaways,
      formulasOrDefinitions: aiGenerated.data.formulasOrDefinitions ?? [],
      practicePrompts: aiGenerated.data.practicePrompts ?? [],
    },
    language: data.language,
    explanationDepth: data.explanationDepth,
    modelId: aiGenerated.modelId,
    isSavedToLibrary: data.saveToLibrary,
    isPublishedByAdmin: false,
    isFlagged: false,
    cacheKey,
  });

  return {
    material: created,
    reusedCache: aiGenerated.cached,
  };
}

export async function listLearningMaterialsForStudent(
  actor: AuthenticatedActor | null | undefined,
  rawQuery: unknown,
  repo: TutorMaterialsRepository = getActiveTutorMaterialsRepository(),
): Promise<{ materials: GeneratedContentRecord[]; meta: PaginationMeta }> {
  const verified = requireAuth(actor);
  const parsed = materialFilterQuerySchema.safeParse(rawQuery ?? {});
  if (!parsed.success) {
    throw AppError.validation('Invalid material filter query', parsed.error.flatten());
  }

  const query = parsed.data;
  const result = await repo.listMaterialsByUser({
    userId: verified.userId,
    subjectId: query.subjectId,
    chapterId: query.chapterId,
    topicId: query.topicId,
    materialType: query.materialType,
    language: query.language,
    savedOnly: query.savedOnly,
    page: query.page,
    limit: query.limit,
  });

  return {
    materials: result.items,
    meta: buildPaginationMeta(query.page, query.limit, result.total),
  };
}

export async function getLearningMaterialForStudent(
  actor: AuthenticatedActor | null | undefined,
  materialId: string,
  repo: TutorMaterialsRepository = getActiveTutorMaterialsRepository(),
): Promise<{ material: GeneratedContentRecord }> {
  const verified = requireAuth(actor);
  const found = await repo.findMaterialById(materialId);
  if (!found) {
    throw AppError.notFound('Learning material');
  }
  assertResourceOwnership(verified, found.userId, true);
  return { material: found };
}

export async function updateLearningMaterialForStudent(
  actor: AuthenticatedActor | null | undefined,
  materialId: string,
  rawInput: unknown,
  repo: TutorMaterialsRepository = getActiveTutorMaterialsRepository(),
): Promise<{ material: GeneratedContentRecord }> {
  const verified = requireAuth(actor);
  const existing = await repo.findMaterialById(materialId);
  if (!existing) {
    throw AppError.notFound('Learning material');
  }
  assertResourceOwnership(verified, existing.userId);

  const parsed = updateMaterialSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid material update payload', parsed.error.flatten());
  }

  const updated = await repo.updateMaterial(materialId, parsed.data);
  if (!updated) {
    throw AppError.notFound('Learning material');
  }

  if (parsed.data.isFlagged) {
    await repo.recordFeedbackReport({
      userId: verified.userId,
      targetType: 'generated_content',
      targetId: materialId,
      reason: 'Student flagged generated study material for review',
    });
  }

  return { material: updated };
}

export async function deleteLearningMaterialForStudent(
  actor: AuthenticatedActor | null | undefined,
  materialId: string,
  repo: TutorMaterialsRepository = getActiveTutorMaterialsRepository(),
): Promise<{ deleted: true; materialId: string }> {
  const verified = requireAuth(actor);
  const existing = await repo.findMaterialById(materialId);
  if (!existing) {
    throw AppError.notFound('Learning material');
  }
  assertResourceOwnership(verified, existing.userId);

  await repo.deleteMaterial(materialId, verified.userId);
  return { deleted: true, materialId };
}

export async function listModerationMaterialsForAdmin(
  actor: AuthenticatedActor | null | undefined,
  repo: TutorMaterialsRepository = getActiveTutorMaterialsRepository(),
): Promise<{ materials: GeneratedContentRecord[] }> {
  requirePermission(actor, 'content:review');
  const materials = await repo.listAdminModerationMaterials(50);
  return { materials };
}

export async function moderateMaterialForAdmin(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  repo: TutorMaterialsRepository = getActiveTutorMaterialsRepository(),
): Promise<{ material: GeneratedContentRecord }> {
  requirePermission(actor, 'content:review');
  const parsed = adminModerateMaterialSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid content moderation payload', parsed.error.flatten());
  }

  const updated = await repo.updateMaterial(parsed.data.materialId, {
    ...(parsed.data.isFlagged !== undefined ? { isFlagged: parsed.data.isFlagged } : {}),
    ...(parsed.data.isPublishedByAdmin !== undefined
      ? { isPublishedByAdmin: parsed.data.isPublishedByAdmin }
      : {}),
  });
  if (!updated) {
    throw AppError.notFound('Learning material');
  }
  return { material: updated };
}
