'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Bot,
  CalendarRange,
  ClipboardCheck,
  Flame,
  FolderUp,
  Layers,
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

export default function StudentDashboardPage() {
  const { language } = useUIPreferences();

  const stats = [
    {
      labelEn: 'Curriculum Track',
      labelBn: 'নির্বাচিত পাঠ্যক্রম',
      value: language === 'bn' ? 'এইচএসসি ২০২৭' : 'HSC 2027',
      subEn: 'Bangladesh NCTB · Science Division',
      subBn: 'বাংলাদেশ এনসিটিবি · বিজ্ঞান বিভাগ',
    },
    {
      labelEn: 'Learning Streak',
      labelBn: 'অধ্যয়নের ধারাবাহিকতা',
      value: language === 'bn' ? '৭ দিন' : '7 Days',
      subEn: 'Daily target: 120 mins/day',
      subBn: 'দৈনিক লক্ষ্য: ১২০ মিনিট/দিন',
    },
    {
      labelEn: 'Due Flashcards',
      labelBn: 'আজকের ফ্ল্যাশকার্ড',
      value: language === 'bn' ? '১৮ টি' : '18 Cards',
      subEn: 'Physics & Higher Math SM-2 queue',
      subBn: 'পদার্থবিজ্ঞান ও উচ্চতর গণিত',
    },
    {
      labelEn: 'Estimated Mastery',
      labelBn: 'আনুমানিক দক্ষতা',
      value: '78%',
      subEn: 'Across 14 completed topics',
      subBn: '১৪টি সম্পন্ন টপিকের ভিত্তিতে',
    },
  ];

  const quickActions = [
    {
      href: '/tutor',
      icon: Bot,
      titleEn: 'Ask AI Subject Tutor',
      titleBn: 'এআই টিউটরকে প্রশ্ন করুন',
      descEn: 'Newtonian Mechanics · Chapter 4',
      descBn: 'নিউটনীয় বলবিদ্যা · অধ্যায় ৪',
    },
    {
      href: '/quizzes',
      icon: ClipboardCheck,
      titleEn: 'Start Practice Quiz',
      titleBn: 'অনুশীলন কুইজ শুরু করুন',
      descEn: '15 MCQs · Timed or untimed mode',
      descBn: '১৫টি এমসিকিউ · সময়ভিত্তিক অনুশীলন',
    },
    {
      href: '/flashcards',
      icon: Layers,
      titleEn: 'Review Due Flashcards',
      titleBn: 'ফ্ল্যাশকার্ড রিভিশন দিন',
      descEn: 'SM-2 spaced repetition queue',
      descBn: 'স্পেসড রিপিটিশন কিউ',
    },
    {
      href: '/planner',
      icon: CalendarRange,
      titleEn: 'View Study Roadmap',
      titleBn: 'স্টাডি রোডম্যাপ দেখুন',
      descEn: 'Daily milestones & revision slots',
      descBn: 'দৈনিক লক্ষ্য ও রিভিশন রুটিন',
    },
    {
      href: '/documents',
      icon: FolderUp,
      titleEn: 'Upload Study Document',
      titleBn: 'ডকুমেন্ট আপলোড করুন',
      descEn: 'PDF, DOCX, TXT grounded RAG',
      descBn: 'পিডিএফ, ডকএক্স ও টেক্সট প্রশ্নোত্তর',
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
              {language === 'bn' ? 'সক্রিয় প্রস্তুতি' : 'Active Study Session'}
            </Badge>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {language === 'bn' ? 'স্বাগতম, শিক্ষার্থী ড্যাশবোর্ড' : 'Student Learning Dashboard'}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {language === 'bn'
              ? 'আপনার প্রতিদিনের পাঠ্যক্রম, এআই টিউটর, ফ্ল্যাশকার্ড এবং পরীক্ষার প্রস্তুতির সারাংশ।'
              : 'Track your daily syllabus milestones, due spaced-repetition reviews, and AI study tools.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/my-learning">
            <Button variant="outline" size="sm">
              {language === 'bn' ? 'বিষয় পরিবর্তন' : 'Switch Subject'}
            </Button>
          </Link>
          <Link href="/tutor">
            <Button size="sm">
              <Bot className="size-4" />
              <span>{language === 'bn' ? 'এআই টিউটর' : 'Launch AI Tutor'}</span>
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
                {language === 'bn' ? stat.labelBn : stat.labelEn}
              </CardDescription>
              <CardTitle className="text-2xl font-bold">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-[var(--muted-foreground)]">
                {language === 'bn' ? stat.subBn : stat.subEn}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Launch Modules */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">
          {language === 'bn' ? 'দ্রুত অধ্যয়ন মডিউল' : 'Study Workspace Modules'}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                      {language === 'bn' ? action.titleBn : action.titleEn}
                    </CardTitle>
                    <CardDescription>
                      {language === 'bn' ? action.descBn : action.descEn}
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
