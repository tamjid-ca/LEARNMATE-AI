'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  FolderUp,
  GraduationCap,
  Layers,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useUIPreferences } from '@/components/providers/app-providers';
import { ThemeLanguageControls } from '@/components/shared/theme-language-controls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const CORE_PILLARS = [
  {
    icon: Bot,
    href: '/tutor',
    titleEn: 'Context-Aware AI Subject Tutor',
    titleBn: 'বিষয়ভিত্তিক এআই টিউটর',
    descEn:
      'Ask conceptual or problem-solving questions scoped to your exact Subject, Chapter, and Topic in English or Bangla.',
    descBn:
      'নির্দিষ্ট বিষয়, অধ্যায় ও টপিকের আলোকে বাংলা বা ইংরেজিতে প্রশ্ন করুন এবং ধাপে ধাপে সমাধান পান।',
  },
  {
    icon: FileText,
    href: '/materials',
    titleEn: '12 Structured Material Formats',
    titleBn: '১২ ধরনের স্টাডি ম্যাটেরিয়ালস',
    descEn:
      'Generate topic explanations, chapter summaries, formula sheets, common mistakes, and exam preparation guidelines.',
    descBn:
      'টপিক ব্যাখ্যা, অধ্যায়ের সারাংশ, সূত্রের তালিকা এবং পরীক্ষার প্রস্তুতির নির্দেশিকা তৈরি করুন।',
  },
  {
    icon: ClipboardCheck,
    href: '/quizzes',
    titleEn: 'AI Quizzes & Timed Mock Exams',
    titleBn: 'এআই কুইজ ও মক পরীক্ষা',
    descEn:
      'Practice single/multi MCQ, true/false, and rubric-graded short answers with configurable negative marking.',
    descBn:
      'সিঙ্গেল/মাল্টি এমসিকিউ, সত্য/মিথ্যা এবং সংক্ষিপ্ত প্রশ্নের সময়ভিত্তিক মক পরীক্ষা দিন।',
  },
  {
    icon: Layers,
    href: '/flashcards',
    titleEn: 'SM-2 Spaced Repetition Flashcards',
    titleBn: 'স্পেসড রিপিটিশন ফ্ল্যাশকার্ড',
    descEn:
      'Convert topics, notes, or uploaded documents into active-recall decks scheduled deterministically by memory strength.',
    descBn:
      'টপিক বা নোট থেকে ফ্ল্যাশকার্ড তৈরি করুন এবং বৈজ্ঞানিক পদ্ধতিতে দীর্ঘমেয়াদী স্মৃতিতে রাখুন।',
  },
  {
    icon: CalendarRange,
    href: '/planner',
    titleEn: 'Deterministic Study Roadmaps',
    titleBn: 'ব্যক্তিগতকৃত স্টাডি রোডম্যাপ',
    descEn:
      'Allocate syllabus topics across your target exam date and daily study hours with automatic missed-task rescheduling.',
    descBn:
      'পরীক্ষার তারিখ এবং দৈনিক পড়ার সময়ের ওপর ভিত্তি করে বাস্তবসম্মত রুটিন ও মাইলফলক তৈরি করুন।',
  },
  {
    icon: FolderUp,
    href: '/documents',
    titleEn: 'Document Upload & Grounded RAG',
    titleBn: 'ডকুমেন্ট আপলোড ও প্রশ্নোত্তর (RAG)',
    descEn:
      'Upload PDF, DOCX, and TXT lecture notes for source-grounded answers with page references and zero cross-user leakage.',
    descBn:
      'পিডিএফ, ডকএক্স বা টেক্সট ফাইল আপলোড করে পৃষ্ঠা নম্বরসহ নির্ভরযোগ্য উত্তর ও কুইজ তৈরি করুন।',
  },
] as const;

const CURRICULUM_TRACKS = [
  { code: 'SSC', labelEn: 'SSC (Class 9–10 · NCTB)', labelBn: 'এসএসসি (নবম–দশম · এনসিটিবি)' },
  { code: 'HSC', labelEn: 'HSC (Class 11–12 · Science/Commerce/Arts)', labelBn: 'এইচএসসি (একাদশ–দ্বাদশ)' },
  { code: 'ADM', labelEn: 'University Admission (BUET, Medical, DU)', labelBn: 'বিশ্ববিদ্যালয় ভর্তি প্রস্তুতি' },
  { code: 'BCS', labelEn: 'BCS & Competitive Examinations', labelBn: 'বিসিএস ও প্রতিযোগিতামূলক পরীক্ষা' },
  { code: 'UNI', labelEn: 'Undergraduate & Independent Study', labelBn: 'বিশ্ববিদ্যালয় ও স্বতন্ত্র শিক্ষা' },
] as const;

export default function PublicLandingPage() {
  const { language } = useUIPreferences();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Public Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)]">
              <GraduationCap className="size-5" />
            </div>
            <span className="text-base font-bold">LearnMate AI</span>
          </Link>

          <nav
            aria-label="Public navigation"
            className="hidden items-center gap-6 text-sm font-medium text-[var(--muted-foreground)] md:flex"
          >
            <Link href="/dashboard" className="hover:text-[var(--foreground)]">
              {language === 'bn' ? 'ড্যাশবোর্ড' : 'Student Workspace'}
            </Link>
            <Link href="/my-learning" className="hover:text-[var(--foreground)]">
              {language === 'bn' ? 'পাঠ্যক্রম' : 'Curriculum'}
            </Link>
            <Link href="/tutor" className="hover:text-[var(--foreground)]">
              {language === 'bn' ? 'এআই টিউটর' : 'AI Tutor'}
            </Link>
            <Link href="/admin" className="hover:text-[var(--foreground)]">
              {language === 'bn' ? 'অ্যাডমিন প্যানেল' : 'Admin CMS'}
            </Link>
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeLanguageControls />
            <Link href="/login">
              <Button variant="ghost" size="sm">
                {language === 'bn' ? 'লগ ইন' : 'Sign In'}
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">
                {language === 'bn' ? 'শুরু করুন' : 'Get Started'}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-[var(--border)] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="accent" className="mb-4 px-3 py-1 text-xs">
              <Sparkles className="mr-1.5 size-3.5" />
              {language === 'bn'
                ? 'বাংলাদেশ (এসএসসি, এইচএসসি, ভর্তি, বিসিএস) ও বৈশ্বিক পাঠ্যক্রমের জন্য নির্মিত'
                : 'Built for Bangladesh (SSC, HSC, Admission, BCS) & Global Curricula'}
            </Badge>

            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:leading-[1.15]">
              {language === 'bn'
                ? 'শেখা, অনুশীলন, রিভিশন এবং পরীক্ষার প্রস্তুতির একীভূত এআই প্ল্যাটফর্ম'
                : 'One Platform to Learn, Practice, Revise, and Master Your Examinations'}
            </h1>

            <p className="mt-5 text-base leading-relaxed text-[var(--muted-foreground)] sm:text-lg">
              {language === 'bn'
                ? 'ওপেনরাউটার এআই গেটওয়ে দ্বারা চালিত বিষয়ভিত্তিক টিউটর, স্মার্ট ফ্ল্যাশকার্ড, মক পরীক্ষা, ডকুমেন্ট প্রশ্নোত্তর এবং ব্যক্তিগতকৃত স্টাডি রোডম্যাপ।'
                : 'Combine context-aware AI tutoring, validated practice exams, SM-2 spaced repetition, document-grounded RAG, and deterministic study roadmaps in one workspace.'}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/dashboard">
                <Button size="lg">
                  <span>
                    {language === 'bn' ? 'শিক্ষার্থী ড্যাশবোর্ডে যান' : 'Launch Student Workspace'}
                  </span>
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="/admin">
                <Button variant="outline" size="lg">
                  <ShieldCheck className="size-4" />
                  <span>{language === 'bn' ? 'অ্যাডমিন সিএমএস' : 'Explore Admin CMS'}</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Curriculum Tracks Bar */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-2.5">
            {CURRICULUM_TRACKS.map((track) => (
              <div
                key={track.code}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3.5 py-1.5 text-xs font-medium shadow-2xs"
              >
                <CheckCircle2 className="size-3.5 text-[var(--primary)]" />
                <span>{language === 'bn' ? track.labelBn : track.labelEn}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Feature Pillars */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {language === 'bn'
                  ? 'সম্পূর্ণ শিক্ষা ও প্রস্তুতির ইকোসিস্টেম'
                  : 'Complete Academic Preparation Ecosystem'}
              </h2>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                {language === 'bn'
                  ? 'প্রতিটি মডিউল আপনার নির্বাচিত শিক্ষা স্তর এবং বিষয়ের সাথে সংযুক্ত।'
                  : 'Every module shares your hierarchical syllabus context (Education System → Level → Exam → Subject → Chapter → Topic).'}
              </p>
            </div>
            <Link href="/my-learning">
              <Button variant="outline" size="sm">
                <BookOpen className="size-4" />
                <span>{language === 'bn' ? 'সকল বিষয় দেখুন' : 'Browse Syllabus Hierarchy'}</span>
              </Button>
            </Link>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CORE_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <Card
                  key={pillar.href}
                  className="flex flex-col justify-between transition-shadow hover:shadow-md"
                >
                  <CardHeader>
                    <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)]">
                      <Icon className="size-5" />
                    </div>
                    <CardTitle>{language === 'bn' ? pillar.titleBn : pillar.titleEn}</CardTitle>
                    <CardDescription className="pt-1">
                      {language === 'bn' ? pillar.descBn : pillar.descEn}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link
                      href={pillar.href}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] hover:underline"
                    >
                      <span>{language === 'bn' ? 'মডিউল খুলুন' : 'Open Module'}</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Architecture & Reliability Banner */}
      <section className="border-t border-[var(--border)] bg-[var(--secondary)]/50 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="flex items-start gap-3">
              <BarChart3 className="mt-0.5 size-5 shrink-0 text-[var(--primary)]" />
              <div>
                <h3 className="text-sm font-semibold">
                  {language === 'bn' ? 'যাচাইকৃত এআই আউটপুট' : 'Schema-Validated AI Outputs'}
                </h3>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {language === 'bn'
                    ? 'কুইজ, ফ্ল্যাশকার্ড এবং স্টাডি প্ল্যান ডাটাবেসে সংরক্ষণের আগে Zod স্কিমা দ্বারা যাচাই করা হয়।'
                    : 'All generated quizzes, answer keys, flashcards, and study tasks are validated with strict Zod schemas before persistence.'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[var(--primary)]" />
              <div>
                <h3 className="text-sm font-semibold">
                  {language === 'bn'
                    ? 'ব্যক্তিগত ডকুমেন্ট সুরক্ষা'
                    : 'Isolated User Ownership & RBAC'}
                </h3>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {language === 'bn'
                    ? 'আপনার আপলোড করা ফাইল এবং নোট শুধুমাত্র আপনার অ্যাকাউন্টেই সীমাবদ্ধ থাকে।'
                    : 'Server-side role checks and compound userId indexes isolate every student’s notes, attempts, and uploaded documents.'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <GraduationCap className="mt-0.5 size-5 shrink-0 text-[var(--primary)]" />
              <div>
                <h3 className="text-sm font-semibold">
                  {language === 'bn' ? 'ডার্ক/লাইট ও দ্বিভাষিক ইন্টারফেস' : 'Bilingual & Accessible Design'}
                </h3>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {language === 'bn'
                    ? 'দীর্ঘ সময় অধ্যয়নের জন্য আরামদায়ক ডার্ক ও লাইট থিম এবং পূর্ণ বাংলা ও ইংরেজি সাপোর্ট।'
                    : 'Comfortable Dark and Light themes with seamless English and Bangla Unicode typography across mobile and desktop.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-[var(--border)] bg-[var(--card)] py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-xs text-[var(--muted-foreground)] sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} LearnMate AI. Personalized AI Education Platform.</p>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="hover:text-[var(--foreground)]">
              Student Dashboard
            </Link>
            <Link href="/admin" className="hover:text-[var(--foreground)]">
              Admin Dashboard
            </Link>
            <Link href="/login" className="hover:text-[var(--foreground)]">
              Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
