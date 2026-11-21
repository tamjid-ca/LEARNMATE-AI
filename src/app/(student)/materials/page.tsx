'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  BookMarked,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  FileText,
  Flag,
  HelpCircle,
  Layers,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useUIPreferences } from '@/components/providers/app-providers';
import { MarkdownRenderer } from '@/components/shared/markdown-renderer';
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
import { LEARNING_MATERIAL_CATALOG } from '@/config/learning-materials-catalog';
import { cn } from '@/lib/utils';
import type {
  ExplanationDepth,
  MaterialType,
  SupportedLanguage,
} from '@/types/domain';

interface SubjectOption {
  id: string;
  code: string;
  name: string;
  nameBn?: string;
}

interface TopicOption {
  id: string;
  subjectId: string;
  chapterId: string;
  code: string;
  title: string;
  titleBn?: string;
  description?: string;
}

interface GeneratedMaterialItem {
  id: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  materialType: MaterialType;
  title: string;
  contentMarkdown: string;
  structuredSections?: {
    summary: string;
    keyTakeaways: string[];
    formulasOrDefinitions: Array<{ term: string; detail: string }>;
    practicePrompts: string[];
  };
  language: SupportedLanguage;
  explanationDepth: ExplanationDepth;
  modelId: string;
  isSavedToLibrary: boolean;
  isFlagged: boolean;
  createdAt: string;
}

interface ApiBannerError {
  status: number;
  message: string;
}

async function parseApiErrorResponse(
  res: Response,
  fallbackMessage: string,
): Promise<ApiBannerError> {
  try {
    const json = (await res.json()) as {
      error?: { message?: string };
    };
    if (res.status === 401) {
      return {
        status: 401,
        message: 'Your session has expired or you are not signed in. Please sign in to continue.',
      };
    }
    return {
      status: res.status,
      message: json.error?.message || fallbackMessage,
    };
  } catch {
    return {
      status: res.status,
      message:
        res.status === 401
          ? 'Please sign in to generate and manage study materials.'
          : res.status === 503
            ? 'The AI or database service is temporarily unavailable. Please retry in a moment.'
            : fallbackMessage,
    };
  }
}

export default function StudentLearningMaterialsPage() {
  const { language: uiLanguage } = useUIPreferences();
  const isBn = uiLanguage === 'bn';

  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [materials, setMaterials] = useState<GeneratedMaterialItem[]>([]);
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);

  // Generator Studio state
  const [showStudio, setShowStudio] = useState<boolean>(true);
  const [topicMode, setTopicMode] = useState<'syllabus' | 'custom'>('syllabus');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [customTopicTitle, setCustomTopicTitle] = useState<string>('');
  const [selectedMaterialType, setSelectedMaterialType] =
    useState<MaterialType>('topic_explanation');
  const [materialLanguage, setMaterialLanguage] = useState<SupportedLanguage>('en');
  const [depth, setDepth] = useState<ExplanationDepth>('intermediate');
  const [customInstructions, setCustomInstructions] = useState<string>('');

  // Library search/filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  // Reader & Editor state
  const [editing, setEditing] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editMarkdown, setEditMarkdown] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Loading & feedback state
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [apiError, setApiError] = useState<ApiBannerError | null>(null);

  const filteredTopicsForSubject = useMemo(() => {
    if (!selectedSubjectId) return topics;
    return topics.filter((t) => t.subjectId === selectedSubjectId);
  }, [topics, selectedSubjectId]);

  const activeTopicObj = useMemo(
    () => topics.find((t) => t.id === selectedTopicId) ?? null,
    [topics, selectedTopicId],
  );

  const visibleMaterials = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return materials.filter((mat) => {
      if (typeFilter && mat.materialType !== typeFilter) return false;
      if (!q) return true;
      return (
        mat.title.toLowerCase().includes(q) ||
        mat.contentMarkdown.toLowerCase().includes(q)
      );
    });
  }, [materials, typeFilter, searchQuery]);

  const activeMaterial = useMemo(
    () =>
      visibleMaterials.find((m) => m.id === activeMaterialId) ??
      materials.find((m) => m.id === activeMaterialId) ??
      null,
    [visibleMaterials, materials, activeMaterialId],
  );

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const [currRes, matRes] = await Promise.all([
        fetch('/api/v1/curriculum?limit=100', { credentials: 'include' }),
        fetch('/api/v1/materials?limit=50', { credentials: 'include' }),
      ]);

      if (!currRes.ok) {
        setApiError(
          await parseApiErrorResponse(currRes, 'Unable to load syllabus topics.'),
        );
      } else {
        const currJson = await currRes.json();
        if (currJson.success) {
          const loadedSubjects: SubjectOption[] = currJson.data.subjects ?? [];
          const loadedTopics: TopicOption[] = currJson.data.topics ?? [];
          setSubjects(loadedSubjects);
          setTopics(loadedTopics);
          if (loadedTopics[0]) {
            setSelectedTopicId((prev) => prev || loadedTopics[0]!.id);
            setSelectedSubjectId((prev) => prev || loadedTopics[0]!.subjectId);
          } else {
            setTopicMode('custom');
          }
        }
      }

      if (!matRes.ok) {
        if (currRes.ok) {
          setApiError(
            await parseApiErrorResponse(matRes, 'Unable to load personal study materials library.'),
          );
        }
      } else {
        const matJson = await matRes.json();
        if (matJson.success) {
          const loadedMaterials: GeneratedMaterialItem[] = matJson.data.materials ?? [];
          setMaterials(loadedMaterials);
          if (loadedMaterials[0]) {
            setActiveMaterialId((prev) =>
              prev && loadedMaterials.some((m) => m.id === prev) ? prev : loadedMaterials[0]!.id,
            );
            setShowStudio(false);
          } else {
            setShowStudio(true);
          }
        }
      }
    } catch {
      setApiError({
        status: 503,
        message: 'Network error while loading Study Materials Studio. Please retry.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  function handleSelectSubject(subjectId: string) {
    setSelectedSubjectId(subjectId);
    const firstTopic = topics.find((t) => !subjectId || t.subjectId === subjectId);
    setSelectedTopicId(firstTopic?.id ?? '');
  }

  function getCatalogLabel(type: MaterialType): string {
    const entry = LEARNING_MATERIAL_CATALOG.find((c) => c.type === type);
    if (!entry) return type.replace(/_/g, ' ');
    return isBn ? entry.labelBn : entry.labelEn;
  }

  async function handleGenerate(regenerate = false) {
    if (generating) return;

    const useSyllabus = topicMode === 'syllabus' && Boolean(selectedTopicId);
    const trimmedCustom = customTopicTitle.trim();

    if (!useSyllabus && trimmedCustom.length < 2) {
      setApiError({
        status: 400,
        message:
          topicMode === 'syllabus'
            ? 'Please select a syllabus topic (or switch to Custom Topic) before generating.'
            : 'Please enter a custom topic title (at least 2 characters).',
      });
      return;
    }

    setGenerating(true);
    setApiError(null);
    setStatusMessage(null);

    try {
      const payload = {
        ...(useSyllabus
          ? {
              topicId: selectedTopicId,
              subjectId: activeTopicObj?.subjectId ?? (selectedSubjectId || undefined),
              chapterId: activeTopicObj?.chapterId,
            }
          : {
              customTopicTitle: trimmedCustom,
              subjectId: selectedSubjectId || undefined,
            }),
        materialType: selectedMaterialType,
        language: materialLanguage,
        explanationDepth: depth,
        customInstructions: customInstructions.trim() || undefined,
        saveToLibrary: true,
        regenerate,
      };

      const res = await fetch('/api/v1/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setApiError(
          await parseApiErrorResponse(res, 'Failed to generate study material.'),
        );
        return;
      }

      const json = await res.json();
      if (json.success) {
        const created: GeneratedMaterialItem = json.data.material;
        setMaterials((prev) => [created, ...prev.filter((m) => m.id !== created.id)]);
        setActiveMaterialId(created.id);
        setEditing(false);
        setShowStudio(false);
        setStatusMessage(
          json.data.reusedCache
            ? isBn
              ? 'যাচাইকৃত ক্যাশ থেকে অধ্যয়ন উপকরণ লোড করা হয়েছে।'
              : 'Loaded verified study material from your library cache.'
            : isBn
              ? 'নতুন অধ্যয়ন উপকরণ তৈরি ও লাইব্রেরিতে সংরক্ষণ করা হয়েছে।'
              : 'Generated and saved your new study material to your personal library.',
        );
      }
    } catch {
      setApiError({
        status: 503,
        message: 'Network interruption while generating study material. Please retry.',
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerateActive() {
    if (!activeMaterial || generating) return;
    setSelectedMaterialType(activeMaterial.materialType);
    setMaterialLanguage(activeMaterial.language);
    setDepth(activeMaterial.explanationDepth);
    if (activeMaterial.topicId) {
      setTopicMode('syllabus');
      setSelectedTopicId(activeMaterial.topicId);
    } else {
      setTopicMode('custom');
      setCustomTopicTitle(activeMaterial.title);
    }
    await handleGenerate(true);
  }

  async function handleSaveEdit() {
    if (!activeMaterial) return;
    setSavingEdit(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/v1/materials/${activeMaterial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: editTitle.trim(),
          contentMarkdown: editMarkdown,
        }),
      });
      if (!res.ok) {
        setApiError(await parseApiErrorResponse(res, 'Failed to save your note edits.'));
        return;
      }
      const json = await res.json();
      if (json.success) {
        setMaterials((prev) =>
          prev.map((m) => (m.id === activeMaterial.id ? json.data.material : m)),
        );
        setEditing(false);
        setStatusMessage(
          isBn ? 'আপনার ব্যক্তিগত নোট সংরক্ষিত হয়েছে।' : 'Saved your personal note edits.',
        );
      }
    } catch {
      setApiError({ status: 503, message: 'Network error while saving note edits.' });
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteMaterial(materialId: string) {
    const res = await fetch(`/api/v1/materials/${materialId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      const remaining = materials.filter((m) => m.id !== materialId);
      setMaterials(remaining);
      if (activeMaterialId === materialId) {
        setActiveMaterialId(remaining[0]?.id ?? null);
      }
      setStatusMessage(
        isBn ? 'উপকরণটি লাইব্রেরি থেকে মুছে ফেলা হয়েছে।' : 'Deleted study material from library.',
      );
    }
  }

  async function handleFlagMaterial(materialId: string) {
    const res = await fetch(`/api/v1/materials/${materialId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isFlagged: true }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        setMaterials((prev) =>
          prev.map((m) => (m.id === materialId ? json.data.material : m)),
        );
        setStatusMessage('Flagged material for content team review.');
      }
    }
  }

  async function handleCopyMarkdown(mat: GeneratedMaterialItem) {
    try {
      await navigator.clipboard.writeText(mat.contentMarkdown);
      setCopiedId(mat.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard API unavailable
    }
  }

  return (
    <div className="space-y-6">
      {/* Editorial Studio Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="accent">
              <Sparkles className="mr-1 size-3" />
              {isBn ? '১২ ধরনের এআই স্টাডি স্টুডিও' : '12-Format AI Study Materials Studio'}
            </Badge>
            <Badge variant="outline">
              {materials.length} {isBn ? 'টি নোট সংরক্ষিত' : 'Saved Notes'}
            </Badge>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {isBn ? 'এআই স্টাডি ম্যাটেরিয়ালস ও নোটস' : 'AI Study Materials & Personal Library'}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {isBn
              ? 'পাঠ্যক্রম বা কাস্টম টপিক থেকে নোট, সারাংশ, সূত্র তালিকা, সংজ্ঞা এবং পরীক্ষার গাইড তৈরি, সম্পাদনা ও সংরক্ষণ করুন।'
              : 'Generate structured explanations, chapter summaries, formula sheets, definitions, and exam prep guides.'}
          </p>
        </div>

        <Button
          onClick={() => setShowStudio((prev) => !prev)}
          variant={showStudio ? 'secondary' : 'default'}
          className="gap-2 rounded-xl"
        >
          {showStudio ? <X className="size-4" /> : <Plus className="size-4" />}
          <span>
            {showStudio
              ? isBn
                ? 'জেনারেটর লুকান'
                : 'Hide Generator Studio'
              : isBn
                ? 'নতুন স্টাডি ম্যাটেরিয়াল তৈরি করুন'
                : 'New Study Material'}
          </span>
        </Button>
      </div>

      {/* Professional Error & Status Alerts */}
      {apiError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="size-4 shrink-0" />
            <span>{apiError.message}</span>
          </div>
          <div className="flex items-center gap-2">
            {apiError.status === 401 ? (
              <Link href="/login">
                <Button size="sm">Sign In</Button>
              </Link>
            ) : (
              <Button size="sm" variant="outline" onClick={() => void loadWorkspace()}>
                <RefreshCw className="mr-1.5 size-3.5" />
                Retry
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {statusMessage ? (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-800 dark:text-emerald-300"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            {statusMessage}
          </span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="opacity-70 hover:opacity-100"
            aria-label="Dismiss status"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {/* Material Generator Studio Panel */}
      {showStudio ? (
        <Card className="overflow-hidden border-[var(--primary)]/30 shadow-sm">
          <CardHeader className="border-b border-[var(--border)] bg-[var(--background)]/60 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="size-5 text-[var(--primary)]" />
                  <span>
                    {isBn ? 'স্টাডি ম্যাটেরিয়াল জেনারেটর স্টুডিও' : 'Study Material Generator Studio'}
                  </span>
                </CardTitle>
                <CardDescription>
                  {isBn
                    ? 'টপিক বেছে নিন, ফরম্যাট নির্বাচন করুন এবং গভীরতা নির্ধারণ করুন।'
                    : 'Choose a syllabus or custom topic, select one of 12 structured formats, and generate publication-grade study notes.'}
                </CardDescription>
              </div>

              {/* Syllabus vs Custom Topic Toggle */}
              <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setTopicMode('syllabus')}
                  className={cn(
                    'rounded-lg px-3 py-1.5 font-medium transition-colors',
                    topicMode === 'syllabus'
                      ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                      : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
                  )}
                >
                  {isBn ? 'পাঠ্যক্রম টপিক' : 'Syllabus Topic'}
                </button>
                <button
                  type="button"
                  onClick={() => setTopicMode('custom')}
                  className={cn(
                    'rounded-lg px-3 py-1.5 font-medium transition-colors',
                    topicMode === 'custom'
                      ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                      : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
                  )}
                >
                  {isBn ? 'কাস্টম টপিক' : 'Custom Topic'}
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-5">
            {/* Step 1: Topic Selection */}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {isBn ? '১. টপিক নির্বাচন করুন' : '1. Select Target Topic'}
              </p>
              {topicMode === 'syllabus' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--muted-foreground)]">
                      {isBn ? 'বিষয় (Subject)' : 'Subject'}
                    </label>
                    <select
                      aria-label="Subject Filter"
                      value={selectedSubjectId}
                      onChange={(e) => handleSelectSubject(e.target.value)}
                      className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
                    >
                      <option value="">{isBn ? 'সব বিষয়' : 'All Subjects'}</option>
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.code} — {isBn && sub.nameBn ? sub.nameBn : sub.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--muted-foreground)]">
                      {isBn ? 'পাঠ্যক্রম টপিক' : 'Syllabus Topic'}
                    </label>
                    <select
                      aria-label="Target Syllabus Topic"
                      value={selectedTopicId}
                      onChange={(e) => setSelectedTopicId(e.target.value)}
                      className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
                    >
                      {filteredTopicsForSubject.length === 0 ? (
                        <option value="">
                          {loading ? 'Loading topics...' : 'No syllabus topics available — use Custom Topic'}
                        </option>
                      ) : (
                        filteredTopicsForSubject.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.code} — {isBn && t.titleBn ? t.titleBn : t.title}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--muted-foreground)]">
                    {isBn ? 'যেকোনো টপিকের নাম লিখুন' : 'Enter Any Study Topic or Chapter Title'}
                  </label>
                  <Input
                    value={customTopicTitle}
                    onChange={(e) => setCustomTopicTitle(e.target.value)}
                    placeholder={
                      isBn
                        ? 'যেমন: জৈব রসায়ন — অ্যালকিন ও অ্যালকাইনের বিক্রিয়া'
                        : 'e.g., Organic Chemistry — Electrophilic Addition Reactions of Alkenes'
                    }
                    className="h-10 rounded-xl"
                  />
                </div>
              )}
            </div>

            {/* Step 2: Visual 12-Format Material Picker Grid */}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {isBn
                  ? '২. স্টাডি ম্যাটেরিয়ালের ধরন নির্বাচন করুন (১২টি ফরম্যাট)'
                  : '2. Choose Material Format (12 Supported Formats)'}
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {LEARNING_MATERIAL_CATALOG.map((item) => {
                  const isSelected = selectedMaterialType === item.type;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setSelectedMaterialType(item.type)}
                      className={cn(
                        'flex flex-col items-start rounded-xl border p-3 text-left transition-all',
                        isSelected
                          ? 'border-[var(--primary)] bg-[var(--accent)]/50 ring-1 ring-[var(--primary)]'
                          : 'border-[var(--border)] bg-[var(--background)]/40 hover:border-[var(--primary)]/50 hover:bg-[var(--muted)]/40',
                      )}
                    >
                      <span
                        className={cn(
                          'text-xs font-semibold',
                          isSelected ? 'text-[var(--primary)]' : 'text-[var(--foreground)]',
                        )}
                      >
                        {isBn ? item.labelBn : item.labelEn}
                      </span>
                      <span className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--muted-foreground)]">
                        {item.descriptionEn}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Depth, Language & Focus Instructions */}
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="space-y-1.5 lg:col-span-4">
                <span className="text-xs font-medium text-[var(--muted-foreground)]">
                  {isBn ? 'ব্যাখ্যার গভীরতা' : 'Explanation Depth'}
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['beginner', 'intermediate', 'advanced'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setDepth(lvl)}
                      className={cn(
                        'rounded-xl border px-2.5 py-2 text-xs font-medium capitalize transition-colors',
                        depth === lvl
                          ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                          : 'border-[var(--border)] bg-[var(--background)] hover:bg-[var(--muted)]',
                      )}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 lg:col-span-3">
                <span className="text-xs font-medium text-[var(--muted-foreground)]">
                  {isBn ? 'ভাষা' : 'Output Language'}
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { code: 'en', label: 'English' },
                      { code: 'bn', label: 'বাংলা' },
                    ] as const
                  ).map((langOpt) => (
                    <button
                      key={langOpt.code}
                      type="button"
                      onClick={() => setMaterialLanguage(langOpt.code)}
                      className={cn(
                        'rounded-xl border px-2.5 py-2 text-xs font-medium transition-colors',
                        materialLanguage === langOpt.code
                          ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                          : 'border-[var(--border)] bg-[var(--background)] hover:bg-[var(--muted)]',
                      )}
                    >
                      {langOpt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 lg:col-span-5">
                <label className="text-xs font-medium text-[var(--muted-foreground)]">
                  {isBn ? 'কাস্টম ফোকাস নির্দেশনা (ঐচ্ছিক)' : 'Optional Focus Instructions'}
                </label>
                <Input
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder={
                    isBn
                      ? 'যেমন: সৃজনশীল (CQ) ও গাণিতিক উদাহরণ যোগ করো...'
                      : 'e.g., Emphasize HSC Board CQ derivations & numerical examples...'
                  }
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-[var(--border)] pt-4">
              <Button
                variant="outline"
                disabled={generating}
                onClick={() => void handleGenerate(true)}
                className="gap-1.5 rounded-xl"
              >
                <RefreshCw className={cn('size-4', generating && 'animate-spin')} />
                <span>{isBn ? 'নতুন করে তৈরি করুন' : 'Generate Fresh (Bypass Cache)'}</span>
              </Button>
              <Button
                disabled={generating}
                onClick={() => void handleGenerate(false)}
                className="gap-2 rounded-xl px-5"
              >
                <Sparkles className="size-4" />
                <span>
                  {generating
                    ? isBn
                      ? 'স্টাডি ম্যাটেরিয়াল তৈরি হচ্ছে...'
                      : 'Generating Study Material...'
                    : isBn
                      ? 'স্টাডি ম্যাটেরিয়াল তৈরি করুন'
                      : 'Generate Study Material'}
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Generating Loading Skeleton */}
      {generating ? (
        <Card className="border-[var(--primary)]/30">
          <CardContent className="space-y-3 py-8">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--primary)]">
              <Sparkles className="size-4 animate-spin" />
              <span>
                {isBn
                  ? 'এআই আপনার জন্য কাঠামোবদ্ধ নোট, সূত্র এবং অনুশীলন প্রশ্ন প্রস্তুত করছে...'
                  : 'Crafting structured notes, key takeaways, formulas, and practice questions...'}
              </span>
            </div>
            <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--muted)]" />
            <div className="h-4 w-full animate-pulse rounded bg-[var(--muted)]" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-[var(--muted)]" />
          </CardContent>
        </Card>
      ) : null}

      {/* Two-Column Personal Library & Editorial Reader */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Library Rail */}
        <Card className="flex flex-col lg:col-span-4">
          <CardHeader className="space-y-3 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookMarked className="size-4 text-[var(--primary)]" />
                <span>
                  {isBn ? `আমার লাইব্রেরি (${visibleMaterials.length})` : `Study Library (${visibleMaterials.length})`}
                </span>
              </CardTitle>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-[var(--muted-foreground)]" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isBn ? 'নোট খুঁজুন...' : 'Search library notes...'}
                  className="h-8 rounded-lg pl-8 text-xs"
                />
              </div>
              <select
                aria-label="Filter library by material type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 text-xs"
              >
                <option value="">{isBn ? 'সব ফরম্যাট' : 'All 12 Material Formats'}</option>
                {LEARNING_MATERIAL_CATALOG.map((c) => (
                  <option key={c.type} value={c.type}>
                    {isBn ? c.labelBn : c.labelEn}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>

          <CardContent className="max-h-[680px] flex-1 space-y-2 overflow-y-auto pt-1">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-16 animate-pulse rounded-xl bg-[var(--muted)]" />
                ))}
              </div>
            ) : visibleMaterials.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-xs text-[var(--muted-foreground)]">
                <FileText className="mx-auto mb-2 size-6 opacity-60" />
                <p className="font-medium text-[var(--foreground)]">
                  {isBn ? 'এখনো কোনো নোট সংরক্ষিত নেই' : 'Your personal study library is empty'}
                </p>
                <p className="mt-1 leading-relaxed">
                  {isBn
                    ? 'উপরের জেনারেটর স্টুডিও থেকে প্রথম স্টাডি ম্যাটেরিয়াল তৈরি করুন।'
                    : 'Use the Generator Studio above to craft your first structured study guide.'}
                </p>
                {!showStudio ? (
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => setShowStudio(true)}
                  >
                    <Plus className="mr-1 size-3.5" />
                    Generate First Material
                  </Button>
                ) : null}
              </div>
            ) : (
              visibleMaterials.map((mat) => {
                const isActive = mat.id === activeMaterial?.id;
                return (
                  <div
                    key={mat.id}
                    onClick={() => {
                      setActiveMaterialId(mat.id);
                      setEditing(false);
                    }}
                    className={cn(
                      'cursor-pointer rounded-xl border p-3.5 transition-all',
                      isActive
                        ? 'border-[var(--primary)] bg-[var(--accent)]/40 shadow-2xs'
                        : 'border-[var(--border)] bg-[var(--background)]/40 hover:border-[var(--primary)]/40',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant={isActive ? 'default' : 'secondary'}
                        className="text-[10px]"
                      >
                        {getCatalogLabel(mat.materialType)}
                      </Badge>
                      <span className="text-[10px] font-medium uppercase text-[var(--muted-foreground)]">
                        {mat.language} · {mat.explanationDepth}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold text-[var(--foreground)]">
                      {mat.title}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                      {new Date(mat.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Right Editorial Document Reader */}
        <Card className="lg:col-span-8">
          {activeMaterial ? (
            <>
              <CardHeader className="border-b border-[var(--border)] bg-[var(--background)]/40 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="default">{getCatalogLabel(activeMaterial.materialType)}</Badge>
                    <Badge variant="outline" className="uppercase">
                      {activeMaterial.language}
                    </Badge>
                    <Badge variant="secondary" className="capitalize">
                      {activeMaterial.explanationDepth}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {activeMaterial.modelId}
                    </Badge>
                  </div>

                  {/* Clean Document Action Toolbar */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => void handleCopyMarkdown(activeMaterial)}
                    >
                      {copiedId === activeMaterial.id ? (
                        <>
                          <Check className="size-3.5 text-emerald-500" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => window.print()}
                    >
                      <Printer className="size-3.5" />
                      <span className="hidden sm:inline">Print</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={generating}
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => void handleRegenerateActive()}
                    >
                      <RefreshCw className="size-3.5" />
                      <span className="hidden sm:inline">Regenerate</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => {
                        setEditTitle(activeMaterial.title);
                        setEditMarkdown(activeMaterial.contentMarkdown);
                        setEditing((prev) => !prev);
                      }}
                    >
                      <Edit3 className="size-3.5" />
                      <span>{editing ? 'Cancel' : 'Edit'}</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      title={activeMaterial.isFlagged ? 'Flagged' : 'Report inaccuracy'}
                      onClick={() => void handleFlagMaterial(activeMaterial.id)}
                    >
                      <Flag
                        className={cn(
                          'size-3.5',
                          activeMaterial.isFlagged
                            ? 'text-red-500'
                            : 'text-[var(--muted-foreground)]',
                        )}
                      />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-red-500 hover:bg-red-500/10"
                      title="Delete material"
                      onClick={() => void handleDeleteMaterial(activeMaterial.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <CardTitle className="mt-3 text-xl leading-snug sm:text-2xl">
                  {activeMaterial.title}
                </CardTitle>
                <CardDescription>
                  {isBn ? 'সংরক্ষিত:' : 'Saved'}{' '}
                  {new Date(activeMaterial.createdAt).toLocaleString()}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6 pt-6">
                {editing ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-[var(--muted-foreground)]">
                        Document Title
                      </label>
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-[var(--muted-foreground)]">
                        Markdown Content
                      </label>
                      <textarea
                        rows={16}
                        value={editMarkdown}
                        onChange={(e) => setEditMarkdown(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-3.5 font-mono text-xs leading-relaxed outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setEditing(false)}>
                        Cancel
                      </Button>
                      <Button disabled={savingEdit} onClick={() => void handleSaveEdit()}>
                        {savingEdit ? 'Saving...' : 'Save Personal Note'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Executive Summary Callout */}
                    {activeMaterial.structuredSections?.summary ? (
                      <div className="rounded-2xl border border-[var(--primary)]/25 bg-[var(--accent)]/35 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--primary)]">
                          {isBn ? 'সারাংশ (Executive Summary)' : 'Executive Summary'}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-[var(--foreground)]">
                          {activeMaterial.structuredSections.summary}
                        </p>
                      </div>
                    ) : null}

                    {/* Rich Rendered Markdown Document */}
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)]/40 p-5 sm:p-6">
                      <MarkdownRenderer content={activeMaterial.contentMarkdown} />
                    </div>

                    {/* Structured Key Takeaways Panel */}
                    {activeMaterial.structuredSections?.keyTakeaways &&
                    activeMaterial.structuredSections.keyTakeaways.length > 0 ? (
                      <div className="space-y-2.5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                          <Layers className="size-4 text-[var(--primary)]" />
                          <span>{isBn ? 'মূল সারমর্ম' : 'Key Takeaways'}</span>
                        </h3>
                        <ul className="space-y-2">
                          {activeMaterial.structuredSections.keyTakeaways.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 text-sm">
                              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {/* Formulas & Important Definitions Grid */}
                    {activeMaterial.structuredSections?.formulasOrDefinitions &&
                    activeMaterial.structuredSections.formulasOrDefinitions.length > 0 ? (
                      <div className="space-y-2.5">
                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                          <BookOpen className="size-4 text-[var(--primary)]" />
                          <span>
                            {isBn
                              ? 'গুরুত্বপূর্ণ সূত্র ও সংজ্ঞা'
                              : 'Formulas & Important Definitions'}
                          </span>
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {activeMaterial.structuredSections.formulasOrDefinitions.map(
                            (entry, idx) => (
                              <div
                                key={idx}
                                className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-3.5"
                              >
                                <p className="font-mono text-xs font-semibold text-[var(--primary)]">
                                  {entry.term}
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                                  {entry.detail}
                                </p>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    ) : null}

                    {/* Self-Check Practice Prompts */}
                    {activeMaterial.structuredSections?.practicePrompts &&
                    activeMaterial.structuredSections.practicePrompts.length > 0 ? (
                      <div className="space-y-2.5 rounded-2xl border border-[var(--border)] bg-[var(--background)]/40 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="flex items-center gap-2 text-sm font-semibold">
                            <HelpCircle className="size-4 text-[var(--primary)]" />
                            <span>
                              {isBn ? 'স্ব-মূল্যায়ন অনুশীলন প্রশ্ন' : 'Self-Check Practice Prompts'}
                            </span>
                          </h3>
                          <Link href="/tutor">
                            <Button size="sm" variant="outline" className="h-7 text-xs">
                              Practice with AI Tutor
                            </Button>
                          </Link>
                        </div>
                        <ol className="ml-5 list-decimal space-y-2 text-sm">
                          {activeMaterial.structuredSections.practicePrompts.map((q, idx) => (
                            <li key={idx} className="pl-1">
                              {q}
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                  </>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]">
                <BookOpen className="size-6" />
              </div>
              <h3 className="text-base font-semibold">
                {isBn ? 'একটি স্টাডি ম্যাটেরিয়াল নির্বাচন করুন' : 'No Study Material Selected'}
              </h3>
              <p className="mt-1 max-w-md text-xs text-[var(--muted-foreground)]">
                {isBn
                  ? 'বাম দিকের লাইব্রেরি থেকে যেকোনো নোট খুলুন অথবা জেনারেটর স্টুডিও থেকে নতুন নোট তৈরি করুন।'
                  : 'Select any note from your personal library on the left, or open the Generator Studio to create a new structured guide.'}
              </p>
              {!showStudio ? (
                <Button className="mt-4 gap-1.5" onClick={() => setShowStudio(true)}>
                  <Sparkles className="size-4" />
                  Open Generator Studio
                </Button>
              ) : null}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
