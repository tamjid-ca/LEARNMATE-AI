'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  resolveEducationLabel,
  type EducationLabelDefinition,
} from '@/config/education-presets';
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
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

interface EducationSystemItem {
  id: string;
  code: string;
  name: string;
  country: string;
  description?: string;
  scope?: 'global' | 'custom';
}

interface EducationLevelItem {
  id: string;
  educationSystemId: string;
  code: string;
  name: string;
  scope?: 'global' | 'custom';
}

interface ExaminationItem {
  id: string;
  educationSystemId: string;
  educationLevelId?: string;
  code: string;
  name: string;
  examDate?: string | null;
  scope?: 'global' | 'custom';
}

interface SubjectItem {
  id: string;
  educationSystemId: string;
  educationLevelId?: string;
  examinationIds: string[];
  code: string;
  name: string;
  nameBn?: string;
  description?: string;
  color?: string;
  scope?: 'global' | 'custom';
}

interface ChapterItem {
  id: string;
  subjectId: string;
  chapterNumber: number;
  title: string;
  titleBn?: string;
  description?: string;
  scope?: 'global' | 'custom';
}

interface TopicItem {
  id: string;
  subjectId: string;
  chapterId: string;
  code: string;
  title: string;
  titleBn?: string;
  description?: string;
  learningObjectives: string[];
  prerequisiteTopicIds: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedMinutes: number;
  keyConcepts: string[];
  curriculumReferences: string[];
  syllabusWeightVerified: boolean;
  syllabusPriorityScore?: number;
  scope?: 'global' | 'custom';
}

interface CurriculumApiData {
  educationSystems: EducationSystemItem[];
  educationLevels: EducationLevelItem[];
  examinations: ExaminationItem[];
  subjects: SubjectItem[];
  chapters: ChapterItem[];
  topics: TopicItem[];
  savedTopicIds: string[];
  labels?: EducationLabelDefinition[];
  hierarchyPreview?: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function StudentMyLearningPage() {
  const { language } = useUIPreferences();
  const [data, setData] = useState<CurriculumApiData | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSystemId, setSelectedSystemId] = useState<string>('');
  const [selectedLevelId, setSelectedLevelId] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [savedOnly, setSavedOnly] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);

  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [togglingTopicId, setTogglingTopicId] = useState<string | null>(null);

  const fetchCurriculum = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedSystemId) params.set('educationSystemId', selectedSystemId);
      if (selectedLevelId) params.set('educationLevelId', selectedLevelId);
      if (selectedExamId) params.set('examinationId', selectedExamId);
      if (selectedSubjectId) params.set('subjectId', selectedSubjectId);
      if (selectedChapterId) params.set('chapterId', selectedChapterId);
      if (difficultyFilter) params.set('difficulty', difficultyFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (savedOnly) params.set('savedOnly', 'true');
      params.set('page', String(page));
      params.set('limit', '12');

      const res = await fetch(`/api/v1/curriculum?${params.toString()}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? 'Failed to load curriculum syllabus');
      } else {
        setData(json.data);
        if (json.meta) setMeta(json.meta);
        if (json.data.topics.length > 0) {
          setActiveTopicId((prev) =>
            prev && json.data.topics.some((t: TopicItem) => t.id === prev)
              ? prev
              : json.data.topics[0].id,
          );
        } else {
          setActiveTopicId(null);
        }
      }
    } catch {
      setError('Network error while loading curriculum data');
    } finally {
      setLoading(false);
    }
  }, [
    selectedSystemId,
    selectedLevelId,
    selectedExamId,
    selectedSubjectId,
    selectedChapterId,
    difficultyFilter,
    searchQuery,
    savedOnly,
    page,
  ]);

  useEffect(() => {
    void fetchCurriculum();
  }, [fetchCurriculum]);

  async function handleToggleSaved(topicId: string) {
    setTogglingTopicId(topicId);
    try {
      const res = await fetch('/api/v1/topics/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ topicId }),
      });
      const json = await res.json();
      if (res.ok && json.success && data) {
        setData({
          ...data,
          savedTopicIds: json.data.savedTopicIds,
        });
      }
    } finally {
      setTogglingTopicId(null);
    }
  }

  const activeTopic = useMemo(
    () => data?.topics.find((t) => t.id === activeTopicId) ?? null,
    [data, activeTopicId],
  );

  const subjectById = useMemo(() => {
    const map = new Map<string, SubjectItem>();
    for (const s of data?.subjects ?? []) map.set(s.id, s);
    return map;
  }, [data]);

  const chapterById = useMemo(() => {
    const map = new Map<string, ChapterItem>();
    for (const c of data?.chapters ?? []) map.set(c.id, c);
    return map;
  }, [data]);

  const sysLabel = resolveEducationLabel(data?.labels, 'educationSystem', 'singular', 'Education System');
  const lvlLabel = resolveEducationLabel(data?.labels, 'educationLevel', 'singular', 'Education Level');
  const examLabel = resolveEducationLabel(data?.labels, 'examination', 'singular', 'Examination');
  const subjLabel = resolveEducationLabel(data?.labels, 'subject', 'singular', 'Subject');
  const chapLabel = resolveEducationLabel(data?.labels, 'chapter', 'singular', 'Chapter');
  const topLabelPlural = resolveEducationLabel(data?.labels, 'topic', 'plural', 'Topics');

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge variant="default" className="mb-2">
            {language === 'bn' ? 'পাঠ্যক্রম ও সিলেবাস ব্রাউজার' : 'Syllabus & Custom Curriculum'}
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {language === 'bn'
              ? 'আমার অধ্যয়ন ও পাঠ্যক্রম (My Learning)'
              : 'My Learning & Curriculum Explorer'}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {data?.hierarchyPreview ||
              (language === 'bn'
                ? 'শিক্ষা ব্যবস্থা → স্তর → পরীক্ষা → বিষয় → অধ্যায় → টপিক অনুসারে ব্রাউজ করুন এবং ব্যক্তিগত তালিকায় সংরক্ষণ করুন।'
                : 'Navigate your academic hierarchy and save topics to your personal learning list.')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/settings/education">
            <Button variant="secondary" size="sm">
              {language === 'bn' ? 'কাস্টম শিক্ষা ও লেবেল' : 'Customize System & Labels'}
            </Button>
          </Link>
          <Button
            variant={savedOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setSavedOnly((prev) => !prev);
              setPage(1);
            }}
          >
            {language === 'bn'
              ? `সংরক্ষিত টপিক (${data?.savedTopicIds.length ?? 0})`
              : `Saved Topics (${data?.savedTopicIds.length ?? 0})`}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedSystemId('');
              setSelectedLevelId('');
              setSelectedExamId('');
              setSelectedSubjectId('');
              setSelectedChapterId('');
              setDifficultyFilter('');
              setSearchQuery('');
              setSavedOnly(false);
              setPage(1);
            }}
          >
            {language === 'bn' ? 'ফিল্টার রিসেট' : 'Reset Filters'}
          </Button>
        </div>
      </div>

      {/* 6-Tier Curriculum Filter Bar */}
      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1">
            <label
              htmlFor="filter-system"
              className="text-xs font-medium text-zinc-500 dark:text-zinc-400"
            >
              {language === 'bn' ? `১. ${sysLabel}` : `1. ${sysLabel}`}
            </label>
            <select
              id="filter-system"
              value={selectedSystemId}
              onChange={(e) => {
                setSelectedSystemId(e.target.value);
                setSelectedLevelId('');
                setSelectedExamId('');
                setSelectedSubjectId('');
                setSelectedChapterId('');
                setPage(1);
              }}
              className="h-9 w-full rounded-xl border border-zinc-300 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">{language === 'bn' ? 'সব' : `All (${sysLabel})`}</option>
              {(data?.educationSystems ?? []).map((sys) => (
                <option key={sys.id} value={sys.id}>
                  {sys.scope === 'custom' ? `[Custom] ${sys.name}` : `${sys.code} — ${sys.name}`}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="filter-level"
              className="text-xs font-medium text-zinc-500 dark:text-zinc-400"
            >
              {language === 'bn' ? `২. ${lvlLabel}` : `2. ${lvlLabel}`}
            </label>
            <select
              id="filter-level"
              value={selectedLevelId}
              onChange={(e) => {
                setSelectedLevelId(e.target.value);
                setSelectedExamId('');
                setSelectedSubjectId('');
                setSelectedChapterId('');
                setPage(1);
              }}
              className="h-9 w-full rounded-xl border border-zinc-300 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">{language === 'bn' ? 'সব' : `All (${lvlLabel})`}</option>
              {(data?.educationLevels ?? []).map((lvl) => (
                <option key={lvl.id} value={lvl.id}>
                  {lvl.scope === 'custom' ? `[Custom] ${lvl.name}` : lvl.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="filter-exam"
              className="text-xs font-medium text-zinc-500 dark:text-zinc-400"
            >
              {language === 'bn' ? `৩. ${examLabel}` : `3. ${examLabel}`}
            </label>
            <select
              id="filter-exam"
              value={selectedExamId}
              onChange={(e) => {
                setSelectedExamId(e.target.value);
                setSelectedSubjectId('');
                setSelectedChapterId('');
                setPage(1);
              }}
              className="h-9 w-full rounded-xl border border-zinc-300 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">{language === 'bn' ? 'সব' : `All (${examLabel})`}</option>
              {(data?.examinations ?? []).map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.scope === 'custom' ? `[Custom] ${ex.name}` : ex.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="filter-subject"
              className="text-xs font-medium text-zinc-500 dark:text-zinc-400"
            >
              {language === 'bn' ? `৪. ${subjLabel}` : `4. ${subjLabel}`}
            </label>
            <select
              id="filter-subject"
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                setSelectedChapterId('');
                setPage(1);
              }}
              className="h-9 w-full rounded-xl border border-zinc-300 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">{language === 'bn' ? 'সব' : `All (${subjLabel})`}</option>
              {(data?.subjects ?? []).map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.scope === 'custom'
                    ? `[Custom] ${sub.name}`
                    : language === 'bn' && sub.nameBn
                      ? `${sub.nameBn} (${sub.name})`
                      : sub.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="filter-chapter"
              className="text-xs font-medium text-zinc-500 dark:text-zinc-400"
            >
              {language === 'bn' ? `৫. ${chapLabel}` : `5. ${chapLabel}`}
            </label>
            <select
              id="filter-chapter"
              value={selectedChapterId}
              onChange={(e) => {
                setSelectedChapterId(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full rounded-xl border border-zinc-300 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">{language === 'bn' ? 'সব' : `All (${chapLabel})`}</option>
              {(data?.chapters ?? []).map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {chapLabel} {ch.chapterNumber}: {language === 'bn' && ch.titleBn ? ch.titleBn : ch.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="filter-search"
              className="text-xs font-medium text-zinc-500 dark:text-zinc-400"
            >
              {language === 'bn' ? `৬. ${topLabelPlural} অনুসন্ধান` : `6. Search ${topLabelPlural}`}
            </label>
            <Input
              id="filter-search"
              placeholder={
                language === 'bn' ? 'নিউটন, ক্যালকুলাস, বিসিএস...' : 'Newton, Calculus, Logic...'
              }
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="h-9 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </div>
      ) : null}

      {/* Main Split View: Topic Catalog List + Active Topic Inspector */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {language === 'bn'
                ? `টপিক তালিকা (${meta.total})`
                : `Curriculum Topics (${meta.total})`}
            </span>
            <div className="flex gap-1">
              {(['', 'easy', 'medium', 'hard'] as const).map((diff) => (
                <button
                  key={diff || 'all'}
                  type="button"
                  onClick={() => {
                    setDifficultyFilter(diff);
                    setPage(1);
                  }}
                  className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                    difficultyFilter === diff
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {diff === '' ? 'All' : diff}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          ) : (data?.topics.length ?? 0) === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-zinc-500">
                {language === 'bn'
                  ? 'নির্বাচিত ফিল্টারে কোনো টপিক পাওয়া যায়নি।'
                  : 'No curriculum topics match the current filters.'}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {data?.topics.map((topic) => {
                const isSelected = topic.id === activeTopic?.id;
                const isSaved = data.savedTopicIds.includes(topic.id);
                const sub = subjectById.get(topic.subjectId);
                const chap = chapterById.get(topic.chapterId);

                return (
                  <div
                    key={topic.id}
                    onClick={() => setActiveTopicId(topic.id)}
                    className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/60 shadow-sm dark:border-indigo-400 dark:bg-indigo-950/30'
                        : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline">{topic.code}</Badge>
                          {topic.scope === 'custom' ? <Badge variant="accent">Custom</Badge> : null}
                          <Badge
                            variant={
                              topic.difficulty === 'hard'
                                ? 'destructive'
                                : topic.difficulty === 'easy'
                                  ? 'accent'
                                  : 'secondary'
                            }
                          >
                            {topic.difficulty}
                          </Badge>
                          <span className="text-xs text-zinc-500">{topic.estimatedMinutes} min</span>
                        </div>
                        <h3 className="mt-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
                          {language === 'bn' && topic.titleBn ? topic.titleBn : topic.title}
                        </h3>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          {sub?.name ?? 'Subject'} · Ch {chap?.chapterNumber ?? '—'}:{' '}
                          {chap?.title ?? 'Chapter'}
                        </p>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant={isSaved ? 'default' : 'outline'}
                        disabled={togglingTopicId === topic.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleToggleSaved(topic.id);
                        }}
                      >
                        {isSaved
                          ? language === 'bn'
                            ? 'সংরক্ষিত'
                            : 'Saved'
                          : language === 'bn'
                            ? 'সংরক্ষণ'
                            : 'Save'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {meta.totalPages > 1 ? (
            <div className="flex items-center justify-between pt-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-xs text-zinc-500">
                Page {meta.page} of {meta.totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </div>

        {/* Topic Inspector Panel */}
        <div className="lg:col-span-7">
          {activeTopic ? (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default">{activeTopic.code}</Badge>
                    <Badge
                      variant={
                        activeTopic.difficulty === 'hard'
                          ? 'destructive'
                          : activeTopic.difficulty === 'easy'
                            ? 'accent'
                            : 'secondary'
                      }
                    >
                      Difficulty: {activeTopic.difficulty.toUpperCase()}
                    </Badge>
                    <Badge variant="outline">{activeTopic.estimatedMinutes} mins est.</Badge>
                    {activeTopic.syllabusWeightVerified &&
                    activeTopic.syllabusPriorityScore !== undefined ? (
                      <Badge variant="accent">
                        Syllabus Priority: {activeTopic.syllabusPriorityScore}/100
                      </Badge>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant={data?.savedTopicIds.includes(activeTopic.id) ? 'default' : 'outline'}
                    onClick={() => void handleToggleSaved(activeTopic.id)}
                  >
                    {data?.savedTopicIds.includes(activeTopic.id)
                      ? language === 'bn'
                        ? '★ আমার তালিকায় সংরক্ষিত'
                        : '★ Saved in My Learning List'
                      : language === 'bn'
                        ? '☆ আমার তালিকায় যোগ করুন'
                        : '☆ Add to My Learning List'}
                  </Button>
                </div>

                <CardTitle className="mt-2 text-xl">
                  {activeTopic.title}
                  {activeTopic.titleBn ? (
                    <span className="block text-base font-normal text-indigo-600 dark:text-indigo-400">
                      {activeTopic.titleBn}
                    </span>
                  ) : null}
                </CardTitle>
                <CardDescription>{activeTopic.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {language === 'bn'
                      ? 'শিখনফল (Learning Objectives)'
                      : 'Learning Objectives'}
                  </h4>
                  <ul className="space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                    {activeTopic.learningObjectives.map((obj, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="mt-0.5 text-indigo-600 dark:text-indigo-400">✓</span>
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Separator />

                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {language === 'bn' ? 'গুরুত্বপূর্ণ ধারণা (Key Concepts)' : 'Key Concepts'}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {activeTopic.keyConcepts.map((concept) => (
                      <Badge key={concept} variant="outline">
                        {concept}
                      </Badge>
                    ))}
                  </div>
                </div>

                {activeTopic.curriculumReferences.length > 0 ? (
                  <div>
                    <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      {language === 'bn' ? 'সিলেবাস সূত্র' : 'Curriculum References'}
                    </h4>
                    <div className="flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {activeTopic.curriculumReferences.map((ref) => (
                        <span
                          key={ref}
                          className="rounded-lg bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800"
                        >
                          {ref}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <Separator />

                <div>
                  <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {language === 'bn'
                      ? 'এই টপিক নিয়ে অধ্যয়ন শুরু করুন'
                      : 'Launch Contextual AI Study Tools'}
                  </h4>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <Link href={`/tutor?topicId=${activeTopic.id}`}>
                      <Button variant="default" className="w-full justify-start">
                        {language === 'bn'
                          ? 'এআই টিউটরের সাথে আলোচনা করুন →'
                          : 'Ask AI Subject Tutor →'}
                      </Button>
                    </Link>
                    <Link href={`/materials?topicId=${activeTopic.id}`}>
                      <Button variant="outline" className="w-full justify-start">
                        {language === 'bn'
                          ? 'নোট ও সারাংশ তৈরি করুন →'
                          : 'Generate Study Notes & Summary →'}
                      </Button>
                    </Link>
                    <Link href={`/quizzes?topicId=${activeTopic.id}`}>
                      <Button variant="outline" className="w-full justify-start">
                        {language === 'bn'
                          ? 'অনুশীলন কুইজ দিন →'
                          : 'Take Topic Practice Quiz →'}
                      </Button>
                    </Link>
                    <Link href={`/flashcards?topicId=${activeTopic.id}`}>
                      <Button variant="outline" className="w-full justify-start">
                        {language === 'bn'
                          ? 'ফ্ল্যাশকার্ড তৈরি করুন →'
                          : 'Build Spaced-Repetition Deck →'}
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-sm text-zinc-500">
                {language === 'bn'
                  ? 'বিস্তারিত দেখার জন্য বাম পাশের তালিকা থেকে একটি টপিক নির্বাচন করুন।'
                  : 'Select a topic from the catalog on the left to inspect its learning objectives, prerequisites, and study actions.'}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
