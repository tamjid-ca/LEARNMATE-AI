/**
 * LearnMate AI — AI Quiz Generator & Examination Service
 * Implements SRS Section 4.6 (FR-QUIZ-001..015).
 */

import {
  getOpenRouterTransport,
  type OpenRouterTransport,
} from '../../lib/ai/openrouter-client.ts';
import { AppError } from '../../lib/api/errors.ts';
import { buildPaginationMeta, type PaginationMeta } from '../../lib/api/response.ts';
import {
  assertResourceOwnership,
  requireAuth,
  type AuthenticatedActor,
} from '../../lib/auth/rbac.ts';
import {
  structuredQuizOutputSchema,
  structuredShortAnswerEvaluationSchema,
} from '../../lib/validators/ai.ts';
import {
  generateQuizSchema,
  quizListQuerySchema,
  startQuizAttemptSchema,
  submitQuizAttemptSchema,
} from '../../lib/validators/quiz.ts';
import {
  getActiveAIRepository,
  type AIRepository,
} from '../ai/ai-repository.ts';
import { executeStructuredAITask } from '../ai/ai-service.ts';
import {
  getActiveCurriculumRepository,
  type CurriculumRepository,
} from '../curriculum/curriculum-repository.ts';
import { assertCurriculumRecordReadable } from '../curriculum/custom-education-service.ts';
import type { TopicRecord } from '../curriculum/seed-data.ts';
import {
  getActiveTutorMaterialsRepository,
  type GeneratedContentRecord,
  type TutorMaterialsRepository,
} from '../tutor/tutor-materials-repository.ts';
import {
  getActiveQuizRepository,
  type AttemptResponseItem,
  type PublicQuestionRecord,
  type QuestionRecord,
  type QuizAttemptRecord,
  type QuizRecord,
  type QuizRepository,
} from './quiz-repository.ts';

export function sanitizeQuestionForDelivery(
  question: QuestionRecord,
  revealSolutions: boolean,
): PublicQuestionRecord {
  const base: PublicQuestionRecord = {
    id: question.id,
    quizId: question.quizId,
    topicId: question.topicId,
    order: question.order,
    questionType: question.questionType,
    difficulty: question.difficulty,
    promptText: question.promptText,
    options: question.options.map((o) => ({ ...o })),
    points: question.points,
  };

  if (revealSolutions) {
    base.correctOptionIds = [...question.correctOptionIds];
    base.expectedShortAnswerRubric = question.expectedShortAnswerRubric;
    base.explanation = question.explanation;
  }

  return base;
}

function areOptionSetsEqual(selected: string[], correct: string[]): boolean {
  if (selected.length !== correct.length || correct.length === 0) {
    return false;
  }
  const normalizedSelected = new Set(selected.map((s) => s.trim()));
  const normalizedCorrect = new Set(correct.map((c) => c.trim()));
  if (normalizedSelected.size !== normalizedCorrect.size) {
    return false;
  }
  for (const id of normalizedCorrect) {
    if (!normalizedSelected.has(id)) {
      return false;
    }
  }
  return true;
}

export async function generateQuizForStudent(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  quizRepo: QuizRepository = getActiveQuizRepository(),
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
  tutorMaterialsRepo: TutorMaterialsRepository = getActiveTutorMaterialsRepository(),
  aiRepo: AIRepository = getActiveAIRepository(),
  transport: OpenRouterTransport = getOpenRouterTransport(),
): Promise<{
  quiz: QuizRecord;
  questions: PublicQuestionRecord[];
  attempt: QuizAttemptRecord;
}> {
  const verified = requireAuth(actor);
  const parsed = generateQuizSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid quiz generation payload', parsed.error.flatten());
  }

  const data = parsed.data;

  // Resolve academic context from subject, chapter, topics, or saved study note
  let effectiveSubjectId = data.subjectId;
  let effectiveChapterId = data.chapterId;
  const resolvedTopics: TopicRecord[] = [];

  for (const topicId of data.topicIds) {
    const t = await curriculumRepo.findTopicById(topicId);
    if (t) {
      assertCurriculumRecordReadable(t, verified, 'Topic');
      resolvedTopics.push(t);
      if (!effectiveChapterId) effectiveChapterId = t.chapterId;
      if (!effectiveSubjectId) effectiveSubjectId = t.subjectId;
    }
  }

  if (resolvedTopics.length === 0 && effectiveChapterId) {
    const chap = await curriculumRepo.findChapterById(effectiveChapterId);
    if (chap) assertCurriculumRecordReadable(chap, verified, 'Chapter');
    const chapterTopics = await curriculumRepo.listTopics({
      chapterId: effectiveChapterId,
      viewerUserId: verified.userId,
      scopeFilter: 'all',
      page: 1,
      limit: 10,
    });
    resolvedTopics.push(...chapterTopics.items);
  } else if (resolvedTopics.length === 0 && effectiveSubjectId) {
    const subj = await curriculumRepo.findSubjectById(effectiveSubjectId);
    if (subj) assertCurriculumRecordReadable(subj, verified, 'Subject');
    const subjectTopics = await curriculumRepo.listTopics({
      subjectId: effectiveSubjectId,
      viewerUserId: verified.userId,
      scopeFilter: 'all',
      page: 1,
      limit: 10,
    });
    resolvedTopics.push(...subjectTopics.items);
  }

  let savedNoteContext = '';
  if (data.generatedContentId) {
    const note = await tutorMaterialsRepo.findMaterialById(data.generatedContentId);
    if (!note) {
      throw AppError.notFound('Saved study note');
    }
    assertResourceOwnership(verified, note.userId);
    savedNoteContext = `Source Study Note (${note.title}):\n${note.contentMarkdown.slice(0, 1800)}`;
    if (!effectiveSubjectId && note.subjectId) effectiveSubjectId = note.subjectId;
    if (!effectiveChapterId && note.chapterId) effectiveChapterId = note.chapterId;
    if (resolvedTopics.length === 0 && note.topicId) {
      const noteTopic = await curriculumRepo.findTopicById(note.topicId);
      if (noteTopic) resolvedTopics.push(noteTopic);
    }
  }

  const [subject, chapter] = await Promise.all([
    effectiveSubjectId ? curriculumRepo.findSubjectById(effectiveSubjectId) : Promise.resolve(null),
    effectiveChapterId ? curriculumRepo.findChapterById(effectiveChapterId) : Promise.resolve(null),
  ]);
  if (subject) assertCurriculumRecordReadable(subject, verified, 'Subject');
  if (chapter) assertCurriculumRecordReadable(chapter, verified, 'Chapter');

  const topicTitles =
    resolvedTopics.length > 0
      ? resolvedTopics.map((t) => `${t.title} (${t.code})`).join(', ')
      : chapter?.title ?? subject?.name ?? 'Selected Study Source';

  const contextParts: string[] = [];
  if (subject) contextParts.push(`Subject: ${subject.name} (${subject.code})`);
  if (chapter) contextParts.push(`Chapter ${chapter.chapterNumber}: ${chapter.title}`);
  if (resolvedTopics.length > 0) {
    contextParts.push(
      `Key Concepts: ${resolvedTopics.flatMap((t) => t.keyConcepts).slice(0, 12).join(', ')}`,
    );
  }
  if (savedNoteContext) {
    contextParts.push(savedNoteContext);
  }

  const typeInstructions = `Allowed Question Types: ${data.questionTypes.join(', ')}. Generate exactly ${data.questionCount} questions (${data.mode === 'mock_exam' ? 'Formal Timed Mock Examination' : 'Practice Quiz'}). ${data.customInstructions ?? ''}`.trim();

  const aiGenerated = await executeStructuredAITask(
    {
      userId: verified.userId,
      taskType: 'quiz_generation',
      schema: structuredQuizOutputSchema,
      variables: {
        topicTitle: topicTitles,
        curriculumContext: contextParts.join(' | ') || 'General Academic Syllabus',
        difficulty: data.difficulty,
        questionCount: data.questionCount,
        language: data.language,
        userPrompt: typeInstructions,
      },
      bypassCache: true,
    },
    aiRepo,
    transport,
  );

  const effectiveTopicIds =
    data.topicIds.length > 0 ? data.topicIds : resolvedTopics.map((t) => t.id);

  const quizTitle = data.title || aiGenerated.data.title;
  const createdQuiz = await quizRepo.createQuiz({
    userId: verified.userId,
    title: quizTitle,
    mode: data.mode,
    subjectId: effectiveSubjectId,
    chapterId: effectiveChapterId,
    topicIds: effectiveTopicIds,
    uploadedMaterialId: data.uploadedMaterialId,
    generatedContentId: data.generatedContentId,
    difficulty: data.difficulty,
    questionTypes: data.questionTypes,
    questionCount: aiGenerated.data.questions.length,
    timeLimitSeconds:
      data.timeLimitSeconds ??
      (data.mode === 'mock_exam' ? aiGenerated.data.questions.length * 90 : undefined),
    negativeMarkingFactor: data.negativeMarkingFactor,
    feedbackTiming: data.feedbackTiming,
    language: data.language,
    modelId: aiGenerated.modelId,
  });

  const createdQuestions = await quizRepo.createQuestionsBulk(
    aiGenerated.data.questions.map((q, idx) => ({
      quizId: createdQuiz.id,
      userId: verified.userId,
      topicId:
        effectiveTopicIds.length > 0
          ? effectiveTopicIds[idx % effectiveTopicIds.length]
          : undefined,
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

  const totalPointsPossible = createdQuestions.reduce((acc, q) => acc + q.points, 0);
  const initialAttempt = await quizRepo.createAttempt({
    quizId: createdQuiz.id,
    userId: verified.userId,
    status: 'in_progress',
    startedAt: new Date(),
    responses: [],
    totalPointsPossible,
    scoreEarned: 0,
    accuracyPercent: 0,
    weakTopicIds: [],
    recommendedTopicIds: [],
  });

  const revealImmediately = createdQuiz.feedbackTiming === 'immediate';
  return {
    quiz: createdQuiz,
    questions: createdQuestions.map((q) => sanitizeQuestionForDelivery(q, revealImmediately)),
    attempt: initialAttempt,
  };
}

export async function listQuizzesForStudent(
  actor: AuthenticatedActor | null | undefined,
  rawQuery: unknown,
  quizRepo: QuizRepository = getActiveQuizRepository(),
): Promise<{
  quizzes: Array<
    QuizRecord & {
      attemptCount: number;
      bestAccuracyPercent: number | null;
      latestAttemptId?: string;
    }
  >;
  meta: PaginationMeta;
}> {
  const verified = requireAuth(actor);
  const parsed = quizListQuerySchema.safeParse(rawQuery ?? {});
  if (!parsed.success) {
    throw AppError.validation('Invalid quiz list query', parsed.error.flatten());
  }

  const query = parsed.data;
  const pageResult = await quizRepo.listQuizzesByUser({
    userId: verified.userId,
    mode: query.mode,
    subjectId: query.subjectId,
    page: query.page,
    limit: query.limit,
  });

  const enriched = await Promise.all(
    pageResult.items.map(async (quiz) => {
      const attempts = await quizRepo.listAttemptsByQuiz(quiz.id, verified.userId);
      const submitted = attempts.filter((a) => a.status === 'submitted');
      const bestAccuracyPercent =
        submitted.length > 0
          ? Math.max(...submitted.map((a) => a.accuracyPercent))
          : null;
      return {
        ...quiz,
        attemptCount: submitted.length,
        bestAccuracyPercent,
        latestAttemptId: attempts[0]?.id,
      };
    }),
  );

  return {
    quizzes: enriched,
    meta: buildPaginationMeta(query.page, query.limit, pageResult.total),
  };
}

export async function getQuizDetailForStudent(
  actor: AuthenticatedActor | null | undefined,
  quizId: string,
  includeSolutions = false,
  quizRepo: QuizRepository = getActiveQuizRepository(),
): Promise<{
  quiz: QuizRecord;
  questions: PublicQuestionRecord[];
  attempts: QuizAttemptRecord[];
}> {
  const verified = requireAuth(actor);
  const quiz = await quizRepo.findQuizById(quizId);
  if (!quiz) {
    throw AppError.notFound('Quiz');
  }
  assertResourceOwnership(verified, quiz.userId);

  const [questions, attempts] = await Promise.all([
    quizRepo.listQuestionsByQuiz(quiz.id),
    quizRepo.listAttemptsByQuiz(quiz.id, verified.userId),
  ]);

  const hasSubmittedAttempt = attempts.some((a) => a.status === 'submitted');
  const shouldReveal =
    quiz.feedbackTiming === 'immediate' || (includeSolutions && hasSubmittedAttempt);

  return {
    quiz,
    questions: questions.map((q) => sanitizeQuestionForDelivery(q, shouldReveal)),
    attempts,
  };
}

export async function startQuizAttemptForStudent(
  actor: AuthenticatedActor | null | undefined,
  rawInput: unknown,
  quizRepo: QuizRepository = getActiveQuizRepository(),
): Promise<{
  quiz: QuizRecord;
  attempt: QuizAttemptRecord;
  questions: PublicQuestionRecord[];
}> {
  const verified = requireAuth(actor);
  const parsed = startQuizAttemptSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation('Invalid start attempt payload', parsed.error.flatten());
  }

  const quiz = await quizRepo.findQuizById(parsed.data.quizId);
  if (!quiz) {
    throw AppError.notFound('Quiz');
  }
  assertResourceOwnership(verified, quiz.userId);

  const questions = await quizRepo.listQuestionsByQuiz(quiz.id);
  const totalPointsPossible = questions.reduce((acc, q) => acc + q.points, 0);

  const attempt = await quizRepo.createAttempt({
    quizId: quiz.id,
    userId: verified.userId,
    status: 'in_progress',
    startedAt: new Date(),
    responses: [],
    totalPointsPossible,
    scoreEarned: 0,
    accuracyPercent: 0,
    weakTopicIds: [],
    recommendedTopicIds: [],
  });

  const revealImmediately = quiz.feedbackTiming === 'immediate';
  return {
    quiz,
    attempt,
    questions: questions.map((q) => sanitizeQuestionForDelivery(q, revealImmediately)),
  };
}

export async function submitQuizAttemptForStudent(
  actor: AuthenticatedActor | null | undefined,
  attemptId: string,
  rawInput: unknown,
  quizRepo: QuizRepository = getActiveQuizRepository(),
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
  tutorMaterialsRepo: TutorMaterialsRepository = getActiveTutorMaterialsRepository(),
  aiRepo: AIRepository = getActiveAIRepository(),
  transport: OpenRouterTransport = getOpenRouterTransport(),
): Promise<{
  quiz: QuizRecord;
  attempt: QuizAttemptRecord;
  questions: PublicQuestionRecord[];
  weakTopics: TopicRecord[];
  recommendedTopics: TopicRecord[];
  recommendedMaterials: GeneratedContentRecord[];
}> {
  const verified = requireAuth(actor);
  const attempt = await quizRepo.findAttemptById(attemptId);
  if (!attempt) {
    throw AppError.notFound('Quiz attempt');
  }
  assertResourceOwnership(verified, attempt.userId);

  const quiz = await quizRepo.findQuizById(attempt.quizId);
  if (!quiz) {
    throw AppError.notFound('Quiz');
  }

  const parsed = submitQuizAttemptSchema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    throw AppError.validation('Invalid quiz submission payload', parsed.error.flatten());
  }

  const questions = await quizRepo.listQuestionsByQuiz(quiz.id);
  const responseMap = new Map(
    parsed.data.responses.map((r) => [r.questionId, r]),
  );

  const gradedResponses: AttemptResponseItem[] = [];
  const topicScoreTracker = new Map<string, { earned: number; possible: number }>();

  for (const question of questions) {
    const submitted = responseMap.get(question.id);
    const selectedOptionIds = submitted?.selectedOptionIds ?? [];
    const shortAnswerText = submitted?.shortAnswerText?.trim() || undefined;

    let isCorrect = false;
    let pointsAwarded = 0;
    let isAiEvaluated = false;
    let aiEvaluationFeedback: string | undefined;
    let missingConcepts: string[] | undefined;

    if (question.questionType === 'short_answer') {
      if (shortAnswerText && shortAnswerText.length > 0) {
        const evalResult = await executeStructuredAITask(
          {
            userId: verified.userId,
            taskType: 'quiz_evaluation',
            schema: structuredShortAnswerEvaluationSchema,
            variables: {
              topicTitle: question.promptText,
              curriculumContext:
                question.expectedShortAnswerRubric || question.explanation,
              userPrompt: shortAnswerText,
            },
            bypassCache: true,
          },
          aiRepo,
          transport,
        );

        const ratio = Math.min(1, Math.max(0, evalResult.data.scoreRatio));
        pointsAwarded = Number((question.points * ratio).toFixed(2));
        isCorrect = evalResult.data.isCorrect || ratio >= 0.7;
        isAiEvaluated = true;
        aiEvaluationFeedback = `[AI-Assisted Rubric Evaluation] ${evalResult.data.feedback}`;
        missingConcepts = evalResult.data.missingConcepts;
      }
    } else {
      // Deterministic objective question auto-scoring (FR-QUIZ-009)
      if (selectedOptionIds.length > 0) {
        if (areOptionSetsEqual(selectedOptionIds, question.correctOptionIds)) {
          isCorrect = true;
          pointsAwarded = question.points;
        } else {
          isCorrect = false;
          pointsAwarded = -Number(
            (question.points * quiz.negativeMarkingFactor).toFixed(2),
          );
        }
      }
    }

    gradedResponses.push({
      questionId: question.id,
      selectedOptionIds,
      shortAnswerText,
      isCorrect,
      pointsAwarded,
      isAiEvaluated,
      aiEvaluationFeedback,
      missingConcepts,
    });

    if (question.topicId) {
      const current = topicScoreTracker.get(question.topicId) ?? {
        earned: 0,
        possible: 0,
      };
      current.earned += Math.max(0, pointsAwarded);
      current.possible += question.points;
      topicScoreTracker.set(question.topicId, current);
    }
  }

  const totalPointsPossible = questions.reduce((acc, q) => acc + q.points, 0);
  const rawScore = gradedResponses.reduce((acc, r) => acc + r.pointsAwarded, 0);
  const scoreEarned = Math.max(0, Number(rawScore.toFixed(2)));
  const accuracyPercent =
    totalPointsPossible > 0
      ? Math.min(100, Math.round((scoreEarned / totalPointsPossible) * 100))
      : 0;

  // Identify weak topics (< 60% accuracy) & recommended prerequisite/revision topics (FR-QUIZ-015)
  const weakTopicIds: string[] = [];
  for (const [topicId, stats] of topicScoreTracker.entries()) {
    const ratio = stats.possible > 0 ? stats.earned / stats.possible : 0;
    if (ratio < 0.6) {
      weakTopicIds.push(topicId);
    }
  }

  const weakTopics: TopicRecord[] = [];
  const recommendedTopicIdSet = new Set<string>(weakTopicIds);
  for (const tid of weakTopicIds) {
    const t = await curriculumRepo.findTopicById(tid);
    if (t) {
      weakTopics.push(t);
      for (const prereqId of t.prerequisiteTopicIds) {
        recommendedTopicIdSet.add(prereqId);
      }
    }
  }

  const recommendedTopicIds = Array.from(recommendedTopicIdSet);
  const recommendedTopics: TopicRecord[] = [];
  for (const rId of recommendedTopicIds) {
    const found =
      weakTopics.find((wt) => wt.id === rId) ?? (await curriculumRepo.findTopicById(rId));
    if (found) {
      recommendedTopics.push(found);
    }
  }

  // Locate relevant revision materials from the student's study library
  const userMaterials = await tutorMaterialsRepo.listMaterialsByUser({
    userId: verified.userId,
    subjectId: quiz.subjectId,
    page: 1,
    limit: 20,
  });
  const recommendedMaterials = userMaterials.items.filter(
    (m) =>
      (m.topicId && recommendedTopicIdSet.has(m.topicId)) ||
      (weakTopicIds.length > 0 && m.subjectId === quiz.subjectId),
  );

  const now = new Date();
  const computedDuration =
    parsed.data.durationSeconds ??
    Math.max(1, Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000));

  const updatedAttempt =
    (await quizRepo.updateAttempt(attempt.id, {
      status: 'submitted',
      submittedAt: now,
      durationSeconds: computedDuration,
      responses: gradedResponses,
      totalPointsPossible,
      scoreEarned,
      accuracyPercent,
      weakTopicIds,
      recommendedTopicIds,
    })) ?? attempt;

  return {
    quiz,
    attempt: updatedAttempt,
    questions: questions.map((q) => sanitizeQuestionForDelivery(q, true)),
    weakTopics,
    recommendedTopics,
    recommendedMaterials,
  };
}

export async function getQuizAttemptDetailForStudent(
  actor: AuthenticatedActor | null | undefined,
  attemptId: string,
  quizRepo: QuizRepository = getActiveQuizRepository(),
  curriculumRepo: CurriculumRepository = getActiveCurriculumRepository(),
): Promise<{
  quiz: QuizRecord;
  attempt: QuizAttemptRecord;
  questions: PublicQuestionRecord[];
  weakTopics: TopicRecord[];
}> {
  const verified = requireAuth(actor);
  const attempt = await quizRepo.findAttemptById(attemptId);
  if (!attempt) {
    throw AppError.notFound('Quiz attempt');
  }
  assertResourceOwnership(verified, attempt.userId);

  const quiz = await quizRepo.findQuizById(attempt.quizId);
  if (!quiz) {
    throw AppError.notFound('Quiz');
  }

  const questions = await quizRepo.listQuestionsByQuiz(quiz.id);
  const revealSolutions =
    attempt.status === 'submitted' || quiz.feedbackTiming === 'immediate';

  const weakTopics: TopicRecord[] = [];
  for (const tid of attempt.weakTopicIds) {
    const t = await curriculumRepo.findTopicById(tid);
    if (t) weakTopics.push(t);
  }

  return {
    quiz,
    attempt,
    questions: questions.map((q) => sanitizeQuestionForDelivery(q, revealSolutions)),
    weakTopics,
  };
}
