/**
 * LearnMate AI — Smart Flashcards & Deterministic SM-2 Spaced Repetition Service
 * Implements SRS Section 4.7 (FR-FLASH-001..010) and ADR-006.
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
import { structuredFlashcardOutputSchema } from '../../lib/validators/ai.ts';
import {
  createFlashcardDeckSchema,
  createFlashcardItemSchema,
  generateFlashcardsSchema,
  reviewQueueQuerySchema,
  submitFlashcardReviewSchema,
  updateFlashcardItemSchema,
  type FlashcardMasteryState,
} from '../../lib/validators/flashcards.ts';
import type { FlashcardRating } from '../../types/domain.ts';
import {
  getActiveAIRepository,
  type AIRepository,
} from '../ai/ai-repository.ts';
import { executeStructuredAITask } from '../ai/ai-service.ts';
import {
  getActiveCurriculumRepository,
  type CurriculumRepository,
} from '../curriculum/curriculum-repository.ts';
import {
  getActiveTutorMaterialsRepository,
  type TutorMaterialsRepository,
} from '../tutor/tutor-materials-repository.ts';
import {
  getActiveFlashcardRepository,
  type FlashcardDeckRecord,
  type FlashcardRecord,
  type FlashcardRepository,
  type ReviewLogRecord,
} from './flashcard-repository.ts';

export interface SM2ScheduleComputation {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: Date;
  masteryState: FlashcardMasteryState;
}

const MIN_EASE_FACTOR = 1.3;
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Deterministic SM-2-inspired spaced repetition scheduler (FR-FLASH-006..009, ADR-006).
 */
export function computeNextSM2Schedule(input: {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  rating: FlashcardRating;
  now?: Date;
}): SM2ScheduleComputation {
  const now = input.now ?? new Date();
  let easeFactor = Math.max(MIN_EASE_FACTOR, input.easeFactor || 2.5);
  let intervalDays = Math.max(0, input.intervalDays || 0);
  let repetitions = Math.max(0, input.repetitions || 0);
  let masteryState: FlashcardMasteryState = 'learning';
  let nextReviewAt: Date;

  switch (input.rating) {
    case 'again': {
      repetitions = 0;
      intervalDays = 0;
      easeFactor = Math.max(MIN_EASE_FACTOR, Number((easeFactor - 0.2).toFixed(2)));
      masteryState = 'difficult';
      nextReviewAt = new Date(now.getTime() + 10 * MS_PER_MINUTE);
      break;
    }
    case 'hard': {
      repetitions += 1;
      intervalDays =
        intervalDays === 0 ? 1 : Math.max(1, Math.round(intervalDays * 1.2));
      easeFactor = Math.max(MIN_EASE_FACTOR, Number((easeFactor - 0.15).toFixed(2)));
      masteryState = easeFactor < 1.85 ? 'difficult' : 'learning';
      nextReviewAt = new Date(now.getTime() + intervalDays * MS_PER_DAY);
      break;
    }
    case 'good': {
      repetitions += 1;
      if (repetitions === 1) {
        intervalDays = 1;
      } else if (repetitions === 2) {
        intervalDays = 6;
      } else {
        intervalDays = Math.max(1, Math.round(intervalDays * easeFactor));
      }
      easeFactor = Math.max(MIN_EASE_FACTOR, Number(easeFactor.toFixed(2)));
      masteryState =
        intervalDays >= 18 || repetitions >= 4 ? 'mastered' : 'review';
      nextReviewAt = new Date(now.getTime() + intervalDays * MS_PER_DAY);
      break;
    }
    case 'easy': {
      repetitions += 1;
      if (repetitions === 1) {
        intervalDays = 4;
      } else if (repetitions === 2) {
        intervalDays = 10;
      } else {
        intervalDays = Math.max(1, Math.round(intervalDays * easeFactor * 1.3));
      }
      easeFactor = Number((easeFactor + 0.15).toFixed(2));
      masteryState =
        intervalDays >= 10 || repetitions >= 2 ? 'mastered' : 'review';
      nextReviewAt = new Date(now.getTime() + intervalDays * MS_PER_DAY);
      break;
    }
  }

  return {
    easeFactor,
    intervalDays,
    repetitions,
    nextReviewAt,
    masteryState,
  };
}

export interface FlashcardQueueBreakdown {
  dueCount: number;
  upcomingCount: number;
  masteredCount: number;
  difficultCount: number;
  totalCount: number;
}

export function categorizeFlashcards(
  cards: FlashcardRecord[],
  now: Date = new Date(),
): FlashcardQueueBreakdown {
  let dueCount = 0;
  let upcomingCount = 0;
  let masteredCount = 0;
  let difficultCount = 0;

  for (const c of cards) {
    if (c.nextReviewAt.getTime() <= now.getTime()) {
      dueCount += 1;
    } else {
      upcomingCount += 1;
    }
    if (c.masteryState === 'mastered') {
      masteredCount += 1;
    }
    if (c.masteryState === 'difficult') {
      difficultCount += 1;
    }
  }

  return {
    dueCount,
    upcomingCount,
    masteredCount,
    difficultCount,
    totalCount: cards.length,
  };
}

export async function listDecksForStudent(
  actor: AuthenticatedActor | null | undefined,
  repo: FlashcardRepository = getActiveFlashcardRepository(),
  now: Date = new Date(),
): Promise<{
  decks: Array<FlashcardDeckRecord & FlashcardQueueBreakdown>;
  overallSummary: FlashcardQueueBreakdown;
}> {
  const verified = requireAuth(actor);
  const [decks, allCards] = await Promise.all([
    repo.listDecksByUser(verified.userId),
    repo.listCardsByUser(verified.userId),
  ]);

  const cardsByDeck = new Map<string, FlashcardRecord[]>();
  for (const card of allCards) {
    const bucket = cardsByDeck.get(card.deckId) ?? [];
    bucket.push(card);
    cardsByDeck.set(card.deckId, bucket);
  }

  const enrichedDecks = decks.map((deck) => {
    const deckCards = cardsByDeck.get(deck.id) ?? [];
    return {
      ...deck,
      cardCount: deckCards.length,
      ...categorizeFlashcards(deckCards, now),
    };
  });

  return {
    decks: enrichedDecks,
    overallSummary: categorizeFlashcards(allCards, now),
  };
}

export async function createManualDeckForStudent(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  repo: FlashcardRepository = getActiveFlashcardRepository(),
): Promise<{
  deck: FlashcardDeckRecord;
  cards: FlashcardRecord[];
}> {
  const verified = requireAuth(actor);
  const parsed = createFlashcardDeckSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid flashcard deck payload', parsed.error.flatten());
  }

  const data = parsed.data;
  const now = new Date();
  const deck = await repo.createDeck({
    userId: verified.userId,
    title: data.title,
    description: data.description,
    subjectId: data.subjectId,
    chapterId: data.chapterId,
    topicId: data.topicId,
    uploadedMaterialId: data.uploadedMaterialId,
    cardCount: data.cards.length,
    language: data.language,
  });

  const cards = await repo.createCardsBulk(
    data.cards.map((item) => ({
      deckId: deck.id,
      userId: verified.userId,
      topicId: data.topicId,
      front: item.front,
      back: item.back,
      hint: item.hint,
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      nextReviewAt: now,
      masteryState: 'new',
    })),
  );

  return { deck, cards };
}

export async function generateAIFlashcardsForStudent(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  repo: FlashcardRepository = getActiveFlashcardRepository(),
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
  tutorMaterialsRepo: TutorMaterialsRepository = getActiveTutorMaterialsRepository(),
  aiRepo: AIRepository = getActiveAIRepository(),
  transport: OpenRouterTransport = getOpenRouterTransport(),
): Promise<{
  deck: FlashcardDeckRecord;
  cards: FlashcardRecord[];
}> {
  const verified = requireAuth(actor);
  const parsed = generateFlashcardsSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid AI flashcard generation payload', parsed.error.flatten());
  }

  const data = parsed.data;
  let existingDeck: FlashcardDeckRecord | null = null;
  if (data.deckId) {
    existingDeck = await repo.findDeckById(data.deckId);
    if (!existingDeck) {
      throw AppError.notFound('Flashcard deck');
    }
    assertResourceOwnership(verified, existingDeck.userId);
  }

  const topic = data.topicId
    ? await curriculumRepo.findTopicById(data.topicId)
    : existingDeck?.topicId
      ? await curriculumRepo.findTopicById(existingDeck.topicId)
      : null;

  const effectiveChapterId = topic?.chapterId ?? data.chapterId ?? existingDeck?.chapterId;
  const effectiveSubjectId = topic?.subjectId ?? data.subjectId ?? existingDeck?.subjectId;

  const [chapter, subject] = await Promise.all([
    effectiveChapterId ? curriculumRepo.findChapterById(effectiveChapterId) : Promise.resolve(null),
    effectiveSubjectId ? curriculumRepo.findSubjectById(effectiveSubjectId) : Promise.resolve(null),
  ]);

  let sourceNotesText = '';
  if (data.generatedContentId) {
    const savedNote = await tutorMaterialsRepo.findMaterialById(data.generatedContentId);
    if (!savedNote) {
      throw AppError.notFound('Saved study note');
    }
    assertResourceOwnership(verified, savedNote.userId);
    sourceNotesText = `Study Note (${savedNote.title}):\n${savedNote.contentMarkdown.slice(0, 1800)}`;
  }

  const topicTitle =
    topic?.title ?? chapter?.title ?? subject?.name ?? existingDeck?.title ?? 'Academic Study Deck';
  const contextParts: string[] = [];
  if (subject) contextParts.push(`Subject: ${subject.name} (${subject.code})`);
  if (chapter) contextParts.push(`Chapter ${chapter.chapterNumber}: ${chapter.title}`);
  if (topic) {
    contextParts.push(`Topic: ${topic.title} (${topic.code})`);
    if (topic.keyConcepts.length > 0) {
      contextParts.push(`Key Concepts: ${topic.keyConcepts.join(', ')}`);
    }
  }

  const userPromptParts = [`Generate ${data.cardCount} active-recall flashcards.`];
  if (sourceNotesText) userPromptParts.push(sourceNotesText);
  if (data.customInstructions) userPromptParts.push(data.customInstructions);

  const aiGenerated = await executeStructuredAITask(
    {
      userId: verified.userId,
      taskType: 'flashcards',
      schema: structuredFlashcardOutputSchema,
      variables: {
        topicTitle,
        curriculumContext: contextParts.join(' | ') || 'General Academic Syllabus',
        language: data.language,
        userPrompt: userPromptParts.join('\n'),
      },
      bypassCache: true,
    },
    aiRepo,
    transport,
  );

  const now = new Date();
  let targetDeck = existingDeck;
  if (!targetDeck) {
    targetDeck = await repo.createDeck({
      userId: verified.userId,
      title: data.title || aiGenerated.data.title,
      description: `AI-generated active-recall flashcards for ${topicTitle}`,
      subjectId: effectiveSubjectId,
      chapterId: effectiveChapterId,
      topicId: topic?.id ?? data.topicId,
      uploadedMaterialId: data.uploadedMaterialId,
      cardCount: aiGenerated.data.cards.length,
      language: data.language,
    });
  }

  const createdCards = await repo.createCardsBulk(
    aiGenerated.data.cards.map((c) => ({
      deckId: targetDeck!.id,
      userId: verified.userId,
      topicId: topic?.id ?? targetDeck!.topicId,
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

  if (existingDeck) {
    const allDeckCards = await repo.listCardsByDeck(existingDeck.id, verified.userId);
    targetDeck =
      (await repo.updateDeck(existingDeck.id, { cardCount: allDeckCards.length })) ??
      existingDeck;
  }

  return {
    deck: targetDeck,
    cards: createdCards,
  };
}

export async function getDeckDetailForStudent(
  actor: AuthenticatedActor | null | undefined,
  deckId: string,
  repo: FlashcardRepository = getActiveFlashcardRepository(),
  now: Date = new Date(),
): Promise<{
  deck: FlashcardDeckRecord;
  cards: FlashcardRecord[];
  summary: FlashcardQueueBreakdown;
}> {
  const verified = requireAuth(actor);
  const deck = await repo.findDeckById(deckId);
  if (!deck) {
    throw AppError.notFound('Flashcard deck');
  }
  assertResourceOwnership(verified, deck.userId);

  const cards = await repo.listCardsByDeck(deck.id, verified.userId);
  return {
    deck: { ...deck, cardCount: cards.length },
    cards,
    summary: categorizeFlashcards(cards, now),
  };
}

export async function deleteDeckForStudent(
  actor: AuthenticatedActor | null | undefined,
  deckId: string,
  repo: FlashcardRepository = getActiveFlashcardRepository(),
): Promise<{ deleted: true; deckId: string }> {
  const verified = requireAuth(actor);
  const deck = await repo.findDeckById(deckId);
  if (!deck) {
    throw AppError.notFound('Flashcard deck');
  }
  assertResourceOwnership(verified, deck.userId);

  await repo.deleteDeckAndCards(deck.id, verified.userId);
  return { deleted: true, deckId: deck.id };
}

export async function addCardToDeckForStudent(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  repo: FlashcardRepository = getActiveFlashcardRepository(),
): Promise<{ card: FlashcardRecord; deck: FlashcardDeckRecord }> {
  const verified = requireAuth(actor);
  const parsed = createFlashcardItemSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid flashcard item payload', parsed.error.flatten());
  }

  const deck = await repo.findDeckById(parsed.data.deckId);
  if (!deck) {
    throw AppError.notFound('Flashcard deck');
  }
  assertResourceOwnership(verified, deck.userId);

  const [created] = await repo.createCardsBulk([
    {
      deckId: deck.id,
      userId: verified.userId,
      topicId: parsed.data.topicId ?? deck.topicId,
      front: parsed.data.front,
      back: parsed.data.back,
      hint: parsed.data.hint,
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      nextReviewAt: new Date(),
      masteryState: 'new',
    },
  ]);

  const updatedDeck =
    (await repo.updateDeck(deck.id, { cardCount: deck.cardCount + 1 })) ?? deck;

  return { card: created!, deck: updatedDeck };
}

export async function updateFlashcardForStudent(
  actor: AuthenticatedActor | null | undefined,
  cardId: string,
  rawInput: unknown,
  repo: FlashcardRepository = getActiveFlashcardRepository(),
): Promise<{ card: FlashcardRecord }> {
  const verified = requireAuth(actor);
  const existing = await repo.findCardById(cardId);
  if (!existing) {
    throw AppError.notFound('Flashcard');
  }
  assertResourceOwnership(verified, existing.userId);

  const parsed = updateFlashcardItemSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid flashcard update payload', parsed.error.flatten());
  }

  const updated = await repo.updateCard(cardId, parsed.data);
  if (!updated) {
    throw AppError.notFound('Flashcard');
  }
  return { card: updated };
}

export async function deleteFlashcardForStudent(
  actor: AuthenticatedActor | null | undefined,
  cardId: string,
  repo: FlashcardRepository = getActiveFlashcardRepository(),
): Promise<{ deleted: true; cardId: string }> {
  const verified = requireAuth(actor);
  const existing = await repo.findCardById(cardId);
  if (!existing) {
    throw AppError.notFound('Flashcard');
  }
  assertResourceOwnership(verified, existing.userId);

  await repo.deleteCard(cardId, verified.userId);
  const deck = await repo.findDeckById(existing.deckId);
  if (deck) {
    await repo.updateDeck(deck.id, {
      cardCount: Math.max(0, deck.cardCount - 1),
    });
  }

  return { deleted: true, cardId };
}

export async function getReviewQueueForStudent(
  actor: AuthenticatedActor | null | undefined,
  rawQuery: unknown,
  repo: FlashcardRepository = getActiveFlashcardRepository(),
  now: Date = new Date(),
): Promise<{
  cards: FlashcardRecord[];
  summary: FlashcardQueueBreakdown;
  recentLogs: ReviewLogRecord[];
}> {
  const verified = requireAuth(actor);
  const parsed = reviewQueueQuerySchema.safeParse(rawQuery ?? {});
  if (!parsed.success) {
    throw AppError.validation('Invalid review queue query', parsed.error.flatten());
  }

  const { deckId, filter, limit } = parsed.data;
  if (deckId) {
    const deck = await repo.findDeckById(deckId);
    if (!deck) {
      throw AppError.notFound('Flashcard deck');
    }
    assertResourceOwnership(verified, deck.userId);
  }

  const [allCards, recentLogs] = await Promise.all([
    repo.listCardsByUser(verified.userId, deckId),
    repo.listReviewLogsByUser(verified.userId, 25),
  ]);

  const summary = categorizeFlashcards(allCards, now);
  const filtered = allCards.filter((card) => {
    switch (filter) {
      case 'due':
        return card.nextReviewAt.getTime() <= now.getTime();
      case 'upcoming':
        return card.nextReviewAt.getTime() > now.getTime();
      case 'mastered':
        return card.masteryState === 'mastered';
      case 'difficult':
        return card.masteryState === 'difficult';
      case 'all':
      default:
        return true;
    }
  });

  return {
    cards: filtered.slice(0, limit),
    summary,
    recentLogs,
  };
}

export async function submitCardReviewForStudent(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  repo: FlashcardRepository = getActiveFlashcardRepository(),
  now: Date = new Date(),
): Promise<{
  card: FlashcardRecord;
  reviewLog: ReviewLogRecord;
}> {
  const verified = requireAuth(actor);
  const parsed = submitFlashcardReviewSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid flashcard review payload', parsed.error.flatten());
  }

  const card = await repo.findCardById(parsed.data.flashcardId);
  if (!card) {
    throw AppError.notFound('Flashcard');
  }
  assertResourceOwnership(verified, card.userId);

  const schedule = computeNextSM2Schedule({
    easeFactor: card.easeFactor,
    intervalDays: card.intervalDays,
    repetitions: card.repetitions,
    rating: parsed.data.rating,
    now,
  });

  const updatedCard =
    (await repo.updateCard(card.id, {
      easeFactor: schedule.easeFactor,
      intervalDays: schedule.intervalDays,
      repetitions: schedule.repetitions,
      nextReviewAt: schedule.nextReviewAt,
      lastReviewedAt: now,
      lastRating: parsed.data.rating,
      masteryState: schedule.masteryState,
    })) ?? card;

  const reviewLog = await repo.createReviewLog({
    userId: verified.userId,
    deckId: card.deckId,
    flashcardId: card.id,
    rating: parsed.data.rating,
    previousIntervalDays: card.intervalDays,
    newIntervalDays: schedule.intervalDays,
    previousEaseFactor: card.easeFactor,
    newEaseFactor: schedule.easeFactor,
    nextReviewAt: schedule.nextReviewAt,
    reviewedAt: now,
    durationMs: parsed.data.durationMs,
  });

  return {
    card: updatedCard,
    reviewLog,
  };
}
