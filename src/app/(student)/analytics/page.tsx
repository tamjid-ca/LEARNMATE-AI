'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Flame,
  Info,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
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

type MasteryBand = 'unstarted' | 'weak' | 'developing' | 'strong';

interface SubjectPerformanceItem {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  subjectNameBn?: string;
  totalTopicsCount: number;
  completedTopicsCount: number;
  studyTimeMinutes: number;
  quizAttemptsCount: number;
  averageQuizAccuracyPercent: number;
  estimatedMasteryScore: number;
  masteryBand: MasteryBand;
}

interface TopicMasteryViewItem {
  topicId: string;
  topicCode: string;
  topicTitle: string;
  topicTitleBn?: string;
  subjectId: string;
  subjectName: string;
  chapterId: string;
  isCompleted: boolean;
  studyTimeMinutes: number;
  quizAttemptsCount: number;
  quizAverageAccuracy: number;
  flashcardReviewsCount: number;
  estimatedMasteryScore: number;
  masteryBand: MasteryBand;
}

interface PerformanceTrendPoint {
  dateKey: string;
  studyMinutes: number;
  quizAccuracyPercent: number | null;
  flashcardReviewsCount: number;
}

interface ExplainableRecommendationItem {
  id: string;
  title: string;
  reason: string;
  evidenceBasis: string;
  suggestedAction: string;
  actionUrl: string;
  priority: 'high' | 'medium' | 'low';
}

interface GamificationMilestoneItem {
  code: string;
  title: string;
  description: string;
  unlocked: boolean;
  progressCurrent: number;
  progressTarget: number;
  pointsAwarded: number;
}

interface AnalyticsDashboardData {
  overview: {
    totalStudyTimeMinutes: number;
    completedTopicsCount: number;
    totalTopicsCount: number;
    quizAttemptsCount: number;
    averageQuizAccuracyPercent: number;
    flashcardReviewsCount: number;
    dueFlashcardsCount: number;
    studyPlanCompletionPercent: number;
    overallEstimatedMasteryScore: number;
    masteryEstimateDisclaimer: string;
  };
  subjectPerformance: SubjectPerformanceItem[];
  topicMastery: TopicMasteryViewItem[];
  strongTopics: TopicMasteryViewItem[];
  weakTopics: TopicMasteryViewItem[];
  performanceTrends: PerformanceTrendPoint[];
  recommendations: ExplainableRecommendationItem[];
  gamification: {
    currentStreakDays: number;
    longestStreakDays: number;
    meaningfulStudyPoints: number;
    milestones: GamificationMilestoneItem[];
    antiGamingPolicyNote: string;
  };
}

export default function StudentAnalyticsPage() {
  const { language } = useUIPreferences();
  const isBn = language === 'bn';

  const [data, setData] = useState<AnalyticsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bandFilter, setBandFilter] = useState<'all' | MasteryBand>('all');

  const fetchAnalytics = useCallback(
    async (refreshAi = false) => {
      if (refreshAi) setRefreshing(true);
      else setLoading(true);
      setErrorMessage(null);

      try {
        const res = await fetch(
          `/api/v1/analytics?language=${language}&refreshAiRecommendations=${refreshAi}`,
        );
        const json = await res.json();
        if (res.ok && json.success) {
          setData(json.data);
        } else {
          setErrorMessage(json?.error?.message ?? 'Failed to load learning analytics.');
        }
      } catch {
        setErrorMessage('Network error while loading learning analytics.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [language],
  );

  useEffect(() => {
    void fetchAnalytics(false);
  }, [fetchAnalytics]);

  const handleMarkTopicCompleted = async (topicId: string) => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/v1/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId,
          studyTimeMinutesDelta: 20,
          markCompleted: true,
        }),
      });
      if (res.ok) {
        await fetchAnalytics(false);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const filteredTopics =
    data?.topicMastery.filter((t) =>
      bandFilter === 'all' ? true : t.masteryBand === bandFilter,
    ) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isBn
              ? 'লার্নিং অ্যানালিটিক্স ও অ্যাডাপ্টিভ মাস্টারি ড্যাশবোর্ড'
              : 'Learning Analytics & Adaptive Mastery'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isBn
              ? 'যাচাইকৃত কুইজ ফলাফল, ফ্ল্যাশকার্ড রিভিশন এবং সম্পন্ন টপিকের ভিত্তিতে আপনার অগ্রগতি।'
              : 'Track verified study time, subject performance, estimated topic mastery, streaks, and explainable recommendations.'}
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          disabled={loading || refreshing}
          onClick={() => void fetchAnalytics(true)}
        >
          <RefreshCw className={`mr-1.5 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {isBn ? 'এআই পরামর্শ রিফ্রেশ করুন' : 'Refresh AI Recommendations'}
        </Button>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      )}

      {loading || !data ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {isBn
              ? 'আপনার যাচাইকৃত অধ্যয়ন পরিসংখ্যান গণনা করা হচ্ছে...'
              : 'Calculating learning analytics from verified study history...'}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Honest Mastery Estimate Disclaimer (FR-ANALYTICS-008) */}
          <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{data.overview.masteryEstimateDisclaimer}</span>
          </div>

          {/* Overview KPI Grid (FR-ANALYTICS-002) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {isBn ? 'আনুমানিক দক্ষতা (Estimate)' : 'Estimated Mastery'}
                </CardDescription>
                <CardTitle className="text-2xl">
                  {data.overview.overallEstimatedMasteryScore}%
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {data.overview.completedTopicsCount} / {data.overview.totalTopicsCount}{' '}
                {isBn ? 'টপিক সম্পন্ন' : 'topics completed'}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {isBn ? 'মোট অধ্যয়নের সময়' : 'Total Study Time'}
                </CardDescription>
                <CardTitle className="flex items-center gap-1.5 text-2xl">
                  <Clock className="h-5 w-5 text-primary" />
                  <span>{data.overview.totalStudyTimeMinutes}m</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Plan completion: {data.overview.studyPlanCompletionPercent}%
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {isBn ? 'কুইজ নির্ভুলতা' : 'Quiz Accuracy'}
                </CardDescription>
                <CardTitle className="text-2xl">
                  {data.overview.averageQuizAccuracyPercent}%
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Across {data.overview.quizAttemptsCount} submitted attempt(s)
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {isBn ? 'ফ্ল্যাশকার্ড রিভিশন' : 'Flashcard Reviews'}
                </CardDescription>
                <CardTitle className="text-2xl">
                  {data.overview.flashcardReviewsCount}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {data.overview.dueFlashcardsCount} card(s) currently due
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {isBn ? 'অধ্যয়ন ধারাবাহিকতা ও পয়েন্ট' : 'Streak & Study Points'}
                </CardDescription>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Flame className="h-5 w-5 text-amber-500" />
                  <span>{data.gamification.currentStreakDays}d</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {data.gamification.meaningfulStudyPoints} pts · Best:{' '}
                {data.gamification.longestStreakDays}d
              </CardContent>
            </Card>
          </div>

          {/* Explainable Adaptive Learning Recommendations (FR-ANALYTICS-005..007) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary" />
                <span>
                  {isBn
                    ? 'ব্যাখ্যাযোগ্য অ্যাডাপ্টিভ অধ্যয়ন সুপারিশ (FR-ANALYTICS-005..007)'
                    : 'Explainable Adaptive Recommendations (FR-ANALYTICS-005..007)'}
                </span>
              </CardTitle>
              <CardDescription>
                {isBn
                  ? 'প্রতিটি সুপারিশের পেছনে যাচাইকৃত কুইজ, ফ্ল্যাশকার্ড বা রোডম্যাপের ভিত্তি প্রদর্শিত হয়েছে।'
                  : 'Inspect the verified performance basis behind every major learning recommendation.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {data.recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="flex flex-col justify-between gap-3 rounded-lg border p-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm">{rec.title}</span>
                      <Badge
                        variant={
                          rec.priority === 'high'
                            ? 'destructive'
                            : rec.priority === 'medium'
                              ? 'default'
                              : 'secondary'
                        }
                        className="text-[11px] uppercase"
                      >
                        {rec.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{rec.reason}</p>
                    <div className="rounded bg-muted/60 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                      <strong>Basis:</strong> {rec.evidenceBasis}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-medium text-primary">
                      {rec.suggestedAction}
                    </span>
                    <Link href={rec.actionUrl}>
                      <Button size="sm" variant="outline">
                        {isBn ? 'শুরু করুন' : 'Open'}
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Subject-wise Performance & Gamification Milestones */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Subject-wise Performance (FR-ANALYTICS-002) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <span>
                    {isBn ? 'বিষয়ভিত্তিক পারফরম্যান্স' : 'Subject-Wise Performance'}
                  </span>
                </CardTitle>
                <CardDescription>
                  {isBn
                    ? 'প্রতিটি বিষয়ে সম্পন্ন টপিক, কুইজ নির্ভুলতা এবং আনুমানিক দক্ষতা।'
                    : 'Topic completion, quiz accuracy, and estimated mastery across syllabus subjects.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.subjectPerformance.map((sub) => (
                  <div key={sub.subjectId} className="space-y-1.5 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {isBn && sub.subjectNameBn ? sub.subjectNameBn : sub.subjectName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {sub.completedTopicsCount}/{sub.totalTopicsCount} topics ·{' '}
                          {sub.studyTimeMinutes} mins · Quiz avg:{' '}
                          {sub.averageQuizAccuracyPercent}%
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={
                            sub.masteryBand === 'strong'
                              ? 'default'
                              : sub.masteryBand === 'weak'
                                ? 'destructive'
                                : 'secondary'
                          }
                          className="capitalize"
                        >
                          {sub.estimatedMasteryScore}% ({sub.masteryBand})
                        </Badge>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${sub.estimatedMasteryScore}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Gamification Milestones & Performance Trends (FR-ANALYTICS-003, FR-GAME-001..004) */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Award className="h-5 w-5 text-amber-500" />
                    <span>
                      {isBn
                        ? 'অর্জন ও মাইলফলক (FR-GAME-001..004)'
                        : 'Achievement Milestones (FR-GAME-001..004)'}
                    </span>
                  </CardTitle>
                  <CardDescription>{data.gamification.antiGamingPolicyNote}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {data.gamification.milestones.map((m) => (
                    <div
                      key={m.code}
                      className={`flex items-center justify-between rounded-lg border p-3 ${
                        m.unlocked ? 'border-emerald-500/40 bg-emerald-500/5' : ''
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium">{m.title}</p>
                        <p className="text-xs text-muted-foreground">{m.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {m.progressCurrent}/{m.progressTarget}
                        </span>
                        <Badge variant={m.unlocked ? 'default' : 'outline'}>
                          {m.unlocked ? `Unlocked (+${m.pointsAwarded} pts)` : 'Locked'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span>
                      {isBn ? 'সাম্প্রতিক পারফরম্যান্স ট্রেন্ড' : 'Recent Activity & Performance Trends'}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.performanceTrends.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {isBn
                        ? 'কুইজ বা ফ্ল্যাশকার্ড অনুশীলন সম্পন্ন করলে এখানে দৈনিক ট্রেন্ড দেখা যাবে।'
                        : 'Complete a quiz attempt, flashcard review, or study task to populate daily trend telemetry.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {data.performanceTrends.map((pt) => (
                        <div
                          key={pt.dateKey}
                          className="flex items-center justify-between rounded border px-3 py-2 text-xs"
                        >
                          <span className="font-medium">{pt.dateKey}</span>
                          <span>{pt.studyMinutes} mins studied</span>
                          <span>
                            {pt.quizAccuracyPercent !== null
                              ? `Quiz: ${pt.quizAccuracyPercent}%`
                              : 'No quiz'}
                          </span>
                          <span>{pt.flashcardReviewsCount} card reviews</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Topic-wise Mastery Matrix (FR-ANALYTICS-004, FR-ANALYTICS-008) */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <span>
                      {isBn
                        ? 'টপিকভিত্তিক আনুমানিক দক্ষতা (Strong vs Weak Topics)'
                        : 'Topic-Wise Estimated Mastery Breakdown'}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    Strong topics: {data.strongTopics.length} · Weak topics:{' '}
                    {data.weakTopics.length}
                  </CardDescription>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(['all', 'strong', 'developing', 'weak', 'unstarted'] as const).map((b) => (
                    <Button
                      key={b}
                      size="sm"
                      variant={bandFilter === b ? 'default' : 'outline'}
                      className="h-7 px-2.5 text-xs capitalize"
                      onClick={() => setBandFilter(b)}
                    >
                      {b}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTopics.map((topic) => (
                <div
                  key={topic.topicId}
                  className="flex flex-col justify-between gap-3 rounded-lg border p-3.5"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        {topic.topicCode}
                      </span>
                      <Badge
                        variant={
                          topic.masteryBand === 'strong'
                            ? 'default'
                            : topic.masteryBand === 'weak'
                              ? 'destructive'
                              : 'secondary'
                        }
                        className="text-[11px] capitalize"
                      >
                        Est. {topic.estimatedMasteryScore}% · {topic.masteryBand}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">
                      {isBn && topic.topicTitleBn ? topic.topicTitleBn : topic.topicTitle}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {topic.subjectName} · {topic.studyTimeMinutes}m · Quizzes:{' '}
                      {topic.quizAttemptsCount} ({topic.quizAverageAccuracy}%) · Reviews:{' '}
                      {topic.flashcardReviewsCount}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    {topic.isCompleted ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {isBn ? 'টপিক সম্পন্ন' : 'Completed'}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={refreshing}
                        onClick={() => void handleMarkTopicCompleted(topic.topicId)}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        {isBn ? 'সম্পন্ন চিহ্নিত করুন (+২০ মিনিট)' : 'Log 20m & Mark Complete'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
