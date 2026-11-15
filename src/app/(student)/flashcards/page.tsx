'use client';

import React, { useCallback, useEffect, useState } from 'react';
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
import type { FlashcardRating, SupportedLanguage } from '@/types/domain';

interface TopicOption {
  id: string;
  code: string;
  title: string;
  titleBn?: string;
}

interface SavedNoteOption {
  id: string;
  title: string;
}

interface DeckSummaryItem {
  id: string;
  title: string;
  description?: string;
  topicId?: string;
  language: SupportedLanguage;
  cardCount: number;
  dueCount: number;
  upcomingCount: number;
  masteredCount: number;
  difficultCount: number;
}

interface FlashcardItem {
  id: string;
  deckId: string;
  front: string;
  back: string;
  hint?: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: string;
  lastReviewedAt?: string;
  lastRating?: FlashcardRating;
  masteryState: 'new' | 'learning' | 'review' | 'mastered' | 'difficult';
}

interface QueueBreakdown {
  dueCount: number;
  upcomingCount: number;
  masteredCount: number;
  difficultCount: number;
  totalCount: number;
}

interface ReviewLogItem {
  id: string;
  flashcardId: string;
  rating: FlashcardRating;
  previousIntervalDays: number;
  newIntervalDays: number;
  newEaseFactor: number;
  reviewedAt: string;
}

export default function StudentFlashcardsPage() {
  const { language: uiLanguage } = useUIPreferences();
  const isBn = uiLanguage === 'bn';

  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [savedNotes, setSavedNotes] = useState<SavedNoteOption[]>([]);
  const [decks, setDecks] = useState<DeckSummaryItem[]>([]);
  const [summary, setSummary] = useState<QueueBreakdown>({
    dueCount: 0,
    upcomingCount: 0,
    masteredCount: 0,
    difficultCount: 0,
    totalCount: 0,
  });

  // Review queue state
  const [queueFilter, setQueueFilter] = useState<
    'due' | 'upcoming' | 'mastered' | 'difficult' | 'all'
  >('due');
  const [selectedDeckFilter, setSelectedDeckFilter] = useState<string>('');
  const [reviewQueue, setReviewQueue] = useState<FlashcardItem[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [recentLogs, setRecentLogs] = useState<ReviewLogItem[]>([]);

  // Generator & Manual Card state
  const [creationMode, setCreationMode] = useState<'ai' | 'manual'>('ai');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [selectedNoteId, setSelectedNoteId] = useState<string>('');
  const [cardCount, setCardCount] = useState<number>(6);
  const [deckLanguage, setDeckLanguage] = useState<SupportedLanguage>('en');
  const [customInstructions, setCustomInstructions] = useState<string>('');

  const [manualTitle, setManualTitle] = useState<string>('');
  const [manualFront, setManualFront] = useState<string>('');
  const [manualBack, setManualBack] = useState<string>('');
  const [manualHint, setManualHint] = useState<string>('');

  // Editing an existing card
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState<string>('');
  const [editBack, setEditBack] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDecksAndQueue = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams({ filter: queueFilter });
      if (selectedDeckFilter) queryParams.set('deckId', selectedDeckFilter);

      const [decksRes, reviewsRes, currRes, matRes] = await Promise.all([
        fetch('/api/v1/flashcards'),
        fetch(`/api/v1/reviews?${queryParams.toString()}`),
        fetch('/api/v1/curriculum?limit=40'),
        fetch('/api/v1/materials?limit=20'),
      ]);

      if (decksRes.ok) {
        const decksJson = await decksRes.json();
        setDecks(decksJson.data?.decks ?? []);
        if (decksJson.data?.overallSummary) {
          setSummary(decksJson.data.overallSummary);
        }
      }

      if (reviewsRes.ok) {
        const revJson = await reviewsRes.json();
        setReviewQueue(revJson.data?.cards ?? []);
        if (revJson.data?.summary) {
          setSummary(revJson.data.summary);
        }
        setRecentLogs(revJson.data?.recentLogs ?? []);
        setCurrentCardIndex(0);
        setIsFlipped(false);
      }

      if (currRes.ok) {
        const currJson = await currRes.json();
        const topicList: TopicOption[] = currJson.data?.topics ?? [];
        setTopics(topicList);
        if (topicList.length > 0 && !selectedTopicId) {
          setSelectedTopicId(topicList[0]!.id);
        }
      }

      if (matRes.ok) {
        const matJson = await matRes.json();
        setSavedNotes(matJson.data?.materials ?? []);
      }
    } catch {
      // Non-fatal initial load error
    }
  }, [queueFilter, selectedDeckFilter, selectedTopicId]);

  useEffect(() => {
    void loadDecksAndQueue();
  }, [loadDecksAndQueue]);

  const handleGenerateOrCreateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const payload =
        creationMode === 'ai'
          ? {
              mode: 'ai',
              ...(selectedTopicId ? { topicId: selectedTopicId } : {}),
              ...(selectedNoteId ? { generatedContentId: selectedNoteId } : {}),
              cardCount,
              language: deckLanguage,
              ...(customInstructions.trim()
                ? { customInstructions: customInstructions.trim() }
                : {}),
            }
          : {
              mode: 'manual',
              title: manualTitle.trim() || 'Personal Flashcard Deck',
              ...(selectedTopicId ? { topicId: selectedTopicId } : {}),
              language: deckLanguage,
              cards:
                manualFront.trim() && manualBack.trim()
                  ? [
                      {
                        front: manualFront.trim(),
                        back: manualBack.trim(),
                        ...(manualHint.trim() ? { hint: manualHint.trim() } : {}),
                      },
                    ]
                  : [],
            };

      const res = await fetch('/api/v1/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message || 'Failed to create flashcards');
        return;
      }

      setManualTitle('');
      setManualFront('');
      setManualBack('');
      setManualHint('');
      setCustomInstructions('');
      await loadDecksAndQueue();
    } catch {
      setErrorMessage('Network error while creating flashcards');
    } finally {
      setLoading(false);
    }
  };

  const handleRateCard = async (rating: FlashcardRating) => {
    const activeCard = reviewQueue[currentCardIndex];
    if (!activeCard) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/v1/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flashcardId: activeCard.id,
          rating,
          durationMs: 4200,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message || 'Failed to record card review');
        return;
      }

      setIsFlipped(false);
      await loadDecksAndQueue();
    } catch {
      setErrorMessage('Network error recording card review');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCardEdit = async (cardId: string) => {
    if (!editFront.trim() || !editBack.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/flashcards/${cardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          front: editFront.trim(),
          back: editBack.trim(),
        }),
      });
      if (res.ok) {
        setEditingCardId(null);
        await loadDecksAndQueue();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/flashcards/${cardId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await loadDecksAndQueue();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDeck = async (deckId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/flashcards/${deckId}?type=deck`, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (selectedDeckFilter === deckId) setSelectedDeckFilter('');
        await loadDecksAndQueue();
      }
    } finally {
      setLoading(false);
    }
  };

  const activeCard = reviewQueue[currentCardIndex];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isBn
              ? 'স্মার্ট ফ্ল্যাশকার্ড এবং স্পেসড রিপিটিশন (SM-2)'
              : 'Smart Flashcards & Spaced Repetition (SM-2)'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isBn
              ? 'টপিক বা নোট থেকে ফ্ল্যাশকার্ড তৈরি করুন এবং Again / Hard / Good / Easy রেটিং দিয়ে দীর্ঘমেয়াদী স্মৃতিতে সংরক্ষণ করুন।'
              : 'Generate active-recall decks from syllabus topics or saved notes and review with deterministic SM-2 scheduling.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="accent">FR-FLASH-001..010</Badge>
          <Badge variant="secondary">SM-2 Scheduler</Badge>
        </div>
      </div>

      {/* Spaced-Repetition Status KPIs (FR-FLASH-009) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              {isBn ? 'এখন রিভিউ বাকি (Due)' : 'Due for Review'}
            </p>
            <p className="mt-1 text-2xl font-bold text-primary">{summary.dueCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              {isBn ? 'আসন্ন (Upcoming)' : 'Upcoming Cards'}
            </p>
            <p className="mt-1 text-2xl font-bold">{summary.upcomingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              {isBn ? 'আয়ত্তকৃত (Mastered)' : 'Mastered Cards'}
            </p>
            <p className="mt-1 text-2xl font-bold">{summary.masteredCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              {isBn ? 'কঠিন কার্ড (Difficult)' : 'Difficult Cards'}
            </p>
            <p className="mt-1 text-2xl font-bold text-destructive">
              {summary.difficultCount}
            </p>
          </CardContent>
        </Card>
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
        {/* Left Column: AI & Manual Deck Creator + Deck List */}
        <div className="space-y-6 lg:col-span-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {isBn ? 'ফ্ল্যাশকার্ড ডেক তৈরি করুন' : 'Create or Generate Flashcards'}
              </CardTitle>
              <CardDescription>
                {isBn
                  ? 'এআই দিয়ে স্বয়ংক্রিয়ভাবে তৈরি করুন অথবা নিজে ফ্রন্ট/ব্যাক লিখুন।'
                  : 'Generate active-recall cards with AI or build a personal deck manually.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerateOrCreateDeck} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={creationMode === 'ai' ? 'default' : 'outline'}
                    onClick={() => setCreationMode('ai')}
                  >
                    {isBn ? 'এআই জেনারেটর' : 'AI Flashcard Generator'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={creationMode === 'manual' ? 'default' : 'outline'}
                    onClick={() => setCreationMode('manual')}
                  >
                    {isBn ? 'ম্যানুয়াল কার্ড' : 'Manual Deck & Card'}
                  </Button>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium">
                    {isBn ? 'সিলেবাস টপিক' : 'Curriculum Topic'}
                  </label>
                  <select
                    aria-label="Curriculum Topic"
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {isBn && t.titleBn ? t.titleBn : t.title} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>

                {creationMode === 'ai' ? (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-medium">
                        {isBn ? 'সংরক্ষিত নোট থেকে (ঐচ্ছিক)' : 'From Saved Study Note (Optional)'}
                      </label>
                      <select
                        aria-label="Saved Study Note"
                        value={selectedNoteId}
                        onChange={(e) => setSelectedNoteId(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">
                          {isBn ? 'শুধু সিলেবাস টপিক' : 'Use Syllabus Topic Only'}
                        </option>
                        {savedNotes.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium">
                          {isBn ? 'কার্ড সংখ্যা' : 'Card Count'}
                        </label>
                        <Input
                          type="number"
                          min={1}
                          max={25}
                          value={cardCount}
                          onChange={(e) => setCardCount(Number(e.target.value) || 6)}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">
                          {isBn ? 'ভাষা' : 'Language'}
                        </label>
                        <select
                          aria-label="Deck Language"
                          value={deckLanguage}
                          onChange={(e) =>
                            setDeckLanguage(e.target.value as SupportedLanguage)
                          }
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="en">English</option>
                          <option value="bn">বাংলা</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium">
                        {isBn ? 'অতিরিক্ত নির্দেশনা' : 'Focus Instructions (Optional)'}
                      </label>
                      <Input
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        placeholder={
                          isBn
                            ? 'যেমন: সূত্র এবং গুরুত্বপূর্ণ সংজ্ঞা অন্তর্ভুক্ত করুন'
                            : 'e.g., Focus on SI units, formulas, and board exam definitions'
                        }
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-medium">
                        {isBn ? 'ডেকের নাম' : 'Deck Title'}
                      </label>
                      <Input
                        required
                        value={manualTitle}
                        onChange={(e) => setManualTitle(e.target.value)}
                        placeholder="e.g., HSC Physics Ch 4 Formulas"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium">
                        {isBn ? 'ফ্রন্ট (প্রশ্ন / টার্ম)' : 'Card Front (Prompt / Term)'}
                      </label>
                      <Input
                        required
                        value={manualFront}
                        onChange={(e) => setManualFront(e.target.value)}
                        placeholder="State Newton's Second Law of Motion"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium">
                        {isBn ? 'ব্যাক (উত্তর / ব্যাখ্যা)' : 'Card Back (Answer)'}
                      </label>
                      <Input
                        required
                        value={manualBack}
                        onChange={(e) => setManualBack(e.target.value)}
                        placeholder="F = dp/dt = ma"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium">
                        {isBn ? 'হিন্ট (ঐচ্ছিক)' : 'Hint (Optional)'}
                      </label>
                      <Input
                        value={manualHint}
                        onChange={(e) => setManualHint(e.target.value)}
                        placeholder="Rate of change of momentum"
                      />
                    </div>
                  </>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading
                    ? isBn
                      ? 'প্রক্রিয়াকরণ চলছে...'
                      : 'Saving Flashcards...'
                    : creationMode === 'ai'
                      ? isBn
                        ? 'এআই ফ্ল্যাশকার্ড তৈরি করুন'
                        : 'Generate AI Flashcards'
                      : isBn
                        ? 'ম্যানুয়াল ডেক তৈরি করুন'
                        : 'Create Personal Deck'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Personal Decks List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {isBn ? 'আপনার ফ্ল্যাশকার্ড ডেকসমূহ' : 'Your Flashcard Decks'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {decks.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {isBn
                    ? 'কোনো ডেক নেই। উপরে একটি নতুন ডেক তৈরি করুন।'
                    : 'No decks yet. Generate an AI deck or create one manually above.'}
                </p>
              ) : (
                decks.map((d) => (
                  <div
                    key={d.id}
                    className={`flex items-center justify-between gap-2 rounded-lg border p-3 text-xs ${
                      selectedDeckFilter === d.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedDeckFilter((prev) => (prev === d.id ? '' : d.id))
                      }
                      className="text-left"
                    >
                      <p className="font-semibold">{d.title}</p>
                      <p className="text-muted-foreground">
                        {d.cardCount} cards · {d.dueCount} due · {d.masteredCount} mastered
                      </p>
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleDeleteDeck(d.id)}
                    >
                      {isBn ? 'মুছুন' : 'Delete'}
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Interactive Flip Card Review Arena & Review History */}
        <div className="space-y-6 lg:col-span-7">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    {isBn ? 'ফ্লিপ কার্ড রিভিউ অ্যারেনা' : 'Interactive Flip-Card Review Arena'}
                  </CardTitle>
                  <CardDescription>
                    {isBn
                      ? 'কার্ডে ক্লিক করে উত্তর দেখুন এবং আপনার স্মৃতির মান অনুযায়ী রেটিং দিন।'
                      : 'Click the card to flip between Front and Back, then rate recall quality.'}
                  </CardDescription>
                </div>

                {/* Queue Filter Tabs (FR-FLASH-009) */}
                <div className="flex flex-wrap gap-1">
                  {(['due', 'upcoming', 'mastered', 'difficult', 'all'] as const).map(
                    (f) => (
                      <Button
                        key={f}
                        size="sm"
                        variant={queueFilter === f ? 'default' : 'outline'}
                        onClick={() => setQueueFilter(f)}
                      >
                        {f.toUpperCase()}
                      </Button>
                    ),
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!activeCard ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
                  <Badge variant="secondary" className="mb-2">
                    {queueFilter.toUpperCase()} QUEUE
                  </Badge>
                  <p className="text-sm font-medium">
                    {isBn
                      ? 'এই তালিকায় বর্তমানে কোনো কার্ড নেই।'
                      : `No cards currently in the "${queueFilter}" filter.`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isBn
                      ? 'নতুন ফ্ল্যাশকার্ড তৈরি করুন অথবা উপরের ALL ট্যাবে ক্লিক করুন।'
                      : 'Generate new flashcards on the left or switch to the ALL tab.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Card {currentCardIndex + 1} of {reviewQueue.length} · State:{' '}
                      <strong>{activeCard.masteryState}</strong>
                    </span>
                    <span>
                      Interval: {activeCard.intervalDays}d · Ease: {activeCard.easeFactor}
                    </span>
                  </div>

                  {/* Interactive Flip Card Surface (FR-FLASH-004) */}
                  <button
                    type="button"
                    onClick={() => setIsFlipped((prev) => !prev)}
                    className="flex min-h-[220px] w-full flex-col items-center justify-center rounded-xl border-2 border-primary/30 bg-card p-6 text-center shadow-sm transition-all hover:border-primary"
                  >
                    <Badge variant={isFlipped ? 'accent' : 'outline'} className="mb-3">
                      {isFlipped
                        ? isBn
                          ? 'উত্তর (BACK)'
                          : 'ANSWER (BACK)'
                        : isBn
                          ? 'প্রশ্ন (FRONT — ক্লিক করে উল্টান)'
                          : 'PROMPT (FRONT — Click to Flip)'}
                    </Badge>
                    <p className="max-w-xl text-base font-semibold leading-relaxed">
                      {isFlipped ? activeCard.back : activeCard.front}
                    </p>
                    {!isFlipped && activeCard.hint ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        💡 Hint: {activeCard.hint}
                      </p>
                    ) : null}
                  </button>

                  {/* 4 SM-2 Rating Controls (FR-FLASH-007) */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={loading}
                      onClick={() => void handleRateCard('again')}
                    >
                      Again (10m)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      onClick={() => void handleRateCard('hard')}
                    >
                      Hard (~1.2x)
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={loading}
                      onClick={() => void handleRateCard('good')}
                    >
                      Good (~2.5x)
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      disabled={loading}
                      onClick={() => void handleRateCard('easy')}
                    >
                      Easy (~3.2x)
                    </Button>
                  </div>

                  {/* Card Navigation + Edit/Delete Controls (FR-FLASH-005) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={currentCardIndex === 0}
                        onClick={() => {
                          setCurrentCardIndex((prev) => Math.max(0, prev - 1));
                          setIsFlipped(false);
                        }}
                      >
                        {isBn ? 'পূর্ববর্তী' : 'Prev'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={currentCardIndex >= reviewQueue.length - 1}
                        onClick={() => {
                          setCurrentCardIndex((prev) =>
                            Math.min(reviewQueue.length - 1, prev + 1),
                          );
                          setIsFlipped(false);
                        }}
                      >
                        {isBn ? 'পরবর্তী' : 'Next'}
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingCardId(activeCard.id);
                          setEditFront(activeCard.front);
                          setEditBack(activeCard.back);
                        }}
                      >
                        {isBn ? 'সম্পাদনা' : 'Edit Card'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleDeleteCard(activeCard.id)}
                      >
                        {isBn ? 'কার্ড মুছুন' : 'Delete Card'}
                      </Button>
                    </div>
                  </div>

                  {editingCardId === activeCard.id ? (
                    <div className="space-y-2 rounded-lg border border-border p-3">
                      <Input
                        value={editFront}
                        onChange={(e) => setEditFront(e.target.value)}
                        placeholder="Front text"
                      />
                      <Input
                        value={editBack}
                        onChange={(e) => setEditBack(e.target.value)}
                        placeholder="Back text"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => void handleSaveCardEdit(activeCard.id)}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingCardId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          {/* Review History Log (FR-FLASH-010) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {isBn ? 'সাম্প্রতিক রিভিউ ইতিহাস (FR-FLASH-010)' : 'Recent Spaced-Repetition Review History'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {isBn
                    ? 'এখনও কোনো কার্ড রিভিউ করা হয়নি।'
                    : 'No review logs recorded yet. Rate a card above to track your SM-2 retention timeline.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {recentLogs.slice(0, 6).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{log.rating.toUpperCase()}</Badge>
                        <span>
                          Interval: {log.previousIntervalDays}d →{' '}
                          <strong>{log.newIntervalDays}d</strong> (EF: {log.newEaseFactor})
                        </span>
                      </div>
                      <span className="text-muted-foreground">
                        {new Date(log.reviewedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
