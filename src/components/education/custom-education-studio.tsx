'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  FolderKanban,
  GraduationCap,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Tags,
  Trash2,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { notify } from '@/lib/ui/toast';
import {
  buildHierarchyPreview,
  cloneDefaultLabels,
  EDUCATION_HIERARCHY_PRESETS,
  type EducationLabelDefinition,
  type EducationPresetKey,
  resolveEducationLabel,
  SUBJECT_COLOR_PRESETS,
  SUBJECT_ICON_PRESETS,
} from '@/config/education-presets';
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
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DifficultyLevel, EducationSystemType, SupportedLanguage } from '@/types/domain';

interface SystemItem {
  id: string;
  code: string;
  name: string;
  country: string;
  description?: string;
  scope?: 'global' | 'custom';
  educationType?: EducationSystemType;
  preferredLanguage?: SupportedLanguage;
  academicYear?: string;
  isArchived?: boolean;
}

interface ExamItem {
  id: string;
  educationSystemId: string;
  code: string;
  name: string;
  description?: string;
  examDate?: string | null;
  customLabelTag?: string;
  academicSession?: string;
  subjectIds?: string[];
  syllabusCoverage?: string;
  totalMarks?: number;
  durationMinutes?: number;
  preparationGoals?: string[];
  scope?: 'global' | 'custom';
  isArchived?: boolean;
}

interface SubjectItem {
  id: string;
  educationSystemId: string;
  examinationIds: string[];
  code: string;
  name: string;
  nameBn?: string;
  description?: string;
  color?: string;
  icon?: string;
  difficultyLevel?: DifficultyLevel;
  learningObjectives?: string[];
  scope?: 'global' | 'custom';
  isArchived?: boolean;
}

interface ChapterItem {
  id: string;
  subjectId: string;
  chapterNumber: number;
  title: string;
  description?: string;
  scope?: 'global' | 'custom';
}

interface TopicItem {
  id: string;
  subjectId: string;
  chapterId: string;
  title: string;
  difficulty: DifficultyLevel;
  estimatedMinutes: number;
  scope?: 'global' | 'custom';
}

interface WorkspacePayload {
  standardSystems: SystemItem[];
  customSystems: SystemItem[];
  archivedSystems: SystemItem[];
  activeSystemId?: string;
  activeExaminationId?: string;
  labels: EducationLabelDefinition[];
  presetName: string;
  hierarchyPreview: string;
  examinations: ExamItem[];
  archivedExaminations: ExamItem[];
  subjects: SubjectItem[];
  archivedSubjects: SubjectItem[];
  chapters: ChapterItem[];
  topics: TopicItem[];
}

export function CustomEducationStudio() {
  const { language } = useUIPreferences();
  const isBn = language === 'bn';

  const [workspace, setWorkspace] = React.useState<WorkspacePayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<{
    kind: 'system' | 'exam' | 'subject';
    id: string;
    label: string;
  } | null>(null);

  // System builder state
  const [editingSystemId, setEditingSystemId] = React.useState<string | null>(null);
  const [sysName, setSysName] = React.useState('');
  const [sysDescription, setSysDescription] = React.useState('');
  const [sysCountry, setSysCountry] = React.useState('GLOBAL');
  const [sysType, setSysType] = React.useState<EducationSystemType>('custom');
  const [sysLanguage, setSysLanguage] = React.useState<SupportedLanguage>('en');
  const [sysAcademicYear, setSysAcademicYear] = React.useState('2026-2027');
  const [sysPreset, setSysPreset] = React.useState<EducationPresetKey>('university');

  // Label editor state
  const [labelDrafts, setLabelDrafts] = React.useState<EducationLabelDefinition[]>(
    cloneDefaultLabels('default'),
  );
  const [labelPresetName, setLabelPresetName] = React.useState<string>('default');
  const [newLabelKey, setNewLabelKey] = React.useState('');
  const [newLabelSingular, setNewLabelSingular] = React.useState('');
  const [newLabelPlural, setNewLabelPlural] = React.useState('');

  // Exam builder state
  const [editingExamId, setEditingExamId] = React.useState<string | null>(null);
  const [examName, setExamName] = React.useState('');
  const [examSystemId, setExamSystemId] = React.useState('');
  const [examSession, setExamSession] = React.useState('2027');
  const [examDate, setExamDate] = React.useState('');
  const [examMarks, setExamMarks] = React.useState('');
  const [examDuration, setExamDuration] = React.useState('');
  const [examSyllabus, setExamSyllabus] = React.useState('');
  const [examGoalsText, setExamGoalsText] = React.useState('');
  const [examSubjectIds, setExamSubjectIds] = React.useState<string[]>([]);

  // Subject builder state
  const [editingSubjectId, setEditingSubjectId] = React.useState<string | null>(null);
  const [subjName, setSubjName] = React.useState('');
  const [subjSystemId, setSubjSystemId] = React.useState('');
  const [subjDescription, setSubjDescription] = React.useState('');
  const [subjColor, setSubjColor] = React.useState<string>(SUBJECT_COLOR_PRESETS[0]);
  const [subjIcon, setSubjIcon] = React.useState<string>(SUBJECT_ICON_PRESETS[0]);
  const [subjDifficulty, setSubjDifficulty] = React.useState<DifficultyLevel>('medium');
  const [subjObjectivesText, setSubjObjectivesText] = React.useState('');
  const [subjExamIds, setSubjExamIds] = React.useState<string[]>([]);

  // Quick Chapter / Topic builder for custom subjects
  const [activeChapterSubjectId, setActiveChapterSubjectId] = React.useState<string>('');
  const [newChapterTitle, setNewChapterTitle] = React.useState('');
  const [activeTopicChapterId, setActiveTopicChapterId] = React.useState<string>('');
  const [newTopicTitle, setNewTopicTitle] = React.useState('');
  const [newTopicMinutes, setNewTopicMinutes] = React.useState(45);

  const loadWorkspace = React.useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/v1/education/workspace', { credentials: 'include' });
      const json = (await res.json()) as {
        success?: boolean;
        data?: WorkspacePayload;
        error?: { message?: string };
      };
      if (!res.ok || !json.success || !json.data) {
        setErrorMessage(json.error?.message ?? 'Unable to load education studio');
        return;
      }
      const data = json.data;
      setWorkspace(data);
      setLabelDrafts(data.labels);
      setLabelPresetName(data.presetName || 'default');
      const fallbackSysId =
        data.activeSystemId || data.customSystems[0]?.id || data.standardSystems[0]?.id || '';
      setExamSystemId((prev) => prev || fallbackSysId);
      setSubjSystemId((prev) => prev || fallbackSysId);
    } catch {
      setErrorMessage('Network error loading education configuration.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const getLabel = React.useCallback(
    (key: string, form: 'singular' | 'plural' = 'singular', fallback?: string) =>
      resolveEducationLabel(workspace?.labels ?? labelDrafts, key, form, fallback),
    [workspace?.labels, labelDrafts],
  );

  const allSystems = React.useMemo(
    () => [...(workspace?.customSystems ?? []), ...(workspace?.standardSystems ?? [])],
    [workspace],
  );

  function notifySuccess(msg: string) {
    setErrorMessage(null);
    setStatusMessage(msg);
    notify.success(msg);
  }

  React.useEffect(() => {
    if (errorMessage) {
      notify.error(errorMessage);
    }
  }, [errorMessage]);

  function showStudioError(msg: string) {
    setErrorMessage(msg);
    notify.error(msg);
  }

  async function handleSetActiveSystem(educationSystemId: string) {
    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/v1/education/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ educationSystemId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        showStudioError(json.error?.message ?? 'Could not activate system');
        return;
      }
      notifySuccess('Active education system updated across your workspace.');
      await loadWorkspace();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSystem(e: React.FormEvent) {
    e.preventDefault();
    if (!sysName.trim()) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const endpoint = editingSystemId
        ? `/api/v1/education/systems/${editingSystemId}`
        : '/api/v1/education/systems';
      const method = editingSystemId ? 'PATCH' : 'POST';
      const bodyPayload = editingSystemId
        ? {
            name: sysName.trim(),
            description: sysDescription.trim() || undefined,
            country: sysCountry.trim() || 'GLOBAL',
            educationType: sysType,
            preferredLanguage: sysLanguage,
            academicYear: sysAcademicYear.trim() || undefined,
          }
        : {
            name: sysName.trim(),
            description: sysDescription.trim() || undefined,
            country: sysCountry.trim() || 'GLOBAL',
            educationType: sysType,
            preferredLanguage: sysLanguage,
            academicYear: sysAcademicYear.trim() || undefined,
            hierarchyPreset: sysPreset,
            setAsActive: true,
          };

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message ?? 'Failed to save custom education system');
        return;
      }
      setEditingSystemId(null);
      setSysName('');
      setSysDescription('');
      notifySuccess(editingSystemId ? 'Custom education system updated.' : 'Custom education system created & activated.');
      await loadWorkspace();
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveSystem(systemId: string, archive: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/education/systems/${systemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: archive }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message ?? 'Failed to update archive state');
        return;
      }
      notifySuccess(archive ? 'Custom education system archived.' : 'Custom education system restored.');
      await loadWorkspace();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSystem(systemId: string, forceCascade = false) {
    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/v1/education/systems/${systemId}${forceCascade ? '?forceCascade=true' : ''}`,
        { method: 'DELETE' },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message ?? 'Cannot delete system');
        return;
      }
      notifySuccess('Custom education system removed.');
      await loadWorkspace();
    } finally {
      setSaving(false);
    }
  }

  function moveLabelRow(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= labelDrafts.length) return;
    const copy = [...labelDrafts];
    const [removed] = copy.splice(index, 1);
    copy.splice(target, 0, removed!);
    setLabelDrafts(copy.map((item, idx) => ({ ...item, order: idx })));
  }

  function handleAddCustomLabelRow() {
    const key = newLabelKey.trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (!key || !newLabelSingular.trim() || !newLabelPlural.trim()) {
      setErrorMessage('Provide a key, singular name, and plural name for the custom label.');
      return;
    }
    if (labelDrafts.some((l) => l.key.toLowerCase() === key.toLowerCase())) {
      setErrorMessage(`Label key "${key}" already exists.`);
      return;
    }
    setLabelDrafts([
      ...labelDrafts,
      {
        key,
        defaultLabel: newLabelSingular.trim(),
        singular: newLabelSingular.trim(),
        plural: newLabelPlural.trim(),
        order: labelDrafts.length,
        required: false,
        allowMultiple: true,
        isVisible: true,
      },
    ]);
    setNewLabelKey('');
    setNewLabelSingular('');
    setNewLabelPlural('');
    setLabelPresetName('custom');
  }

  async function handleSaveLabels() {
    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/v1/education/labels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          educationSystemId: workspace?.activeSystemId,
          presetName: labelPresetName,
          labels: labelDrafts.map((item, idx) => ({ ...item, order: idx })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message ?? 'Unable to save custom education labels');
        return;
      }
      notifySuccess('Custom education labels saved cleanly without modifying existing curriculum data.');
      await loadWorkspace();
    } finally {
      setSaving(false);
    }
  }

  async function handleResetLabels() {
    setSaving(true);
    try {
      const qs = workspace?.activeSystemId
        ? `?educationSystemId=${encodeURIComponent(workspace.activeSystemId)}`
        : '';
      const res = await fetch(`/api/v1/education/labels${qs}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message ?? 'Could not reset labels');
        return;
      }
      notifySuccess('Education labels reset to default terminology.');
      await loadWorkspace();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveExamination(e: React.FormEvent) {
    e.preventDefault();
    if (!examName.trim() || !examSystemId) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const goals = examGoalsText
        .split(/\n|,/)
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        ...(editingExamId ? {} : { educationSystemId: examSystemId }),
        name: examName.trim(),
        academicSession: examSession.trim() || undefined,
        examDate: examDate.trim() || undefined,
        totalMarks: examMarks ? Number(examMarks) : undefined,
        durationMinutes: examDuration ? Number(examDuration) : undefined,
        syllabusCoverage: examSyllabus.trim() || undefined,
        preparationGoals: goals,
        subjectIds: examSubjectIds,
      };
      const url = editingExamId
        ? `/api/v1/education/examinations/${editingExamId}`
        : '/api/v1/education/examinations';
      const res = await fetch(url, {
        method: editingExamId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message ?? 'Failed to save custom examination');
        return;
      }
      setEditingExamId(null);
      setExamName('');
      setExamSyllabus('');
      setExamGoalsText('');
      setExamMarks('');
      setExamDuration('');
      setExamSubjectIds([]);
      notifySuccess(editingExamId ? 'Custom examination updated.' : 'Custom examination created.');
      await loadWorkspace();
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicateExam(examId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/education/examinations/${examId}`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message ?? 'Could not duplicate examination');
        return;
      }
      notifySuccess('Examination duplicated as editable custom definition.');
      await loadWorkspace();
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveExam(examId: string, archive: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/education/examinations/${examId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: archive }),
      });
      if (res.ok) {
        notifySuccess(archive ? 'Examination archived.' : 'Examination restored.');
        await loadWorkspace();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExam(examId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/education/examinations/${examId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message ?? 'Could not delete examination');
        return;
      }
      notifySuccess('Custom examination deleted.');
      await loadWorkspace();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!subjName.trim() || !subjSystemId) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const objectives = subjObjectivesText
        .split(/\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        ...(editingSubjectId ? {} : { educationSystemId: subjSystemId }),
        name: subjName.trim(),
        description: subjDescription.trim() || undefined,
        color: subjColor,
        icon: subjIcon,
        difficultyLevel: subjDifficulty,
        examinationIds: subjExamIds,
        learningObjectives: objectives,
      };
      const url = editingSubjectId
        ? `/api/v1/education/subjects/${editingSubjectId}`
        : '/api/v1/education/subjects';
      const res = await fetch(url, {
        method: editingSubjectId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message ?? 'Failed to save custom subject');
        return;
      }
      setEditingSubjectId(null);
      setSubjName('');
      setSubjDescription('');
      setSubjObjectivesText('');
      setSubjExamIds([]);
      notifySuccess(editingSubjectId ? 'Custom subject updated.' : 'Custom subject created.');
      await loadWorkspace();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSubject(subjectId: string, forceCascade = false) {
    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/v1/education/subjects/${subjectId}${forceCascade ? '?forceCascade=true' : ''}`,
        { method: 'DELETE' },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message ?? 'Could not delete subject');
        return;
      }
      notifySuccess('Custom subject removed.');
      await loadWorkspace();
    } finally {
      setSaving(false);
    }
  }

  async function handleAddChapter(subjectId: string) {
    if (!newChapterTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/education/chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId, title: newChapterTitle.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message ?? 'Failed to add chapter');
        return;
      }
      setNewChapterTitle('');
      notifySuccess(`${getLabel('chapter')} added.`);
      await loadWorkspace();
    } finally {
      setSaving(false);
    }
  }

  async function handleAddTopic(subjectId: string, chapterId: string) {
    if (!newTopicTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/education/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId,
          chapterId,
          title: newTopicTitle.trim(),
          estimatedMinutes: Number(newTopicMinutes) || 45,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message ?? 'Failed to add topic');
        return;
      }
      setNewTopicTitle('');
      notifySuccess(`${getLabel('topic')} added.`);
      await loadWorkspace();
    } finally {
      setSaving(false);
    }
  }

  if (loading && !workspace) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-[var(--muted-foreground)]">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading custom education architecture...
      </div>
    );
  }

  const labelPreview = buildHierarchyPreview(labelDrafts);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge variant="accent">
            <Sparkles className="mr-1.5 size-3.5" />
            {isBn ? 'কাস্টম শিক্ষা ব্যবস্থা ও লেবেল স্টুডিও' : 'Custom Education & Label Studio'}
          </Badge>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {isBn ? 'আপনার শিক্ষা কাঠামো কাস্টমাইজ করুন' : 'Academic Structure & Custom Curriculum'}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {workspace?.hierarchyPreview || labelPreview}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/my-learning">
            <Button variant="outline" size="sm">
              <BookOpen className="size-4" />
              <span>Open My Learning</span>
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="ghost" size="sm">
              Back to Settings
            </Button>
          </Link>
        </div>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
        >
          {errorMessage}
        </div>
      ) : null}

      {statusMessage ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300"
        >
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      ) : null}

      <Tabs defaultValue="systems" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="systems">
            <GraduationCap className="mr-1.5 size-4" />
            {getLabel('educationSystem', 'plural')}
          </TabsTrigger>
          <TabsTrigger value="labels">
            <Tags className="mr-1.5 size-4" />
            Labels & Hierarchy
          </TabsTrigger>
          <TabsTrigger value="examinations">
            <FolderKanban className="mr-1.5 size-4" />
            {getLabel('examination', 'plural')}
          </TabsTrigger>
          <TabsTrigger value="subjects">
            <Layers className="mr-1.5 size-4" />
            {getLabel('subject', 'plural')} & {getLabel('chapter', 'plural')}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: STANDARD VS CUSTOM EDUCATION SYSTEMS */}
        <TabsContent value="systems" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-7">
              <CardHeader>
                <CardTitle className="text-base">
                  Option A: Official Standard {getLabel('educationSystem', 'plural')}
                </CardTitle>
                <CardDescription>
                  Verified administrator-managed syllabi (BD-NCTB SSC/HSC, University Admission, BCS, Cambridge).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {(workspace?.standardSystems ?? []).map((sys) => {
                  const isActive = workspace?.activeSystemId === sys.id;
                  return (
                    <div
                      key={sys.id}
                      className={`flex flex-col justify-between gap-2 rounded-xl border p-3.5 sm:flex-row sm:items-center ${
                        isActive ? 'border-[var(--primary)] bg-[var(--accent)]/30' : ''
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{sys.name}</span>
                          <Badge variant="outline">{sys.code}</Badge>
                          <Badge variant="secondary">Standard</Badge>
                        </div>
                        {sys.description ? (
                          <p className="mt-1 text-xs text-[var(--muted-foreground)]">{sys.description}</p>
                        ) : null}
                      </div>
                      <Button
                        size="sm"
                        variant={isActive ? 'default' : 'outline'}
                        disabled={saving || isActive}
                        onClick={() => void handleSetActiveSystem(sys.id)}
                      >
                        {isActive ? 'Active Track' : 'Select Standard'}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>

              <Separator className="my-2" />

              <CardHeader>
                <CardTitle className="text-base">
                  Option B: Your Custom {getLabel('educationSystem', 'plural')}
                </CardTitle>
                <CardDescription>
                  Personal learning tracks, private coaching curricula, university semesters, or certification goals.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {(workspace?.customSystems ?? []).length === 0 ? (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    No custom education system created yet. Create one using the panel on the right.
                  </p>
                ) : (
                  workspace?.customSystems.map((sys) => {
                    const isActive = workspace?.activeSystemId === sys.id;
                    return (
                      <div
                        key={sys.id}
                        className={`flex flex-col justify-between gap-3 rounded-xl border p-3.5 ${
                          isActive ? 'border-[var(--primary)] bg-[var(--accent)]/30' : ''
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-sm">{sys.name}</span>
                              <Badge variant="accent">Custom</Badge>
                              {sys.academicYear ? (
                                <Badge variant="outline">{sys.academicYear}</Badge>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                              {sys.description || `Type: ${sys.educationType ?? 'custom'} · ${sys.country}`}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              size="sm"
                              variant={isActive ? 'default' : 'outline'}
                              disabled={saving || isActive}
                              onClick={() => void handleSetActiveSystem(sys.id)}
                            >
                              {isActive ? 'Active' : 'Activate'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingSystemId(sys.id);
                                setSysName(sys.name);
                                setSysDescription(sys.description ?? '');
                                setSysCountry(sys.country);
                                setSysType(sys.educationType ?? 'custom');
                                setSysLanguage(sys.preferredLanguage ?? 'en');
                                setSysAcademicYear(sys.academicYear ?? '');
                              }}
                            >
                              <Edit3 className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={saving}
                              onClick={() => void handleArchiveSystem(sys.id, true)}
                            >
                              <Archive className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={saving}
                              onClick={() =>
                                setPendingDelete({ kind: 'system', id: sys.id, label: sys.name })
                              }
                            >
                              <Trash2 className="size-3.5 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {(workspace?.archivedSystems ?? []).length > 0 ? (
                  <div className="pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase text-[var(--muted-foreground)]">
                      Archived Custom Systems
                    </p>
                    <div className="space-y-2">
                      {workspace?.archivedSystems.map((sys) => (
                        <div
                          key={sys.id}
                          className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2 text-xs"
                        >
                          <span>{sys.name}</span>
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleArchiveSystem(sys.id, false)}
                            >
                              <ArchiveRestore className="mr-1 size-3.5" />
                              Restore
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                setPendingDelete({ kind: 'system', id: sys.id, label: sys.name })
                              }
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="lg:col-span-5">
              <form onSubmit={handleSaveSystem}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {editingSystemId ? 'Edit Custom Education System' : 'Create Custom Education System'}
                  </CardTitle>
                  <CardDescription>
                    Design your own academic pathway with custom hierarchy tiers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3.5">
                  <div className="space-y-1">
                    <label htmlFor="sys-name" className="text-xs font-medium">
                      System Name
                    </label>
                    <Input
                      id="sys-name"
                      required
                      value={sysName}
                      onChange={(e) => setSysName(e.target.value)}
                      placeholder="e.g., B.Sc. in Computer Science (Semester Track)"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="sys-desc" className="text-xs font-medium">
                      Description
                    </label>
                    <Input
                      id="sys-desc"
                      value={sysDescription}
                      onChange={(e) => setSysDescription(e.target.value)}
                      placeholder="Optional goals or institution details"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="sys-type" className="text-xs font-medium">
                        Education Type
                      </label>
                      <select
                        id="sys-type"
                        value={sysType}
                        onChange={(e) => setSysType(e.target.value as EducationSystemType)}
                        className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 text-xs"
                      >
                        <option value="custom">Personal Custom</option>
                        <option value="university">University Semester</option>
                        <option value="school">School / Board</option>
                        <option value="competitive">Coaching / Competitive</option>
                        <option value="certification">Certification</option>
                        <option value="self_learning">Self-Learning Path</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="sys-year" className="text-xs font-medium">
                        Academic Year
                      </label>
                      <Input
                        id="sys-year"
                        value={sysAcademicYear}
                        onChange={(e) => setSysAcademicYear(e.target.value)}
                        placeholder="2026-2027"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="sys-country" className="text-xs font-medium">
                        Country / Region
                      </label>
                      <Input
                        id="sys-country"
                        value={sysCountry}
                        onChange={(e) => setSysCountry(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="sys-lang" className="text-xs font-medium">
                        Preferred Language
                      </label>
                      <select
                        id="sys-lang"
                        value={sysLanguage}
                        onChange={(e) => setSysLanguage(e.target.value as SupportedLanguage)}
                        className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 text-xs"
                      >
                        <option value="en">English</option>
                        <option value="bn">বাংলা (Bangla)</option>
                      </select>
                    </div>
                  </div>
                  {!editingSystemId ? (
                    <div className="space-y-1">
                      <label htmlFor="sys-preset" className="text-xs font-medium">
                        Hierarchy Preset
                      </label>
                      <select
                        id="sys-preset"
                        value={sysPreset}
                        onChange={(e) => setSysPreset(e.target.value as EducationPresetKey)}
                        className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 text-xs"
                      >
                        {(Object.keys(EDUCATION_HIERARCHY_PRESETS) as EducationPresetKey[]).map((key) => (
                          <option key={key} value={key}>
                            {EDUCATION_HIERARCHY_PRESETS[key].labelEn}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </CardContent>
                <CardFooter className="flex justify-between gap-2 border-t pt-4">
                  {editingSystemId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingSystemId(null);
                        setSysName('');
                        setSysDescription('');
                      }}
                    >
                      Cancel Edit
                    </Button>
                  ) : (
                    <span />
                  )}
                  <Button type="submit" disabled={saving}>
                    <Plus className="mr-1.5 size-4" />
                    {editingSystemId ? 'Update System' : 'Create Custom System'}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: CUSTOM EDUCATION LABELS & FLEXIBLE HIERARCHY */}
        <TabsContent value="labels" className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <CardTitle className="text-base">Custom Education Labels & Terminology</CardTitle>
                  <CardDescription>
                    Customize interface terminology (e.g., rename Subject → Course, Chapter → Unit). Underlying data stays intact.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(EDUCATION_HIERARCHY_PRESETS) as EducationPresetKey[]).map((key) => (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant={labelPresetName === key ? 'default' : 'outline'}
                      onClick={() => {
                        setLabelPresetName(key);
                        setLabelDrafts(cloneDefaultLabels(key));
                      }}
                    >
                      {EDUCATION_HIERARCHY_PRESETS[key].labelEn.split(' ')[0]}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-dashed bg-[var(--secondary)]/40 p-3 text-xs">
                <span className="font-semibold">Live Structure Preview: </span>
                <span className="text-[var(--primary)] font-medium">{labelPreview}</span>
              </div>

              <div className="space-y-2">
                {labelDrafts.map((row, idx) => (
                  <div
                    key={row.key}
                    className="grid items-center gap-2 rounded-xl border p-3 sm:grid-cols-12"
                  >
                    <div className="sm:col-span-2">
                      <Badge variant="outline">{row.key}</Badge>
                    </div>
                    <div className="sm:col-span-3">
                      <Input
                        value={row.singular}
                        aria-label={`${row.key} singular label`}
                        onChange={(e) => {
                          const next = [...labelDrafts];
                          next[idx] = { ...row, singular: e.target.value };
                          setLabelDrafts(next);
                        }}
                        placeholder="Singular"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Input
                        value={row.plural}
                        aria-label={`${row.key} plural label`}
                        onChange={(e) => {
                          const next = [...labelDrafts];
                          next[idx] = { ...row, plural: e.target.value };
                          setLabelDrafts(next);
                        }}
                        placeholder="Plural"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 sm:col-span-4 sm:justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant={row.required ? 'default' : 'outline'}
                        onClick={() => {
                          const next = [...labelDrafts];
                          next[idx] = { ...row, required: !row.required };
                          setLabelDrafts(next);
                        }}
                      >
                        {row.required ? 'Required' : 'Optional'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={row.allowMultiple ? 'secondary' : 'outline'}
                        onClick={() => {
                          const next = [...labelDrafts];
                          next[idx] = { ...row, allowMultiple: !row.allowMultiple };
                          setLabelDrafts(next);
                        }}
                      >
                        {row.allowMultiple ? 'Multi' : 'Single'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const next = [...labelDrafts];
                          next[idx] = { ...row, isVisible: !row.isVisible };
                          setLabelDrafts(next);
                        }}
                        title={row.isVisible ? 'Visible in hierarchy' : 'Hidden in hierarchy'}
                      >
                        {row.isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={idx === 0}
                        onClick={() => moveLabelRow(idx, -1)}
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={idx === labelDrafts.length - 1}
                        onClick={() => moveLabelRow(idx, 1)}
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-2 rounded-xl border border-dashed p-3 sm:grid-cols-12">
                <Input
                  className="sm:col-span-3"
                  placeholder="Custom key (e.g. program)"
                  value={newLabelKey}
                  onChange={(e) => setNewLabelKey(e.target.value)}
                />
                <Input
                  className="sm:col-span-3"
                  placeholder="Singular (e.g. Program)"
                  value={newLabelSingular}
                  onChange={(e) => setNewLabelSingular(e.target.value)}
                />
                <Input
                  className="sm:col-span-4"
                  placeholder="Plural (e.g. Programs)"
                  value={newLabelPlural}
                  onChange={(e) => setNewLabelPlural(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="sm:col-span-2"
                  onClick={handleAddCustomLabelRow}
                >
                  Add Label
                </Button>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between gap-2 border-t pt-4">
              <Button type="button" variant="outline" disabled={saving} onClick={() => void handleResetLabels()}>
                <RotateCcw className="mr-1.5 size-4" />
                Reset Defaults
              </Button>
              <Button type="button" disabled={saving} onClick={() => void handleSaveLabels()}>
                <Save className="mr-1.5 size-4" />
                Save Labels & Structure
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* TAB 3: CUSTOM EXAMINATIONS */}
        <TabsContent value="examinations" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-7">
              <CardHeader>
                <CardTitle className="text-base">
                  Active {getLabel('examination', 'plural')}
                </CardTitle>
                <CardDescription>
                  Custom and official {getLabel('examination', 'plural').toLowerCase()} available in AI Tutor, Quizzes, Planner, and Analytics.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(workspace?.examinations ?? []).map((ex) => {
                  const isCustom = ex.scope === 'custom';
                  return (
                    <div key={ex.id} className="rounded-xl border p-3.5 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-sm">{ex.name}</span>
                            <Badge variant={isCustom ? 'accent' : 'secondary'}>
                              {isCustom ? 'Custom' : 'Standard'}
                            </Badge>
                            {ex.academicSession ? <Badge variant="outline">{ex.academicSession}</Badge> : null}
                            {ex.totalMarks ? <Badge variant="outline">{ex.totalMarks} marks</Badge> : null}
                          </div>
                          {ex.syllabusCoverage ? (
                            <p className="mt-1 text-xs text-[var(--muted-foreground)]">{ex.syllabusCoverage}</p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saving}
                            onClick={() => void handleDuplicateExam(ex.id)}
                            title="Duplicate to customize"
                          >
                            <Copy className="size-3.5" />
                          </Button>
                          {isCustom ? (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingExamId(ex.id);
                                  setExamName(ex.name);
                                  setExamSystemId(ex.educationSystemId);
                                  setExamSession(ex.academicSession ?? '');
                                  setExamDate(ex.examDate ? String(ex.examDate).slice(0, 10) : '');
                                  setExamMarks(ex.totalMarks ? String(ex.totalMarks) : '');
                                  setExamDuration(ex.durationMinutes ? String(ex.durationMinutes) : '');
                                  setExamSyllabus(ex.syllabusCoverage ?? '');
                                  setExamGoalsText((ex.preparationGoals ?? []).join('\n'));
                                  setExamSubjectIds(ex.subjectIds ?? []);
                                }}
                              >
                                <Edit3 className="size-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void handleArchiveExam(ex.id, true)}
                              >
                                <Archive className="size-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setPendingDelete({ kind: 'exam', id: ex.id, label: ex.name })
                                }
                              >
                                <Trash2 className="size-3.5 text-red-500" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {(workspace?.archivedExaminations ?? []).length > 0 ? (
                  <div className="pt-2 space-y-1.5">
                    <p className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">Archived</p>
                    {workspace?.archivedExaminations.map((ex) => (
                      <div key={ex.id} className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2 text-xs">
                        <span>{ex.name}</span>
                        <Button size="sm" variant="outline" onClick={() => void handleArchiveExam(ex.id, false)}>
                          Restore
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="lg:col-span-5">
              <form onSubmit={handleSaveExamination}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {editingExamId
                      ? `Edit ${getLabel('examination')}`
                      : `Create Custom ${getLabel('examination')}`}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    required
                    placeholder={`Name (e.g., Engineering Admission 2027)`}
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                  />
                  {!editingExamId ? (
                    <select
                      value={examSystemId}
                      onChange={(e) => setExamSystemId(e.target.value)}
                      className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 text-xs"
                    >
                      {allSystems.map((sys) => (
                        <option key={sys.id} value={sys.id}>
                          {sys.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Academic session (e.g., 2027)"
                      value={examSession}
                      onChange={(e) => setExamSession(e.target.value)}
                    />
                    <Input
                      type="date"
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      placeholder="Total marks (optional)"
                      value={examMarks}
                      onChange={(e) => setExamMarks(e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Duration mins (optional)"
                      value={examDuration}
                      onChange={(e) => setExamDuration(e.target.value)}
                    />
                  </div>
                  <Input
                    placeholder="Syllabus coverage summary..."
                    value={examSyllabus}
                    onChange={(e) => setExamSyllabus(e.target.value)}
                  />
                  <Input
                    placeholder="Preparation goals (comma separated)"
                    value={examGoalsText}
                    onChange={(e) => setExamGoalsText(e.target.value)}
                  />
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium">
                      Included {getLabel('subject', 'plural')}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(workspace?.subjects ?? []).map((subj) => {
                        const checked = examSubjectIds.includes(subj.id);
                        return (
                          <Button
                            key={subj.id}
                            type="button"
                            size="sm"
                            variant={checked ? 'default' : 'outline'}
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                              setExamSubjectIds((prev) =>
                                prev.includes(subj.id)
                                  ? prev.filter((id) => id !== subj.id)
                                  : [...prev, subj.id],
                              )
                            }
                          >
                            {subj.name}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between gap-2 border-t pt-4">
                  {editingExamId ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditingExamId(null)}>
                      Cancel
                    </Button>
                  ) : (
                    <span />
                  )}
                  <Button type="submit" disabled={saving}>
                    {editingExamId ? `Save ${getLabel('examination')}` : `Create ${getLabel('examination')}`}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 4: CUSTOM SUBJECTS, CHAPTERS & TOPICS */}
        <TabsContent value="subjects" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-7">
              <CardHeader>
                <CardTitle className="text-base">
                  Your Custom {getLabel('subject', 'plural')}
                </CardTitle>
                <CardDescription>
                  Build {getLabel('chapter', 'plural').toLowerCase()} and {getLabel('topic', 'plural').toLowerCase()} inside personal {getLabel('subject', 'plural').toLowerCase()} for use across Tutor, Quizzes, Flashcards & Planner.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(workspace?.subjects ?? [])
                  .filter((s) => s.scope === 'custom')
                  .map((subj) => {
                    const subjChapters = (workspace?.chapters ?? []).filter((c) => c.subjectId === subj.id);
                    const isExpanded = activeChapterSubjectId === subj.id;
                    return (
                      <div key={subj.id} className="rounded-xl border p-3.5 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <span
                              className="mt-1 inline-block size-3.5 rounded-full shrink-0"
                              style={{ backgroundColor: subj.color || '#2563eb' }}
                            />
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-sm">{subj.name}</span>
                                <Badge variant="accent">Custom</Badge>
                                <Badge variant="outline">{subj.difficultyLevel ?? 'medium'}</Badge>
                              </div>
                              {subj.description ? (
                                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                                  {subj.description}
                                </p>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setActiveChapterSubjectId(isExpanded ? '' : subj.id)
                              }
                            >
                              {subjChapters.length} {getLabel('chapter', 'plural')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingSubjectId(subj.id);
                                setSubjName(subj.name);
                                setSubjSystemId(subj.educationSystemId);
                                setSubjDescription(subj.description ?? '');
                                setSubjColor(subj.color ?? SUBJECT_COLOR_PRESETS[0]);
                                setSubjIcon(subj.icon ?? SUBJECT_ICON_PRESETS[0]);
                                setSubjDifficulty(subj.difficultyLevel ?? 'medium');
                                setSubjObjectivesText((subj.learningObjectives ?? []).join('\n'));
                                setSubjExamIds(subj.examinationIds ?? []);
                              }}
                            >
                              <Edit3 className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={saving}
                              onClick={() =>
                                setPendingDelete({ kind: 'subject', id: subj.id, label: subj.name })
                              }
                            >
                              <Trash2 className="size-3.5 text-red-500" />
                            </Button>
                          </div>
                        </div>

                        {isExpanded ? (
                          <div className="space-y-3 border-t pt-3">
                            {subjChapters.map((chap) => {
                              const chapTopics = (workspace?.topics ?? []).filter(
                                (t) => t.chapterId === chap.id,
                              );
                              return (
                                <div key={chap.id} className="rounded-lg bg-[var(--secondary)]/40 p-2.5 space-y-2">
                                  <div className="flex items-center justify-between text-xs font-semibold">
                                    <span>
                                      {getLabel('chapter')} {chap.chapterNumber}: {chap.title}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2 text-xs"
                                      onClick={() =>
                                        setActiveTopicChapterId(
                                          activeTopicChapterId === chap.id ? '' : chap.id,
                                        )
                                      }
                                    >
                                      + {getLabel('topic')} ({chapTopics.length})
                                    </Button>
                                  </div>
                                  {chapTopics.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {chapTopics.map((t) => (
                                        <Link key={t.id} href={`/tutor?topicId=${t.id}`}>
                                          <Badge variant="outline" className="cursor-pointer">
                                            {t.title} ({t.estimatedMinutes}m)
                                          </Badge>
                                        </Link>
                                      ))}
                                    </div>
                                  ) : null}
                                  {activeTopicChapterId === chap.id ? (
                                    <div className="flex gap-2 pt-1">
                                      <Input
                                        className="h-8 text-xs"
                                        placeholder={`New ${getLabel('topic').toLowerCase()} title`}
                                        value={newTopicTitle}
                                        onChange={(e) => setNewTopicTitle(e.target.value)}
                                      />
                                      <Input
                                        type="number"
                                        className="h-8 w-20 text-xs"
                                        value={newTopicMinutes}
                                        onChange={(e) => setNewTopicMinutes(Number(e.target.value))}
                                      />
                                      <Button
                                        size="sm"
                                        className="h-8"
                                        disabled={saving}
                                        onClick={() => void handleAddTopic(subj.id, chap.id)}
                                      >
                                        Add
                                      </Button>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}

                            <div className="flex gap-2">
                              <Input
                                className="h-8 text-xs"
                                placeholder={`Add new ${getLabel('chapter').toLowerCase()}...`}
                                value={newChapterTitle}
                                onChange={(e) => setNewChapterTitle(e.target.value)}
                              />
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-8"
                                disabled={saving}
                                onClick={() => void handleAddChapter(subj.id)}
                              >
                                Add {getLabel('chapter')}
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}

                {(workspace?.subjects ?? []).filter((s) => s.scope === 'custom').length === 0 ? (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    No custom {getLabel('subject', 'plural').toLowerCase()} created yet. Use the form to create your first custom {getLabel('subject').toLowerCase()}.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="lg:col-span-5">
              <form onSubmit={handleSaveSubject}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {editingSubjectId
                      ? `Edit Custom ${getLabel('subject')}`
                      : `Create Custom ${getLabel('subject')}`}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    required
                    placeholder={`${getLabel('subject')} name (e.g., Operating Systems)`}
                    value={subjName}
                    onChange={(e) => setSubjName(e.target.value)}
                  />
                  {!editingSubjectId ? (
                    <select
                      value={subjSystemId}
                      onChange={(e) => setSubjSystemId(e.target.value)}
                      className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 text-xs"
                    >
                      {allSystems.map((sys) => (
                        <option key={sys.id} value={sys.id}>
                          {sys.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <Input
                    placeholder="Short description..."
                    value={subjDescription}
                    onChange={(e) => setSubjDescription(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-xs font-medium">Difficulty</span>
                      <select
                        value={subjDifficulty}
                        onChange={(e) => setSubjDifficulty(e.target.value as DifficultyLevel)}
                        className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 text-xs"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-medium">Icon</span>
                      <select
                        value={subjIcon}
                        onChange={(e) => setSubjIcon(e.target.value)}
                        className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 text-xs"
                      >
                        {SUBJECT_ICON_PRESETS.map((ic) => (
                          <option key={ic} value={ic}>
                            {ic}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium">Color Tag</span>
                    <div className="flex flex-wrap gap-2">
                      {SUBJECT_COLOR_PRESETS.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => setSubjColor(hex)}
                          className={`size-6 rounded-full border-2 ${
                            subjColor === hex ? 'border-foreground scale-110' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: hex }}
                          aria-label={`Color ${hex}`}
                        />
                      ))}
                    </div>
                  </div>
                  <Input
                    placeholder="Learning objective (optional)"
                    value={subjObjectivesText}
                    onChange={(e) => setSubjObjectivesText(e.target.value)}
                  />
                </CardContent>
                <CardFooter className="flex justify-between gap-2 border-t pt-4">
                  {editingSubjectId ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditingSubjectId(null)}>
                      Cancel
                    </Button>
                  ) : (
                    <span />
                  )}
                  <Button type="submit" disabled={saving}>
                    {editingSubjectId ? `Update ${getLabel('subject')}` : `Create ${getLabel('subject')}`}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        destructive
        busy={saving}
        title={
          pendingDelete
            ? isBn
              ? `"${pendingDelete.label}" মুছে ফেলবেন?`
              : `Delete "${pendingDelete.label}"?`
            : 'Confirm Deletion'
        }
        description={
          pendingDelete?.kind === 'system'
            ? 'This custom education system and its nested levels, exams, subjects, chapters, and topics will be permanently deleted.'
            : pendingDelete?.kind === 'exam'
              ? 'This custom examination definition will be permanently deleted from your workspace.'
              : 'This custom subject and any custom chapters or topics inside it will be permanently deleted.'
        }
        confirmLabel={isBn ? 'স্থায়ীভাবে মুছুন' : 'Delete Permanently'}
        cancelLabel={isBn ? 'বাতিল করুন' : 'Cancel'}
        onConfirm={async () => {
          if (!pendingDelete) return;
          const target = pendingDelete;
          setPendingDelete(null);
          if (target.kind === 'system') {
            await handleDeleteSystem(target.id, true);
          } else if (target.kind === 'exam') {
            await handleDeleteExam(target.id);
          } else {
            await handleDeleteSubject(target.id, true);
          }
        }}
      />
    </div>
  );
}
