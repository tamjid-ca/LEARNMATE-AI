/**
 * LearnMate AI — Document Management & Grounded RAG Service
 * Implements SRS Section 4.9 (FR-DOC-001..011), Section 4.13 (FR-AI-008), and ADR-005/007.
 */

import {
  getOpenRouterTransport,
  type OpenRouterTransport,
} from '../../lib/ai/openrouter-client.ts';
import { AppError } from '../../lib/api/errors.ts';
import {
  assertResourceOwnership,
  requireAuth,
  type AuthenticatedActor,
} from '../../lib/auth/rbac.ts';
import { canTransitionDocumentStatus } from '../../lib/jobs/processor.ts';
import { validateUploadDescriptor } from '../../lib/storage/adapter.ts';
import {
  structuredFlashcardOutputSchema,
  structuredMaterialOutputSchema,
  structuredQuizOutputSchema,
} from '../../lib/validators/ai.ts';
import {
  documentDerivativeSchema,
  documentQaSchema,
  uploadDocumentPayloadSchema,
} from '../../lib/validators/documents.ts';
import {
  getActiveAIRepository,
  type AIRepository,
} from '../ai/ai-repository.ts';
import {
  executeAITask,
  executeStructuredAITask,
} from '../ai/ai-service.ts';
import {
  getActiveFlashcardRepository,
  type FlashcardDeckRecord,
  type FlashcardRecord,
  type FlashcardRepository,
} from '../flashcards/flashcard-repository.ts';
import {
  getActiveQuizRepository,
  type QuestionRecord,
  type QuizRecord,
  type QuizRepository,
} from '../quizzes/quiz-repository.ts';
import {
  getActiveTutorMaterialsRepository,
  type GeneratedContentRecord,
  type TutorMaterialsRepository,
} from '../tutor/tutor-materials-repository.ts';
import {
  getActiveDocumentRepository,
  type DocumentChunkRecord,
  type DocumentRepository,
  type UploadedMaterialRecord,
} from './document-repository.ts';
import {
  extractReadableTextFromDocument,
  formatSandboxedDocumentContext,
  getActiveRetrievalMode,
  rankAndRetrieveChunks,
  splitDocumentIntoChunks,
  type RankedChunkCitation,
} from './rag-engine.ts';

export async function listDocumentsForStudent(
  actor: AuthenticatedActor | null | undefined,
  docRepo: DocumentRepository = getActiveDocumentRepository(),
): Promise<{
  documents: UploadedMaterialRecord[];
  retrievalMode: 'keyword' | 'vector_hybrid';
}> {
  const verified = requireAuth(actor);
  const documents = await docRepo.listMaterialsByUser(verified.userId);
  return {
    documents,
    retrievalMode: getActiveRetrievalMode(),
  };
}

export async function uploadAndProcessDocumentForStudent(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  docRepo: DocumentRepository = getActiveDocumentRepository(),
): Promise<{
  document: UploadedMaterialRecord;
  chunks: DocumentChunkRecord[];
  retrievalMode: 'keyword' | 'vector_hybrid';
}> {
  const verified = requireAuth(actor);
  const parsed = uploadDocumentPayloadSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid document upload payload', parsed.error.flatten());
  }

  const data = parsed.data;
  const format = validateUploadDescriptor({
    originalFilename: data.originalFilename,
    mimeType: data.mimeType,
    byteSize: data.byteSize,
    ownerUserId: verified.userId,
  });

  const storageProvider = process.env.BLOB_READ_WRITE_TOKEN?.trim()
    ? 'vercel_blob'
    : 'local_disk';
  const storageKey = `users/${verified.userId}/docs/${Date.now()}-${data.originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  let material = await docRepo.createMaterial({
    userId: verified.userId,
    subjectId: data.subjectId,
    chapterId: data.chapterId,
    topicId: data.topicId,
    title: data.title,
    originalFilename: data.originalFilename,
    format,
    mimeType: data.mimeType,
    byteSize: data.byteSize,
    storageProvider,
    storageKey,
    processingStatus: 'uploaded',
    extractionStatus: 'pending',
    chunkingStatus: 'pending',
    chunkCount: 0,
    retryCount: 0,
  });

  try {
    // Transition uploaded -> extracting
    if (canTransitionDocumentStatus(material.processingStatus, 'extracting')) {
      material =
        (await docRepo.updateMaterial(material.id, {
          processingStatus: 'extracting',
        })) ?? material;
    }

    const extracted = extractReadableTextFromDocument(format, data.rawContent);
    if (!extracted.text || extracted.text.length < 3) {
      throw AppError.validation('Could not extract readable text from uploaded document');
    }

    // Transition extracting -> chunking
    if (canTransitionDocumentStatus(material.processingStatus, 'chunking')) {
      material =
        (await docRepo.updateMaterial(material.id, {
          processingStatus: 'chunking',
          extractionStatus: 'completed',
          pageCount: extracted.pageCount,
        })) ?? material;
    }

    const drafts = splitDocumentIntoChunks(extracted.text);
    if (drafts.length === 0) {
      throw AppError.validation('Document produced zero searchable chunks');
    }

    // Transition chunking -> indexing
    if (canTransitionDocumentStatus(material.processingStatus, 'indexing')) {
      material =
        (await docRepo.updateMaterial(material.id, {
          processingStatus: 'indexing',
          chunkingStatus: 'completed',
        })) ?? material;
    }

    const createdChunks = await docRepo.createChunksBulk(
      drafts.map((d) => ({
        materialId: material.id,
        userId: verified.userId,
        chunkIndex: d.chunkIndex,
        pageNumber: d.pageNumber,
        sectionHeading: d.sectionHeading,
        content: d.content,
        tokenEstimate: d.tokenEstimate,
        keywords: d.keywords,
      })),
    );

    // Transition indexing -> ready
    if (canTransitionDocumentStatus(material.processingStatus, 'ready')) {
      material =
        (await docRepo.updateMaterial(material.id, {
          processingStatus: 'ready',
          chunkCount: createdChunks.length,
        })) ?? material;
    }

    return {
      document: material,
      chunks: createdChunks,
      retrievalMode: getActiveRetrievalMode(),
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Document ingestion failed';
    await docRepo.updateMaterial(material.id, {
      processingStatus: 'failed',
      extractionStatus: 'failed',
      chunkingStatus: 'failed',
      errorMessage: errMsg,
      retryCount: material.retryCount + 1,
    });
    throw err;
  }
}

export async function getDocumentDetailForStudent(
  actor: AuthenticatedActor | null | undefined,
  documentId: string,
  docRepo: DocumentRepository = getActiveDocumentRepository(),
): Promise<{
  document: UploadedMaterialRecord;
  chunks: DocumentChunkRecord[];
  retrievalMode: 'keyword' | 'vector_hybrid';
}> {
  const verified = requireAuth(actor);
  const document = await docRepo.findMaterialById(documentId);
  if (!document || document.processingStatus === 'deleted') {
    throw AppError.notFound('Uploaded document');
  }
  assertResourceOwnership(verified, document.userId);

  const chunks = await docRepo.listChunksByMaterial(document.id, verified.userId);
  return {
    document,
    chunks,
    retrievalMode: getActiveRetrievalMode(),
  };
}

export async function deleteDocumentForStudent(
  actor: AuthenticatedActor | null | undefined,
  documentId: string,
  docRepo: DocumentRepository = getActiveDocumentRepository(),
): Promise<{
  deleted: true;
  documentId: string;
  purgedChunkCount: number;
}> {
  const verified = requireAuth(actor);
  const existing = await docRepo.findMaterialById(documentId);
  if (!existing || existing.processingStatus === 'deleted') {
    throw AppError.notFound('Uploaded document');
  }
  assertResourceOwnership(verified, existing.userId);

  const purgedChunkCount = await docRepo.deleteChunksByMaterial(
    existing.id,
    verified.userId,
  );
  await docRepo.updateMaterial(existing.id, {
    processingStatus: 'deleted',
    chunkCount: 0,
    deletedAt: new Date(),
  });

  return {
    deleted: true,
    documentId: existing.id,
    purgedChunkCount,
  };
}

export async function answerQuestionFromDocumentForStudent(
  actor: AuthenticatedActor | null | undefined,
  documentId: string,
  rawInput: unknown,
  docRepo: DocumentRepository = getActiveDocumentRepository(),
  aiRepo: AIRepository = getActiveAIRepository(),
  transport: OpenRouterTransport = getOpenRouterTransport(),
): Promise<{
  answer: string;
  citations: RankedChunkCitation[];
  retrievalMode: 'keyword' | 'vector_hybrid';
  modelId: string;
}> {
  const verified = requireAuth(actor);
  const document = await docRepo.findMaterialById(documentId);
  if (!document || document.processingStatus === 'deleted') {
    throw AppError.notFound('Uploaded document');
  }
  assertResourceOwnership(verified, document.userId);

  if (document.processingStatus !== 'ready') {
    throw AppError.validation(
      `Document is not ready for Q&A (status: ${document.processingStatus})`,
    );
  }

  const parsed = documentQaSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid document Q&A payload', parsed.error.flatten());
  }

  const chunks = await docRepo.listChunksByMaterial(document.id, verified.userId);
  if (chunks.length === 0) {
    throw AppError.validation('No indexed chunks available for this document');
  }

  const ranked = rankAndRetrieveChunks(
    chunks,
    parsed.data.question,
    parsed.data.topK,
  );
  const { contextXml, citations } = formatSandboxedDocumentContext(ranked);

  const aiResult = await executeAITask(
    {
      userId: verified.userId,
      taskType: 'document_qa',
      variables: {
        documentContext: contextXml,
        language: parsed.data.language,
        userPrompt: parsed.data.question,
      },
      bypassCache: true,
    },
    aiRepo,
    transport,
  );

  return {
    answer: aiResult.content,
    citations,
    retrievalMode: getActiveRetrievalMode(),
    modelId: aiResult.modelId,
  };
}

export async function generateDerivativeFromDocumentForStudent(
  actor: AuthenticatedActor | null | undefined,
  documentId: string,
  rawInput: unknown,
  docRepo: DocumentRepository = getActiveDocumentRepository(),
  tutorMaterialsRepo: TutorMaterialsRepository = getActiveTutorMaterialsRepository(),
  quizRepo: QuizRepository = getActiveQuizRepository(),
  flashcardRepo: FlashcardRepository = getActiveFlashcardRepository(),
  aiRepo: AIRepository = getActiveAIRepository(),
  transport: OpenRouterTransport = getOpenRouterTransport(),
): Promise<{
  target: 'summary' | 'notes' | 'quiz' | 'flashcards';
  citations: RankedChunkCitation[];
  material?: GeneratedContentRecord;
  quiz?: QuizRecord;
  questions?: QuestionRecord[];
  deck?: FlashcardDeckRecord;
  cards?: FlashcardRecord[];
}> {
  const verified = requireAuth(actor);
  const document = await docRepo.findMaterialById(documentId);
  if (!document || document.processingStatus === 'deleted') {
    throw AppError.notFound('Uploaded document');
  }
  assertResourceOwnership(verified, document.userId);

  const parsed = documentDerivativeSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation(
      'Invalid document derivative generation payload',
      parsed.error.flatten(),
    );
  }

  const data = parsed.data;
  const chunks = await docRepo.listChunksByMaterial(document.id, verified.userId);
  if (chunks.length === 0) {
    throw AppError.validation('No indexed chunks available for this document');
  }

  const ranked = rankAndRetrieveChunks(chunks, document.title, 6);
  const { contextXml, citations } = formatSandboxedDocumentContext(ranked);

  if (data.target === 'summary' || data.target === 'notes') {
    const materialType =
      data.materialType ??
      (data.target === 'summary' ? 'chapter_summary' : 'detailed_notes');

    const aiGenerated = await executeStructuredAITask(
      {
        userId: verified.userId,
        taskType: data.target === 'summary' ? 'summarization' : 'explanation',
        schema: structuredMaterialOutputSchema,
        variables: {
          topicTitle: document.title,
          curriculumContext: `Uploaded Document: ${document.originalFilename}`,
          materialType,
          language: data.language,
          depth: data.explanationDepth,
          userPrompt: `Ground all notes strictly in these sandboxed document chunks:\n${contextXml}`,
        },
        bypassCache: true,
      },
      aiRepo,
      transport,
    );

    const createdMaterial = await tutorMaterialsRepo.createMaterial({
      userId: verified.userId,
      subjectId: document.subjectId,
      chapterId: document.chapterId,
      topicId: document.topicId,
      uploadedMaterialId: document.id,
      materialType,
      title: aiGenerated.data.title,
      contentMarkdown: `# ${aiGenerated.data.title}\n\n> ${aiGenerated.data.summary}\n\n${aiGenerated.data.contentMarkdown}`,
      structuredSections: {
        summary: aiGenerated.data.summary,
        keyTakeaways: aiGenerated.data.keyTakeaways,
        formulasOrDefinitions: aiGenerated.data.formulasOrDefinitions ?? [],
        practicePrompts: aiGenerated.data.practicePrompts ?? [],
      },
      language: data.language,
      explanationDepth: data.explanationDepth,
      modelId: aiGenerated.modelId,
      isSavedToLibrary: true,
      isPublishedByAdmin: false,
      isFlagged: false,
    });

    return {
      target: data.target,
      citations,
      material: createdMaterial,
    };
  }

  if (data.target === 'quiz') {
    const aiQuiz = await executeStructuredAITask(
      {
        userId: verified.userId,
        taskType: 'quiz_generation',
        schema: structuredQuizOutputSchema,
        variables: {
          topicTitle: document.title,
          curriculumContext: `Uploaded Document: ${document.originalFilename}`,
          difficulty: data.difficulty,
          questionCount: data.itemCount,
          language: data.language,
          userPrompt: `Ground all quiz questions strictly in these sandboxed document chunks:\n${contextXml}`,
        },
        bypassCache: true,
      },
      aiRepo,
      transport,
    );

    const createdQuiz = await quizRepo.createQuiz({
      userId: verified.userId,
      title: aiQuiz.data.title,
      mode: 'practice',
      subjectId: document.subjectId,
      chapterId: document.chapterId,
      topicIds: document.topicId ? [document.topicId] : [],
      uploadedMaterialId: document.id,
      difficulty: data.difficulty,
      questionTypes: ['single_mcq'],
      questionCount: aiQuiz.data.questions.length,
      negativeMarkingFactor: 0,
      feedbackTiming: 'after_submission',
      language: data.language,
      modelId: aiQuiz.modelId,
    });

    const createdQuestions = await quizRepo.createQuestionsBulk(
      aiQuiz.data.questions.map((q, idx) => ({
        quizId: createdQuiz.id,
        userId: verified.userId,
        topicId: document.topicId,
        order: idx + 1,
        questionType: q.questionType,
        difficulty: q.difficulty,
        promptText: q.promptText,
        options: q.options ?? [],
        correctOptionIds: q.correctOptionIds ?? [],
        expectedShortAnswerRubric: q.expectedShortAnswerRubric,
        explanation: q.explanation,
        points: q.points ?? 1,
      })),
    );

    return {
      target: 'quiz',
      citations,
      quiz: createdQuiz,
      questions: createdQuestions,
    };
  }

  // target === 'flashcards'
  const aiCards = await executeStructuredAITask(
    {
      userId: verified.userId,
      taskType: 'flashcards',
      schema: structuredFlashcardOutputSchema,
      variables: {
        topicTitle: document.title,
        curriculumContext: `Uploaded Document: ${document.originalFilename}`,
        language: data.language,
        userPrompt: `Generate ${data.itemCount} flashcards grounded strictly in these sandboxed document chunks:\n${contextXml}`,
      },
      bypassCache: true,
    },
    aiRepo,
    transport,
  );

  const createdDeck = await flashcardRepo.createDeck({
    userId: verified.userId,
    title: aiCards.data.title,
    description: `Generated from uploaded document: ${document.originalFilename}`,
    subjectId: document.subjectId,
    chapterId: document.chapterId,
    topicId: document.topicId,
    uploadedMaterialId: document.id,
    cardCount: aiCards.data.cards.length,
    language: data.language,
  });

  const now = new Date();
  const createdCards = await flashcardRepo.createCardsBulk(
    aiCards.data.cards.map((c) => ({
      deckId: createdDeck.id,
      userId: verified.userId,
      topicId: document.topicId,
      front: c.front,
      back: c.back,
      hint: c.hint,
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      nextReviewAt: now,
      masteryState: 'new',
    })),
  );

  return {
    target: 'flashcards',
    citations,
    deck: createdDeck,
    cards: createdCards,
  };
}
