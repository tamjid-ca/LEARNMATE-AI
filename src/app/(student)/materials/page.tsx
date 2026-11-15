'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { LEARNING_MATERIAL_CATALOG } from '@/config/learning-materials-catalog';
import type {
  ExplanationDepth,
  MaterialType,
  SupportedLanguage,
} from '@/types/domain';

interface TopicOption {
  id: string;
  subjectId: string;
  chapterId: string;
  code: string;
  title: string;
  titleBn?: string;
}

interface GeneratedMaterialItem {
  id: string;
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

export default function StudentLearningMaterialsPage() {
  const { language: uiLanguage } = useUIPreferences();

  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [materials, setMaterials] = useState<GeneratedMaterialItem[]>([]);
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);

  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [selectedMaterialType, setSelectedMaterialType] =
    useState<MaterialType>('topic_explanation');
  const [materialLanguage, setMaterialLanguage] = useState<SupportedLanguage>('en');
  const [depth, setDepth] = useState<ExplanationDepth>('intermediate');
  const [customInstructions, setCustomInstructions] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  const [editing, setEditing] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editMarkdown, setEditMarkdown] = useState<string>('');

  const [generating, setGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('materialType', typeFilter);
      params.set('limit', '30');

      const [currRes, matRes] = await Promise.all([
        fetch('/api/v1/curriculum?limit=50', { credentials: 'include' }),
        fetch(`/api/v1/materials?${params.toString()}`, { credentials: 'include' }),
      ]);
      const currJson = await currRes.json();
      if (currRes.ok && currJson.success) {
        const loadedTopics: TopicOption[] = currJson.data.topics ?? [];
        setTopics(loadedTopics);
        if (loadedTopics[0]) {
          setSelectedTopicId((prev) => prev || loadedTopics[0]!.id);
        }
      }

      const matJson = await matRes.json();
      if (matRes.ok && matJson.success) {
        const loadedMaterials: GeneratedMaterialItem[] = matJson.data.materials ?? [];
        setMaterials(loadedMaterials);
        if (loadedMaterials[0]) {
          setActiveMaterialId((prev) =>
            prev && loadedMaterials.some((m) => m.id === prev) ? prev : loadedMaterials[0]!.id,
          );
        }
      }
    } catch {
      setErrorMessage('Failed to load study materials library');
    }
  }, [typeFilter]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const activeMaterial = materials.find((m) => m.id === activeMaterialId) ?? null;

  async function handleGenerate(regenerate = false) {
    if (!selectedTopicId || generating) return;
    setGenerating(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/v1/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          topicId: selectedTopicId,
          materialType: selectedMaterialType,
          language: materialLanguage,
          explanationDepth: depth,
          customInstructions: customInstructions.trim() || undefined,
          saveToLibrary: true,
          regenerate,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json?.error?.message ?? 'Failed to generate learning material');
        return;
      }

      const created: GeneratedMaterialItem = json.data.material;
      setMaterials((prev) => [created, ...prev.filter((m) => m.id !== created.id)]);
      setActiveMaterialId(created.id);
      setEditing(false);
      setStatusMessage(
        json.data.reusedCache
          ? 'Loaded material from verified library cache.'
          : 'Generated and saved new study material to your library.',
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveEdit() {
    if (!activeMaterial) return;
    setErrorMessage(null);
    const res = await fetch(`/api/v1/materials/${activeMaterial.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: editTitle.trim(),
        contentMarkdown: editMarkdown,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setErrorMessage(json?.error?.message ?? 'Failed to save note edits');
      return;
    }
    setMaterials((prev) =>
      prev.map((m) => (m.id === activeMaterial.id ? json.data.material : m)),
    );
    setEditing(false);
    setStatusMessage('Saved your personal note edits.');
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
      setStatusMessage('Deleted material from your personal library.');
    }
  }

  async function handleFlagMaterial(materialId: string) {
    const res = await fetch(`/api/v1/materials/${materialId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isFlagged: true }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMaterials((prev) =>
        prev.map((m) => (m.id === materialId ? json.data.material : m)),
      );
      setStatusMessage('Flagged material for administrative review.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="default" className="mb-2">
          {uiLanguage === 'bn'
            ? '১২ ধরনের এআই অধ্যয়ন উপকরণ ও ব্যক্তিগত লাইব্রেরি'
            : '12-Type AI Study Materials Generator & Library'}
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {uiLanguage === 'bn'
            ? 'এআই লার্নিং ম্যাটেরিয়ালস ও নোটস (Materials)'
            : 'AI Learning Materials & Personal Notes'}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {uiLanguage === 'bn'
            ? 'যেকোনো টপিক থেকে নোট, সারাংশ, সূত্র তালিকা, সংজ্ঞা এবং পরীক্ষার গাইডলাইন তৈরি ও সম্পাদনা করুন।'
            : 'Generate structured topic explanations, chapter summaries, formula sheets, definitions, and exam guidelines.'}
        </p>
      </div>

      {/* 12 Material Type Generator Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {uiLanguage === 'bn'
              ? 'নতুন অধ্যয়ন উপকরণ তৈরি করুন (FR-MAT-001..003)'
              : 'Configure & Generate Study Material'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-500">Topic</label>
              <select
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                className="h-9 w-full rounded-xl border border-zinc-300 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              >
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} — {uiLanguage === 'bn' && t.titleBn ? t.titleBn : t.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-500">
                Material Type (12 Supported Types)
              </label>
              <select
                value={selectedMaterialType}
                onChange={(e) => setSelectedMaterialType(e.target.value as MaterialType)}
                className="h-9 w-full rounded-xl border border-zinc-300 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              >
                {LEARNING_MATERIAL_CATALOG.map((item) => (
                  <option key={item.type} value={item.type}>
                    {uiLanguage === 'bn'
                      ? `${item.labelBn} (${item.labelEn})`
                      : item.labelEn}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-500">Language</label>
              <select
                value={materialLanguage}
                onChange={(e) => setMaterialLanguage(e.target.value as SupportedLanguage)}
                className="h-9 w-full rounded-xl border border-zinc-300 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="en">English</option>
                <option value="bn">বাংলা (Bangla)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-500">Explanation Depth</label>
              <select
                value={depth}
                onChange={(e) => setDepth(e.target.value as ExplanationDepth)}
                className="h-9 w-full rounded-xl border border-zinc-300 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder={
                uiLanguage === 'bn'
                  ? 'অতিরিক্ত নির্দেশনা (ঐচ্ছিক, যেমন: সৃজনশীল গ ও ঘ নম্বরের গাণিতিক উদাহরণ যোগ করো)...'
                  : 'Optional custom instructions (e.g., Emphasize HSC Board CQ & BUET admission numericals)...'
              }
              className="flex-1 text-xs"
            />
            <div className="flex gap-2">
              <Button disabled={generating} onClick={() => void handleGenerate(false)}>
                {generating ? 'Generating...' : 'Generate Material'}
              </Button>
              <Button
                variant="outline"
                disabled={generating}
                onClick={() => void handleGenerate(true)}
              >
                Regenerate Fresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {errorMessage}
        </div>
      ) : null}

      {statusMessage ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {statusMessage}
        </div>
      ) : null}

      {/* Personal Library Split View */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">
                {uiLanguage === 'bn'
                  ? `আমার লাইব্রেরি (${materials.length})`
                  : `Personal Library (${materials.length})`}
              </CardTitle>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-8 rounded-lg border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">All Types</option>
                {LEARNING_MATERIAL_CATALOG.map((c) => (
                  <option key={c.type} value={c.type}>
                    {c.labelEn}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {materials.length === 0 ? (
              <p className="py-8 text-center text-xs text-zinc-500">
                No saved study materials yet. Generate one above to populate your personal library.
              </p>
            ) : (
              materials.map((mat) => (
                <div
                  key={mat.id}
                  onClick={() => {
                    setActiveMaterialId(mat.id);
                    setEditing(false);
                  }}
                  className={`cursor-pointer rounded-xl border p-3 text-xs transition-colors ${
                    mat.id === activeMaterial?.id
                      ? 'border-indigo-600 bg-indigo-50/60 dark:border-indigo-400 dark:bg-indigo-950/30'
                      : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <Badge variant="outline">{mat.materialType}</Badge>
                    <span className="text-[11px] text-zinc-500">
                      {mat.language.toUpperCase()} · {mat.explanationDepth}
                    </span>
                  </div>
                  <p className="mt-1.5 font-semibold">{mat.title}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-8">
          {activeMaterial ? (
            <>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default">{activeMaterial.materialType}</Badge>
                    <Badge variant="outline">{activeMaterial.language.toUpperCase()}</Badge>
                    <Badge variant="secondary">{activeMaterial.explanationDepth}</Badge>
                    <Badge variant="outline">Model: {activeMaterial.modelId}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditTitle(activeMaterial.title);
                        setEditMarkdown(activeMaterial.contentMarkdown);
                        setEditing((prev) => !prev);
                      }}
                    >
                      {editing ? 'Cancel Edit' : 'Edit Note'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleFlagMaterial(activeMaterial.id)}
                    >
                      {activeMaterial.isFlagged ? 'Flagged' : 'Report'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => void handleDeleteMaterial(activeMaterial.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <CardTitle className="mt-2 text-xl">{activeMaterial.title}</CardTitle>
                <CardDescription>
                  Created {new Date(activeMaterial.createdAt).toLocaleString()}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {editing ? (
                  <div className="space-y-3">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Note Title"
                    />
                    <textarea
                      rows={12}
                      value={editMarkdown}
                      onChange={(e) => setEditMarkdown(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-white p-3 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    />
                    <Button onClick={() => void handleSaveEdit()}>Save Personal Note</Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="whitespace-pre-wrap rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 text-sm leading-relaxed dark:border-zinc-800 dark:bg-zinc-900/50">
                      {activeMaterial.contentMarkdown}
                    </div>
                  </div>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="py-16 text-center text-sm text-zinc-500">
              Select a study material from your personal library or generate a new one above.
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
