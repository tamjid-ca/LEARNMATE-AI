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
  InMemoryFlashcardRepository,
  setActiveFlashcardRepository,
} from '../src/modules/flashcards/flashcard-repository.ts';
import {
  addCardToDeckForStudent,
  computeNextSM2Schedule,
  createManualDeckForStudent,
  deleteDeckForStudent,
  deleteFlashcardForStudent,
  generateAIFlashcardsForStudent,
  getDeckDetailForStudent,
  getReviewQueueForStudent,
  listDecksForStudent,
  submitCardReviewForStudent,
  updateFlashcardForStudent,
} from '../src/modules/flashcards/flashcard-service.ts';
import {
  InMemoryTutorMaterialsRepository,
  setActiveTutorMaterialsRepository,
} from '../src/modules/tutor/tutor-materials-repository.ts';

describe('State 08 — Flashcards & Spaced Repetition (SM-2) Gate', () => {
  let flashcardRepo: InMemoryFlashcardRepository;
  let curriculumRepo: InMemoryCurriculumRepository;
  let tutorMaterialsRepo: InMemoryTutorMaterialsRepository;
  let aiRepo: InMemoryAIRepository;

  const studentA = {
    userId: '66f000000000000000000b01',
    email: 'student.flash.a@example.com',
    role: 'student' as const,
  };

  const studentB = {
    userId: '66f000000000000000000b02',
    email: 'student.flash.b@example.com',
    role: 'student' as const,
  };

  const topicNewtonsLaws = SEED_IDS.topics.newtonsLaws;

  beforeEach(() => {
    flashcardRepo = new InMemoryFlashcardRepository();
    curriculumRepo = new InMemoryCurriculumRepository();
    tutorMaterialsRepo = new InMemoryTutorMaterialsRepository();
    aiRepo = new InMemoryAIRepository();

    setActiveFlashcardRepository(flashcardRepo);
    setActiveCurriculumRepository(curriculumRepo);
    setActiveTutorMaterialsRepository(tutorMaterialsRepo);
    setActiveAIRepository(aiRepo);
  });

  it('computes deterministic SM-2 schedules across Again, Hard, Good, and Easy ratings with easeFactor floor 1.3 (FR-FLASH-006..008)', () => {
    const baseNow = new Date('2026-03-01T10:00:00.000Z');

    // 1st review 'good' -> interval 1d, repetitions 1, EF 2.5
    const r1 = computeNextSM2Schedule({
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      rating: 'good',
      now: baseNow,
    });
    expect(r1.intervalDays).toBe(1);
    expect(r1.repetitions).toBe(1);
    expect(r1.easeFactor).toBe(2.5);
    expect(r1.masteryState).toBe('review');

    // 2nd review 'good' -> interval 6d, repetitions 2
    const r2 = computeNextSM2Schedule({
      easeFactor: r1.easeFactor,
      intervalDays: r1.intervalDays,
      repetitions: r1.repetitions,
      rating: 'good',
      now: baseNow,
    });
    expect(r2.intervalDays).toBe(6);
    expect(r2.repetitions).toBe(2);

    // 3rd review 'easy' -> interval round(6 * 2.5 * 1.3) = 20d, EF 2.65, mastered
    const r3 = computeNextSM2Schedule({
      easeFactor: r2.easeFactor,
      intervalDays: r2.intervalDays,
      repetitions: r2.repetitions,
      rating: 'easy',
      now: baseNow,
    });
    expect(r3.intervalDays).toBe(20);
    expect(r3.easeFactor).toBe(2.65);
    expect(r3.masteryState).toBe('mastered');

    // 'again' resets repetitions to 0, intervalDays to 0 (10-minute re-queue), and marks difficult
    const againSchedule = computeNextSM2Schedule({
      easeFactor: 1.35,
      intervalDays: 10,
      repetitions: 3,
      rating: 'again',
      now: baseNow,
    });
    expect(againSchedule.repetitions).toBe(0);
    expect(againSchedule.intervalDays).toBe(0);
    expect(againSchedule.easeFactor).toBe(1.3); // clamped at minimum 1.3
    expect(againSchedule.masteryState).toBe('difficult');
    expect(againSchedule.nextReviewAt.getTime() - baseNow.getTime()).toBe(10 * 60 * 1000);
  });

  it('generates AI flashcard decks from topics & study notes, supports manual deck/card CRUD, and updates deck counts (FR-FLASH-001..005)', async () => {
    const savedNote = await tutorMaterialsRepo.createMaterial({
      userId: studentA.userId,
      subjectId: SEED_IDS.subjects.hscPhysics,
      chapterId: SEED_IDS.chapters.hscPhysMechanics,
      topicId: topicNewtonsLaws,
      materialType: 'formula_sheet',
      title: 'Mechanics Formula Sheet',
      contentMarkdown: 'Force F = ma, Momentum p = mv, Impulse J = FΔt.',
      language: 'en',
      explanationDepth: 'intermediate',
      modelId: 'openrouter/free',
      isSavedToLibrary: true,
      isPublishedByAdmin: false,
      isFlagged: false,
    });

    const mockTransport = async (
      req: OpenRouterCompletionRequest,
    ): Promise<OpenRouterCompletionResponse> => {
      expect(req.messages[1]?.content).toContain('Mechanics Formula Sheet');
      return {
        content: JSON.stringify({
          title: 'HSC Physics: Newton’s Laws Active Recall',
          cards: [
            {
              front: 'What is the formula for linear momentum?',
              back: 'p = mv (mass times velocity)',
              hint: 'Product of mass and velocity',
            },
            {
              front: 'State the Impulse-Momentum Theorem.',
              back: 'Impulse J = FΔt = Δp = m(v - u)',
            },
          ],
        }),
        modelId: req.model,
        promptTokens: 80,
        completionTokens: 65,
        totalTokens: 145,
      };
    };

    const generated = await generateAIFlashcardsForStudent(
      studentA,
      {
        mode: 'ai',
        topicId: topicNewtonsLaws,
        generatedContentId: savedNote.id,
        cardCount: 2,
        language: 'en',
      },
      flashcardRepo,
      curriculumRepo,
      tutorMaterialsRepo,
      aiRepo,
      mockTransport,
    );

    expect(generated.deck.title).toContain('Newton’s Laws');
    expect(generated.cards).toHaveLength(2);

    // Add a manual card to the same deck
    const added = await addCardToDeckForStudent(
      studentA,
      {
        deckId: generated.deck.id,
        front: 'What is 1 Newton in base SI units?',
        back: '1 N = 1 kg·m/s²',
      },
      flashcardRepo,
    );
    expect(added.deck.cardCount).toBe(3);

    // Edit the newly added card
    const edited = await updateFlashcardForStudent(
      studentA,
      added.card.id,
      { back: '1 Newton = 1 kg·m·s⁻²' },
      flashcardRepo,
    );
    expect(edited.card.back).toContain('s⁻²');

    // Delete one card and verify count decrements to 2
    await deleteFlashcardForStudent(studentA, added.card.id, flashcardRepo);
    const detail = await getDeckDetailForStudent(studentA, generated.deck.id, flashcardRepo);
    expect(detail.cards).toHaveLength(2);
    expect(detail.deck.cardCount).toBe(2);
  });

  it('tracks due, upcoming, mastered, and difficult queues, logs review history, and enforces user ownership isolation (FR-FLASH-009, FR-FLASH-010)', async () => {
    const now = new Date('2026-04-10T08:00:00.000Z');

    const manual = await createManualDeckForStudent(
      studentA,
      {
        mode: 'manual',
        title: 'ICT Boolean Logic Deck',
        language: 'en',
        cards: [
          { front: 'De Morgan’s First Law', back: 'NOT(A AND B) = (NOT A) OR (NOT B)' },
          { front: 'Universal Gates', back: 'NAND and NOR gates' },
        ],
      },
      flashcardRepo,
    );

    const [card1, card2] = manual.cards;

    // Rate card1 'easy' twice -> transitions new -> review -> mastered (interval 10d)
    const rEasy1 = await submitCardReviewForStudent(
      studentA,
      { flashcardId: card1!.id, rating: 'easy', durationMs: 3100 },
      flashcardRepo,
      now,
    );
    expect(rEasy1.card.masteryState).toBe('review');
    expect(rEasy1.card.intervalDays).toBe(4);

    const rEasy2 = await submitCardReviewForStudent(
      studentA,
      { flashcardId: card1!.id, rating: 'easy', durationMs: 2800 },
      flashcardRepo,
      now,
    );
    expect(rEasy2.card.masteryState).toBe('mastered');
    expect(rEasy2.card.intervalDays).toBe(10);
    expect(rEasy2.reviewLog.newIntervalDays).toBe(10);

    // Rate card2 'again' -> becomes difficult and scheduled +10m
    const rAgain = await submitCardReviewForStudent(
      studentA,
      { flashcardId: card2!.id, rating: 'again', durationMs: 5000 },
      flashcardRepo,
      now,
    );
    expect(rAgain.card.masteryState).toBe('difficult');

    // At now + 15 minutes, card2 is due while card1 (4 days out) is upcoming & mastered
    const fifteenMinsLater = new Date(now.getTime() + 15 * 60 * 1000);
    const queueDue = await getReviewQueueForStudent(
      studentA,
      { filter: 'due', limit: 20 },
      flashcardRepo,
      fifteenMinsLater,
    );

    expect(queueDue.summary.dueCount).toBe(1);
    expect(queueDue.summary.upcomingCount).toBe(1);
    expect(queueDue.summary.masteredCount).toBe(1);
    expect(queueDue.summary.difficultCount).toBe(1);
    expect(queueDue.cards).toHaveLength(1);
    expect(queueDue.cards[0]?.id).toBe(card2!.id);
    expect(queueDue.recentLogs).toHaveLength(3);

    // Student B is blocked from accessing, modifying, reviewing, or deleting Student A's deck or cards
    await expect(
      getDeckDetailForStudent(studentB, manual.deck.id, flashcardRepo),
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      submitCardReviewForStudent(
        studentB,
        { flashcardId: card1!.id, rating: 'good' },
        flashcardRepo,
        now,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      deleteDeckForStudent(studentB, manual.deck.id, flashcardRepo),
    ).rejects.toMatchObject({ statusCode: 403 });

    // Student A deletes deck and cards are cascaded
    await deleteDeckForStudent(studentA, manual.deck.id, flashcardRepo);
    const afterDelete = await listDecksForStudent(studentA, flashcardRepo, now);
    expect(afterDelete.decks).toHaveLength(0);
    expect(afterDelete.overallSummary.totalCount).toBe(0);
  });
});
