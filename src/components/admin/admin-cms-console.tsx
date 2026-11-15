'use client';

import { useCallback, useEffect, useState } from 'react';
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

export type AdminCmsSection =
  | 'education-systems'
  | 'examinations'
  | 'subjects'
  | 'topics'
  | 'users'
  | 'audit-logs';

interface SystemItem {
  id: string;
  code: string;
  name: string;
  country: string;
  isActive: boolean;
}

interface LevelItem {
  id: string;
  educationSystemId: string;
  code: string;
  name: string;
  order: number;
  isActive: boolean;
}

interface ExamItem {
  id: string;
  educationSystemId: string;
  educationLevelId: string;
  code: string;
  name: string;
  examDate?: string | null;
  isActive: boolean;
}

interface SubjectItem {
  id: string;
  educationSystemId: string;
  educationLevelId: string;
  code: string;
  name: string;
  nameBn?: string;
  order: number;
  isActive: boolean;
}

interface ChapterItem {
  id: string;
  subjectId: string;
  chapterNumber: number;
  title: string;
  titleBn?: string;
  order: number;
  isActive: boolean;
}

interface TopicItem {
  id: string;
  subjectId: string;
  chapterId: string;
  code: string;
  title: string;
  titleBn?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedMinutes: number;
  keyConcepts: string[];
  learningObjectives: string[];
  isActive: boolean;
}

interface AuditLogItem {
  id: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetCollection?: string;
  targetId?: string;
  createdAt: string;
}

interface AdminUserItem {
  id: string;
  fullName: string;
  email: string;
  role: 'student' | 'content_manager' | 'admin';
  status: 'active' | 'suspended' | 'pending_verification' | 'deleted';
  country: string;
  onboardingCompleted: boolean;
}

export function AdminCmsConsole({ section }: { section: AdminCmsSection }) {
  const [systems, setSystems] = useState<SystemItem[]>([]);
  const [levels, setLevels] = useState<LevelItem[]>([]);
  const [examinations, setExaminations] = useState<ExamItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [users, setUsers] = useState<AdminUserItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Create form states
  const [sysCode, setSysCode] = useState('');
  const [sysName, setSysName] = useState('');
  const [sysCountry, setSysCountry] = useState('BD');

  const [lvlSystemId, setLvlSystemId] = useState('');
  const [lvlCode, setLvlCode] = useState('');
  const [lvlName, setLvlName] = useState('');

  const [examSystemId, setExamSystemId] = useState('');
  const [examLevelId, setExamLevelId] = useState('');
  const [examCode, setExamCode] = useState('');
  const [examName, setExamName] = useState('');
  const [examDate, setExamDate] = useState('2027-06-15');

  const [subSystemId, setSubSystemId] = useState('');
  const [subLevelId, setSubLevelId] = useState('');
  const [subCode, setSubCode] = useState('');
  const [subName, setSubName] = useState('');
  const [subNameBn, setSubNameBn] = useState('');

  const [chapSubjectId, setChapSubjectId] = useState('');
  const [chapNumber, setChapNumber] = useState(1);
  const [chapTitle, setChapTitle] = useState('');
  const [chapTitleBn, setChapTitleBn] = useState('');

  const [topSubjectId, setTopSubjectId] = useState('');
  const [topChapterId, setTopChapterId] = useState('');
  const [topCode, setTopCode] = useState('');
  const [topTitle, setTopTitle] = useState('');
  const [topTitleBn, setTopTitleBn] = useState('');
  const [topDifficulty, setTopDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [topMinutes, setTopMinutes] = useState(45);
  const [topConcepts, setTopConcepts] = useState('');
  const [topObjectives, setTopObjectives] = useState('');

  const [exportPayload, setExportPayload] = useState('');
  const [csvImportText, setCsvImportText] = useState(
    'code,title,titleBn,difficulty,estimatedMinutes,keyConcepts,learningObjectives\nPHY-VEC-01,Vector Calculus & Curl,ভেক্টর ক্যালকুলাস ও কার্ল,medium,45,Gradient | Divergence | Curl,Compute divergence and curl of 3D vector fields',
  );

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      if (section === 'users') {
        const res = await fetch('/api/v1/admin/users', { credentials: 'include' });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setErrorMessage(json?.error?.message ?? 'Unable to load users');
        } else {
          setUsers(json.data.users ?? []);
        }
      } else {
        const res = await fetch('/api/v1/admin/curriculum', { credentials: 'include' });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setErrorMessage(json?.error?.message ?? 'Unable to load curriculum CMS');
        } else {
          const d = json.data;
          setSystems(d.educationSystems ?? []);
          setLevels(d.educationLevels ?? []);
          setExaminations(d.examinations ?? []);
          setSubjects(d.subjects ?? []);
          setChapters(d.chapters ?? []);
          setTopics(d.topics ?? []);
          setAuditLogs(d.auditLogs ?? []);

          if (d.educationSystems?.[0]) {
            setLvlSystemId((p) => p || d.educationSystems[0].id);
            setExamSystemId((p) => p || d.educationSystems[0].id);
            setSubSystemId((p) => p || d.educationSystems[0].id);
          }
          if (d.educationLevels?.[0]) {
            setExamLevelId((p) => p || d.educationLevels[0].id);
            setSubLevelId((p) => p || d.educationLevels[0].id);
          }
          if (d.subjects?.[0]) {
            setChapSubjectId((p) => p || d.subjects[0].id);
            setTopSubjectId((p) => p || d.subjects[0].id);
          }
          if (d.chapters?.[0]) {
            setTopChapterId((p) => p || d.chapters[0].id);
          }
        }
      }
    } catch {
      setErrorMessage('Network error communicating with Admin API');
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  async function mutateEntity(method: 'POST' | 'PATCH' | 'DELETE', payload: unknown) {
    setErrorMessage(null);
    setStatusMessage(null);
    const res = await fetch('/api/v1/admin/curriculum', {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setErrorMessage(json?.error?.message ?? 'Operation failed');
      return false;
    }
    setStatusMessage('Curriculum updated and recorded in auditLogs.');
    await loadSnapshot();
    return true;
  }

  async function handleExport(format: 'json' | 'csv') {
    setErrorMessage(null);
    const res = await fetch(`/api/v1/admin/curriculum/import-export?format=${format}`, {
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setErrorMessage(json?.error?.message ?? 'Export failed');
      return;
    }
    if (format === 'csv') {
      setExportPayload(json.data.csvText ?? '');
    } else {
      setExportPayload(JSON.stringify(json.data.bundle, null, 2));
    }
    setStatusMessage(`Exported curriculum in ${format.toUpperCase()} format.`);
  }

  async function handleCsvImport() {
    setErrorMessage(null);
    setStatusMessage(null);
    const res = await fetch('/api/v1/admin/curriculum/import-export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        format: 'csv',
        csvText: csvImportText,
        defaultSubjectId: topSubjectId,
        defaultChapterId: topChapterId,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setErrorMessage(json?.error?.message ?? 'CSV import failed');
      return;
    }
    setStatusMessage(`Imported ${json.data.importedCounts.topics} topic(s) from CSV.`);
    await loadSnapshot();
  }

  async function handleUpdateUser(
    userId: string,
    patch: { role?: AdminUserItem['role']; status?: AdminUserItem['status'] },
  ) {
    setErrorMessage(null);
    setStatusMessage(null);
    const res = await fetch('/api/v1/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId, ...patch }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setErrorMessage(json?.error?.message ?? 'Failed to update user permissions');
      return;
    }
    setStatusMessage('User permissions updated and logged.');
    await loadSnapshot();
  }

  return (
    <div className="space-y-6">
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

      {section === 'education-systems' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Education Systems ({systems.length})</CardTitle>
              <CardDescription>
                Manage national and international academic boards (e.g., BD-NCTB, BD-COMPETITIVE).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="grid gap-2.5 sm:grid-cols-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutateEntity('POST', {
                    entityType: 'educationSystem',
                    data: { code: sysCode, name: sysName, country: sysCountry },
                  }).then((ok) => {
                    if (ok) {
                      setSysCode('');
                      setSysName('');
                    }
                  });
                }}
              >
                <Input
                  placeholder="Code (e.g. BD-MADRASAH)"
                  value={sysCode}
                  onChange={(e) => setSysCode(e.target.value)}
                  required
                />
                <Input
                  placeholder="System Name"
                  value={sysName}
                  onChange={(e) => setSysName(e.target.value)}
                  required
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Country"
                    value={sysCountry}
                    onChange={(e) => setSysCountry(e.target.value)}
                    className="w-20"
                  />
                  <Button type="submit" size="sm" className="flex-1">
                    Add
                  </Button>
                </div>
              </form>

              <Separator />

              <div className="space-y-2">
                {systems.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{s.code}</Badge>
                        <span className="font-medium">{s.name}</span>
                        <Badge variant={s.isActive ? 'accent' : 'secondary'}>
                          {s.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void mutateEntity('PATCH', {
                          entityType: 'educationSystem',
                          id: s.id,
                          data: { isActive: !s.isActive },
                        })
                      }
                    >
                      {s.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Education Levels ({levels.length})</CardTitle>
              <CardDescription>
                Manage academic tiers (SSC, HSC, University Admission, BCS) under each system.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="grid gap-2.5 sm:grid-cols-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutateEntity('POST', {
                    entityType: 'educationLevel',
                    data: {
                      educationSystemId: lvlSystemId,
                      code: lvlCode,
                      name: lvlName,
                      order: levels.length + 1,
                    },
                  }).then((ok) => {
                    if (ok) {
                      setLvlCode('');
                      setLvlName('');
                    }
                  });
                }}
              >
                <select
                  value={lvlSystemId}
                  onChange={(e) => setLvlSystemId(e.target.value)}
                  className="h-10 rounded-xl border border-zinc-300 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {systems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Level Code (e.g. JSC)"
                  value={lvlCode}
                  onChange={(e) => setLvlCode(e.target.value)}
                  required
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Level Name"
                    value={lvlName}
                    onChange={(e) => setLvlName(e.target.value)}
                    required
                  />
                  <Button type="submit" size="sm">
                    Add
                  </Button>
                </div>
              </form>

              <Separator />

              <div className="space-y-2">
                {levels.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{l.code}</Badge>
                      <span className="font-medium">{l.name}</span>
                      <Badge variant={l.isActive ? 'accent' : 'secondary'}>
                        {l.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void mutateEntity('PATCH', {
                          entityType: 'educationLevel',
                          id: l.id,
                          data: { isActive: !l.isActive },
                        })
                      }
                    >
                      {l.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === 'examinations' ? (
        <Card>
          <CardHeader>
            <CardTitle>Target Examinations ({examinations.length})</CardTitle>
            <CardDescription>
              Create and schedule target examinations (HSC 2027, SSC 2027, Engineering Admission, BCS).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="grid gap-2.5 sm:grid-cols-5"
              onSubmit={(e) => {
                e.preventDefault();
                void mutateEntity('POST', {
                  entityType: 'examination',
                  data: {
                    educationSystemId: examSystemId,
                    educationLevelId: examLevelId,
                    code: examCode,
                    name: examName,
                    examDate,
                  },
                }).then((ok) => {
                  if (ok) {
                    setExamCode('');
                    setExamName('');
                  }
                });
              }}
            >
              <select
                value={examSystemId}
                onChange={(e) => setExamSystemId(e.target.value)}
                className="h-10 rounded-xl border border-zinc-300 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              >
                {systems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code}
                  </option>
                ))}
              </select>
              <select
                value={examLevelId}
                onChange={(e) => setExamLevelId(e.target.value)}
                className="h-10 rounded-xl border border-zinc-300 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              >
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} — {l.name}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Code (e.g. HSC-2028)"
                value={examCode}
                onChange={(e) => setExamCode(e.target.value)}
                required
              />
              <Input
                placeholder="Examination Name"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                required
              />
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                />
                <Button type="submit" size="sm">
                  Create
                </Button>
              </div>
            </form>

            <Separator />

            <div className="space-y-2">
              {examinations.map((ex) => (
                <div
                  key={ex.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{ex.code}</Badge>
                    <span className="font-semibold">{ex.name}</span>
                    {ex.examDate ? (
                      <span className="text-xs text-zinc-500">
                        Exam Date: {new Date(ex.examDate).toISOString().slice(0, 10)}
                      </span>
                    ) : null}
                    <Badge variant={ex.isActive ? 'accent' : 'secondary'}>
                      {ex.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void mutateEntity('PATCH', {
                        entityType: 'examination',
                        id: ex.id,
                        data: { isActive: !ex.isActive },
                      })
                    }
                  >
                    {ex.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {section === 'subjects' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Subjects ({subjects.length})</CardTitle>
              <CardDescription>
                Manage subjects in English and বাংলা mapped to education levels.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="grid gap-2 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutateEntity('POST', {
                    entityType: 'subject',
                    data: {
                      educationSystemId: subSystemId,
                      educationLevelId: subLevelId,
                      code: subCode,
                      name: subName,
                      nameBn: subNameBn || undefined,
                      order: subjects.length + 1,
                    },
                  }).then((ok) => {
                    if (ok) {
                      setSubCode('');
                      setSubName('');
                      setSubNameBn('');
                    }
                  });
                }}
              >
                <select
                  value={subSystemId}
                  onChange={(e) => setSubSystemId(e.target.value)}
                  className="h-10 rounded-xl border border-zinc-300 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {systems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code}
                    </option>
                  ))}
                </select>
                <select
                  value={subLevelId}
                  onChange={(e) => setSubLevelId(e.target.value)}
                  className="h-10 rounded-xl border border-zinc-300 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} — {l.name}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Code (e.g. HSC-BIO)"
                  value={subCode}
                  onChange={(e) => setSubCode(e.target.value)}
                  required
                />
                <Input
                  placeholder="English Name (e.g. Biology)"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  required
                />
                <Input
                  placeholder="বাংলা নাম (যেমন: জীববিজ্ঞান)"
                  value={subNameBn}
                  onChange={(e) => setSubNameBn(e.target.value)}
                />
                <Button type="submit">Add Subject</Button>
              </form>

              <Separator />

              <div className="space-y-2">
                {subjects.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800"
                  >
                    <div>
                      <Badge variant="outline" className="mr-2">
                        {sub.code}
                      </Badge>
                      <span className="font-semibold">{sub.name}</span>
                      {sub.nameBn ? (
                        <span className="ml-2 text-xs text-zinc-500">({sub.nameBn})</span>
                      ) : null}
                    </div>
                    <Badge variant={sub.isActive ? 'accent' : 'secondary'}>
                      {sub.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Chapters ({chapters.length})</CardTitle>
              <CardDescription>Manage ordered chapters inside each subject.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="grid gap-2 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutateEntity('POST', {
                    entityType: 'chapter',
                    data: {
                      subjectId: chapSubjectId,
                      chapterNumber: Number(chapNumber),
                      title: chapTitle,
                      titleBn: chapTitleBn || undefined,
                      order: chapters.length + 1,
                    },
                  }).then((ok) => {
                    if (ok) {
                      setChapTitle('');
                      setChapTitleBn('');
                    }
                  });
                }}
              >
                <select
                  value={chapSubjectId}
                  onChange={(e) => setChapSubjectId(e.target.value)}
                  className="h-10 rounded-xl border border-zinc-300 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={1}
                  placeholder="Chapter #"
                  value={chapNumber}
                  onChange={(e) => setChapNumber(Number(e.target.value))}
                  required
                />
                <Input
                  placeholder="Chapter Title (EN)"
                  value={chapTitle}
                  onChange={(e) => setChapTitle(e.target.value)}
                  required
                />
                <Input
                  placeholder="অধ্যায়ের শিরোনাম (BN)"
                  value={chapTitleBn}
                  onChange={(e) => setChapTitleBn(e.target.value)}
                />
                <Button type="submit" className="sm:col-span-2">
                  Add Chapter
                </Button>
              </form>

              <Separator />

              <div className="space-y-2">
                {chapters.map((ch) => (
                  <div
                    key={ch.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800"
                  >
                    <div>
                      <Badge variant="outline" className="mr-2">
                        Ch {ch.chapterNumber}
                      </Badge>
                      <span className="font-semibold">{ch.title}</span>
                      {ch.titleBn ? (
                        <span className="ml-2 text-xs text-zinc-500">({ch.titleBn})</span>
                      ) : null}
                    </div>
                    <Badge variant={ch.isActive ? 'accent' : 'secondary'}>
                      {ch.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === 'topics' ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Create Curriculum Topic</CardTitle>
                <CardDescription>
                  Topics exist independently of AI-generated materials (FR-CUR-007).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-2.5 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void mutateEntity('POST', {
                      entityType: 'topic',
                      data: {
                        subjectId: topSubjectId,
                        chapterId: topChapterId,
                        code: topCode,
                        title: topTitle,
                        titleBn: topTitleBn || undefined,
                        difficulty: topDifficulty,
                        estimatedMinutes: Number(topMinutes),
                        keyConcepts: topConcepts
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                        learningObjectives: topObjectives
                          .split('\n')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      },
                    }).then((ok) => {
                      if (ok) {
                        setTopCode('');
                        setTopTitle('');
                        setTopTitleBn('');
                        setTopConcepts('');
                        setTopObjectives('');
                      }
                    });
                  }}
                >
                  <select
                    value={topSubjectId}
                    onChange={(e) => setTopSubjectId(e.target.value)}
                    className="h-10 rounded-xl border border-zinc-300 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={topChapterId}
                    onChange={(e) => setTopChapterId(e.target.value)}
                    className="h-10 rounded-xl border border-zinc-300 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {chapters
                      .filter((c) => !topSubjectId || c.subjectId === topSubjectId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          Ch {c.chapterNumber}: {c.title}
                        </option>
                      ))}
                  </select>
                  <Input
                    placeholder="Topic Code (e.g. PHY-MECH-04)"
                    value={topCode}
                    onChange={(e) => setTopCode(e.target.value)}
                    required
                  />
                  <Input
                    placeholder="Topic Title (EN)"
                    value={topTitle}
                    onChange={(e) => setTopTitle(e.target.value)}
                    required
                  />
                  <Input
                    placeholder="টপিকের শিরোনাম (BN)"
                    value={topTitleBn}
                    onChange={(e) => setTopTitleBn(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <select
                      value={topDifficulty}
                      onChange={(e) =>
                        setTopDifficulty(e.target.value as 'easy' | 'medium' | 'hard')
                      }
                      className="h-10 flex-1 rounded-xl border border-zinc-300 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                    <Input
                      type="number"
                      min={5}
                      max={300}
                      value={topMinutes}
                      onChange={(e) => setTopMinutes(Number(e.target.value))}
                      className="w-24"
                    />
                  </div>
                  <Input
                    placeholder="Key Concepts (comma-separated)"
                    value={topConcepts}
                    onChange={(e) => setTopConcepts(e.target.value)}
                    className="sm:col-span-2"
                  />
                  <textarea
                    placeholder="Learning Objectives (one per line)"
                    value={topObjectives}
                    onChange={(e) => setTopObjectives(e.target.value)}
                    rows={2}
                    className="rounded-xl border border-zinc-300 bg-white p-2.5 text-xs sm:col-span-2 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <Button type="submit" className="sm:col-span-2">
                    Create Topic
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Validated JSON / CSV Import & Export (FR-CUR-009)</CardTitle>
                <CardDescription>
                  Export the syllabus hierarchy or bulk-import validated CSV topics.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void handleExport('json')}>
                    Export JSON Bundle
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void handleExport('csv')}>
                    Export Topics CSV
                  </Button>
                  <Button size="sm" variant="default" onClick={() => void handleCsvImport()}>
                    Import CSV Topics
                  </Button>
                </div>

                <textarea
                  value={csvImportText}
                  onChange={(e) => setCsvImportText(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-zinc-300 bg-zinc-50 p-2.5 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
                  aria-label="CSV topic import payload"
                />

                {exportPayload ? (
                  <textarea
                    readOnly
                    value={exportPayload}
                    rows={5}
                    className="w-full rounded-xl border border-indigo-200 bg-indigo-50/40 p-2.5 font-mono text-xs dark:border-indigo-900/50 dark:bg-indigo-950/20"
                    aria-label="Exported curriculum output"
                  />
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Curriculum Topics ({topics.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {topics.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800"
                >
                  <div>
                    <Badge variant="outline" className="mr-2">
                      {t.code}
                    </Badge>
                    <span className="font-semibold">{t.title}</span>
                    {t.titleBn ? (
                      <span className="ml-2 text-xs text-zinc-500">({t.titleBn})</span>
                    ) : null}
                    <span className="ml-2 text-xs text-zinc-500">
                      · {t.difficulty} · {t.estimatedMinutes}m
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void mutateEntity('PATCH', {
                          entityType: 'topic',
                          id: t.id,
                          data: { isActive: !t.isActive },
                        })
                      }
                    >
                      {t.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === 'users' ? (
        <Card>
          <CardHeader>
            <CardTitle>User Management & Role Permissions ({users.length})</CardTitle>
            <CardDescription>
              Server-enforced RBAC management for Students, Content Managers, and Administrators (FR-ADMIN-003).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {loading ? (
              <p className="text-sm text-zinc-500">Loading platform users...</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-zinc-500">No users registered yet.</p>
            ) : (
              users.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3.5 text-sm dark:border-zinc-800"
                >
                  <div>
                    <p className="font-semibold">
                      {u.fullName}{' '}
                      <span className="font-normal text-zinc-500">({u.email})</span>
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="default">{u.role}</Badge>
                      <Badge variant={u.status === 'active' ? 'accent' : 'secondary'}>
                        {u.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={u.role}
                      onChange={(e) =>
                        void handleUpdateUser(u.id, {
                          role: e.target.value as AdminUserItem['role'],
                        })
                      }
                      className="h-9 rounded-lg border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="student">student</option>
                      <option value="content_manager">content_manager</option>
                      <option value="admin">admin</option>
                    </select>
                    <select
                      value={u.status}
                      onChange={(e) =>
                        void handleUpdateUser(u.id, {
                          status: e.target.value as AdminUserItem['status'],
                        })
                      }
                      className="h-9 rounded-lg border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="active">active</option>
                      <option value="suspended">suspended</option>
                    </select>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {section === 'audit-logs' ? (
        <Card>
          <CardHeader>
            <CardTitle>Administrative Security Audit Logs ({auditLogs.length})</CardTitle>
            <CardDescription>
              Immutable trace of administrative curriculum and permission actions (FR-ADMIN-011).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-zinc-500">No administrative mutations recorded yet.</p>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 p-3 text-xs dark:border-zinc-800"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{log.action}</Badge>
                    <span className="text-zinc-600 dark:text-zinc-400">
                      Role: <strong>{log.actorRole}</strong> · Target:{' '}
                      {log.targetCollection ?? 'system'}/{log.targetId ?? '—'}
                    </span>
                  </div>
                  <span className="text-zinc-400">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
