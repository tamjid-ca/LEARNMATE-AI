/**
 * LearnMate AI — Client-Safe Custom Education Presets, Labels & Hierarchy Helpers
 * Terminological labels control UI presentation cleanly without mutating underlying entity records.
 */

import type { AcademicLabelKey, EducationSystemType } from '../types/domain.ts';

export interface EducationLabelDefinition {
  key: string;
  defaultLabel: string;
  singular: string;
  plural: string;
  order: number;
  required: boolean;
  allowMultiple: boolean;
  isVisible: boolean;
}

export interface HierarchyLevelConfig {
  key: string;
  singularLabel: string;
  pluralLabel: string;
  order: number;
  required: boolean;
  allowMultiple: boolean;
}

export type EducationPresetKey =
  | 'default'
  | 'school'
  | 'university'
  | 'self_learning'
  | 'competitive';

export const DEFAULT_EDUCATION_LABELS: readonly EducationLabelDefinition[] = [
  {
    key: 'educationSystem',
    defaultLabel: 'Education System',
    singular: 'Education System',
    plural: 'Education Systems',
    order: 0,
    required: true,
    allowMultiple: false,
    isVisible: true,
  },
  {
    key: 'educationLevel',
    defaultLabel: 'Education Level',
    singular: 'Education Level',
    plural: 'Education Levels',
    order: 1,
    required: false,
    allowMultiple: false,
    isVisible: true,
  },
  {
    key: 'academicYear',
    defaultLabel: 'Academic Year',
    singular: 'Academic Year',
    plural: 'Academic Years',
    order: 2,
    required: false,
    allowMultiple: false,
    isVisible: false,
  },
  {
    key: 'semester',
    defaultLabel: 'Semester',
    singular: 'Semester',
    plural: 'Semesters',
    order: 3,
    required: false,
    allowMultiple: true,
    isVisible: false,
  },
  {
    key: 'examination',
    defaultLabel: 'Examination',
    singular: 'Examination',
    plural: 'Examinations',
    order: 4,
    required: false,
    allowMultiple: true,
    isVisible: true,
  },
  {
    key: 'subject',
    defaultLabel: 'Subject',
    singular: 'Subject',
    plural: 'Subjects',
    order: 5,
    required: true,
    allowMultiple: true,
    isVisible: true,
  },
  {
    key: 'chapter',
    defaultLabel: 'Chapter',
    singular: 'Chapter',
    plural: 'Chapters',
    order: 6,
    required: true,
    allowMultiple: true,
    isVisible: true,
  },
  {
    key: 'topic',
    defaultLabel: 'Topic',
    singular: 'Topic',
    plural: 'Topics',
    order: 7,
    required: true,
    allowMultiple: true,
    isVisible: true,
  },
] as const;

export const EDUCATION_HIERARCHY_PRESETS: Record<
  EducationPresetKey,
  {
    labelEn: string;
    labelBn: string;
    educationType: EducationSystemType;
    descriptionEn: string;
    labels: readonly EducationLabelDefinition[];
  }
> = {
  default: {
    labelEn: 'Standard Academic Track',
    labelBn: 'স্ট্যান্ডার্ড একাডেমিক ধারা',
    educationType: 'standard',
    descriptionEn: 'Education System → Education Level → Examination → Subject → Chapter → Topic',
    labels: DEFAULT_EDUCATION_LABELS,
  },
  school: {
    labelEn: 'School / Board System',
    labelBn: 'স্কুল / বোর্ড পদ্ধতি',
    educationType: 'school',
    descriptionEn: 'Country / Board → Grade → Examination → Subject → Chapter → Topic',
    labels: [
      { key: 'educationSystem', defaultLabel: 'Education System', singular: 'Board', plural: 'Boards', order: 0, required: true, allowMultiple: false, isVisible: true },
      { key: 'educationLevel', defaultLabel: 'Education Level', singular: 'Grade', plural: 'Grades', order: 1, required: true, allowMultiple: false, isVisible: true },
      { key: 'academicYear', defaultLabel: 'Academic Year', singular: 'Session', plural: 'Sessions', order: 2, required: false, allowMultiple: false, isVisible: false },
      { key: 'semester', defaultLabel: 'Semester', singular: 'Term', plural: 'Terms', order: 3, required: false, allowMultiple: true, isVisible: false },
      { key: 'examination', defaultLabel: 'Examination', singular: 'Examination', plural: 'Examinations', order: 4, required: false, allowMultiple: true, isVisible: true },
      { key: 'subject', defaultLabel: 'Subject', singular: 'Subject', plural: 'Subjects', order: 5, required: true, allowMultiple: true, isVisible: true },
      { key: 'chapter', defaultLabel: 'Chapter', singular: 'Chapter', plural: 'Chapters', order: 6, required: true, allowMultiple: true, isVisible: true },
      { key: 'topic', defaultLabel: 'Topic', singular: 'Topic', plural: 'Topics', order: 7, required: true, allowMultiple: true, isVisible: true },
    ],
  },
  university: {
    labelEn: 'University / Semester Curriculum',
    labelBn: 'বিশ্ববিদ্যালয় / সেমিস্টার পাঠ্যক্রম',
    educationType: 'university',
    descriptionEn: 'University → Program → Academic Year → Semester → Course → Unit → Topic',
    labels: [
      { key: 'educationSystem', defaultLabel: 'Education System', singular: 'University', plural: 'Universities', order: 0, required: true, allowMultiple: false, isVisible: true },
      { key: 'educationLevel', defaultLabel: 'Education Level', singular: 'Program', plural: 'Programs', order: 1, required: true, allowMultiple: false, isVisible: true },
      { key: 'academicYear', defaultLabel: 'Academic Year', singular: 'Academic Year', plural: 'Academic Years', order: 2, required: false, allowMultiple: false, isVisible: true },
      { key: 'semester', defaultLabel: 'Semester', singular: 'Semester', plural: 'Semesters', order: 3, required: true, allowMultiple: true, isVisible: true },
      { key: 'examination', defaultLabel: 'Examination', singular: 'Assessment', plural: 'Assessments', order: 4, required: false, allowMultiple: true, isVisible: true },
      { key: 'subject', defaultLabel: 'Subject', singular: 'Course', plural: 'Courses', order: 5, required: true, allowMultiple: true, isVisible: true },
      { key: 'chapter', defaultLabel: 'Chapter', singular: 'Unit', plural: 'Units', order: 6, required: true, allowMultiple: true, isVisible: true },
      { key: 'topic', defaultLabel: 'Topic', singular: 'Topic', plural: 'Topics', order: 7, required: true, allowMultiple: true, isVisible: true },
    ],
  },
  self_learning: {
    labelEn: 'Self-Learning / Certification Path',
    labelBn: 'স্ব-শিক্ষা / সার্টিফিকেশন পথ',
    educationType: 'self_learning',
    descriptionEn: 'Learning Path → Certification → Module → Unit → Topic',
    labels: [
      { key: 'educationSystem', defaultLabel: 'Education System', singular: 'Learning Path', plural: 'Learning Paths', order: 0, required: true, allowMultiple: false, isVisible: true },
      { key: 'educationLevel', defaultLabel: 'Education Level', singular: 'Track', plural: 'Tracks', order: 1, required: false, allowMultiple: false, isVisible: false },
      { key: 'academicYear', defaultLabel: 'Academic Year', singular: 'Cohort', plural: 'Cohorts', order: 2, required: false, allowMultiple: false, isVisible: false },
      { key: 'semester', defaultLabel: 'Semester', singular: 'Sprint', plural: 'Sprints', order: 3, required: false, allowMultiple: true, isVisible: false },
      { key: 'examination', defaultLabel: 'Examination', singular: 'Certification Exam', plural: 'Certification Exams', order: 4, required: false, allowMultiple: true, isVisible: true },
      { key: 'subject', defaultLabel: 'Subject', singular: 'Module', plural: 'Modules', order: 5, required: true, allowMultiple: true, isVisible: true },
      { key: 'chapter', defaultLabel: 'Chapter', singular: 'Unit', plural: 'Units', order: 6, required: true, allowMultiple: true, isVisible: true },
      { key: 'topic', defaultLabel: 'Topic', singular: 'Topic', plural: 'Topics', order: 7, required: true, allowMultiple: true, isVisible: true },
    ],
  },
  competitive: {
    labelEn: 'Competitive / Coaching Track',
    labelBn: 'ভর্তি ও প্রতিযোগিতামূলক পরীক্ষা',
    educationType: 'competitive',
    descriptionEn: 'Program → Target Test → Subject → Section → Topic',
    labels: [
      { key: 'educationSystem', defaultLabel: 'Education System', singular: 'Prep Program', plural: 'Prep Programs', order: 0, required: true, allowMultiple: false, isVisible: true },
      { key: 'educationLevel', defaultLabel: 'Education Level', singular: 'Stage', plural: 'Stages', order: 1, required: false, allowMultiple: false, isVisible: true },
      { key: 'academicYear', defaultLabel: 'Academic Year', singular: 'Batch Year', plural: 'Batch Years', order: 2, required: false, allowMultiple: false, isVisible: false },
      { key: 'semester', defaultLabel: 'Semester', singular: 'Phase', plural: 'Phases', order: 3, required: false, allowMultiple: true, isVisible: false },
      { key: 'examination', defaultLabel: 'Examination', singular: 'Competitive Test', plural: 'Competitive Tests', order: 4, required: true, allowMultiple: true, isVisible: true },
      { key: 'subject', defaultLabel: 'Subject', singular: 'Subject', plural: 'Subjects', order: 5, required: true, allowMultiple: true, isVisible: true },
      { key: 'chapter', defaultLabel: 'Chapter', singular: 'Section', plural: 'Sections', order: 6, required: true, allowMultiple: true, isVisible: true },
      { key: 'topic', defaultLabel: 'Topic', singular: 'Topic', plural: 'Topics', order: 7, required: true, allowMultiple: true, isVisible: true },
    ],
  },
};

export const SUBJECT_COLOR_PRESETS = [
  '#2563eb',
  '#7c3aed',
  '#059669',
  '#d97706',
  '#dc2626',
  '#0891b2',
  '#db2777',
  '#4f46e5',
] as const;

export const SUBJECT_ICON_PRESETS = [
  'book-open',
  'atom',
  'calculator',
  'flask-conical',
  'cpu',
  'globe',
  'microscope',
  'landmark',
] as const;

export function cloneDefaultLabels(
  presetKey: EducationPresetKey = 'default',
): EducationLabelDefinition[] {
  const preset = EDUCATION_HIERARCHY_PRESETS[presetKey] ?? EDUCATION_HIERARCHY_PRESETS.default;
  return preset.labels.map((item) => ({ ...item }));
}

export function resolveEducationLabel(
  labels: readonly EducationLabelDefinition[] | undefined,
  key: AcademicLabelKey | string,
  form: 'singular' | 'plural' = 'singular',
  fallback?: string,
): string {
  const list = labels && labels.length > 0 ? labels : DEFAULT_EDUCATION_LABELS;
  const match =
    list.find((l) => l.key === key) ?? DEFAULT_EDUCATION_LABELS.find((l) => l.key === key);
  if (!match) {
    return fallback ?? key;
  }
  return form === 'plural' ? match.plural : match.singular;
}

export function buildHierarchyPreview(
  labels: readonly EducationLabelDefinition[] | undefined,
): string {
  const list = labels && labels.length > 0 ? labels : DEFAULT_EDUCATION_LABELS;
  return [...list]
    .filter((item) => item.isVisible)
    .sort((a, b) => a.order - b.order)
    .map((item) => item.singular)
    .join(' → ');
}
