'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Compass,
  FileText,
  FolderOpen,
  Home,
  Layers,
  Loader2,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import type { EducationLabelDefinition } from '@/config/education-presets';
import { useEducationLabels } from '@/hooks/use-education-labels';
import {
  buildSubjectChapterProgress,
  getAdjacentChapters,
  type NavChapterRef,
  type NavSubjectRef,
  type ProgressTopicRef,
} from '@/lib/learning/navigation-helpers';
import { notify } from '@/lib/ui/toast';
import { useUIPreferences } from '@/components/providers/app-providers';
import { InlineAlert, PageEmptyState } from '@/components/shared/page-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
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

interface CurriculumPayload {
  educationSystems: EducationSystemItem[];
  educationLevels: EducationLevelItem[];
  examinations: ExaminationItem[];
  subjects: NavSubjectRef[];
  chapters: NavChapterRef[];
  topics: ProgressTopicRef[];
  savedTopicIds: string[];
  labels?: EducationLabelDefinition[];
  hierarchyPreview?: string;
}

interface AnalyticsTopicMasteryItem {
  topicId: string;
  isCompleted: boolean;
}

const SELECT_CLASS =
  'h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]';

export function AcademicWorkspace() {
  const { language } = useUIPreferences();
  const isBn = language === 'bn';
  const searchParams = useSearchParams();

  const [curriculum, setCurriculum] = useState<CurriculumPayload | null>(null);
  const [subjectTopics, setSubjectTopics] = useState<ProgressTopicRef[] | null>(null);
  const [subjectChapters, setSubjectChapters] = useState<NavChapterRef[] | null>(null);
  const [completedTopicIds, setCompletedTopicIds] = useState<Set<string>>(() => new Set());

  const [loading, setLoading] = useState(true);
  const [subjectLoading, setSubjectLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active academic context (persisted in student workspace or switched via modal)
  const [contextSystemId, setContextSystemId] = useState('');
  const [contextLevelId, setContextLevelId] = useState('');
  const [contextExamId, setContextExamId] = useState('');

  // Modal draft values for Switch Context Dialog
  const [contextDialogOpen, setContextDialogOpen] = useState(false);
  const [draftSystemId, setDraftSystemId] = useState('');
  const [draftLevelId, setDraftLevelId] = useState('');
  const [draftExamId, setDraftExamId] = useState('');
  const [savingWorkspaceContext, setSavingWorkspaceContext] = useState(false);

  // Selected subject & chapter
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    () => searchParams.get('subject') ?? '',
  );
  const [selectedChapterId, setSelectedChapterId] = useState<string>(
    () => searchParams.get('chapter') ?? '',
  );

  // Quick search & filter controls
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('');
  const [savedOnly, setSavedOnly] = useState(false);

  // Desktop collapsible chapter sidebar + mobile chapter sheet
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Busy states for mutations
  const [savingBookmarkId, setSavingBookmarkId] = useState<string | null>(null);
  const [togglingProgressId, setTogglingProgressId] = useState<string | null>(null);

  const { getLabel, reloadLabels, hierarchyPreview } = useEducationLabels(curriculum?.labels);

  const loadWorkspaceAndCurriculum = useCallback(
    async (overrideSystemId?: string) => {
      setLoading(true);
      setError(null);
      try {
        const wsRes = await fetch('/api/v1/education/workspace', { credentials: 'include' });
        const wsJson = wsRes.ok
          ? ((await wsRes.json()) as {
              success?: boolean;
              data?: { activeSystemId?: string; activeLevelId?: string; activeExaminationId?: string };
            })
          : null;

        const targetSystemId =
          overrideSystemId !== undefined
            ? overrideSystemId
            : (wsJson?.data?.activeSystemId ?? '');

        if (overrideSystemId === undefined && wsJson?.data) {
          setContextSystemId(wsJson.data.activeSystemId ?? '');
          setContextLevelId(wsJson.data.activeLevelId ?? '');
          setContextExamId(wsJson.data.activeExaminationId ?? '');
        }

        const params = new URLSearchParams({ limit: '100' });
        if (targetSystemId) {
          params.set('educationSystemId', targetSystemId);
        }

        const [currRes, analyticsRes] = await Promise.all([
          fetch(`/api/v1/curriculum?${params.toString()}`, { credentials: 'include' }),
          fetch('/api/v1/analytics', { credentials: 'include' }),
        ]);

        const currJson = (await currRes.json()) as {
          success?: boolean;
          data?: CurriculumPayload;
          error?: { message?: string };
        };

        if (!currRes.ok || !currJson.success || !currJson.data) {
          setError(currJson.error?.message ?? 'Unable to load academic curriculum');
          return;
        }

        setCurriculum(currJson.data);

        if (analyticsRes.ok) {
          const analyticsJson = (await analyticsRes.json()) as {
            success?: boolean;
            data?: { topicMastery?: AnalyticsTopicMasteryItem[] };
          };
          if (analyticsJson.success && Array.isArray(analyticsJson.data?.topicMastery)) {
            const doneIds = new Set(
              analyticsJson.data.topicMastery
                .filter((item) => item.isCompleted)
                .map((item) => item.topicId),
            );
            setCompletedTopicIds(doneIds);
          }
        }
      } catch {
        setError('Network error while loading your academic workspace.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadWorkspaceAndCurriculum();
  }, [loadWorkspaceAndCurriculum]);

  // Reload labels whenever active system changes
  useEffect(() => {
    if (contextSystemId) {
      void reloadLabels(contextSystemId);
    }
  }, [contextSystemId, reloadLabels]);

  // Fetch complete chapter & topic details whenever user focuses on a specific subject
  useEffect(() => {
    if (!selectedSubjectId) {
      setSubjectChapters(null);
      setSubjectTopics(null);
      return;
    }

    let cancelled = false;
    async function loadSubjectDetail() {
      setSubjectLoading(true);
      try {
        const res = await fetch(
          `/api/v1/curriculum?subjectId=${encodeURIComponent(selectedSubjectId)}&limit=100`,
          { credentials: 'include' },
        );
        const json = (await res.json()) as {
          success?: boolean;
          data?: CurriculumPayload;
        };
        if (!cancelled && res.ok && json.success && json.data) {
          const ordered = [...json.data.chapters]
            .filter((ch) => ch.subjectId === selectedSubjectId)
            .sort((a, b) => a.chapterNumber - b.chapterNumber);
          setSubjectChapters(ordered);
          setSubjectTopics(json.data.topics);
          setSelectedChapterId((prev) =>
            prev && ordered.some((c) => c.id === prev) ? prev : (ordered[0]?.id ?? ''),
          );
        }
      } finally {
        if (!cancelled) {
          setSubjectLoading(false);
        }
      }
    }

    void loadSubjectDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedSubjectId]);

  const savedSet = useMemo(() => new Set(curriculum?.savedTopicIds ?? []), [curriculum]);

  const systems = curriculum?.educationSystems ?? [];
  const allLevels = curriculum?.educationLevels ?? [];
  const allExams = curriculum?.examinations ?? [];
  const allSubjects = curriculum?.subjects ?? [];
  const allChapters = curriculum?.chapters ?? [];
  const allTopics = curriculum?.topics ?? [];

  const activeSystem = useMemo(
    () => systems.find((s) => s.id === contextSystemId) ?? null,
    [systems, contextSystemId],
  );
  const activeLevel = useMemo(
    () => allLevels.find((l) => l.id === contextLevelId) ?? null,
    [allLevels, contextLevelId],
  );
  const activeExam = useMemo(
    () => allExams.find((e) => e.id === contextExamId) ?? null,
    [allExams, contextExamId],
  );

  // Scoped subjects inside the chosen level / exam context
  const visibleSubjects = useMemo(() => {
    return allSubjects.filter((subj) => {
      if (contextSystemId && subj.educationSystemId !== contextSystemId) return false;
      if (contextLevelId && subj.educationLevelId && subj.educationLevelId !== contextLevelId) {
        return false;
      }
      if (contextExamId && subj.examinationIds.length > 0 && !subj.examinationIds.includes(contextExamId)) {
        return false;
      }
      return true;
    });
  }, [allSubjects, contextSystemId, contextLevelId, contextExamId]);

  const activeSubject = useMemo(
    () => allSubjects.find((s) => s.id === selectedSubjectId) ?? null,
    [allSubjects, selectedSubjectId],
  );

  const orderedSubjectChapters = useMemo(() => {
    const source = subjectChapters ?? allChapters.filter((ch) => ch.subjectId === selectedSubjectId);
    return [...source].sort((a, b) => a.chapterNumber - b.chapterNumber);
  }, [subjectChapters, allChapters, selectedSubjectId]);

  const activeChapter = useMemo(
    () => orderedSubjectChapters.find((ch) => ch.id === selectedChapterId) ?? orderedSubjectChapters[0] ?? null,
    [orderedSubjectChapters, selectedChapterId],
  );

  const { previousChapter, nextChapter } = useMemo(
    () => getAdjacentChapters(orderedSubjectChapters, activeChapter?.id),
    [orderedSubjectChapters, activeChapter?.id],
  );

  const effectiveTopicsPool = useMemo(() => {
    if (!subjectTopics || subjectTopics.length === 0) return allTopics;
    const byId = new Map<string, ProgressTopicRef>();
    for (const item of allTopics) byId.set(item.id, item);
    for (const item of subjectTopics) byId.set(item.id, item);
    return Array.from(byId.values());
  }, [allTopics, subjectTopics]);

  const { subjectProgress, chapterProgress } = useMemo(
    () => buildSubjectChapterProgress(visibleSubjects, allChapters, effectiveTopicsPool, completedTopicIds),
    [visibleSubjects, allChapters, effectiveTopicsPool, completedTopicIds],
  );

  // Filtered topics for the active chapter (or global quick-search results when no subject is open)
  const chapterTopics = useMemo(() => {
    if (!activeChapter) return [];
    const q = searchQuery.trim().toLowerCase();
    return effectiveTopicsPool.filter((t) => {
      if (t.chapterId !== activeChapter.id) return false;
      if (difficultyFilter && t.difficulty !== difficultyFilter) return false;
      if (savedOnly && !savedSet.has(t.id)) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.titleBn ?? '').toLowerCase().includes(q) ||
        t.keyConcepts.some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [activeChapter, effectiveTopicsPool, searchQuery, difficultyFilter, savedOnly, savedSet]);

  const hasQuickFilter = Boolean(searchQuery.trim() || difficultyFilter || savedOnly);

  const globalFilteredTopics = useMemo(() => {
    if (!hasQuickFilter) return [];
    const q = searchQuery.trim().toLowerCase();
    const visibleSubjIds = new Set(visibleSubjects.map((s) => s.id));
    return effectiveTopicsPool.filter((t) => {
      if (visibleSubjIds.size > 0 && !visibleSubjIds.has(t.subjectId)) return false;
      if (difficultyFilter && t.difficulty !== difficultyFilter) return false;
      if (savedOnly && !savedSet.has(t.id)) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.titleBn ?? '').toLowerCase().includes(q) ||
        t.keyConcepts.some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [hasQuickFilter, searchQuery, difficultyFilter, savedOnly, savedSet, effectiveTopicsPool, visibleSubjects]);

  const subjectChapterCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ch of allChapters) {
      counts.set(ch.subjectId, (counts.get(ch.subjectId) ?? 0) + 1);
    }
    return counts;
  }, [allChapters]);

  function openSubject(subjectId: string, chapterId?: string) {
    setSelectedSubjectId(subjectId);
    setSelectedChapterId(chapterId ?? '');
    setSearchQuery('');
    setDifficultyFilter('');
    setSavedOnly(false);
  }

  async function handleToggleSaved(topicId: string) {
    setSavingBookmarkId(topicId);
    try {
      const res = await fetch('/api/v1/topics/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ topicId }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { saved?: boolean; savedTopicIds?: string[] };
        error?: { message?: string };
      };
      if (!res.ok || !json.success || !json.data) {
        notify.error(json.error?.message ?? 'Unable to update saved topics');
        return;
      }
      setCurriculum((prev) =>
        prev ? { ...prev, savedTopicIds: json.data?.savedTopicIds ?? prev.savedTopicIds } : prev,
      );
      notify.success(
        json.data.saved
          ? isBn
            ? 'টপিক বুকমার্ক করা হয়েছে।'
            : 'Topic bookmarked.'
          : isBn
            ? 'বুকমার্ক সরানো হয়েছে।'
            : 'Removed from bookmarks.',
      );
    } catch (err) {
      notify.error(err, 'Unable to update bookmark.');
    } finally {
      setSavingBookmarkId(null);
    }
  }

  async function handleToggleTopicCompleted(topic: ProgressTopicRef) {
    const nextCompleted = !completedTopicIds.has(topic.id);
    setTogglingProgressId(topic.id);
    try {
      const res = await fetch('/api/v1/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          topicId: topic.id,
          studyTimeMinutesDelta: nextCompleted ? 15 : 0,
          markCompleted: nextCompleted,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.success) {
        notify.error(json.error?.message ?? 'Failed to update topic progress');
        return;
      }
      setCompletedTopicIds((prev) => {
        const next = new Set(prev);
        if (nextCompleted) next.add(topic.id);
        else next.delete(topic.id);
        return next;
      });
      notify.success(
        nextCompleted
          ? isBn
            ? `"${topic.title}" সম্পন্ন হিসেবে সংরক্ষিত হয়েছে!`
            : `Marked "${topic.title}" completed!`
          : isBn
            ? `"${topic.title}" অসম্পূর্ণ হিসেবে চিহ্নিত হয়েছে।`
            : `Marked "${topic.title}" in progress.`,
      );
    } catch (err) {
      notify.error(err, 'Network error updating topic progress.');
    } finally {
      setTogglingProgressId(null);
    }
  }

  async function handleApplyContext(persistAsDefault: boolean) {
    setSavingWorkspaceContext(true);
    try {
      if (persistAsDefault && draftSystemId) {
        const res = await fetch('/api/v1/education/workspace', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            educationSystemId: draftSystemId,
            ...(draftLevelId ? { educationLevelId: draftLevelId } : {}),
            ...(draftExamId ? { targetExaminationId: draftExamId } : {}),
          }),
        });
        const json = (await res.json()) as { success?: boolean; error?: { message?: string } };
        if (!res.ok || !json.success) {
          notify.error(json.error?.message ?? 'Unable to update workspace context');
          return;
        }
      }

      setContextSystemId(draftSystemId);
      setContextLevelId(draftLevelId);
      setContextExamId(draftExamId);
      setSelectedSubjectId('');
      setSelectedChapterId('');
      setContextDialogOpen(false);
      await loadWorkspaceAndCurriculum(draftSystemId);
      notify.success(
        persistAsDefault
          ? isBn
            ? 'শিক্ষাব্যবস্থা ডিফল্ট হিসেবে সংরক্ষিত হয়েছে।'
            : 'Workspace academic track saved.'
          : isBn
            ? 'শিক্ষাব্যবস্থা ফিল্টার আপডেট হয়েছে।'
            : 'Academic context updated.',
      );
    } catch (err) {
      notify.error(err, 'Could not switch academic context.');
    } finally {
      setSavingWorkspaceContext(false);
    }
  }

  function renderChapterNavList(onAfterSelect?: () => void) {
    if (orderedSubjectChapters.length === 0) {
      return (
        <p className="p-3 text-xs text-[var(--muted-foreground)]">
          {isBn
            ? `এই ${getLabel('subject')}-এ এখনো কোনো ${getLabel('chapter')} যোগ করা হয়নি।`
            : `No ${getLabel('chapter', 'plural').toLowerCase()} found in this ${getLabel('subject').toLowerCase()} yet.`}
        </p>
      );
    }

    return (
      <div className="space-y-1.5">
        {orderedSubjectChapters.map((chap) => {
          const isCurrent = activeChapter?.id === chap.id;
          const summary = chapterProgress.get(chap.id) ?? {
            totalTopics: 0,
            completedTopics: 0,
            completionPercent: 0,
          };

          return (
            <button
              key={chap.id}
              type="button"
              onClick={() => {
                setSelectedChapterId(chap.id);
                onAfterSelect?.();
              }}
              className={`w-full rounded-xl border p-3 text-left transition-colors ${
                isCurrent
                  ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--foreground)]'
                  : 'border-transparent hover:bg-[var(--secondary)]/70'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--primary)]">
                  {getLabel('chapter')} {chap.chapterNumber}
                </span>
                <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
                  {summary.completedTopics}/{summary.totalTopics}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm font-medium">{chap.title}</p>
              <Progress value={summary.completionPercent} className="mt-2 h-1.5" />
            </button>
          );
        })}
      </div>
    );
  }

  const draftLevels = useMemo(
    () => allLevels.filter((l) => !draftSystemId || l.educationSystemId === draftSystemId),
    [allLevels, draftSystemId],
  );
  const draftExams = useMemo(
    () =>
      allExams.filter((e) => {
        if (draftSystemId && e.educationSystemId !== draftSystemId) return false;
        if (draftLevelId && e.educationLevelId && e.educationLevelId !== draftLevelId) return false;
        return true;
      }),
    [allExams, draftSystemId, draftLevelId],
  );

  return (
    <div className="space-y-6">
      {/* Compact Breadcrumb + Workspace Switcher (Replaces Permanent 6-Dropdown Form) */}
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <nav
              aria-label="Academic breadcrumb"
              className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted-foreground)]"
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedSubjectId('');
                  setSelectedChapterId('');
                }}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-[var(--foreground)] hover:bg-[var(--secondary)]"
              >
                <Home className="size-3.5" />
                <span>{isBn ? 'আমার অধ্যয়ন' : 'My Learning'}</span>
              </button>

              {activeSystem ? (
                <>
                  <ChevronRight className="size-3.5" />
                  <button
                    type="button"
                    onClick={() => {
                      setDraftSystemId(contextSystemId);
                      setDraftLevelId(contextLevelId);
                      setDraftExamId(contextExamId);
                      setContextDialogOpen(true);
                    }}
                    className="rounded-md px-1.5 py-0.5 hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                  >
                    {activeSystem.name}
                  </button>
                </>
              ) : null}

              {activeLevel ? (
                <>
                  <ChevronRight className="size-3.5" />
                  <span>{activeLevel.name}</span>
                </>
              ) : null}

              {activeExam ? (
                <>
                  <ChevronRight className="size-3.5" />
                  <Badge variant="outline" className="text-[11px]">
                    {activeExam.name}
                  </Badge>
                </>
              ) : null}

              {activeSubject ? (
                <>
                  <ChevronRight className="size-3.5" />
                  <button
                    type="button"
                    onClick={() => setSelectedChapterId(orderedSubjectChapters[0]?.id ?? '')}
                    className="font-medium text-[var(--foreground)] hover:underline"
                  >
                    {activeSubject.name}
                  </button>
                </>
              ) : null}

              {activeSubject && activeChapter ? (
                <>
                  <ChevronRight className="size-3.5" />
                  <span className="font-medium text-[var(--primary)]">
                    {getLabel('chapter')} {activeChapter.chapterNumber}
                  </span>
                </>
              ) : null}
            </nav>

            <div>
              <CardTitle className="text-xl">
                {activeSubject
                  ? isBn && activeSubject.nameBn
                    ? activeSubject.nameBn
                    : activeSubject.name
                  : isBn
                    ? `আমার ${getLabel('subject', 'plural')}`
                    : `Explore Your ${getLabel('subject', 'plural')}`}
              </CardTitle>
              <CardDescription className="mt-1">
                {hierarchyPreview}
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Dialog
              open={contextDialogOpen}
              onOpenChange={(open) => {
                setContextDialogOpen(open);
                if (open) {
                  setDraftSystemId(contextSystemId);
                  setDraftLevelId(contextLevelId);
                  setDraftExamId(contextExamId);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Compass className="size-4" />
                  <span>{isBn ? 'শিক্ষা ট্র্যাক পরিবর্তন' : 'Switch Context'}</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {isBn ? 'শিক্ষা ও পরীক্ষার প্রেক্ষাপট' : 'Academic & Examination Context'}
                  </DialogTitle>
                  <DialogDescription>
                    {isBn
                      ? 'আপনার সক্রিয় শিক্ষাব্যবস্থা, স্তর এবং লক্ষ্য পরীক্ষা নির্বাচন করুন।'
                      : 'Switch between your official or custom education systems, levels, and target examinations.'}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--muted-foreground)]">
                      {getLabel('educationSystem')}
                    </label>
                    <select
                      className={SELECT_CLASS}
                      value={draftSystemId}
                      onChange={(e) => {
                        setDraftSystemId(e.target.value);
                        setDraftLevelId('');
                        setDraftExamId('');
                      }}
                    >
                      <option value="">All Systems</option>
                      {systems.map((sys) => (
                        <option key={sys.id} value={sys.id}>
                          {sys.name} ({sys.country}){sys.scope === 'custom' ? ' · Custom' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {draftLevels.length > 0 ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[var(--muted-foreground)]">
                        {getLabel('educationLevel')}
                      </label>
                      <select
                        className={SELECT_CLASS}
                        value={draftLevelId}
                        onChange={(e) => {
                          setDraftLevelId(e.target.value);
                          setDraftExamId('');
                        }}
                      >
                        <option value="">All {getLabel('educationLevel', 'plural')}</option>
                        {draftLevels.map((lvl) => (
                          <option key={lvl.id} value={lvl.id}>
                            {lvl.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {draftExams.length > 0 ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[var(--muted-foreground)]">
                        {getLabel('examination')}
                      </label>
                      <select
                        className={SELECT_CLASS}
                        value={draftExamId}
                        onChange={(e) => setDraftExamId(e.target.value)}
                      >
                        <option value="">All {getLabel('examination', 'plural')}</option>
                        {draftExams.map((ex) => (
                          <option key={ex.id} value={ex.id}>
                            {ex.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                  <Link href="/settings/education">
                    <Button variant="ghost" size="sm">
                      <Settings2 className="size-4" />
                      <span>{isBn ? 'কাস্টম স্টুডিও' : 'Customize Labels & Structure'}</span>
                    </Button>
                  </Link>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={savingWorkspaceContext}
                      onClick={() => void handleApplyContext(false)}
                    >
                      {isBn ? 'শুধু এই ভিউতে দেখুন' : 'Preview View'}
                    </Button>
                    <Button
                      size="sm"
                      disabled={savingWorkspaceContext}
                      onClick={() => void handleApplyContext(true)}
                    >
                      {savingWorkspaceContext ? <Loader2 className="size-4 animate-spin" /> : null}
                      <span>{isBn ? 'ডিফল্ট হিসেবে সংরক্ষণ' : 'Save & Apply'}</span>
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Link href="/settings/education">
              <Button variant="secondary" size="sm">
                <SlidersHorizontal className="size-4" />
                <span>{isBn ? 'কাস্টম সিস্টেম' : 'Education Studio'}</span>
              </Button>
            </Link>
          </div>
        </CardHeader>

        {/* Single-Row Search + Saved + Difficulty Toolbar */}
        <CardContent className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isBn
                  ? `${getLabel('topic')} বা ধারণা খুঁজুন...`
                  : `Search ${getLabel('topic', 'plural').toLowerCase()} or key concepts...`
              }
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(['', 'easy', 'medium', 'hard'] as const).map((level) => (
              <Button
                key={level || 'all'}
                size="sm"
                variant={difficultyFilter === level ? 'default' : 'outline'}
                className="h-8 rounded-full px-3 text-xs capitalize"
                onClick={() => setDifficultyFilter(level)}
              >
                {level === '' ? (isBn ? 'সব' : 'All Levels') : level}
              </Button>
            ))}

            <Button
              size="sm"
              variant={savedOnly ? 'secondary' : 'outline'}
              className="h-8 gap-1.5 rounded-full px-3 text-xs"
              onClick={() => setSavedOnly((prev) => !prev)}
            >
              <Bookmark className={`size-3.5 ${savedOnly ? 'fill-current' : ''}`} />
              <span>
                {isBn ? 'বুকমার্ক' : 'Saved'} ({curriculum?.savedTopicIds.length ?? 0})
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <InlineAlert
          variant="destructive"
          title={isBn ? 'কারিকুলাম লোড ব্যর্থ' : 'Unable to load syllabus'}
          description={error}
          action={
            <Button size="sm" variant="outline" onClick={() => void loadWorkspaceAndCurriculum()}>
              <RefreshCw className="size-3.5" />
              <span>{isBn ? 'আবার চেষ্টা করুন' : 'Retry'}</span>
            </Button>
          }
        />
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <Card key={idx}>
              <CardHeader>
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-8 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : selectedSubjectId && activeSubject ? (
        /* Mode B: Focused Chapter-by-Chapter Study View */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedSubjectId('');
                  setSelectedChapterId('');
                }}
              >
                <ArrowLeft className="size-4" />
                <span>
                  {isBn
                    ? `সব ${getLabel('subject', 'plural')}`
                    : `All ${getLabel('subject', 'plural')}`}
                </span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="hidden lg:inline-flex"
                onClick={() => setSidebarOpen((prev) => !prev)}
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="size-4" />
                ) : (
                  <PanelLeftOpen className="size-4" />
                )}
                <span>
                  {sidebarOpen
                    ? isBn
                      ? 'সাইডবার লুকান'
                      : 'Hide Chapters'
                    : isBn
                      ? 'অধ্যায় দেখুন'
                      : 'Show Chapters'}
                </span>
              </Button>

              {/* Mobile Chapter Sheet Trigger */}
              <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="lg:hidden">
                    <Menu className="size-4" />
                    <span>
                      {getLabel('chapter', 'plural')} ({orderedSubjectChapters.length})
                    </span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 overflow-y-auto p-4">
                  <SheetHeader className="px-0">
                    <SheetTitle>{activeSubject.name}</SheetTitle>
                    <SheetDescription>
                      {getLabel('chapter', 'plural')}
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-4">
                    {renderChapterNavList(() => setMobileDrawerOpen(false))}
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Previous / Next Chapter Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!previousChapter}
                onClick={() => {
                  if (previousChapter) setSelectedChapterId(previousChapter.id);
                }}
              >
                <ArrowLeft className="size-3.5" />
                <span>
                  {previousChapter
                    ? `${getLabel('chapter')} ${previousChapter.chapterNumber}`
                    : isBn
                      ? 'পূর্ববর্তী'
                      : 'Previous'}
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!nextChapter}
                onClick={() => {
                  if (nextChapter) setSelectedChapterId(nextChapter.id);
                }}
              >
                <span>
                  {nextChapter
                    ? `${getLabel('chapter')} ${nextChapter.chapterNumber}`
                    : isBn
                      ? 'পরবর্তী'
                      : 'Next'}
                </span>
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>

          <div
            className={`grid gap-6 ${
              sidebarOpen ? 'lg:grid-cols-[290px_minmax(0,1fr)]' : 'lg:grid-cols-1'
            }`}
          >
            {/* Desktop Collapsible Chapter Sidebar */}
            <Collapsible open={sidebarOpen} onOpenChange={setSidebarOpen} className="hidden lg:block">
              <CollapsibleTrigger className="sr-only">Toggle chapter navigation</CollapsibleTrigger>
              <CollapsibleContent>
                <Card className="sticky top-20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">
                      {getLabel('chapter', 'plural')} ({orderedSubjectChapters.length})
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {activeSubject.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="max-h-[70vh] overflow-y-auto pt-0">
                    {renderChapterNavList()}
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>

            {/* Chapter Detail & Topics */}
            <div className="space-y-4">
              {subjectLoading ? (
                <Card>
                  <CardContent className="space-y-3 p-6">
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ) : !activeChapter ? (
                <PageEmptyState
                  title={
                    isBn
                      ? `কোনো ${getLabel('chapter')} পাওয়া যায়নি`
                      : `No ${getLabel('chapter', 'plural').toLowerCase()} yet`
                  }
                  description={
                    isBn
                      ? 'কাস্টম এডুকেশন স্টুডিও থেকে এই বিষয়ে অধ্যায় ও টপিক যোগ করুন।'
                      : `Add ${getLabel('chapter', 'plural').toLowerCase()} and ${getLabel('topic', 'plural').toLowerCase()} to this ${getLabel('subject').toLowerCase()} inside Education Studio.`
                  }
                  actionLabel={isBn ? 'অধ্যায় যোগ করুন' : 'Open Education Studio'}
                  actionHref="/settings/education"
                />
              ) : (
                <>
                  <Card>
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <Badge variant="accent">
                            {getLabel('chapter')} {activeChapter.chapterNumber}
                          </Badge>
                          <CardTitle className="pt-1 text-lg">
                            {activeChapter.title}
                          </CardTitle>
                          {activeChapter.description ? (
                            <CardDescription>{activeChapter.description}</CardDescription>
                          ) : null}
                        </div>

                        {(() => {
                          const prog = chapterProgress.get(activeChapter.id) ?? {
                            totalTopics: 0,
                            completedTopics: 0,
                            completionPercent: 0,
                          };
                          return (
                            <div className="min-w-44 space-y-1.5 rounded-xl border p-3">
                              <div className="flex items-center justify-between text-xs font-medium">
                                <span>{isBn ? 'অগ্রগতি' : 'Chapter Progress'}</span>
                                <span>
                                  {prog.completedTopics}/{prog.totalTopics} ({prog.completionPercent}%)
                                </span>
                              </div>
                              <Progress value={prog.completionPercent} />
                            </div>
                          );
                        })()}
                      </div>
                    </CardHeader>
                  </Card>

                  {chapterTopics.length === 0 ? (
                    <PageEmptyState
                      title={
                        hasQuickFilter
                          ? isBn
                            ? 'কোনো মিল খুঁজে পাওয়া যায়নি'
                            : 'No matching topics in this chapter'
                          : isBn
                            ? `এই ${getLabel('chapter')}-এ কোনো ${getLabel('topic')} নেই`
                            : `No ${getLabel('topic', 'plural').toLowerCase()} in this ${getLabel('chapter').toLowerCase()}`
                      }
                      description={
                        hasQuickFilter
                          ? 'Try clearing your search or difficulty filter to see all chapter topics.'
                          : 'You can add custom topics for this chapter in Education Studio.'
                      }
                      actionLabel={hasQuickFilter ? 'Clear Filters' : 'Open Education Studio'}
                      actionHref={hasQuickFilter ? undefined : '/settings/education'}
                      onAction={
                        hasQuickFilter
                          ? () => {
                              setSearchQuery('');
                              setDifficultyFilter('');
                              setSavedOnly(false);
                            }
                          : undefined
                      }
                    />
                  ) : (
                    <div className="space-y-3">
                      {chapterTopics.map((topic) => {
                        const isDone = completedTopicIds.has(topic.id);
                        const isSaved = savedSet.has(topic.id);

                        return (
                          <Card
                            key={topic.id}
                            className={isDone ? 'border-emerald-500/35 bg-emerald-500/[0.03]' : ''}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-1.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="text-[11px] capitalize">
                                      {topic.difficulty}
                                    </Badge>
                                    <Badge variant="secondary" className="gap-1 text-[11px]">
                                      <Clock className="size-3" />
                                      <span>{topic.estimatedMinutes}m</span>
                                    </Badge>
                                    {isDone ? (
                                      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                                        {isBn ? 'সম্পন্ন' : 'Completed'}
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <CardTitle className="text-base">{topic.title}</CardTitle>
                                  {topic.titleBn ? (
                                    <p className="text-xs text-[var(--muted-foreground)]">
                                      {topic.titleBn}
                                    </p>
                                  ) : null}
                                  {topic.description ? (
                                    <CardDescription className="pt-0.5">
                                      {topic.description}
                                    </CardDescription>
                                  ) : null}
                                </div>

                                <div className="flex shrink-0 items-center gap-1.5">
                                  <Button
                                    size="sm"
                                    variant={isDone ? 'secondary' : 'outline'}
                                    disabled={togglingProgressId === topic.id}
                                    onClick={() => void handleToggleTopicCompleted(topic)}
                                  >
                                    {togglingProgressId === topic.id ? (
                                      <Loader2 className="size-4 animate-spin" />
                                    ) : isDone ? (
                                      <CheckCircle2 className="size-4 text-emerald-600" />
                                    ) : (
                                      <Circle className="size-4" />
                                    )}
                                    <span>
                                      {isDone
                                        ? isBn
                                          ? 'সম্পন্ন'
                                          : 'Completed'
                                        : isBn
                                          ? 'সম্পন্ন করুন'
                                          : 'Mark Done'}
                                    </span>
                                  </Button>

                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    disabled={savingBookmarkId === topic.id}
                                    title={isSaved ? 'Remove bookmark' : 'Bookmark topic'}
                                    aria-label={isSaved ? 'Remove bookmark' : 'Bookmark topic'}
                                    onClick={() => void handleToggleSaved(topic.id)}
                                  >
                                    <Bookmark
                                      className={`size-4 ${
                                        isSaved ? 'fill-current text-[var(--primary)]' : ''
                                      }`}
                                    />
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>

                            <CardContent className="space-y-3 pt-0">
                              {topic.learningObjectives.length > 0 ? (
                                <ul className="list-disc space-y-1 pl-5 text-xs text-[var(--muted-foreground)]">
                                  {topic.learningObjectives.slice(0, 3).map((obj, idx) => (
                                    <li key={idx}>{obj}</li>
                                  ))}
                                </ul>
                              ) : null}

                              {topic.keyConcepts.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {topic.keyConcepts.slice(0, 6).map((concept, idx) => (
                                    <span
                                      key={idx}
                                      className="rounded-md bg-[var(--secondary)] px-2 py-0.5 text-[11px] text-[var(--secondary-foreground)]"
                                    >
                                      {concept}
                                    </span>
                                  ))}
                                </div>
                              ) : null}

                              <div className="flex flex-wrap gap-2 border-t pt-3">
                                <Link href={`/tutor?topicId=${topic.id}&subjectId=${topic.subjectId}`}>
                                  <Button size="sm" variant="default">
                                    <MessageSquare className="size-3.5" />
                                    <span>{isBn ? 'এআই টিউটর' : 'Ask AI Tutor'}</span>
                                  </Button>
                                </Link>
                                <Link
                                  href={`/materials?topicId=${topic.id}&subjectId=${topic.subjectId}`}
                                >
                                  <Button size="sm" variant="outline">
                                    <Sparkles className="size-3.5" />
                                    <span>{isBn ? 'স্টাডি ম্যাটেরিয়াল' : 'Study Materials'}</span>
                                  </Button>
                                </Link>
                                <Link href={`/quizzes?topicId=${topic.id}&subjectId=${topic.subjectId}`}>
                                  <Button size="sm" variant="outline">
                                    <FileText className="size-3.5" />
                                    <span>{isBn ? 'কুইজ অনুশীলন' : 'Practice Quiz'}</span>
                                  </Button>
                                </Link>
                                <Link href={`/flashcards?topicId=${topic.id}&subjectId=${topic.subjectId}`}>
                                  <Button size="sm" variant="ghost">
                                    <Layers className="size-3.5" />
                                    <span>{isBn ? 'ফ্ল্যাশকার্ড' : 'Flashcards'}</span>
                                  </Button>
                                </Link>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Mode A: Subject Overview Grid (+ Global Quick Search Matches if Filtering) */
        <div className="space-y-6">
          {visibleSubjects.length === 0 ? (
            <PageEmptyState
              title={
                isBn
                  ? `কোনো ${getLabel('subject')} পাওয়া যায়নি`
                  : `No ${getLabel('subject', 'plural').toLowerCase()} in this context`
              }
              description={
                isBn
                  ? 'অন্য শিক্ষাব্যবস্থা বেছে নিন অথবা কাস্টম এডুকেশন স্টুডিওতে আপনার নিজস্ব বিষয় তৈরি করুন।'
                  : `Switch academic context or create custom ${getLabel('subject', 'plural').toLowerCase()} inside Education Studio.`
              }
              actionLabel={isBn ? 'কাস্টম স্টুডিও খুলুন' : 'Customize Education Studio'}
              actionHref="/settings/education"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visibleSubjects.map((subject) => {
                const prog = subjectProgress.get(subject.id) ?? {
                  totalTopics: 0,
                  completedTopics: 0,
                  completionPercent: 0,
                };
                const chapterCount = subjectChapterCountMap.get(subject.id) ?? 0;

                return (
                  <Card
                    key={subject.id}
                    className="flex flex-col justify-between transition-shadow hover:shadow-md"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block size-3 shrink-0 rounded-full"
                            style={{ backgroundColor: subject.color ?? '#0ea5e9' }}
                          />
                          <Badge variant="outline" className="text-[11px]">
                            {subject.code}
                          </Badge>
                        </div>
                        <Badge variant={subject.scope === 'custom' ? 'accent' : 'secondary'}>
                          {subject.scope === 'custom' ? 'Custom' : 'Official'}
                        </Badge>
                      </div>
                      <CardTitle className="pt-2 text-lg">
                        {isBn && subject.nameBn ? subject.nameBn : subject.name}
                      </CardTitle>
                      {subject.description ? (
                        <CardDescription className="line-clamp-2">
                          {subject.description}
                        </CardDescription>
                      ) : null}
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                        <span>
                          {chapterCount} {getLabel('chapter', 'plural')}
                        </span>
                        <span>
                          {prog.completedTopics}/{prog.totalTopics} {getLabel('topic', 'plural')}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <Progress value={prog.completionPercent} />
                        <p className="text-right text-[11px] font-medium text-[var(--muted-foreground)]">
                          {prog.completionPercent}% complete
                        </p>
                      </div>

                      <Button
                        className="w-full"
                        onClick={() => openSubject(subject.id)}
                      >
                        <FolderOpen className="size-4" />
                        <span>
                          {isBn
                            ? `${getLabel('chapter', 'plural')} খুলুন`
                            : `Browse ${getLabel('chapter', 'plural')}`}
                        </span>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {hasQuickFilter ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="size-4 text-[var(--primary)]" />
                  <span>
                    {isBn ? 'ফিল্টার ফলাফল' : 'Matching Topics'} ({globalFilteredTopics.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {globalFilteredTopics.length === 0 ? (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    No matching topics found across the current {getLabel('educationSystem').toLowerCase()}.
                  </p>
                ) : (
                  globalFilteredTopics.slice(0, 20).map((topic) => {
                    const subj = allSubjects.find((s) => s.id === topic.subjectId);
                    return (
                      <div
                        key={topic.id}
                        className="flex flex-col justify-between gap-2 rounded-xl border p-3 sm:flex-row sm:items-center"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">{topic.title}</span>
                            {subj ? <Badge variant="outline">{subj.name}</Badge> : null}
                            <Badge variant="secondary" className="text-[11px] capitalize">
                              {topic.difficulty}
                            </Badge>
                          </div>
                          {topic.description ? (
                            <p className="mt-1 line-clamp-1 text-xs text-[var(--muted-foreground)]">
                              {topic.description}
                            </p>
                          ) : null}
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openSubject(topic.subjectId, topic.chapterId)}
                        >
                          <span>Open {getLabel('chapter')}</span>
                          <ChevronRight className="size-3.5" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
