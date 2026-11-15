'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  ListTodo,
  MapPin,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
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
import { Input } from '@/components/ui/input';
import type {
  ExplanationDepth,
  StudyPlanStatus,
  StudyTaskStatus,
  StudyTaskType,
} from '@/types/domain';

interface SubjectOption {
  id: string;
  code: string;
  name: string;
  nameBn?: string;
}

interface ExaminationOption {
  id: string;
  code: string;
  name: string;
  examDate?: string | null;
}

interface WeeklyMilestoneItem {
  weekNumber: number;
  startDateKey: string;
  endDateKey: string;
  title: string;
  focusSubjectNames: string[];
  plannedMinutes: number;
  taskCount: number;
}

interface StudyPlanItem {
  id: string;
  title: string;
  targetExaminationId?: string;
  targetDate: string;
  startDate: string;
  subjectIds: string[];
  dailyStudyMinutes: number;
  availableDaysOfWeek: number[];
  proficiencyBySubject: Record<string, ExplanationDepth>;
  weeklyMilestones: WeeklyMilestoneItem[];
  aiSummary?: string;
  status: StudyPlanStatus;
  completionPercent: number;
}

interface StudyTaskItem {
  id: string;
  studyPlanId: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  taskType: StudyTaskType;
  title: string;
  description?: string;
  scheduledDateKey: string;
  scheduledDate: string;
  durationMinutes: number;
  priorityRank: number;
  status: StudyTaskStatus;
  completedAt?: string;
  isManuallyEdited: boolean;
}

interface CalendarDateBucket {
  dateKey: string;
  totalMinutes: number;
  dailyCapacityMinutes: number;
  tasks: StudyTaskItem[];
}

interface ScheduleFeasibilityReport {
  isFeasible: boolean;
  availableStudyDaysCount: number;
  totalAvailableMinutes: number;
  totalPlannedMinutes: number;
  utilizationPercent: number;
  verifiedWeightTopicCount: number;
  unverifiedWeightTopicCount: number;
  weightingPolicyNote: string;
  warningMessage?: string;
}

interface AdaptiveLearningSignals {
  weakTopicIds: string[];
  weakTopicTitles: string[];
  dueFlashcardCount: number;
  dueFlashcardTopicIds: string[];
  dueFlashcardTopicTitles: string[];
  verifiedWeightTopicCount: number;
  unverifiedWeightTopicCount: number;
  weightingDisclaimer: string;
}

interface StudyPlanDetailView {
  plan: StudyPlanItem;
  tasks: StudyTaskItem[];
  calendarByDate: CalendarDateBucket[];
  weeklyMilestones: WeeklyMilestoneItem[];
  feasibility: ScheduleFeasibilityReport;
  adaptiveSignals: AdaptiveLearningSignals;
  studyTips: string[];
}

const DAY_LABELS: Array<{ day: number; en: string; bn: string }> = [
  { day: 0, en: 'Sun', bn: 'রবি' },
  { day: 1, en: 'Mon', bn: 'সোম' },
  { day: 2, en: 'Tue', bn: 'মঙ্গল' },
  { day: 3, en: 'Wed', bn: 'বুধ' },
  { day: 4, en: 'Thu', bn: 'বৃহঃ' },
  { day: 5, en: 'Fri', bn: 'শুক্র' },
  { day: 6, en: 'Sat', bn: 'শনি' },
];

const TASK_TYPE_LABELS: Record<StudyTaskType, { en: string; bn: string }> = {
  learn_topic: { en: 'Learn Topic', bn: 'টপিক অধ্যয়ন' },
  revision: { en: 'Revision', bn: 'পুনরালোচনা' },
  practice_quiz: { en: 'Practice Quiz', bn: 'অনুশীলন কুইজ' },
  flashcard_review: { en: 'Flashcard Review', bn: 'ফ্ল্যাশকার্ড রিভিউ' },
  mock_exam: { en: 'Mock Exam', bn: 'মক পরীক্ষা' },
  final_revision: { en: 'Final Revision', bn: 'চূড়ান্ত রিভিশন' },
};

function defaultTargetDateString(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 21);
  return d.toISOString().slice(0, 10);
}

export default function StudentStudyPlannerPage() {
  const { language } = useUIPreferences();
  const isBn = language === 'bn';

  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [examinations, setExaminations] = useState<ExaminationOption[]>([]);
  const [plans, setPlans] = useState<StudyPlanItem[]>([]);
  const [activeDetail, setActiveDetail] = useState<StudyPlanDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // View mode (FR-PLAN-005: list, calendar, roadmap)
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'roadmap'>('list');
  const [statusFilter, setStatusFilter] = useState<'all' | StudyTaskStatus>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create Plan form state (FR-PLAN-002)
  const [planTitle, setPlanTitle] = useState('HSC & Admission Preparation Plan');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>(defaultTargetDateString());
  const [dailyMinutes, setDailyMinutes] = useState<number>(120);
  const [availableDays, setAvailableDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [proficiencyMap, setProficiencyMap] = useState<Record<string, ExplanationDepth>>({});

  // Quick Recalculate state (FR-PLAN-008)
  const [recalcTargetDate, setRecalcTargetDate] = useState<string>('');
  const [recalcDailyMinutes, setRecalcDailyMinutes] = useState<number>(120);

  // Manual Task Addition & Inline Edit state (FR-PLAN-007)
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskType, setNewTaskType] = useState<StudyTaskType>('learn_topic');
  const [newTaskDate, setNewTaskDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [newTaskDuration, setNewTaskDuration] = useState<number>(45);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDuration, setEditDuration] = useState<number>(45);

  const loadPlannerWorkspace = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [currRes, plansRes] = await Promise.all([
        fetch('/api/v1/curriculum'),
        fetch('/api/v1/study-plans'),
      ]);
      const currJson = await currRes.json();
      const plansJson = await plansRes.json();

      if (currRes.ok && currJson.success) {
        const fetchedSubjects: SubjectOption[] = currJson.data.subjects ?? [];
        const fetchedExams: ExaminationOption[] = currJson.data.examinations ?? [];
        setSubjects(fetchedSubjects);
        setExaminations(fetchedExams);
        if (fetchedSubjects.length > 0) {
          setSelectedSubjectIds((prev) =>
            prev.length > 0 ? prev : fetchedSubjects.slice(0, 2).map((s) => s.id),
          );
        }
        if (fetchedExams[0]?.id) {
          setSelectedExamId((prev) => prev || fetchedExams[0]!.id);
        }
      }

      if (plansRes.ok && plansJson.success) {
        const fetchedPlans: StudyPlanItem[] = plansJson.data.plans ?? [];
        const detail: StudyPlanDetailView | null = plansJson.data.activePlanDetail ?? null;
        setPlans(fetchedPlans);
        setActiveDetail(detail);
        if (detail) {
          setRecalcTargetDate(detail.plan.targetDate.slice(0, 10));
          setRecalcDailyMinutes(detail.plan.dailyStudyMinutes);
          setShowCreateForm(false);
        } else {
          setShowCreateForm(true);
        }
      } else {
        setErrorMessage(plansJson?.error?.message ?? 'Failed to load study plans.');
      }
    } catch {
      setErrorMessage('Network error while loading study planner workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlannerWorkspace();
  }, [loadPlannerWorkspace]);

  const handleSelectPlan = async (planId: string) => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/v1/study-plans/${planId}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setActiveDetail(json.data);
        setRecalcTargetDate(json.data.plan.targetDate.slice(0, 10));
        setRecalcDailyMinutes(json.data.plan.dailyStudyMinutes);
      } else {
        setErrorMessage(json?.error?.message ?? 'Unable to load selected plan.');
      }
    } catch {
      setErrorMessage('Failed to switch study plan.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDayOfWeek = (day: number) => {
    setAvailableDays((prev) => {
      if (prev.includes(day)) {
        return prev.length > 1 ? prev.filter((d) => d !== day) : prev;
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  };

  const toggleSubjectSelection = (subjectId: string) => {
    setSelectedSubjectIds((prev) => {
      if (prev.includes(subjectId)) {
        return prev.length > 1 ? prev.filter((id) => id !== subjectId) : prev;
      }
      return [...prev, subjectId];
    });
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSubjectIds.length === 0) {
      setErrorMessage('Select at least one subject for your study roadmap.');
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    setStatusBanner(null);

    try {
      const res = await fetch('/api/v1/study-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: planTitle,
          targetExaminationId: selectedExamId || undefined,
          targetDate,
          subjectIds: selectedSubjectIds,
          dailyStudyMinutes: dailyMinutes,
          availableDaysOfWeek: availableDays,
          proficiencyBySubject: proficiencyMap,
          language,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const createdDetail: StudyPlanDetailView = json.data;
        setActiveDetail(createdDetail);
        setPlans((prev) => [createdDetail.plan, ...prev]);
        setRecalcTargetDate(createdDetail.plan.targetDate.slice(0, 10));
        setRecalcDailyMinutes(createdDetail.plan.dailyStudyMinutes);
        setShowCreateForm(false);
        setStatusBanner(
          isBn
            ? 'অধ্যয়ন রোডম্যাপ সফলভাবে তৈরি করা হয়েছে।'
            : 'Personalized preparation roadmap created with deterministic daily scheduling.',
        );
      } else {
        setErrorMessage(json?.error?.message ?? 'Failed to create study plan.');
      }
    } catch {
      setErrorMessage('Network error while creating study plan.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecalculateOrReschedule = async (action: 'recalculate' | 'reschedule_missed') => {
    if (!activeDetail) return;
    setSubmitting(true);
    setErrorMessage(null);
    setStatusBanner(null);
    try {
      const res = await fetch(`/api/v1/study-plans/${activeDetail.plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          targetDate: recalcTargetDate || activeDetail.plan.targetDate,
          dailyStudyMinutes: recalcDailyMinutes,
          language,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActiveDetail(json.data);
        setPlans((prev) =>
          prev.map((p) => (p.id === json.data.plan.id ? json.data.plan : p)),
        );
        setStatusBanner(
          action === 'reschedule_missed'
            ? isBn
              ? 'বাদ পড়া ও অমীমাংসিত কাজগুলো পুনরায় নির্ধারণ করা হয়েছে।'
              : 'Missed and pending tasks have been deterministically rescheduled.'
            : isBn
              ? 'নতুন সময়সূচী অনুযায়ী রোডম্যাপ পুনঃগণনা করা হয়েছে।'
              : 'Study roadmap recalculated for updated target date and daily study hours.',
        );
      } else {
        setErrorMessage(json?.error?.message ?? 'Unable to recalculate study plan.');
      }
    } catch {
      setErrorMessage('Network error while updating study plan.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTaskStatusUpdate = async (taskId: string, status: StudyTaskStatus) => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/v1/study-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (res.ok && json.success && activeDetail) {
        await handleSelectPlan(activeDetail.plan.id);
      } else {
        setErrorMessage(json?.error?.message ?? 'Failed to update task status.');
      }
    } catch {
      setErrorMessage('Network error while updating task.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEditingTask = (task: StudyTaskItem) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDate(task.scheduledDateKey || task.scheduledDate.slice(0, 10));
    setEditDuration(task.durationMinutes);
  };

  const handleSaveManualTaskEdit = async (taskId: string) => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/v1/study-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          scheduledDate: editDate,
          durationMinutes: editDuration,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success && activeDetail) {
        setEditingTaskId(null);
        await handleSelectPlan(activeDetail.plan.id);
        setStatusBanner(
          isBn ? 'কাজটি ম্যানুয়ালি সম্পাদনা করা হয়েছে।' : 'Task manually updated on roadmap.',
        );
      } else {
        setErrorMessage(json?.error?.message ?? 'Failed to save task edit.');
      }
    } catch {
      setErrorMessage('Network error while saving task edit.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddManualTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDetail || !newTaskTitle.trim()) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/v1/study-plans/${activeDetail.plan.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          taskType: newTaskType,
          scheduledDate: newTaskDate,
          durationMinutes: newTaskDuration,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setNewTaskTitle('');
        await handleSelectPlan(activeDetail.plan.id);
        setStatusBanner(
          isBn ? 'নতুন কাস্টম কাজ যোগ করা হয়েছে।' : 'Custom study task added to roadmap.',
        );
      } else {
        setErrorMessage(json?.error?.message ?? 'Failed to add custom task.');
      }
    } catch {
      setErrorMessage('Network error while adding custom task.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!activeDetail) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/study-tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        await handleSelectPlan(activeDetail.plan.id);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTasks =
    activeDetail?.tasks.filter((t) =>
      statusFilter === 'all' ? true : t.status === statusFilter,
    ) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isBn ? 'ব্যক্তিগতকৃত অধ্যয়ন পরিকল্পনাকারী ও রোডম্যাপ' : 'Personalized Study Planner & Roadmap'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isBn
              ? 'পরীক্ষার তারিখ, দৈনিক অধ্যয়নের সময় এবং যাচাইকৃত পারফরম্যান্সের ভিত্তিতে নির্ধারিত রোডম্যাপ।'
              : 'Deterministic syllabus scheduling adapted to your target exam, daily availability, and verified quiz/flashcard performance.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {plans.length > 0 && (
            <select
              aria-label="Select Study Plan"
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={activeDetail?.plan.id ?? ''}
              onChange={(e) => void handleSelectPlan(e.target.value)}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.completionPercent}%)
                </option>
              ))}
            </select>
          )}
          <Button
            variant={showCreateForm ? 'secondary' : 'default'}
            size="sm"
            onClick={() => setShowCreateForm((prev) => !prev)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {isBn ? 'নতুন পরিকল্পনা' : 'New Study Plan'}
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      )}

      {statusBanner && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {statusBanner}
        </div>
      )}

      {/* Create Study Plan Configuration Form (FR-PLAN-001, FR-PLAN-002) */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {isBn ? 'নতুন পরীক্ষার প্রস্তুতি পরিকল্পনা তৈরি করুন' : 'Create Preparation Plan'}
            </CardTitle>
            <CardDescription>
              {isBn
                ? 'লক্ষ্য পরীক্ষা, বিষয়, দৈনিক অধ্যয়নের সময় এবং সপ্তাহের দিন নির্বাচন করুন।'
                : 'Configure your target examination, subjects, daily study hours, available days, and current proficiency.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleCreatePlan(e)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">
                    {isBn ? 'পরিকল্পনার শিরোনাম' : 'Plan Title'}
                  </label>
                  <Input
                    value={planTitle}
                    onChange={(e) => setPlanTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium">
                    {isBn ? 'লক্ষ্য পরীক্ষা' : 'Target Examination'}
                  </label>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                  >
                    <option value="">{isBn ? 'সাধারণ লক্ষ্য' : 'General Preparation Goal'}</option>
                    {examinations.map((exam) => (
                      <option key={exam.id} value={exam.id}>
                        {exam.name} ({exam.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium">
                    {isBn ? 'লক্ষ্য তারিখ' : 'Target Exam / Completion Date'}
                  </label>
                  <Input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium">
                    {isBn ? 'দৈনিক অধ্যয়নের সময় (মিনিট)' : 'Daily Study Minutes'}
                  </label>
                  <Input
                    type="number"
                    min={15}
                    max={720}
                    value={dailyMinutes}
                    onChange={(e) => setDailyMinutes(Number(e.target.value) || 60)}
                    required
                  />
                </div>
              </div>

              {/* Available Days of Week */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium">
                  {isBn ? 'অধ্যয়নের দিনসমূহ' : 'Available Study Days'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAY_LABELS.map((d) => {
                    const active = availableDays.includes(d.day);
                    return (
                      <Button
                        key={d.day}
                        type="button"
                        size="sm"
                        variant={active ? 'default' : 'outline'}
                        onClick={() => toggleDayOfWeek(d.day)}
                      >
                        {isBn ? d.bn : d.en}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Subject Selection & Proficiency */}
              <div className="space-y-2">
                <label className="text-xs font-medium">
                  {isBn
                    ? 'নির্বাচিত বিষয় ও বর্তমান দক্ষতা'
                    : 'Selected Subjects & Current Proficiency Estimates'}
                </label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {subjects.map((sub) => {
                    const checked = selectedSubjectIds.includes(sub.id);
                    const prof = proficiencyMap[sub.id] ?? 'intermediate';
                    return (
                      <div
                        key={sub.id}
                        className={`flex items-center justify-between rounded-lg border p-2.5 text-sm ${
                          checked ? 'border-primary bg-primary/5' : 'opacity-75'
                        }`}
                      >
                        <label className="flex cursor-pointer items-center gap-2 font-medium">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSubjectSelection(sub.id)}
                          />
                          <span>{isBn && sub.nameBn ? sub.nameBn : sub.name}</span>
                        </label>
                        {checked && (
                          <select
                            aria-label={`Proficiency for ${sub.name}`}
                            className="h-7 rounded border bg-background px-2 text-xs"
                            value={prof}
                            onChange={(e) =>
                              setProficiencyMap((prev) => ({
                                ...prev,
                                [sub.id]: e.target.value as ExplanationDepth,
                              }))
                            }
                          >
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                {activeDetail && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                  >
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </Button>
                )}
                <Button type="submit" disabled={submitting}>
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  {submitting
                    ? isBn
                      ? 'রোডম্যাপ তৈরি হচ্ছে...'
                      : 'Generating Roadmap...'
                    : isBn
                      ? 'রোডম্যাপ তৈরি করুন'
                      : 'Generate Preparation Roadmap'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {isBn ? 'অধ্যয়ন পরিকল্পনাকারী লোড হচ্ছে...' : 'Loading study planner and adaptive signals...'}
          </CardContent>
        </Card>
      ) : activeDetail ? (
        <>
          {/* Summary KPI & Adaptive Signals Row */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {isBn ? 'সামগ্রিক অগ্রগতি' : 'Roadmap Completion'}
                </CardDescription>
                <CardTitle className="text-2xl">
                  {activeDetail.plan.completionPercent}%
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${activeDetail.plan.completionPercent}%` }}
                  />
                </div>
                <div className="flex justify-between">
                  <span>
                    {activeDetail.tasks.filter((t) => t.status === 'completed').length} /{' '}
                    {activeDetail.tasks.length} {isBn ? 'কাজ সম্পন্ন' : 'tasks completed'}
                  </span>
                  <span>
                    {activeDetail.plan.dailyStudyMinutes} {isBn ? 'মিনিট/দিন' : 'mins/day'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {isBn ? 'সম্ভাব্যতা ও সময় বরাদ্দ' : 'Schedule Feasibility'}
                </CardDescription>
                <CardTitle className="flex items-center gap-2 text-lg">
                  {activeDetail.feasibility.isFeasible ? (
                    <Badge variant="default">
                      {isBn ? 'ভারসাম্যপূর্ণ সময়সূচী' : 'Feasible Schedule'}
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      {isBn ? 'অতিরিক্ত কাজের চাপ' : 'Capacity Exceeded'}
                    </Badge>
                  )}
                  <span className="text-sm font-normal text-muted-foreground">
                    {activeDetail.feasibility.utilizationPercent}% capacity
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                <p>
                  {activeDetail.feasibility.totalPlannedMinutes} mins planned across{' '}
                  {activeDetail.feasibility.availableStudyDaysCount} study days (capacity:{' '}
                  {activeDetail.feasibility.totalAvailableMinutes} mins).
                </p>
                {activeDetail.feasibility.warningMessage && (
                  <p className="mt-1 flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>{activeDetail.feasibility.warningMessage}</span>
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {isBn
                    ? 'যাচাইকৃত পারফরম্যান্স সংকেত (FR-PLAN-009..011)'
                    : 'Verified Adaptive Signals (FR-PLAN-009..011)'}
                </CardDescription>
                <CardTitle className="text-sm font-semibold">
                  {activeDetail.adaptiveSignals.weakTopicTitles.length > 0
                    ? `${activeDetail.adaptiveSignals.weakTopicTitles.length} Weak Topic(s) Prioritized`
                    : 'No Weak Topics Flagged Yet'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-muted-foreground">
                <p>
                  Due/Difficult Flashcards:{' '}
                  <strong>{activeDetail.adaptiveSignals.dueFlashcardCount}</strong>
                </p>
                <p className="text-[11px] leading-snug">
                  {activeDetail.adaptiveSignals.weightingDisclaimer}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* AI Advisor Summary & Recalculate Controls (FR-PLAN-008) */}
          <Card>
            <CardContent className="flex flex-col gap-4 pt-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>{activeDetail.plan.title}</span>
                  <Badge variant="outline">
                    Target: {activeDetail.plan.targetDate.slice(0, 10)}
                  </Badge>
                </div>
                {activeDetail.plan.aiSummary && (
                  <p className="text-sm text-muted-foreground">{activeDetail.plan.aiSummary}</p>
                )}
                {activeDetail.studyTips.length > 0 && (
                  <ul className="list-inside list-disc text-xs text-muted-foreground">
                    {activeDetail.studyTips.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-wrap items-end gap-2 border-t pt-3 lg:border-t-0 lg:pt-0">
                <div>
                  <label className="block text-[11px] text-muted-foreground">
                    {isBn ? 'লক্ষ্য তারিখ' : 'Target Date'}
                  </label>
                  <Input
                    type="date"
                    className="h-8 w-36 text-xs"
                    value={recalcTargetDate}
                    onChange={(e) => setRecalcTargetDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-muted-foreground">
                    {isBn ? 'মিনিট/দিন' : 'Mins/Day'}
                  </label>
                  <Input
                    type="number"
                    min={15}
                    max={720}
                    className="h-8 w-24 text-xs"
                    value={recalcDailyMinutes}
                    onChange={(e) => setRecalcDailyMinutes(Number(e.target.value) || 60)}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => void handleRecalculateOrReschedule('recalculate')}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  {isBn ? 'পুনঃগণনা করুন' : 'Recalculate Plan'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={submitting}
                  onClick={() => void handleRecalculateOrReschedule('reschedule_missed')}
                >
                  <Clock className="mr-1.5 h-3.5 w-3.5" />
                  {isBn ? 'বাদ পড়া কাজ পুনঃনির্ধারণ' : 'Reschedule Missed'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* View Mode Switcher (FR-PLAN-005: List, Calendar, Roadmap) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2" role="tablist" aria-label="Schedule Views">
              <Button
                size="sm"
                variant={viewMode === 'list' ? 'default' : 'outline'}
                onClick={() => setViewMode('list')}
              >
                <ListTodo className="mr-1.5 h-4 w-4" />
                {isBn ? 'তালিকা ভিউ' : 'List View'}
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'calendar' ? 'default' : 'outline'}
                onClick={() => setViewMode('calendar')}
              >
                <Calendar className="mr-1.5 h-4 w-4" />
                {isBn ? 'ক্যালেন্ডার ভিউ' : 'Calendar View'}
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'roadmap' ? 'default' : 'outline'}
                onClick={() => setViewMode('roadmap')}
              >
                <MapPin className="mr-1.5 h-4 w-4" />
                {isBn ? 'রোডম্যাপ ও মাইলফলক' : 'Roadmap & Milestones'}
              </Button>
            </div>

            {viewMode === 'list' && (
              <div className="flex items-center gap-1.5">
                {(['all', 'pending', 'completed', 'rescheduled', 'skipped'] as const).map(
                  (st) => (
                    <Button
                      key={st}
                      size="sm"
                      variant={statusFilter === st ? 'secondary' : 'ghost'}
                      className="h-7 px-2.5 text-xs capitalize"
                      onClick={() => setStatusFilter(st)}
                    >
                      {st}
                    </Button>
                  ),
                )}
              </div>
            )}
          </div>

          {/* VIEW 1: LIST VIEW + MANUAL TASK EDITOR (FR-PLAN-005, FR-PLAN-006, FR-PLAN-007) */}
          {viewMode === 'list' && (
            <div className="space-y-4">
              {/* Add Custom Task Form */}
              <Card>
                <CardContent className="pt-4">
                  <form
                    onSubmit={(e) => void handleAddManualTask(e)}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <div className="min-w-[200px] flex-1">
                      <label className="block text-xs font-medium">
                        {isBn ? 'কাস্টম কাজ যোগ করুন (FR-PLAN-007)' : 'Add Custom Study Task (FR-PLAN-007)'}
                      </label>
                      <Input
                        placeholder={
                          isBn ? 'কাজের শিরোনাম লিখুন...' : 'e.g., Extra Vector Calculus Problem Set'
                        }
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium">
                        {isBn ? 'ধরন' : 'Type'}
                      </label>
                      <select
                        className="h-9 rounded-md border bg-background px-2.5 text-xs"
                        value={newTaskType}
                        onChange={(e) => setNewTaskType(e.target.value as StudyTaskType)}
                      >
                        {Object.entries(TASK_TYPE_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>
                            {isBn ? label.bn : label.en}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium">
                        {isBn ? 'তারিখ' : 'Date'}
                      </label>
                      <Input
                        type="date"
                        className="w-36 text-xs"
                        value={newTaskDate}
                        onChange={(e) => setNewTaskDate(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium">
                        {isBn ? 'মিনিট' : 'Minutes'}
                      </label>
                      <Input
                        type="number"
                        min={10}
                        max={360}
                        className="w-20 text-xs"
                        value={newTaskDuration}
                        onChange={(e) => setNewTaskDuration(Number(e.target.value) || 45)}
                      />
                    </div>
                    <Button type="submit" size="sm" disabled={submitting}>
                      <Plus className="mr-1 h-4 w-4" />
                      {isBn ? 'যোগ করুন' : 'Add Task'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Task List */}
              <div className="space-y-2.5">
                {filteredTasks.map((task) => {
                  const isEditing = editingTaskId === task.id;
                  const typeLabel = TASK_TYPE_LABELS[task.taskType];
                  return (
                    <Card key={task.id}>
                      <CardContent className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                        {isEditing ? (
                          <div className="flex flex-1 flex-wrap items-center gap-2">
                            <Input
                              className="min-w-[200px] flex-1 text-sm"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                            />
                            <Input
                              type="date"
                              className="w-36 text-xs"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                            />
                            <Input
                              type="number"
                              min={10}
                              max={360}
                              className="w-20 text-xs"
                              value={editDuration}
                              onChange={(e) => setEditDuration(Number(e.target.value) || 45)}
                            />
                            <Button
                              size="sm"
                              onClick={() => void handleSaveManualTaskEdit(task.id)}
                              disabled={submitting}
                            >
                              {isBn ? 'সংরক্ষণ' : 'Save'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingTaskId(null)}
                            >
                              {isBn ? 'বাতিল' : 'Cancel'}
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`font-medium ${
                                    task.status === 'completed'
                                      ? 'line-through text-muted-foreground'
                                      : ''
                                  }`}
                                >
                                  {task.title}
                                </span>
                                <Badge variant="outline" className="text-[11px]">
                                  {isBn ? typeLabel.bn : typeLabel.en}
                                </Badge>
                                <Badge
                                  variant={
                                    task.status === 'completed'
                                      ? 'default'
                                      : task.status === 'skipped'
                                        ? 'destructive'
                                        : 'secondary'
                                  }
                                  className="text-[11px] capitalize"
                                >
                                  {task.status}
                                </Badge>
                                {task.isManuallyEdited && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Edited
                                  </Badge>
                                )}
                              </div>
                              {task.description && (
                                <p className="text-xs text-muted-foreground">{task.description}</p>
                              )}
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {task.scheduledDateKey}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {task.durationMinutes} mins
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              {task.status !== 'completed' ? (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => void handleTaskStatusUpdate(task.id, 'completed')}
                                  disabled={submitting}
                                >
                                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                  {isBn ? 'সম্পন্ন' : 'Complete'}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void handleTaskStatusUpdate(task.id, 'pending')}
                                  disabled={submitting}
                                >
                                  {isBn ? 'পূর্বাবস্থায়' : 'Reopen'}
                                </Button>
                              )}
                              {task.status !== 'skipped' && task.status !== 'completed' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void handleTaskStatusUpdate(task.id, 'skipped')}
                                  disabled={submitting}
                                >
                                  {isBn ? 'স্কিপ' : 'Skip'}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditingTask(task)}
                                aria-label={`Edit ${task.title}`}
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void handleDeleteTask(task.id)}
                                aria-label={`Delete ${task.title}`}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 2: CALENDAR VIEW (FR-PLAN-005) */}
          {viewMode === 'calendar' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeDetail.calendarByDate.map((bucket) => {
                const overCap = bucket.totalMinutes > bucket.dailyCapacityMinutes;
                return (
                  <Card key={bucket.dateKey}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">
                          {bucket.dateKey}
                        </CardTitle>
                        <Badge variant={overCap ? 'destructive' : 'secondary'}>
                          {bucket.totalMinutes} / {bucket.dailyCapacityMinutes} mins
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {bucket.tasks.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between rounded border p-2 text-xs"
                        >
                          <div>
                            <p
                              className={`font-medium ${
                                t.status === 'completed' ? 'line-through text-muted-foreground' : ''
                              }`}
                            >
                              {t.title}
                            </p>
                            <span className="text-[11px] text-muted-foreground">
                              {TASK_TYPE_LABELS[t.taskType].en} · {t.durationMinutes}m
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {t.status}
                          </Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* VIEW 3: ROADMAP & WEEKLY MILESTONES VIEW (FR-PLAN-004, FR-PLAN-005) */}
          {viewMode === 'roadmap' && (
            <div className="space-y-4">
              {activeDetail.weeklyMilestones.map((milestone) => (
                <Card key={milestone.weekNumber}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{milestone.title}</CardTitle>
                        <CardDescription>
                          {milestone.startDateKey} → {milestone.endDateKey}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{milestone.taskCount} tasks</Badge>
                        <Badge variant="outline">{milestone.plannedMinutes} mins</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {milestone.focusSubjectNames.map((subName) => (
                        <Badge key={subName} variant="default" className="text-xs">
                          {subName}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
