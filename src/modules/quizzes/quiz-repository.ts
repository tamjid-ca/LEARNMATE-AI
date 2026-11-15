/**
 * LearnMate AI — Quiz, Question Bank & Examination Attempt Repository
 * Persists quizzes, questions, and quizAttempts across MongoDB/Mongoose
 * and InMemory test stores.
 */

import { randomBytes } from 'node:crypto';
import mongoose, { type Types } from 'mongoose';
import { connectToDatabase } from '../../lib/database/mongoose.ts';
import type { FeedbackTiming, QuizMode } from '../../lib/validators/quiz.ts';
import { getMongooseModel } from '../../models/index.ts';
import type {
  DifficultyLevel,
  QuestionType,
  SupportedLanguage,
} from '../../types/domain.ts';

export interface QuestionOptionItem {
  id: string;
  text: string;
}

export interface QuizRecord {
  id: string;
  userId: string;
  title: string;
  mode: QuizMode;
  subjectId?: string;
  chapterId?: string;
  topicIds: string[];
  uploadedMaterialId?: string;
  generatedContentId?: string;
  difficulty: DifficultyLevel;
  questionTypes: QuestionType[];
  questionCount: number;
  timeLimitSeconds?: number;
  negativeMarkingFactor: number;
  feedbackTiming: FeedbackTiming;
  language: SupportedLanguage;
  modelId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionRecord {
  id: string;
  quizId: string;
  userId: string;
  topicId?: string;
  order: number;
  questionType: QuestionType;
  difficulty: DifficultyLevel;
  promptText: string;
  options: QuestionOptionItem[];
  correctOptionIds: string[];
  expectedShortAnswerRubric?: string;
  explanation: string;
  points: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicQuestionRecord {
  id: string;
  quizId: string;
  topicId?: string;
  order: number;
  questionType: QuestionType;
  difficulty: DifficultyLevel;
  promptText: string;
  options: QuestionOptionItem[];
  points: number;
  correctOptionIds?: string[];
  expectedShortAnswerRubric?: string;
  explanation?: string;
}

export interface AttemptResponseItem {
  questionId: string;
  selectedOptionIds: string[];
  shortAnswerText?: string;
  isCorrect: boolean;
  pointsAwarded: number;
  isAiEvaluated: boolean;
  aiEvaluationFeedback?: string;
  missingConcepts?: string[];
}

export interface QuizAttemptRecord {
  id: string;
  quizId: string;
  userId: string;
  status: 'in_progress' | 'submitted';
  startedAt: Date;
  submittedAt?: Date;
  durationSeconds?: number;
  responses: AttemptResponseItem[];
  totalPointsPossible: number;
  scoreEarned: number;
  accuracyPercent: number;
  weakTopicIds: string[];
  recommendedTopicIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizListFilter {
  userId: string;
  mode?: QuizMode;
  subjectId?: string;
  page: number;
  limit: number;
}

export interface QuizRepository {
  // Quizzes
  createQuiz(data: Omit<QuizRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<QuizRecord>;
  findQuizById(id: string): Promise<QuizRecord | null>;
  listQuizzesByUser(
    filter: QuizListFilter,
  ): Promise<{ items: QuizRecord[]; total: number }>;

  // Questions
  createQuestionsBulk(
    items: Array<Omit<QuestionRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<QuestionRecord[]>;
  listQuestionsByQuiz(quizId: string): Promise<QuestionRecord[]>;

  // Quiz Attempts
  createAttempt(
    data: Omit<QuizAttemptRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<QuizAttemptRecord>;
  findAttemptById(id: string): Promise<QuizAttemptRecord | null>;
  updateAttempt(
    id: string,
    patch: Partial<Omit<QuizAttemptRecord, 'id' | 'quizId' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<QuizAttemptRecord | null>;
  listAttemptsByQuiz(quizId: string, userId: string): Promise<QuizAttemptRecord[]>;
  listAttemptsByUser(userId: string, limit?: number): Promise<QuizAttemptRecord[]>;
}

function generateHexId(): string {
  return randomBytes(12).toString('hex');
}

function toValidObjectIdOrUndefined(id?: string): Types.ObjectId | undefined {
  return id && mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : undefined;
}

function mapDocToQuiz(doc: Record<string, unknown>): QuizRecord {
  const rawTopics = Array.isArray(doc.topicIds) ? doc.topicIds : [];
  const rawQTypes = Array.isArray(doc.questionTypes) ? doc.questionTypes : ['single_mcq'];
  return {
    id: String(doc._id),
    userId: String(doc.userId ?? ''),
    title: String(doc.title ?? ''),
    mode: ((doc.mode as QuizMode) ?? 'practice'),
    subjectId: doc.subjectId ? String(doc.subjectId) : undefined,
    chapterId: doc.chapterId ? String(doc.chapterId) : undefined,
    topicIds: rawTopics.map((id) => String(id)),
    uploadedMaterialId: doc.uploadedMaterialId ? String(doc.uploadedMaterialId) : undefined,
    generatedContentId: doc.generatedContentId ? String(doc.generatedContentId) : undefined,
    difficulty: (doc.difficulty as DifficultyLevel) ?? 'medium',
    questionTypes: rawQTypes.map((qt) => String(qt) as QuestionType),
    questionCount: typeof doc.questionCount === 'number' ? doc.questionCount : 1,
    timeLimitSeconds:
      typeof doc.timeLimitSeconds === 'number' ? doc.timeLimitSeconds : undefined,
    negativeMarkingFactor:
      typeof doc.negativeMarkingFactor === 'number' ? doc.negativeMarkingFactor : 0,
    feedbackTiming: (doc.feedbackTiming as FeedbackTiming) ?? 'after_submission',
    language: (doc.language as SupportedLanguage) ?? 'en',
    modelId: doc.modelId ? String(doc.modelId) : undefined,
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

function mapDocToQuestion(doc: Record<string, unknown>): QuestionRecord {
  const rawOptions = Array.isArray(doc.options) ? doc.options : [];
  const rawCorrect = Array.isArray(doc.correctOptionIds) ? doc.correctOptionIds : [];
  return {
    id: String(doc._id),
    quizId: String(doc.quizId ?? ''),
    userId: String(doc.userId ?? ''),
    topicId: doc.topicId ? String(doc.topicId) : undefined,
    order: typeof doc.order === 'number' ? doc.order : 1,
    questionType: (doc.questionType as QuestionType) ?? 'single_mcq',
    difficulty: (doc.difficulty as DifficultyLevel) ?? 'medium',
    promptText: String(doc.promptText ?? ''),
    options: rawOptions.map((o) => {
      const obj = (o ?? {}) as Record<string, unknown>;
      return {
        id: String(obj.id ?? ''),
        text: String(obj.text ?? ''),
      };
    }),
    correctOptionIds: rawCorrect.map((id) => String(id)),
    expectedShortAnswerRubric: doc.expectedShortAnswerRubric
      ? String(doc.expectedShortAnswerRubric)
      : undefined,
    explanation: String(doc.explanation ?? ''),
    points: typeof doc.points === 'number' ? doc.points : 1,
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

function mapDocToAttempt(doc: Record<string, unknown>): QuizAttemptRecord {
  const rawResponses = Array.isArray(doc.responses) ? doc.responses : [];
  const rawWeakTopics = Array.isArray(doc.weakTopicIds) ? doc.weakTopicIds : [];
  const rawRecTopics = Array.isArray(doc.recommendedTopicIds) ? doc.recommendedTopicIds : [];
  return {
    id: String(doc._id),
    quizId: String(doc.quizId ?? ''),
    userId: String(doc.userId ?? ''),
    status: doc.status === 'submitted' ? 'submitted' : 'in_progress',
    startedAt: doc.startedAt ? new Date(String(doc.startedAt)) : new Date(),
    submittedAt: doc.submittedAt ? new Date(String(doc.submittedAt)) : undefined,
    durationSeconds:
      typeof doc.durationSeconds === 'number' ? doc.durationSeconds : undefined,
    responses: rawResponses.map((r) => {
      const obj = (r ?? {}) as Record<string, unknown>;
      const selected = Array.isArray(obj.selectedOptionIds) ? obj.selectedOptionIds : [];
      const missing = Array.isArray(obj.missingConcepts) ? obj.missingConcepts : [];
      return {
        questionId: String(obj.questionId ?? ''),
        selectedOptionIds: selected.map((s) => String(s)),
        shortAnswerText: obj.shortAnswerText ? String(obj.shortAnswerText) : undefined,
        isCorrect: Boolean(obj.isCorrect),
        pointsAwarded: typeof obj.pointsAwarded === 'number' ? obj.pointsAwarded : 0,
        isAiEvaluated: Boolean(obj.isAiEvaluated),
        aiEvaluationFeedback: obj.aiEvaluationFeedback
          ? String(obj.aiEvaluationFeedback)
          : undefined,
        missingConcepts: missing.map((m) => String(m)),
      };
    }),
    totalPointsPossible:
      typeof doc.totalPointsPossible === 'number' ? doc.totalPointsPossible : 0,
    scoreEarned: typeof doc.scoreEarned === 'number' ? doc.scoreEarned : 0,
    accuracyPercent: typeof doc.accuracyPercent === 'number' ? doc.accuracyPercent : 0,
    weakTopicIds: rawWeakTopics.map((id) => String(id)),
    recommendedTopicIds: rawRecTopics.map((id) => String(id)),
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

export class MongooseQuizRepository implements QuizRepository {
  async createQuiz(data: Omit<QuizRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<QuizRecord> {
    await connectToDatabase();
    const Model = getMongooseModel('quizzes');
    const created = await Model.create({
      userId: new mongoose.Types.ObjectId(data.userId),
      title: data.title,
      mode: data.mode,
      subjectId: toValidObjectIdOrUndefined(data.subjectId),
      chapterId: toValidObjectIdOrUndefined(data.chapterId),
      topicIds: data.topicIds
        .map((id) => toValidObjectIdOrUndefined(id))
        .filter((id): id is Types.ObjectId => Boolean(id)),
      uploadedMaterialId: toValidObjectIdOrUndefined(data.uploadedMaterialId),
      generatedContentId: toValidObjectIdOrUndefined(data.generatedContentId),
      difficulty: data.difficulty,
      questionTypes: data.questionTypes,
      questionCount: data.questionCount,
      timeLimitSeconds: data.timeLimitSeconds,
      negativeMarkingFactor: data.negativeMarkingFactor,
      feedbackTiming: data.feedbackTiming,
      language: data.language,
      modelId: data.modelId,
    });
    return mapDocToQuiz(created as unknown as Record<string, unknown>);
  }

  async findQuizById(id: string): Promise<QuizRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    await connectToDatabase();
    const Model = getMongooseModel('quizzes');
    const doc = await Model.findById(id).lean();
    return doc ? mapDocToQuiz(doc) : null;
  }

  async listQuizzesByUser(
    filter: QuizListFilter,
  ): Promise<{ items: QuizRecord[]; total: number }> {
    if (!mongoose.Types.ObjectId.isValid(filter.userId)) {
      return { items: [], total: 0 };
    }
    await connectToDatabase();
    const Model = getMongooseModel('quizzes');
    const query: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(filter.userId),
    };
    if (filter.mode) query.mode = filter.mode;
    if (filter.subjectId && mongoose.Types.ObjectId.isValid(filter.subjectId)) {
      query.subjectId = new mongoose.Types.ObjectId(filter.subjectId);
    }

    const skip = Math.max(0, (filter.page - 1) * filter.limit);
    const [docs, total] = await Promise.all([
      Model.find(query).sort({ createdAt: -1 }).skip(skip).limit(filter.limit).lean(),
      Model.countDocuments(query),
    ]);
    return {
      items: docs.map(mapDocToQuiz),
      total,
    };
  }

  async createQuestionsBulk(
    items: Array<Omit<QuestionRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<QuestionRecord[]> {
    if (items.length === 0) return [];
    await connectToDatabase();
    const Model = getMongooseModel('questions');
    const created = await Promise.all(
      items.map((item) =>
        Model.create({
          quizId: new mongoose.Types.ObjectId(item.quizId),
          userId: new mongoose.Types.ObjectId(item.userId),
          topicId: toValidObjectIdOrUndefined(item.topicId),
          order: item.order,
          questionType: item.questionType,
          difficulty: item.difficulty,
          promptText: item.promptText,
          options: item.options,
          correctOptionIds: item.correctOptionIds,
          expectedShortAnswerRubric: item.expectedShortAnswerRubric,
          explanation: item.explanation,
          points: item.points,
        }),
      ),
    );
    return created.map((doc) => mapDocToQuestion(doc as unknown as Record<string, unknown>));
  }

  async listQuestionsByQuiz(quizId: string): Promise<QuestionRecord[]> {
    if (!mongoose.Types.ObjectId.isValid(quizId)) return [];
    await connectToDatabase();
    const Model = getMongooseModel('questions');
    const docs = await Model.find({
      quizId: new mongoose.Types.ObjectId(quizId),
    })
      .sort({ order: 1 })
      .lean();
    return docs.map(mapDocToQuestion);
  }

  async createAttempt(
    data: Omit<QuizAttemptRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<QuizAttemptRecord> {
    await connectToDatabase();
    const Model = getMongooseModel('quizAttempts');
    const created = await Model.create({
      quizId: new mongoose.Types.ObjectId(data.quizId),
      userId: new mongoose.Types.ObjectId(data.userId),
      status: data.status,
      startedAt: data.startedAt,
      submittedAt: data.submittedAt,
      durationSeconds: data.durationSeconds,
      responses: data.responses,
      totalPointsPossible: data.totalPointsPossible,
      scoreEarned: data.scoreEarned,
      accuracyPercent: data.accuracyPercent,
      weakTopicIds: data.weakTopicIds
        .map((id) => toValidObjectIdOrUndefined(id))
        .filter((id): id is Types.ObjectId => Boolean(id)),
      recommendedTopicIds: data.recommendedTopicIds
        .map((id) => toValidObjectIdOrUndefined(id))
        .filter((id): id is Types.ObjectId => Boolean(id)),
    });
    return mapDocToAttempt(created as unknown as Record<string, unknown>);
  }

  async findAttemptById(id: string): Promise<QuizAttemptRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    await connectToDatabase();
    const Model = getMongooseModel('quizAttempts');
    const doc = await Model.findById(id).lean();
    return doc ? mapDocToAttempt(doc) : null;
  }

  async updateAttempt(
    id: string,
    patch: Partial<
      Omit<QuizAttemptRecord, 'id' | 'quizId' | 'userId' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<QuizAttemptRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    await connectToDatabase();
    const Model = getMongooseModel('quizAttempts');
    const updateDoc: Record<string, unknown> = { ...patch };
    if (patch.weakTopicIds) {
      updateDoc.weakTopicIds = patch.weakTopicIds
        .map((tid) => toValidObjectIdOrUndefined(tid))
        .filter((tid): tid is Types.ObjectId => Boolean(tid));
    }
    if (patch.recommendedTopicIds) {
      updateDoc.recommendedTopicIds = patch.recommendedTopicIds
        .map((tid) => toValidObjectIdOrUndefined(tid))
        .filter((tid): tid is Types.ObjectId => Boolean(tid));
    }
    const updated = await Model.findByIdAndUpdate(id, { $set: updateDoc }, { new: true }).lean();
    return updated ? mapDocToAttempt(updated) : null;
  }

  async listAttemptsByQuiz(quizId: string, userId: string): Promise<QuizAttemptRecord[]> {
    if (
      !mongoose.Types.ObjectId.isValid(quizId) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return [];
    }
    await connectToDatabase();
    const Model = getMongooseModel('quizAttempts');
    const docs = await Model.find({
      quizId: new mongoose.Types.ObjectId(quizId),
      userId: new mongoose.Types.ObjectId(userId),
    })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map(mapDocToAttempt);
  }

  async listAttemptsByUser(userId: string, limit = 30): Promise<QuizAttemptRecord[]> {
    if (!mongoose.Types.ObjectId.isValid(userId)) return [];
    await connectToDatabase();
    const Model = getMongooseModel('quizAttempts');
    const docs = await Model.find({
      userId: new mongoose.Types.ObjectId(userId),
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return docs.map(mapDocToAttempt);
  }
}

export class InMemoryQuizRepository implements QuizRepository {
  private readonly quizzes = new Map<string, QuizRecord>();
  private readonly questions = new Map<string, QuestionRecord>();
  private readonly attempts = new Map<string, QuizAttemptRecord>();

  async createQuiz(data: Omit<QuizRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<QuizRecord> {
    const now = new Date();
    const record: QuizRecord = {
      ...data,
      topicIds: [...data.topicIds],
      questionTypes: [...data.questionTypes],
      id: generateHexId(),
      createdAt: now,
      updatedAt: now,
    };
    this.quizzes.set(record.id, record);
    return { ...record, topicIds: [...record.topicIds], questionTypes: [...record.questionTypes] };
  }

  async findQuizById(id: string): Promise<QuizRecord | null> {
    const found = this.quizzes.get(id);
    return found
      ? { ...found, topicIds: [...found.topicIds], questionTypes: [...found.questionTypes] }
      : null;
  }

  async listQuizzesByUser(
    filter: QuizListFilter,
  ): Promise<{ items: QuizRecord[]; total: number }> {
    let all = Array.from(this.quizzes.values()).filter((q) => q.userId === filter.userId);
    if (filter.mode) all = all.filter((q) => q.mode === filter.mode);
    if (filter.subjectId) all = all.filter((q) => q.subjectId === filter.subjectId);
    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = all.length;
    const skip = Math.max(0, (filter.page - 1) * filter.limit);
    const items = all.slice(skip, skip + filter.limit).map((q) => ({
      ...q,
      topicIds: [...q.topicIds],
      questionTypes: [...q.questionTypes],
    }));
    return { items, total };
  }

  async createQuestionsBulk(
    items: Array<Omit<QuestionRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<QuestionRecord[]> {
    const now = new Date();
    const created: QuestionRecord[] = items.map((item) => {
      const record: QuestionRecord = {
        ...item,
        options: item.options.map((o) => ({ ...o })),
        correctOptionIds: [...item.correctOptionIds],
        id: generateHexId(),
        createdAt: now,
        updatedAt: now,
      };
      this.questions.set(record.id, record);
      return { ...record };
    });
    return created.sort((a, b) => a.order - b.order);
  }

  async listQuestionsByQuiz(quizId: string): Promise<QuestionRecord[]> {
    return Array.from(this.questions.values())
      .filter((q) => q.quizId === quizId)
      .sort((a, b) => a.order - b.order)
      .map((q) => ({
        ...q,
        options: q.options.map((o) => ({ ...o })),
        correctOptionIds: [...q.correctOptionIds],
      }));
  }

  async createAttempt(
    data: Omit<QuizAttemptRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<QuizAttemptRecord> {
    const now = new Date();
    const record: QuizAttemptRecord = {
      ...data,
      responses: data.responses.map((r) => ({ ...r, selectedOptionIds: [...r.selectedOptionIds] })),
      weakTopicIds: [...data.weakTopicIds],
      recommendedTopicIds: [...data.recommendedTopicIds],
      id: generateHexId(),
      createdAt: now,
      updatedAt: now,
    };
    this.attempts.set(record.id, record);
    return { ...record };
  }

  async findAttemptById(id: string): Promise<QuizAttemptRecord | null> {
    const found = this.attempts.get(id);
    return found ? { ...found } : null;
  }

  async updateAttempt(
    id: string,
    patch: Partial<
      Omit<QuizAttemptRecord, 'id' | 'quizId' | 'userId' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<QuizAttemptRecord | null> {
    const existing = this.attempts.get(id);
    if (!existing) return null;
    const updated: QuizAttemptRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date(),
    };
    this.attempts.set(id, updated);
    return { ...updated };
  }

  async listAttemptsByQuiz(quizId: string, userId: string): Promise<QuizAttemptRecord[]> {
    return Array.from(this.attempts.values())
      .filter((a) => a.quizId === quizId && a.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((a) => ({ ...a }));
  }

  async listAttemptsByUser(userId: string, limit = 30): Promise<QuizAttemptRecord[]> {
    return Array.from(this.attempts.values())
      .filter((a) => a.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map((a) => ({ ...a }));
  }
}

let fallbackQuizRepo: InMemoryQuizRepository | null = null;
let activeQuizRepoOverride: QuizRepository | null = null;

export function setActiveQuizRepository(repo: QuizRepository | null): void {
  activeQuizRepoOverride = repo;
}

export function getActiveQuizRepository(): QuizRepository {
  if (activeQuizRepoOverride) {
    return activeQuizRepoOverride;
  }
  if (process.env.MONGODB_URI?.trim()) {
    return new MongooseQuizRepository();
  }
  if (!fallbackQuizRepo) {
    fallbackQuizRepo = new InMemoryQuizRepository();
  }
  return fallbackQuizRepo;
}
