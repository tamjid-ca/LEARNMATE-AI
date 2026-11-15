'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  GraduationCap,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { ONBOARDING_CURRICULUM_CATALOG } from '@/config/onboarding-catalog';
import { useUIPreferences } from '@/components/providers/app-providers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { LearningStyle } from '@/types/domain';

const LEARNING_STYLE_OPTIONS: ReadonlyArray<{
  key: LearningStyle;
  labelEn: string;
  labelBn: string;
}> = [
  {
    key: 'simple_explanations',
    labelEn: 'Simple Explanations',
    labelBn: 'সহজ ভাষায় ব্যাখ্যা',
  },
  {
    key: 'detailed_explanations',
    labelEn: 'Detailed Step-by-Step',
    labelBn: 'বিস্তারিত ধাপে ধাপে ব্যাখ্যা',
  },
  {
    key: 'conceptual_learning',
    labelEn: 'Conceptual Deep Dive',
    labelBn: 'ধারণাগত গভীর শিক্ষা',
  },
  {
    key: 'exam_focused',
    labelEn: 'Exam-Focused Preparation',
    labelBn: 'পরীক্ষাভিত্তিক প্রস্তুতি',
  },
  {
    key: 'problem_solving',
    labelEn: 'Problem-Solving Practice',
    labelBn: 'গাণিতিক ও সমস্যা সমাধান অনুশীলন',
  },
];

export default function StudentOnboardingPage() {
  const router = useRouter();
  const { language, setLanguage } = useUIPreferences();

  const [country, setCountry] = React.useState('BD');
  const [educationSystemCode, setEducationSystemCode] = React.useState('BD-NCTB');
  const [educationLevelCode, setEducationLevelCode] = React.useState('HSC');
  const [targetExaminationCode, setTargetExaminationCode] = React.useState('HSC-2027');
  const [institution, setInstitution] = React.useState('');
  const [selectedSubjects, setSelectedSubjects] = React.useState<string[]>([
    'Physics 1st & 2nd Paper',
    'Chemistry 1st & 2nd Paper',
    'Higher Mathematics 1st & 2nd Paper',
    'ICT',
  ]);
  const [customSubject, setCustomSubject] = React.useState('');
  const [preferredLanguage, setPreferredLanguage] = React.useState<'en' | 'bn'>(language);
  const [dailyStudyMinutes, setDailyStudyMinutes] = React.useState(120);
  const [timezone, setTimezone] = React.useState('Asia/Dhaka');
  const [learningPreferences, setLearningPreferences] = React.useState<LearningStyle[]>([
    'conceptual_learning',
    'exam_focused',
  ]);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const currentLevel = React.useMemo(
    () =>
      ONBOARDING_CURRICULUM_CATALOG.educationLevels.find(
        (lvl) => lvl.code === educationLevelCode,
      ) ?? ONBOARDING_CURRICULUM_CATALOG.educationLevels[1],
    [educationLevelCode],
  );

  function handleLevelSelect(code: string, systemCode: string, defaults: readonly string[]) {
    setEducationLevelCode(code);
    setEducationSystemCode(systemCode);
    setSelectedSubjects([...defaults.slice(0, 4)]);
  }

  function toggleSubject(subject: string) {
    setSelectedSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject],
    );
  }

  function addCustomSubject() {
    const trimmed = customSubject.trim();
    if (!trimmed) return;
    if (!selectedSubjects.includes(trimmed)) {
      setSelectedSubjects((prev) => [...prev, trimmed]);
    }
    setCustomSubject('');
  }

  function toggleLearningStyle(style: LearningStyle) {
    setLearningPreferences((prev) =>
      prev.includes(style) ? prev.filter((item) => item !== style) : [...prev, style],
    );
  }

  async function handleCompleteOnboarding(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/v1/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country,
          educationSystemCode,
          educationLevelCode,
          targetExaminationCode,
          selectedSubjects,
          preferredLanguage,
          dailyStudyMinutes: Number(dailyStudyMinutes),
          learningPreferences,
          timezone,
          institution: institution.trim() || undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        setError(payload?.error?.message ?? 'Please review your onboarding selections');
        return;
      }

      setLanguage(preferredLanguage);
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Network error while saving onboarding preferences.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-2">
        <Badge variant="accent" className="w-fit">
          <Sparkles className="mr-1.5 size-3.5" />
          {language === 'bn' ? 'শিক্ষার্থী প্রোফাইল অনবোর্ডিং' : 'Personalized Student Onboarding'}
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {language === 'bn'
            ? 'আপনার শিক্ষা স্তর এবং অধ্যয়নের পছন্দসমূহ সেটআপ করুন'
            : 'Configure Your Academic Profile & Study Preferences'}
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          {language === 'bn'
            ? 'এআই টিউটর, কুইজ এবং স্টাডি রোডম্যাপ আপনার নির্বাচিত পাঠ্যক্রম ও বিষয়ের ওপর ভিত্তি করে কাজ করবে।'
            : 'LearnMate AI tailors every explanation, practice quiz, flashcard deck, and study roadmap to these settings.'}
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <form onSubmit={handleCompleteOnboarding} className="space-y-6">
        {/* Step 1: Country, Education System & Level */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="size-5 text-[var(--primary)]" />
              <span>
                {language === 'bn'
                  ? '১. দেশ, শিক্ষা ব্যবস্থা ও লক্ষ্য পরীক্ষা'
                  : '1. Country, Education Level & Target Examination'}
              </span>
            </CardTitle>
            <CardDescription>
              {language === 'bn'
                ? 'আপনার বর্তমান শ্রেণি বা লক্ষ্য পরীক্ষা নির্বাচন করুন।'
                : 'Select your academic level or target competitive examination.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {ONBOARDING_CURRICULUM_CATALOG.educationLevels.map((lvl) => {
                const active = educationLevelCode === lvl.code;
                return (
                  <button
                    key={lvl.code}
                    type="button"
                    onClick={() => {
                      setCountry(lvl.systemCode.startsWith('BD') ? 'BD' : 'INTL');
                      handleLevelSelect(lvl.code, lvl.systemCode, lvl.defaultSubjects);
                    }}
                    className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                      active
                        ? 'border-[var(--primary)] bg-[var(--accent)]/40 ring-1 ring-[var(--primary)]'
                        : 'border-[var(--border)] hover:bg-[var(--secondary)]'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-sm font-semibold">
                        {language === 'bn' ? lvl.nameBn : lvl.nameEn}
                      </span>
                      {active ? <CheckCircle2 className="size-4 text-[var(--primary)]" /> : null}
                    </div>
                    <span className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {lvl.systemCode}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 pt-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="targetExam" className="text-xs font-medium">
                  {language === 'bn' ? 'লক্ষ্য পরীক্ষা / ব্যাচ' : 'Target Examination / Batch'}
                </label>
                <Input
                  id="targetExam"
                  value={targetExaminationCode}
                  onChange={(e) => setTargetExaminationCode(e.target.value)}
                  placeholder="e.g., HSC-2027, BCS-47, BUET-Admission"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="institution" className="text-xs font-medium">
                  {language === 'bn' ? 'শিক্ষা প্রতিষ্ঠান (ঐচ্ছিক)' : 'Academic Institution (Optional)'}
                </label>
                <Input
                  id="institution"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="e.g., Notre Dame College / Dhaka University"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Subjects Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {language === 'bn' ? '২. অধ্যয়নের বিষয়সমূহ নির্বাচন করুন' : '2. Select Subjects to Study'}
            </CardTitle>
            <CardDescription>
              {language === 'bn'
                ? 'কমপক্ষে একটি বিষয় নির্বাচন করুন অথবা নতুন বিষয় যুক্ত করুন।'
                : 'Choose subjects from your level or add custom subjects.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set([...currentLevel.defaultSubjects, ...selectedSubjects])).map(
                (subj) => {
                  const isSelected = selectedSubjects.includes(subj);
                  return (
                    <Button
                      key={subj}
                      type="button"
                      size="sm"
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={() => toggleSubject(subj)}
                    >
                      {subj}
                    </Button>
                  );
                },
              )}
            </div>

            <div className="flex gap-2">
              <Input
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder={
                  language === 'bn' ? 'অন্য কোনো বিষয় যোগ করুন...' : 'Add another subject...'
                }
              />
              <Button type="button" variant="secondary" onClick={addCustomSubject}>
                {language === 'bn' ? 'যোগ করুন' : 'Add'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Study Availability, Language & Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-5 text-[var(--primary)]" />
              <span>
                {language === 'bn'
                  ? '৩. দৈনিক অধ্যয়নের সময়, ভাষা ও শিখন পদ্ধতি'
                  : '3. Daily Study Availability, Language & Learning Style'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label htmlFor="dailyMinutes" className="text-xs font-medium">
                  {language === 'bn' ? 'দৈনিক পড়ার সময় (মিনিট)' : 'Daily Study Availability (Minutes)'}
                </label>
                <Input
                  id="dailyMinutes"
                  type="number"
                  min={15}
                  max={720}
                  value={dailyStudyMinutes}
                  onChange={(e) => setDailyStudyMinutes(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">
                  {language === 'bn' ? 'প্রাথমিক অধ্যয়নের ভাষা' : 'Preferred Learning Language'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={preferredLanguage === 'en' ? 'default' : 'outline'}
                    onClick={() => setPreferredLanguage('en')}
                  >
                    English
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={preferredLanguage === 'bn' ? 'default' : 'outline'}
                    onClick={() => setPreferredLanguage('bn')}
                  >
                    বাংলা
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="timezone" className="text-xs font-medium">
                  {language === 'bn' ? 'টাইমজোন' : 'Timezone'}
                </label>
                <Input
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">
                {language === 'bn'
                  ? 'আপনি কীভাবে শিখতে পছন্দ করেন?'
                  : 'Preferred Explanation & Learning Styles'}
              </label>
              <div className="flex flex-wrap gap-2">
                {LEARNING_STYLE_OPTIONS.map((opt) => {
                  const selected = learningPreferences.includes(opt.key);
                  return (
                    <Button
                      key={opt.key}
                      type="button"
                      size="sm"
                      variant={selected ? 'default' : 'outline'}
                      onClick={() => toggleLearningStyle(opt.key)}
                    >
                      {language === 'bn' ? opt.labelBn : opt.labelEn}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end border-t border-[var(--border)] pt-4">
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>{language === 'bn' ? 'সংরক্ষণ করা হচ্ছে...' : 'Saving preferences...'}</span>
                </>
              ) : (
                <span>
                  {language === 'bn'
                    ? 'অনবোর্ডিং সম্পন্ন করুন ও ড্যাশবোর্ডে যান'
                    : 'Complete Onboarding & Continue to Dashboard'}
                </span>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
