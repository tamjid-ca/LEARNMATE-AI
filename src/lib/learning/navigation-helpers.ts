/**
 * LearnMate AI — Client-Safe Academic Navigation & Chapter Progress Helpers
 */

export interface ProgressTopicRef {
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

export interface NavChapterRef {
  id: string;
  subjectId: string;
  chapterNumber: number;
  title: string;
  titleBn?: string;
  description?: string;
  learningObjectives?: string[];
  scope?: 'global' | 'custom';
}

export interface NavSubjectRef {
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

export interface NodeProgressSummary {
  totalTopics: number;
  completedTopics: number;
  completionPercent: number;
}

export function buildSubjectChapterProgress(
  subjects: readonly NavSubjectRef[],
  chapters: readonly NavChapterRef[],
  topics: readonly ProgressTopicRef[],
  completedTopicIds: ReadonlySet<string>,
): {
  subjectProgress: Map<string, NodeProgressSummary>;
  chapterProgress: Map<string, NodeProgressSummary>;
} {
  const chapterProgress = new Map<string, NodeProgressSummary>();
  for (const ch of chapters) {
    chapterProgress.set(ch.id, { totalTopics: 0, completedTopics: 0, completionPercent: 0 });
  }

  const subjectProgress = new Map<string, NodeProgressSummary>();
  for (const subj of subjects) {
    subjectProgress.set(subj.id, { totalTopics: 0, completedTopics: 0, completionPercent: 0 });
  }

  for (const top of topics) {
    const isDone = completedTopicIds.has(top.id);
    const chEntry = chapterProgress.get(top.chapterId) ?? {
      totalTopics: 0,
      completedTopics: 0,
      completionPercent: 0,
    };
    chEntry.totalTopics += 1;
    if (isDone) chEntry.completedTopics += 1;
    chapterProgress.set(top.chapterId, chEntry);

    const subjEntry = subjectProgress.get(top.subjectId) ?? {
      totalTopics: 0,
      completedTopics: 0,
      completionPercent: 0,
    };
    subjEntry.totalTopics += 1;
    if (isDone) subjEntry.completedTopics += 1;
    subjectProgress.set(top.subjectId, subjEntry);
  }

  for (const [id, entry] of chapterProgress.entries()) {
    entry.completionPercent =
      entry.totalTopics > 0 ? Math.round((entry.completedTopics / entry.totalTopics) * 100) : 0;
    chapterProgress.set(id, entry);
  }
  for (const [id, entry] of subjectProgress.entries()) {
    entry.completionPercent =
      entry.totalTopics > 0 ? Math.round((entry.completedTopics / entry.totalTopics) * 100) : 0;
    subjectProgress.set(id, entry);
  }

  return { subjectProgress, chapterProgress };
}

export function getAdjacentChapters<T extends { id: string; chapterNumber: number }>(
  orderedChapters: readonly T[],
  currentChapterId: string | undefined,
): { previousChapter: T | null; nextChapter: T | null } {
  if (!currentChapterId || orderedChapters.length === 0) {
    return { previousChapter: null, nextChapter: null };
  }
  const idx = orderedChapters.findIndex((c) => c.id === currentChapterId);
  if (idx < 0) {
    return { previousChapter: null, nextChapter: null };
  }
  return {
    previousChapter: idx > 0 ? (orderedChapters[idx - 1] ?? null) : null,
    nextChapter: idx < orderedChapters.length - 1 ? (orderedChapters[idx + 1] ?? null) : null,
  };
}
