'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useUIPreferences } from '@/components/providers/app-providers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type {
  DifficultyLevel,
  QuestionType,
  SupportedLanguage,
} from '@/types/domain';

interface SubjectOption {
  id: string;
  name: string;
  nameBn?: string;
  code: string;
}

interface TopicOption {
  id: string;
  subjectId: string;
  chapterId: string;
  code: string;
  title: string;
  titleBn?: string;
  difficulty: DifficultyLevel;
}

interface SavedNoteOption {
  id: string;
  title: string;
  materialType: string;
}

interface QuizQuestionItem {
  id: string;
  quizId: string;
  topicId?: string;
  order: number;
  questionType: QuestionType;
  difficulty: DifficultyLevel;
  promptText: string;
  options: Array<{ id: string; text: string }>;
  points: number;
  correctOptionIds?: string[];
  expectedShortAnswerRubric?: string;
  explanation?: string;
}

interface AttemptResponseUI {
  questionId: string;
  selectedOptionIds: string[];
  shortAnswerText?: string;
  isCorrect: boolean;
  pointsAwarded: number;
  isAiEvaluated: boolean;
  aiEvaluationFeedback?: string;
  missingConcepts?: string[];
}

interface QuizAttemptSummary {
  id: string;
  quizId: string;
  status: 'in_progress' | 'submitted';
  startedAt: string;
  submittedAt?: string;
  durationSeconds?: number;
  responses: AttemptResponseUI[];
  totalPointsPossible: number;
  scoreEarned: number;
  accuracyPercent: number;
  weakTopicIds: string[];
  recommendedTopicIds: string[];
}

interface QuizSummaryItem {
  id: string;
  title: string;
  mode: 'practice' | 'mock_exam';
  subjectId?: string;
  topicIds: string[];
  difficulty: DifficultyLevel;
  questionTypes: QuestionType[];
  questionCount: number;
  timeLimitSeconds?: number;
  negativeMarkingFactor: number;
  feedbackTiming: 'after_submission' | 'immediate';
  language: SupportedLanguage;
  attemptCount?: number;
  bestAccuracyPercent?: number | null;
  latestAttemptId?: string;
  createdAt: string;
}

const QUESTION_TYPE_LABELS: Array<{
  value: QuestionType;
  labelEn: string;
  labelBn: string;
}> = [
  { value: 'single_mcq', labelEn: 'Single MCQ', labelBn: 'একক উত্তর বহুনির্বাচনী' },
  { value: 'multiple_mcq', labelEn: 'Multiple MCQ', labelBn: 'একাধিক উত্তর বহুনির্বাচনী' },
  { value: 'true_false', labelEn: 'True / False', labelBn: 'সত্য / মিথ্যা' },
  { value: 'short_answer', labelEn: 'Short Answer (AI Rubric)', labelBn: 'সংক্ষিপ্ত উত্তর (এআই রুব্রিক)' },
];

export default function StudentQuizzesPage() {
  const { language: uiLanguage } = useUIPreferences();
  const isBn = uiLanguage === 'bn';

  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [savedNotes, setSavedNotes] = useState<SavedNoteOption[]>([]);
  const [quizzes, setQuizzes] = useState<QuizSummaryItem[]>([]);

  // Generator state
  const [mode, setMode] = useState<'practice' | 'mock_exam'>('practice');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string>('');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>(['single_mcq']);
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(10);
  const [negativeMarkingFactor, setNegativeMarkingFactor] = useState<number>(0);
  const [feedbackTiming, setFeedbackTiming] = useState<'after_submission' | 'immediate'>(
    'after_submission',
  );
  const [quizLanguage, setQuizLanguage] = useState<SupportedLanguage>('en');
  const [customInstructions, setCustomInstructions] = useState<string>('');

  // Active exam & results state
  const [activeQuiz, setActiveQuiz] = useState<QuizSummaryItem | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<QuizAttemptSummary | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestionItem[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [draftAnswers, setDraftAnswers] = useState<
    Record<string, { selectedOptionIds: string[]; shortAnswerText: string }>
  >({});
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [weakTopics, setWeakTopics] = useState<TopicOption[]>([]);
  const [recommendedMaterials, setRecommendedMaterials] = useState<SavedNoteOption[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadInitialData = useCallback(async () => {
    try {
      const [currRes, quizRes, matRes] = await Promise.all([
        fetch('/api/v1/curriculum?limit=50'),
        fetch('/api/v1/quizzes?limit=25'),
        fetch('/api/v1/materials?limit=20'),
      ]);

      if (currRes.ok) {
        const currJson = await currRes.json();
        const subjList: SubjectOption[] = currJson.data?.subjects ?? [];
        const topicList: TopicOption[] = currJson.data?.topics ?? [];
        setSubjects(subjList);
        setTopics(topicList);
        if (topicList.length > 0 && selectedTopicIds.length === 0) {
          setSelectedTopicIds([topicList[0]!.id]);
        }
      }

      if (quizRes.ok) {
        const quizJson = await quizRes.json();
        setQuizzes(quizJson.data?.quizzes ?? []);
      }

      if (matRes.ok) {
        const matJson = await matRes.json();
        setSavedNotes(matJson.data?.materials ?? []);
      }
    } catch {
      // Non-fatal initial load error
    }
  }, [selectedTopicIds.length]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  // Countdown timer for active timed examinations (FR-QUIZ-007)
  useEffect(() => {
    if (
      !activeAttempt ||
      activeAttempt.status !== 'in_progress' ||
      remainingSeconds === null ||
      remainingSeconds <= 0
    ) {
      return;
    }

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeAttempt, remainingSeconds]);

  const filteredTopics = useMemo(() => {
    if (!selectedSubjectId) return topics;
    return topics.filter((t) => t.subjectId === selectedSubjectId);
  }, [topics, selectedSubjectId]);

  const toggleQuestionType = (qt: QuestionType) => {
    setQuestionTypes((prev) => {
      if (prev.includes(qt)) {
        return prev.length > 1 ? prev.filter((item) => item !== qt) : prev;
      }
      return [...prev, qt];
    });
  };

  const toggleTopicSelection = (topicId: string) => {
    setSelectedTopicIds((prev) =>
      prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId],
    );
  };

  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const payload = {
        mode,
        ...(selectedSubjectId ? { subjectId: selectedSubjectId } : {}),
        topicIds: selectedTopicIds,
        ...(selectedNoteId ? { generatedContentId: selectedNoteId } : {}),
        difficulty,
        questionTypes,
        questionCount,
        ...(timeLimitMinutes > 0 ? { timeLimitSeconds: timeLimitMinutes * 60 } : {}),
        negativeMarkingFactor,
        feedbackTiming,
        language: quizLanguage,
        ...(customInstructions.trim()
          ? { customInstructions: customInstructions.trim() }
          : {}),
      };

      const res = await fetch('/api/v1/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message || 'Failed to generate quiz');
        return;
      }

      const createdQuiz: QuizSummaryItem = json.data.quiz;
      const createdAttempt: QuizAttemptSummary = json.data.attempt;
      const createdQuestions: QuizQuestionItem[] = json.data.questions ?? [];

      setActiveQuiz(createdQuiz);
      setActiveAttempt(createdAttempt);
      setActiveQuestions(createdQuestions);
      setCurrentQuestionIndex(0);
      setDraftAnswers({});
      setWeakTopics([]);
      setRecommendedMaterials([]);
      setRemainingSeconds(createdQuiz.timeLimitSeconds ?? null);
      void loadInitialData();
    } catch {
      setErrorMessage('Network error while generating quiz');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (question: QuizQuestionItem, optionId: string) => {
    setDraftAnswers((prev) => {
      const current = prev[question.id] ?? {
        selectedOptionIds: [],
        shortAnswerText: '',
      };

      if (question.questionType === 'multiple_mcq') {
        const exists = current.selectedOptionIds.includes(optionId);
        const updated = exists
          ? current.selectedOptionIds.filter((id) => id !== optionId)
          : [...current.selectedOptionIds, optionId];
        return {
          ...prev,
          [question.id]: { ...current, selectedOptionIds: updated },
        };
      }

      return {
        ...prev,
        [question.id]: { ...current, selectedOptionIds: [optionId] },
      };
    });
  };

  const handleShortAnswerChange = (questionId: string, text: string) => {
    setDraftAnswers((prev) => {
      const current = prev[questionId] ?? {
        selectedOptionIds: [],
        shortAnswerText: '',
      };
      return {
        ...prev,
        [questionId]: { ...current, shortAnswerText: text },
      };
    });
  };

  const handleSubmitAttempt = async () => {
    if (!activeAttempt || !activeQuiz) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const responses = activeQuestions.map((q) => {
        const draft = draftAnswers[q.id];
        return {
          questionId: q.id,
          selectedOptionIds: draft?.selectedOptionIds ?? [],
          ...(draft?.shortAnswerText?.trim()
            ? { shortAnswerText: draft.shortAnswerText.trim() }
            : {}),
        };
      });

      const elapsedSeconds =
        activeQuiz.timeLimitSeconds && remainingSeconds !== null
          ? Math.max(1, activeQuiz.timeLimitSeconds - remainingSeconds)
          : undefined;

      const res = await fetch(`/api/v1/attempts/${activeAttempt.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(elapsedSeconds ? { durationSeconds: elapsedSeconds } : {}),
          responses,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message || 'Failed to submit quiz attempt');
        return;
      }

      setActiveAttempt(json.data.attempt);
      setActiveQuestions(json.data.questions ?? activeQuestions);
      setWeakTopics(json.data.weakTopics ?? []);
      setRecommendedMaterials(json.data.recommendedMaterials ?? []);
      setRemainingSeconds(null);
      void loadInitialData();
    } catch {
      setErrorMessage('Network error while submitting attempt');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryQuiz = async (quizId: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/v1/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message || 'Could not start retry attempt');
        return;
      }

      const quiz: QuizSummaryItem = json.data.quiz;
      setActiveQuiz(quiz);
      setActiveAttempt(json.data.attempt);
      setActiveQuestions(json.data.questions ?? []);
      setCurrentQuestionIndex(0);
      setDraftAnswers({});
      setWeakTopics([]);
      setRecommendedMaterials([]);
      setRemainingSeconds(quiz.timeLimitSeconds ?? null);
    } catch {
      setErrorMessage('Network error starting retry attempt');
    } finally {
      setLoading(false);
    }
  };

  const formatCountdown = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const currentQuestion = activeQuestions[currentQuestionIndex];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isBn
              ? 'এআই কুইজ জেনারেটর এবং মক পরীক্ষা সিস্টেম'
              : 'AI Quiz Generator & Mock Examination System'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isBn
              ? 'সিলেবাস টপিক বা সংরক্ষিত নোট থেকে একক/বহুনির্বাচনী, সত্য/মিথ্যা এবং রুব্রিক-ভিত্তিক সংক্ষিপ্ত উত্তরের পরীক্ষা দিন।'
              : 'Generate topic-scoped practice quizzes and timed mock exams with objective auto-scoring, AI rubric evaluation, and weak-topic diagnostics.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="accent">FR-QUIZ-001..015</Badge>
          <Badge variant="secondary">
            {mode === 'mock_exam'
              ? isBn
                ? 'মক পরীক্ষা মোড'
                : 'Mock Exam Mode'
              : isBn
                ? 'অনুশীলন কুইজ মোড'
                : 'Practice Quiz Mode'}
          </Badge>
        </div>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left column: Quiz & Mock Exam Configurator + History */}
        <div className="space-y-6 lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {isBn ? 'নতুন কুইজ বা মক পরীক্ষা তৈরি করুন' : 'Configure Quiz or Mock Examination'}
              </CardTitle>
              <CardDescription>
                {isBn
                  ? 'প্রশ্নের ধরন, সময়সীমা, নেগেটিভ মার্কিং এবং ফিডব্যাক মোড নির্বাচন করুন।'
                  : 'Select topics or saved notes, question formats, timer, and negative marking.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerateQuiz} className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={mode === 'practice' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMode('practice')}
                  >
                    {isBn ? 'অনুশীলন কুইজ' : 'Practice Quiz'}
                  </Button>
                  <Button
                    type="button"
                    variant={mode === 'mock_exam' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setMode('mock_exam');
                      setFeedbackTiming('after_submission');
                    }}
                  >
                    {isBn ? 'টাইমড মক পরীক্ষা' : 'Timed Mock Exam'}
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      {isBn ? 'বিষয় (ঐচ্ছিক)' : 'Subject Filter'}
                    </label>
                    <select
                      aria-label="Subject Filter"
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">{isBn ? 'সকল বিষয়' : 'All Subjects'}</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {isBn && s.nameBn ? s.nameBn : s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      {isBn ? 'সংরক্ষিত নোট থেকে (ঐচ্ছিক)' : 'From Saved Study Note'}
                    </label>
                    <select
                      aria-label="Saved Study Note"
                      value={selectedNoteId}
                      onChange={(e) => setSelectedNoteId(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">{isBn ? 'সিলেবাস টপিক ব্যবহার করুন' : 'Use Syllabus Topics'}</option>
                      {savedNotes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium">
                    {isBn
                      ? `নির্বাচিত টপিকসমূহ (${selectedTopicIds.length})`
                      : `Selected Syllabus Topics (${selectedTopicIds.length})`}
                  </label>
                  <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-md border border-border p-2.5">
                    {filteredTopics.map((topic) => {
                      const checked = selectedTopicIds.includes(topic.id);
                      return (
                        <label
                          key={topic.id}
                          className="flex cursor-pointer items-center gap-2 text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTopicSelection(topic.id)}
                            className="rounded border-input"
                          />
                          <span className="font-medium">
                            {isBn && topic.titleBn ? topic.titleBn : topic.title}
                          </span>
                          <span className="text-muted-foreground">({topic.code})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium">
                    {isBn ? 'প্রশ্নের ধরন (FR-QUIZ-002)' : 'Question Formats (FR-QUIZ-002)'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {QUESTION_TYPE_LABELS.map((qt) => {
                      const active = questionTypes.includes(qt.value);
                      return (
                        <button
                          key={qt.value}
                          type="button"
                          onClick={() => toggleQuestionType(qt.value)}
                          className={`rounded-md border px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                            active
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border bg-background text-muted-foreground'
                          }`}
                        >
                          {isBn ? qt.labelBn : qt.labelEn}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      {isBn ? 'প্রশ্ন সংখ্যা' : 'Questions'}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={40}
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value) || 5)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      {isBn ? 'কঠিন্য' : 'Difficulty'}
                    </label>
                    <select
                      aria-label="Difficulty"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                      className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm"
                    >
                      <option value="easy">{isBn ? 'সহজ' : 'Easy'}</option>
                      <option value="medium">{isBn ? 'মধ্যম' : 'Medium'}</option>
                      <option value="hard">{isBn ? 'কঠিন' : 'Hard'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      {isBn ? 'সময় (মিনিট)' : 'Time (Mins)'}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={180}
                      value={timeLimitMinutes}
                      onChange={(e) => setTimeLimitMinutes(Number(e.target.value) || 10)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      {isBn ? 'নেগেটিভ মার্কিং' : 'Negative Mark'}
                    </label>
                    <select
                      aria-label="Negative Marking"
                      value={negativeMarkingFactor}
                      onChange={(e) => setNegativeMarkingFactor(Number(e.target.value))}
                      className="w-full rounded-md border border-input bg-background px-2 py-2 text-xs"
                    >
                      <option value={0}>None (0.00)</option>
                      <option value={0.25}>-0.25 (BCS/Adm)</option>
                      <option value={0.5}>-0.50</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      {isBn ? 'সমাধান প্রদর্শন' : 'Explanations'}
                    </label>
                    <select
                      aria-label="Feedback Timing"
                      value={feedbackTiming}
                      onChange={(e) =>
                        setFeedbackTiming(e.target.value as 'after_submission' | 'immediate')
                      }
                      className="w-full rounded-md border border-input bg-background px-2 py-2 text-xs"
                    >
                      <option value="after_submission">
                        {isBn ? 'জমা দেওয়ার পর' : 'After Submit'}
                      </option>
                      <option value="immediate">
                        {isBn ? 'তাৎক্ষণিক' : 'Immediate'}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      {isBn ? 'ভাষা' : 'Language'}
                    </label>
                    <select
                      aria-label="Quiz Language"
                      value={quizLanguage}
                      onChange={(e) => setQuizLanguage(e.target.value as SupportedLanguage)}
                      className="w-full rounded-md border border-input bg-background px-2 py-2 text-xs"
                    >
                      <option value="en">English</option>
                      <option value="bn">বাংলা</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium">
                    {isBn ? 'বিশেষ নির্দেশনা (ঐচ্ছিক)' : 'Custom Exam Focus (Optional)'}
                  </label>
                  <Input
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder={
                      isBn
                        ? 'যেমন: গাণিতিক সমস্যা ও সূত্রের প্রয়োগে গুরুত্ব দিন'
                        : 'e.g., Focus on numerical problems and HSC board exam questions'
                    }
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading
                    ? isBn
                      ? 'প্রশ্নপত্র তৈরি হচ্ছে...'
                      : 'Generating Validated Quiz...'
                    : isBn
                      ? 'কুইজ / মক পরীক্ষা শুরু করুন'
                      : 'Generate & Start Exam'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Past Quizzes & Retry History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {isBn ? 'পূর্ববর্তী কুইজ ও পুনরায় চেষ্টা' : 'Recent Quizzes & Mock Exams'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {quizzes.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {isBn
                    ? 'এখনও কোনো কুইজ তৈরি করা হয়নি।'
                    : 'No quizzes generated yet. Create your first practice quiz or mock exam above.'}
                </p>
              ) : (
                quizzes.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <span>{q.title}</span>
                        <Badge variant="outline">{q.mode}</Badge>
                      </div>
                      <p className="text-muted-foreground">
                        {q.questionCount} Qs · {q.difficulty} ·{' '}
                        {q.bestAccuracyPercent !== null && q.bestAccuracyPercent !== undefined
                          ? `Best: ${q.bestAccuracyPercent}%`
                          : 'Not submitted yet'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleRetryQuiz(q.id)}
                      disabled={loading}
                    >
                      {isBn ? 'আবার দিন' : 'Retry'}
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Interactive Exam Arena & Post-Submission Diagnostics */}
        <div className="space-y-6 lg:col-span-7">
          {!activeQuiz || !activeAttempt ? (
            <Card>
              <CardContent className="flex min-h-[380px] flex-col items-center justify-center p-8 text-center">
                <Badge variant="secondary" className="mb-3">
                  {isBn ? 'পরীক্ষার ইন্টারফেস প্রস্তুত' : 'Interactive Examination Arena'}
                </Badge>
                <h2 className="text-lg font-semibold">
                  {isBn
                    ? 'বাম পাশ থেকে কুইজ তৈরি করুন বা পূর্বের কুইজ আবার দিন'
                    : 'Configure and launch a Quiz or Timed Mock Exam'}
                </h2>
                <p className="mt-1 max-w-md text-xs text-muted-foreground">
                  {isBn
                    ? 'প্রতিটি অবজেক্টিভ প্রশ্ন স্বয়ংক্রিয়ভাবে মূল্যায়ন করা হয় এবং সংক্ষিপ্ত উত্তরগুলো এআই রুব্রিক দ্বারা যাচাই করা হয়।'
                    : 'Supports countdown timers, question palette navigation, negative marking, AI-assisted short-answer rubric grading, and weak-topic identification.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Exam Header Bar with Countdown & Question Navigator */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{activeQuiz.title}</CardTitle>
                      <CardDescription>
                        {activeQuestions.length} Questions · Difficulty: {activeQuiz.difficulty} ·
                        Negative Marking: -{activeQuiz.negativeMarkingFactor}x
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeAttempt.status === 'in_progress' && remainingSeconds !== null ? (
                        <Badge
                          variant={remainingSeconds < 60 ? 'destructive' : 'accent'}
                          aria-label="Exam Countdown Timer"
                        >
                          ⏱ {formatCountdown(remainingSeconds)}
                        </Badge>
                      ) : null}
                      <Badge
                        variant={
                          activeAttempt.status === 'submitted' ? 'secondary' : 'default'
                        }
                      >
                        {activeAttempt.status === 'submitted'
                          ? `Submitted · ${activeAttempt.accuracyPercent}%`
                          : 'In Progress'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Question Navigation Palette (FR-QUIZ-008) */}
                  <div className="flex flex-wrap gap-1.5">
                    {activeQuestions.map((q, idx) => {
                      const draft = draftAnswers[q.id];
                      const isAnswered =
                        (draft?.selectedOptionIds.length ?? 0) > 0 ||
                        Boolean(draft?.shortAnswerText?.trim());
                      const isCurrent = idx === currentQuestionIndex;
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => setCurrentQuestionIndex(idx)}
                          className={`h-8 w-8 rounded-md border text-xs font-semibold transition-colors ${
                            isCurrent
                              ? 'border-primary bg-primary text-primary-foreground'
                              : isAnswered
                                ? 'border-primary/40 bg-primary/10 text-primary'
                                : 'border-border bg-background text-muted-foreground'
                          }`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Question Card */}
                  {currentQuestion && activeAttempt.status === 'in_progress' ? (
                    <div className="space-y-4 rounded-lg border border-border p-4">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Question {currentQuestionIndex + 1} of {activeQuestions.length} (
                          {currentQuestion.questionType})
                        </span>
                        <span>{currentQuestion.points} pt(s)</span>
                      </div>

                      <p className="text-sm font-medium leading-relaxed">
                        {currentQuestion.promptText}
                      </p>

                      {currentQuestion.questionType === 'short_answer' ? (
                        <textarea
                          rows={4}
                          value={draftAnswers[currentQuestion.id]?.shortAnswerText ?? ''}
                          onChange={(e) =>
                            handleShortAnswerChange(currentQuestion.id, e.target.value)
                          }
                          placeholder={
                            isBn
                              ? 'আপনার সংক্ষিপ্ত উত্তর এখানে লিখুন...'
                              : 'Write your concise academic answer here...'
                          }
                          className="w-full rounded-md border border-input bg-background p-3 text-sm"
                        />
                      ) : (
                        <div className="space-y-2">
                          {currentQuestion.options.map((opt) => {
                            const selected =
                              draftAnswers[currentQuestion.id]?.selectedOptionIds.includes(
                                opt.id,
                              ) ?? false;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => handleSelectOption(currentQuestion, opt.id)}
                                className={`flex w-full items-center gap-3 rounded-md border p-3 text-left text-sm transition-colors ${
                                  selected
                                    ? 'border-primary bg-primary/10 font-medium text-primary'
                                    : 'border-border bg-background hover:bg-muted/50'
                                }`}
                              >
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold">
                                  {opt.id}
                                </span>
                                <span>{opt.text}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Immediate feedback explanation if configured */}
                      {activeQuiz.feedbackTiming === 'immediate' &&
                      currentQuestion.explanation &&
                      ((draftAnswers[currentQuestion.id]?.selectedOptionIds.length ?? 0) > 0 ||
                        Boolean(
                          draftAnswers[currentQuestion.id]?.shortAnswerText?.trim(),
                        )) ? (
                        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
                          <p className="font-semibold">
                            Correct Option(s):{' '}
                            {(currentQuestion.correctOptionIds ?? []).join(', ') ||
                              'Rubric-evaluated'}
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            {currentQuestion.explanation}
                          </p>
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={currentQuestionIndex === 0}
                          onClick={() =>
                            setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))
                          }
                        >
                          {isBn ? 'পূর্ববর্তী' : 'Previous'}
                        </Button>

                        <div className="flex items-center gap-2">
                          {currentQuestionIndex < activeQuestions.length - 1 ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                setCurrentQuestionIndex((prev) =>
                                  Math.min(activeQuestions.length - 1, prev + 1),
                                )
                              }
                            >
                              {isBn ? 'পরবর্তী প্রশ্ন' : 'Next Question'}
                            </Button>
                          ) : null}

                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void handleSubmitAttempt()}
                            disabled={submitting}
                          >
                            {submitting
                              ? isBn
                                ? 'মূল্যায়ন হচ্ছে...'
                                : 'Scoring Exam...'
                              : isBn
                                ? 'পরীক্ষা জমা দিন'
                                : 'Submit Exam'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Post-Submission Results, Explanations & Weak Topic Diagnostics (FR-QUIZ-012..015) */}
              {activeAttempt.status === 'submitted' ? (
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">
                          {isBn
                            ? 'ফলাফল, ব্যাখ্যা এবং দুর্বল টপিক বিশ্লেষণ'
                            : 'Exam Results, Solutions & Weak-Topic Analysis'}
                        </CardTitle>
                        <CardDescription>
                          Score: {activeAttempt.scoreEarned} /{' '}
                          {activeAttempt.totalPointsPossible} pts (
                          {activeAttempt.accuracyPercent}% Accuracy)
                        </CardDescription>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleRetryQuiz(activeQuiz.id)}
                      >
                        {isBn ? 'কুইজটি আবার দিন' : 'Retry This Quiz'}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Weak Topics & Recommended Revision */}
                    {weakTopics.length > 0 ? (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3.5 text-xs">
                        <p className="font-semibold text-destructive">
                          {isBn
                            ? 'শনাক্তকৃত দুর্বল টপিকসমূহ (<60% নির্ভুলতা — FR-QUIZ-015):'
                            : 'Identified Weak Topics (<60% Accuracy — FR-QUIZ-015):'}
                        </p>
                        <ul className="mt-1.5 list-disc space-y-1 pl-4">
                          {weakTopics.map((wt) => (
                            <li key={wt.id}>
                              <span className="font-medium">{wt.title}</span> ({wt.code})
                            </li>
                          ))}
                        </ul>
                        {recommendedMaterials.length > 0 ? (
                          <div className="mt-2 border-t border-border/60 pt-2">
                            <p className="font-medium">
                              {isBn
                                ? 'প্রস্তাবিত রিভিশন নোটসমূহ:'
                                : 'Recommended Revision Notes from Your Library:'}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {recommendedMaterials.map((rm) => (
                                <Badge key={rm.id} variant="secondary">
                                  {rm.title}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Question-by-question solution breakdown */}
                    <div className="space-y-3">
                      {activeQuestions.map((q, idx) => {
                        const resp = activeAttempt.responses.find(
                          (r) => r.questionId === q.id,
                        );
                        return (
                          <div
                            key={q.id}
                            className="space-y-1.5 rounded-lg border border-border p-3.5 text-xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold">
                                Q{idx + 1}. {q.promptText}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {resp?.isAiEvaluated ? (
                                  <Badge variant="accent">AI-Assisted Evaluation</Badge>
                                ) : null}
                                <Badge
                                  variant={resp?.isCorrect ? 'secondary' : 'destructive'}
                                >
                                  {resp?.pointsAwarded ?? 0} / {q.points} pt
                                </Badge>
                              </div>
                            </div>

                            {q.questionType === 'short_answer' ? (
                              <div className="space-y-1 text-muted-foreground">
                                <p>
                                  <strong>Your Answer:</strong>{' '}
                                  {resp?.shortAnswerText || '(Unanswered)'}
                                </p>
                                {resp?.aiEvaluationFeedback ? (
                                  <p className="text-foreground">
                                    {resp.aiEvaluationFeedback}
                                  </p>
                                ) : null}
                              </div>
                            ) : (
                              <p className="text-muted-foreground">
                                <strong>Selected:</strong>{' '}
                                {(resp?.selectedOptionIds ?? []).join(', ') || 'None'} ·{' '}
                                <strong>Correct:</strong>{' '}
                                {(q.correctOptionIds ?? []).join(', ')}
                              </p>
                            )}

                            {q.explanation ? (
                              <p className="rounded bg-muted/50 p-2 text-muted-foreground">
                                <strong>Explanation:</strong> {q.explanation}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
