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
  InMemoryQuizRepository,
  setActiveQuizRepository,
} from '../src/modules/quizzes/quiz-repository.ts';
import {
  generateQuizForStudent,
  getQuizAttemptDetailForStudent,
  getQuizDetailForStudent,
  listQuizzesForStudent,
  startQuizAttemptForStudent,
  submitQuizAttemptForStudent,
} from '../src/modules/quizzes/quiz-service.ts';
import {
  InMemoryTutorMaterialsRepository,
  setActiveTutorMaterialsRepository,
} from '../src/modules/tutor/tutor-materials-repository.ts';

describe('State 07 — Quiz & Examination System Gate', () => {
  let quizRepo: InMemoryQuizRepository;
  let curriculumRepo: InMemoryCurriculumRepository;
  let tutorMaterialsRepo: InMemoryTutorMaterialsRepository;
  let aiRepo: InMemoryAIRepository;

  const studentA = {
    userId: '66f000000000000000000a01',
    email: 'student.quiz.a@example.com',
    role: 'student' as const,
  };

  const studentB = {
    userId: '66f000000000000000000a02',
    email: 'student.quiz.b@example.com',
    role: 'student' as const,
  };

  const topicNewtonsLaws = SEED_IDS.topics.newtonsLaws;
  const topicMomentum = SEED_IDS.topics.conservationOfMomentum;

  beforeEach(() => {
    quizRepo = new InMemoryQuizRepository();
    curriculumRepo = new InMemoryCurriculumRepository();
    tutorMaterialsRepo = new InMemoryTutorMaterialsRepository();
    aiRepo = new InMemoryAIRepository();

    setActiveQuizRepository(quizRepo);
    setActiveCurriculumRepository(curriculumRepo);
    setActiveTutorMaterialsRepository(tutorMaterialsRepo);
    setActiveAIRepository(aiRepo);
  });

  it('generates validated 4-format quizzes, strips answer keys before submission, auto-scores objective items with negative marking, and grades short answers via AI rubric (FR-QUIZ-001..012)', async () => {
    const mockTransport = async (
      req: OpenRouterCompletionRequest,
    ): Promise<OpenRouterCompletionResponse> => {
      if (req.messages[0]?.content.includes('Rubric Grader')) {
        return {
          content: JSON.stringify({
            scoreRatio: 0.8,
            isCorrect: true,
            feedback: 'Accurately stated conservation of momentum; mention isolated system condition.',
            missingConcepts: ['External net force = 0'],
          }),
          modelId: req.model,
          promptTokens: 70,
          completionTokens: 45,
          totalTokens: 115,
        };
      }

      return {
        content: JSON.stringify({
          title: 'HSC Physics: Mechanics Mock Exam',
          questions: [
            {
              questionType: 'single_mcq',
              difficulty: 'medium',
              promptText: 'Which equation represents Newton’s Second Law for constant mass?',
              options: [
                { id: 'A', text: 'F = ma' },
                { id: 'B', text: 'F = mv' },
              ],
              correctOptionIds: ['A'],
              explanation: 'Net force equals mass times acceleration.',
              points: 2,
            },
            {
              questionType: 'multiple_mcq',
              difficulty: 'hard',
              promptText: 'Which quantities are conserved in an elastic collision?',
              options: [
                { id: 'A', text: 'Linear Momentum' },
                { id: 'B', text: 'Kinetic Energy' },
                { id: 'C', text: 'Velocity difference sign' },
              ],
              correctOptionIds: ['A', 'B'],
              explanation: 'Both linear momentum and kinetic energy are conserved in elastic collisions.',
              points: 2,
            },
            {
              questionType: 'true_false',
              difficulty: 'easy',
              promptText: 'Action and reaction forces act on the same body.',
              options: [
                { id: 'T', text: 'True' },
                { id: 'F', text: 'False' },
              ],
              correctOptionIds: ['F'],
              explanation: 'Action and reaction forces always act on two different bodies.',
              points: 1,
            },
            {
              questionType: 'short_answer',
              difficulty: 'medium',
              promptText: 'State the law of conservation of linear momentum.',
              options: [],
              correctOptionIds: [],
              expectedShortAnswerRubric:
                'When net external force on a system is zero, total linear momentum remains constant.',
              explanation: 'Derived from dP/dt = F_ext = 0.',
              points: 5,
            },
          ],
        }),
        modelId: req.model,
        promptTokens: 130,
        completionTokens: 150,
        totalTokens: 280,
      };
    };

    const generated = await generateQuizForStudent(
      studentA,
      {
        mode: 'mock_exam',
        topicIds: [topicNewtonsLaws, topicMomentum],
        difficulty: 'medium',
        questionTypes: ['single_mcq', 'multiple_mcq', 'true_false', 'short_answer'],
        questionCount: 4,
        negativeMarkingFactor: 0.25,
        feedbackTiming: 'after_submission',
        language: 'en',
      },
      quizRepo,
      curriculumRepo,
      tutorMaterialsRepo,
      aiRepo,
      mockTransport,
    );

    expect(generated.quiz.mode).toBe('mock_exam');
    expect(generated.quiz.timeLimitSeconds).toBe(360); // 4 questions * 90s default for mock_exam
    expect(generated.questions).toHaveLength(4);
    expect(generated.attempt.status).toBe('in_progress');
    expect(generated.attempt.totalPointsPossible).toBe(10);

    // Ensure answer keys & explanations are stripped while attempt is in_progress
    for (const q of generated.questions) {
      expect(q.correctOptionIds).toBeUndefined();
      expect(q.explanation).toBeUndefined();
      expect(q.expectedShortAnswerRubric).toBeUndefined();
    }

    const [qSingle, qMulti, qTrueFalse, qShort] = generated.questions;

    // Submit attempt:
    // Q1 (single_mcq, 2 pts): Correct ('A') -> +2 pts
    // Q2 (multiple_mcq, 2 pts): Wrong ('A' only instead of 'A','B') -> -0.5 pts (2 * 0.25 negative mark)
    // Q3 (true_false, 1 pt): Correct ('F') -> +1 pt
    // Q4 (short_answer, 5 pts): AI Rubric scoreRatio 0.8 -> +4 pts
    // Total = 2 - 0.5 + 1 + 4 = 6.5 / 10 (65%)
    const submitted = await submitQuizAttemptForStudent(
      studentA,
      generated.attempt.id,
      {
        durationSeconds: 185,
        responses: [
          { questionId: qSingle!.id, selectedOptionIds: ['A'] },
          { questionId: qMulti!.id, selectedOptionIds: ['A'] },
          { questionId: qTrueFalse!.id, selectedOptionIds: ['F'] },
          {
            questionId: qShort!.id,
            selectedOptionIds: [],
            shortAnswerText: 'Total momentum of a system remains constant during collision.',
          },
        ],
      },
      quizRepo,
      curriculumRepo,
      tutorMaterialsRepo,
      aiRepo,
      mockTransport,
    );

    expect(submitted.attempt.status).toBe('submitted');
    expect(submitted.attempt.scoreEarned).toBe(6.5);
    expect(submitted.attempt.accuracyPercent).toBe(65);
    expect(submitted.attempt.durationSeconds).toBe(185);

    const rMulti = submitted.attempt.responses.find((r) => r.questionId === qMulti!.id)!;
    expect(rMulti.isCorrect).toBe(false);
    expect(rMulti.pointsAwarded).toBe(-0.5);

    const rShort = submitted.attempt.responses.find((r) => r.questionId === qShort!.id)!;
    expect(rShort.isAiEvaluated).toBe(true);
    expect(rShort.pointsAwarded).toBe(4);
    expect(rShort.aiEvaluationFeedback).toContain('[AI-Assisted Rubric Evaluation]');
    expect(rShort.missingConcepts).toEqual(['External net force = 0']);

    // Verify full solutions and explanations are revealed after submission (FR-QUIZ-012)
    expect(submitted.questions[0]?.correctOptionIds).toEqual(['A']);
    expect(submitted.questions[0]?.explanation).toContain('Net force');
  });

  it('identifies weak topics (<60% accuracy), recommends prerequisite topics & revision notes, and supports quiz retries (FR-QUIZ-013, FR-QUIZ-015)', async () => {
    // Save a study note for topicNewtonsLaws in Student A's personal library
    const savedNote = await tutorMaterialsRepo.createMaterial({
      userId: studentA.userId,
      subjectId: SEED_IDS.subjects.hscPhysics,
      chapterId: SEED_IDS.chapters.hscPhysMechanics,
      topicId: topicNewtonsLaws,
      materialType: 'quick_revision_notes',
      title: 'Quick Revision: Newton’s Laws & Momentum',
      contentMarkdown: 'F = ma and conservation of momentum p = mv.',
      language: 'en',
      explanationDepth: 'intermediate',
      modelId: 'openrouter/free',
      isSavedToLibrary: true,
      isPublishedByAdmin: false,
      isFlagged: false,
    });

    const mockTransport = async (
      req: OpenRouterCompletionRequest,
    ): Promise<OpenRouterCompletionResponse> => ({
      content: JSON.stringify({
        title: 'Momentum & Collisions Diagnostic Quiz',
        questions: [
          {
            questionType: 'single_mcq',
            difficulty: 'medium',
            promptText: 'What is linear momentum p?',
            options: [
              { id: 'A', text: 'p = mv' },
              { id: 'B', text: 'p = ma' },
            ],
            correctOptionIds: ['A'],
            explanation: 'Momentum is mass times velocity.',
            points: 2,
          },
        ],
      }),
      modelId: req.model,
      promptTokens: 60,
      completionTokens: 50,
      totalTokens: 110,
    });

    // Generate quiz on topicMomentum (which has prerequisite topicNewtonsLaws in seed data)
    const generated = await generateQuizForStudent(
      studentA,
      {
        mode: 'practice',
        topicIds: [topicMomentum],
        generatedContentId: savedNote.id,
        questionTypes: ['single_mcq'],
        questionCount: 1,
        feedbackTiming: 'after_submission',
        language: 'en',
      },
      quizRepo,
      curriculumRepo,
      tutorMaterialsRepo,
      aiRepo,
      mockTransport,
    );

    // Answer incorrectly so topicMomentum accuracy is 0% (< 60%)
    const submitted = await submitQuizAttemptForStudent(
      studentA,
      generated.attempt.id,
      {
        responses: [{ questionId: generated.questions[0]!.id, selectedOptionIds: ['B'] }],
      },
      quizRepo,
      curriculumRepo,
      tutorMaterialsRepo,
      aiRepo,
      mockTransport,
    );

    expect(submitted.attempt.accuracyPercent).toBe(0);
    expect(submitted.attempt.weakTopicIds).toContain(topicMomentum);
    // Prerequisite topicNewtonsLaws should be included in recommendedTopicIds
    expect(submitted.attempt.recommendedTopicIds).toContain(topicNewtonsLaws);
    expect(submitted.weakTopics.map((t) => t.id)).toContain(topicMomentum);
    expect(submitted.recommendedMaterials.map((m) => m.id)).toContain(savedNote.id);

    // Retry the same quiz (FR-QUIZ-013)
    const retry = await startQuizAttemptForStudent(
      studentA,
      { quizId: generated.quiz.id },
      quizRepo,
    );
    expect(retry.attempt.id).not.toBe(generated.attempt.id);
    expect(retry.attempt.status).toBe('in_progress');

    const listed = await listQuizzesForStudent(studentA, { page: 1, limit: 10 }, quizRepo);
    expect(listed.quizzes).toHaveLength(1);
    expect(listed.quizzes[0]?.attemptCount).toBe(1);
  });

  it('enforces strict user ownership isolation across quizzes and attempts', async () => {
    const mockTransport = async (
      req: OpenRouterCompletionRequest,
    ): Promise<OpenRouterCompletionResponse> => ({
      content: JSON.stringify({
        title: 'Private Student A Quiz',
        questions: [
          {
            questionType: 'true_false',
            difficulty: 'easy',
            promptText: 'Force is a vector quantity.',
            options: [
              { id: 'T', text: 'True' },
              { id: 'F', text: 'False' },
            ],
            correctOptionIds: ['T'],
            explanation: 'Force has both magnitude and direction.',
            points: 1,
          },
        ],
      }),
      modelId: req.model,
      promptTokens: 40,
      completionTokens: 40,
      totalTokens: 80,
    });

    const created = await generateQuizForStudent(
      studentA,
      {
        topicIds: [topicNewtonsLaws],
        questionTypes: ['true_false'],
        questionCount: 1,
      },
      quizRepo,
      curriculumRepo,
      tutorMaterialsRepo,
      aiRepo,
      mockTransport,
    );

    // Student B cannot view Student A's quiz, start an attempt on it, or view/submit Student A's attempt
    await expect(
      getQuizDetailForStudent(studentB, created.quiz.id, false, quizRepo),
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      startQuizAttemptForStudent(studentB, { quizId: created.quiz.id }, quizRepo),
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      getQuizAttemptDetailForStudent(studentB, created.attempt.id, quizRepo, curriculumRepo),
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      submitQuizAttemptForStudent(
        studentB,
        created.attempt.id,
        { responses: [] },
        quizRepo,
        curriculumRepo,
        tutorMaterialsRepo,
        aiRepo,
        mockTransport,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
