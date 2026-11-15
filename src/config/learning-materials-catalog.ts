/**
 * LearnMate AI — Learning Material Types & Tutor Response Modes Catalog
 * Safe for both server services and client components.
 */

import type { MaterialType } from '../types/domain.ts';

export interface MaterialTypeMetadata {
  type: MaterialType;
  labelEn: string;
  labelBn: string;
  descriptionEn: string;
  descriptionBn: string;
}

export const LEARNING_MATERIAL_CATALOG: readonly MaterialTypeMetadata[] = [
  {
    type: 'topic_explanation',
    labelEn: 'Topic Explanation',
    labelBn: 'টপিক ব্যাখ্যা',
    descriptionEn: 'Intuitive step-by-step conceptual breakdown with derivations.',
    descriptionBn: 'সহজবোধ্য ধাপে ধাপে তাত্ত্বিক ও গাণিতিক ব্যাখ্যা।',
  },
  {
    type: 'chapter_summary',
    labelEn: 'Chapter Summary',
    labelBn: 'অধ্যায় সারাংশ',
    descriptionEn: 'High-yield executive summary of the entire chapter.',
    descriptionBn: 'সম্পূর্ণ অধ্যায়ের মূল অংশের সংক্ষিপ্ত সারসংক্ষেপ।',
  },
  {
    type: 'detailed_notes',
    labelEn: 'Detailed Study Notes',
    labelBn: 'বিস্তারিত হ্যান্ডনোট',
    descriptionEn: 'Comprehensive board-exam and admission-ready lecture notes.',
    descriptionBn: 'বোর্ড ও ভর্তি পরীক্ষার উপযোগী পূর্ণাঙ্গ লেকচার নোট।',
  },
  {
    type: 'quick_revision_notes',
    labelEn: 'Quick Revision Notes',
    labelBn: 'দ্রুত রিভিশন নোট',
    descriptionEn: 'Last-minute bullet points for pre-exam revision.',
    descriptionBn: 'পরীক্ষার আগের রাতে দ্রুত রিভিশনের জন্য বুলেট পয়েন্ট।',
  },
  {
    type: 'important_definitions',
    labelEn: 'Important Definitions',
    labelBn: 'গুরুত্বপূর্ণ সংজ্ঞা (ক-নম্বর)',
    descriptionEn: 'Exact textbook definitions for 1-mark and 2-mark board questions.',
    descriptionBn: 'সৃজনশীল ক ও খ নম্বরের জন্য নির্ভুল সংজ্ঞা সংকলন।',
  },
  {
    type: 'formula_sheet',
    labelEn: 'Formula & Equation Sheet',
    labelBn: 'সূত্র ও সমীকরণ তালিকা',
    descriptionEn: 'All mathematical formulas, units, constants, and conditions.',
    descriptionBn: 'সকল গাণিতিক সূত্র, একক, ধ্রুবক ও প্রয়োগের শর্তাবলি।',
  },
  {
    type: 'key_concepts',
    labelEn: 'Key Concepts Map',
    labelBn: 'মূল ধারণা মানচিত্র',
    descriptionEn: 'Core mental models and relationships between concepts.',
    descriptionBn: 'টপিকের মূল ধারণা ও পারস্পরিক সম্পর্ক বিশ্লেষণ।',
  },
  {
    type: 'examples',
    labelEn: 'Worked Examples & Solutions',
    labelBn: 'সমাধানসহ গাণিতিক উদাহরণ',
    descriptionEn: 'Step-by-step solved numerical and conceptual problems.',
    descriptionBn: 'ধাপে ধাপে সমাধানকৃত গাণিতিক ও সৃজনশীল সমস্যা।',
  },
  {
    type: 'learning_guidelines',
    labelEn: 'Learning Guidelines',
    labelBn: 'অধ্যয়ন নির্দেশিকা',
    descriptionEn: 'How to master this topic in sequence and what prerequisites to review.',
    descriptionBn: 'টপিকটি কীভাবে ধাপে ধাপে আয়ত্ত করতে হবে তার নির্দেশিকা।',
  },
  {
    type: 'exam_preparation_guidelines',
    labelEn: 'Exam Preparation Guidelines',
    labelBn: 'পরীক্ষা প্রস্তুতি নির্দেশিকা',
    descriptionEn: 'High-frequency question patterns for HSC, SSC, Admission, and BCS.',
    descriptionBn: 'বোর্ড, ভর্তি ও বিসিএস পরীক্ষায় আসার মতো গুরুত্বপূর্ণ প্রশ্নের ধরন।',
  },
  {
    type: 'common_mistakes',
    labelEn: 'Common Mistakes & Pitfalls',
    labelBn: 'সাধারণ ভুল ও সতর্কতা',
    descriptionEn: 'Frequent sign errors, unit traps, and conceptual misconceptions.',
    descriptionBn: 'পরীক্ষায় শিক্ষার্থীদের সচরাচর হওয়া ভুল ও তা এড়ানোর উপায়।',
  },
  {
    type: 'conceptual_faq',
    labelEn: 'Conceptual FAQ',
    labelBn: 'অনুধাবনমূলক প্রশ্নোত্তর (FAQ)',
    descriptionEn: 'Frequently asked "Why" and "How" conceptual questions with answers.',
    descriptionBn: 'গুরুত্বপূর্ণ অনুধাবনমূলক প্রশ্ন ও টু-দ্য-পয়েন্ট উত্তর।',
  },
] as const;

export const TUTOR_STYLE_OPTIONS = [
  { value: 'explanation', labelEn: 'Concept Explanation', labelBn: 'ধারণা ব্যাখ্যা' },
  { value: 'step_by_step', labelEn: 'Step-by-Step Solution', labelBn: 'ধাপে ধাপে সমাধান' },
  { value: 'examples', labelEn: 'Worked Examples', labelBn: 'উদাহরণসহ ব্যাখ্যা' },
  { value: 'definitions', labelEn: 'Key Definitions', labelBn: 'সংজ্ঞা ও পরিভাষা' },
  { value: 'comparison', labelEn: 'Comparison Table', labelBn: 'তুলনামূলক পার্থক্য' },
  { value: 'application', labelEn: 'Practical Application', labelBn: 'বাস্তব প্রয়োগ' },
  { value: 'revision', labelEn: 'Revision Guidance', labelBn: 'রিভিশন গাইড' },
  { value: 'follow_up', labelEn: 'Follow-Up Practice', labelBn: 'অনুশীলন প্রশ্ন' },
] as const;
