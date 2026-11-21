'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  CalendarRange,
  ClipboardCheck,
  Flame,
  FolderUp,
  Layers,
  Sparkles,
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

interface LiveDashboardSummary {
  streakDays: number;
  meaningfulStudyPoints: number;
  dueFlashcardsCount: number;
  overallEstimatedMasteryScore: number;
  completedTopicsCount: number;
  totalTopicsCount: number;
  studyPlanCompletionPercent: number;
  unreadNotificationsCount: number;
  topRecommendation?: {
    title: string;
    reason: string;
    evidenceBasis: string;
    actionUrl: string;
  };
}

export default function StudentDashboardPage() {
  const { language } = useUIPreferences();
  const isBn = language === 'bn';

  const [liveSummary, setLiveSummary] = useState<LiveDashboardSummary | null>(null);

  useEffect(() => {
    let active = true;
    async function loadLiveSummary() {
      try {
        const [analyticsRes, notifyRes] = await Promise.all([
          fetch(`/api/v1/analytics?language=${language}`),
          fetch('/api/v1/notifications'),
        ]);
        const analyticsJson = await analyticsRes.json();
        const notifyJson = await notifyRes.json();

        if (active && analyticsRes.ok && analyticsJson.success) {
          const d = analyticsJson.data;
          setLiveSummary({
            streakDays: d.gamification?.currentStreakDays ?? 0,
            meaningfulStudyPoints: d.gamification?.meaningfulStudyPoints ?? 0,
            dueFlashcardsCount: d.overview?.dueFlashcardsCount ?? 0,
            overallEstimatedMasteryScore: d.overview?.overallEstimatedMasteryScore ?? 0,
            completedTopicsCount: d.overview?.completedTopicsCount ?? 0,
            totalTopicsCount: d.overview?.totalTopicsCount ?? 9,
            studyPlanCompletionPercent: d.overview?.studyPlanCompletionPercent ?? 0,
            unreadNotificationsCount:
              notifyRes.ok && notifyJson.success ? (notifyJson.data.unreadCount ?? 0) : 0,
            topRecommendation: d.recommendations?.[0],
          });
        }
      } catch {
        // Keep fallback cards if unauthenticated or offline
      }
    }
    void loadLiveSummary();
    return () => {
      active = false;
    };
  }, [language]);

  const stats = [
    {
      labelEn: 'Curriculum Track',
      labelBn: 'নির্বাচিত পাঠ্যক্রম',
      value: isBn ? 'এইচএসসি ২০২৭' : 'HSC 2027',
      subEn: liveSummary
        ? `Study Plan: ${liveSummary.studyPlanCompletionPercent}% complete`
        : 'Bangladesh NCTB · Science Division',
      subBn: liveSummary
        ? `স্টাডি প্ল্যান: ${liveSummary.studyPlanCompletionPercent}% সম্পন্ন`
        : 'বাংলাদেশ এনসিটিবি · বিজ্ঞান বিভাগ',
    },
    {
      labelEn: 'Learning Streak',
      labelBn: 'অধ্যয়নের ধারাবাহিকতা',
      value: liveSummary
        ? `${liveSummary.streakDays} ${isBn ? 'দিন' : 'Days'}`
        : isBn
          ? '০ দিন'
          : '0 Days',
      subEn: liveSummary
        ? `${liveSummary.meaningfulStudyPoints} verified study points`
        : 'Daily target: 120 mins/day',
      subBn: liveSummary
        ? `${liveSummary.meaningfulStudyPoints} যাচাইকৃত পয়েন্ট`
        : 'দৈনিক লক্ষ্য: ১২০ মিনিট/দিন',
    },
    {
      labelEn: 'Due Flashcards',
      labelBn: 'আজকের ফ্ল্যাশকার্ড',
      value: liveSummary
        ? `${liveSummary.dueFlashcardsCount} ${isBn ? 'টি' : 'Cards'}`
        : isBn
          ? '০ টি'
          : '0 Cards',
      subEn: 'SM-2 spaced-repetition queue',
      subBn: 'স্পেসড রিপিটিশন কিউ',
    },
    {
      labelEn: 'Estimated Mastery',
      labelBn: 'আনুমানিক দক্ষতা',
      value: liveSummary ? `${liveSummary.overallEstimatedMasteryScore}%` : '0%',
      subEn: liveSummary
        ? `Est. across ${liveSummary.completedTopicsCount}/${liveSummary.totalTopicsCount} topics (FR-ANALYTICS-008)`
        : 'Algorithmic estimate across syllabus topics',
      subBn: liveSummary
        ? `${liveSummary.completedTopicsCount}/${liveSummary.totalTopicsCount}টি টপিকের ভিত্তিতে আনুমানিক`
        : 'সিলেবাস টপিকের ভিত্তিতে আনুমানিক',
    },
  ];

  const quickActions = [
    {
      href: '/tutor',
      icon: Bot,
      titleEn: 'Ask AI Subject Tutor',
      titleBn: 'এআই টিউটরকে প্রশ্ন করুন',
      descEn: 'Step-by-step bilingual syllabus guidance',
      descBn: 'ধাপে ধাপে পাঠ্যক্রমভিত্তিক সহায়তা',
    },
    {
      href: '/quizzes',
      icon: ClipboardCheck,
      titleEn: 'Start Practice Quiz',
      titleBn: 'অনুশীলন কুইজ শুরু করুন',
      descEn: 'Objective & AI rubric-graded mock exams',
      descBn: 'এমসিকিউ ও সংক্ষিপ্ত প্রশ্নের মক পরীক্ষা',
    },
    {
      href: '/flashcards',
      icon: Layers,
      titleEn: 'Review Due Flashcards',
      titleBn: 'ফ্ল্যাশকার্ড রিভিশন দিন',
      descEn: 'SM-2 spaced repetition active recall queue',
      descBn: 'স্পেসড রিপিটিশন অ্যাক্টিভ রিকল কিউ',
    },
    {
      href: '/planner',
      icon: CalendarRange,
      titleEn: 'View Study Roadmap',
      titleBn: 'স্টাডি রোডম্যাপ দেখুন',
      descEn: 'Daily milestones & adaptive rescheduling',
      descBn: 'দৈনিক লক্ষ্য ও অ্যাডাপ্টিভ রুটিন',
    },
    {
      href: '/documents',
      icon: FolderUp,
      titleEn: 'Upload Study Document',
      titleBn: 'ডকুমেন্ট আপলোড করুন',
      descEn: 'PDF, DOCX, TXT grounded RAG Q&A',
      descBn: 'পিডিএফ, ডকএক্স ও টেক্সট প্রশ্নোত্তর',
    },
    {
      href: '/analytics',
      icon: BarChart3,
      titleEn: 'Analytics & Mastery',
      titleBn: 'অ্যানালিটিক্স ও মাস্টারি',
      descEn: 'Subject accuracy, weak topics & streaks',
      descBn: 'বিষয়ভিত্তিক নির্ভুলতা ও দুর্বল টপিক',
    },
    {
      href: '/notifications',
      icon: Bell,
      titleEn: 'Notifications & Reminders',
      titleBn: 'বিজ্ঞপ্তি ও অনুস্মারক',
      descEn: liveSummary
        ? `${liveSummary.unreadNotificationsCount} unread reminder(s)`
        : 'Manage study & exam reminders',
      descBn: liveSummary
        ? `${liveSummary.unreadNotificationsCount}টি অপঠিত অনুস্মারক`
        : 'অধ্যয়ন ও পরীক্ষার রিমাইন্ডার',
    },
    {
      href: '/my-learning',
      icon: BookOpen,
      titleEn: 'Browse Full Syllabus',
      titleBn: 'সম্পূর্ণ সিলেবাস দেখুন',
      descEn: 'Subjects → Chapters → Topics',
      descBn: 'বিষয় → অধ্যায় → টপিক',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="accent">
              <Flame className="mr-1 size-3.5" />
              {isBn ? 'সক্রিয় প্রস্তুতি' : 'Active Study Session'}
            </Badge>
            {liveSummary && liveSummary.unreadNotificationsCount > 0 && (
              <Link href="/notifications">
                <Badge variant="default">
                  <Bell className="mr-1 size-3" />
                  {liveSummary.unreadNotificationsCount}{' '}
                  {isBn ? 'নতুন বিজ্ঞপ্তি' : 'New Alerts'}
                </Badge>
              </Link>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {isBn ? 'স্বাগতম, শিক্ষার্থী ড্যাশবোর্ড' : 'Student Learning Dashboard'}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {isBn
              ? 'আপনার প্রতিদিনের পাঠ্যক্রম, এআই টিউটর, ফ্ল্যাশকার্ড এবং পরীক্ষার প্রস্তুতির সারাংশ।'
              : 'Track your daily syllabus milestones, due spaced-repetition reviews, and AI study tools.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/analytics">
            <Button variant="outline" size="sm">
              <BarChart3 className="mr-1.5 size-4" />
              {isBn ? 'অ্যানালিটিক্স' : 'View Analytics'}
            </Button>
          </Link>
          <Link href="/tutor">
            <Button size="sm">
              <Bot className="size-4" />
              <span>{isBn ? 'এআই টিউটর' : 'Launch AI Tutor'}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.labelEn}>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                {isBn ? stat.labelBn : stat.labelEn}
              </CardDescription>
              <CardTitle className="text-2xl font-bold">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-[var(--muted-foreground)]">
                {isBn ? stat.subBn : stat.subEn}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top Explainable Recommendation Banner (FR-ANALYTICS-005..007) */}
      {liveSummary?.topRecommendation && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-primary" />
                <span>{liveSummary.topRecommendation.title}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {liveSummary.topRecommendation.reason}
              </p>
              <p className="text-[11px] text-muted-foreground">
                <strong>Basis:</strong> {liveSummary.topRecommendation.evidenceBasis}
              </p>
            </div>
            <Link href={liveSummary.topRecommendation.actionUrl}>
              <Button size="sm">
                {isBn ? 'এখনই অনুশীলন করুন' : 'Start Recommended Action'}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Quick Launch Modules */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">
          {isBn ? 'দ্রুত অধ্যয়ন মডিউল' : 'Study Workspace Modules'}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href} className="group block">
                <Card className="h-full transition-colors group-hover:border-[var(--primary)]">
                  <CardHeader>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)]">
                        <Icon className="size-4" />
                      </div>
                      <ArrowRight className="size-4 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" />
                    </div>
                    <CardTitle className="text-base">
                      {isBn ? action.titleBn : action.titleEn}
                    </CardTitle>
                    <CardDescription>
                      {isBn ? action.descBn : action.descEn}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
