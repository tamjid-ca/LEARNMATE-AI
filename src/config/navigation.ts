/**
 * LearnMate AI — Canonical Navigation & Information Architecture
 * Implements all Student (11) and Administrator (13) navigation items required by SRS Section 9.3,
 * with bilingual English (en) and Bangla (bn) labels and descriptions.
 */

export type NavIconName =
  | 'layout-dashboard'
  | 'book-open'
  | 'bot'
  | 'file-text'
  | 'clipboard-check'
  | 'layers'
  | 'calendar-range'
  | 'folder-up'
  | 'bar-chart-3'
  | 'bell'
  | 'settings'
  | 'shield'
  | 'users'
  | 'globe-2'
  | 'award'
  | 'library'
  | 'list-tree'
  | 'file-check-2'
  | 'cpu'
  | 'terminal-square'
  | 'activity'
  | 'flag'
  | 'scroll-text';

export interface NavItemConfig {
  key: string;
  href: string;
  icon: NavIconName;
  labelEn: string;
  labelBn: string;
  descriptionEn: string;
  descriptionBn: string;
  badge?: string;
  stateTarget: string;
}

export const STUDENT_NAV_ITEMS: readonly NavItemConfig[] = [
  {
    key: 'dashboard',
    href: '/dashboard',
    icon: 'layout-dashboard',
    labelEn: 'Dashboard',
    labelBn: 'ড্যাশবোর্ড',
    descriptionEn: 'Daily learning overview, active study tasks, streaks, and AI recommendations.',
    descriptionBn: 'দৈনিক পাঠের সারাংশ, অধ্যয়নের কাজ, ধারাবাহিকতা এবং এআই পরামর্শ।',
    stateTarget: 'State 03 / State 11',
  },
  {
    key: 'my-learning',
    href: '/my-learning',
    icon: 'book-open',
    labelEn: 'My Learning',
    labelBn: 'আমার পাঠ্যক্রম',
    descriptionEn: 'Browse education systems, SSC/HSC/University/BCS subjects, chapters, and topics.',
    descriptionBn: 'শিক্ষা ব্যবস্থা, বিষয়, অধ্যায় এবং টপিক ব্রাউজ করুন।',
    stateTarget: 'State 04',
  },
  {
    key: 'tutor',
    href: '/tutor',
    icon: 'bot',
    labelEn: 'AI Tutor',
    labelBn: 'এআই টিউটর',
    descriptionEn: 'Context-aware subject tutor with step-by-step explanations in Bangla & English.',
    descriptionBn: 'বাংলা ও ইংরেজিতে বিষয়ভিত্তিক এআই টিউটর এবং ধাপে ধাপে সমাধান।',
    badge: 'AI',
    stateTarget: 'State 06',
  },
  {
    key: 'materials',
    href: '/materials',
    icon: 'file-text',
    labelEn: 'Study Materials',
    labelBn: 'স্টাডি ম্যাটেরিয়ালস',
    descriptionEn: 'Generate and save topic explanations, chapter summaries, formula sheets, and notes.',
    descriptionBn: 'টপিক ব্যাখ্যা, অধ্যায়ের সারাংশ, সূত্র এবং নোট তৈরি ও সংরক্ষণ করুন।',
    stateTarget: 'State 06',
  },
  {
    key: 'quizzes',
    href: '/quizzes',
    icon: 'clipboard-check',
    labelEn: 'Quiz Center',
    labelBn: 'কুইজ ও পরীক্ষা',
    descriptionEn: 'Practice quizzes and timed mock examinations with instant scoring and rubric feedback.',
    descriptionBn: 'অনুশীলন কুইজ এবং সময়ভিত্তিক মক পরীক্ষা।',
    stateTarget: 'State 07',
  },
  {
    key: 'flashcards',
    href: '/flashcards',
    icon: 'layers',
    labelEn: 'Flashcards',
    labelBn: 'ফ্ল্যাশকার্ড',
    descriptionEn: 'Smart flashcards with SM-2 spaced repetition scheduling for long-term retention.',
    descriptionBn: 'দীর্ঘমেয়াদী মনে রাখার জন্য স্মার্ট ফ্ল্যাশকার্ড ও স্পেসড রিপিটিশন।',
    stateTarget: 'State 08',
  },
  {
    key: 'planner',
    href: '/planner',
    icon: 'calendar-range',
    labelEn: 'Study Planner',
    labelBn: 'স্টাডি প্ল্যানার',
    descriptionEn: 'Personalized exam preparation roadmaps, daily study milestones, and smart rescheduling.',
    descriptionBn: 'পরীক্ষার প্রস্তুতির রোডম্যাপ এবং দৈনিক অধ্যয়নের রুটিন।',
    stateTarget: 'State 10',
  },
  {
    key: 'documents',
    href: '/documents',
    icon: 'folder-up',
    labelEn: 'My Documents',
    labelBn: 'আমার ডকুমেন্টস',
    descriptionEn: 'Upload PDF, DOCX, and TXT files for source-grounded RAG Q&A, quizzes, and summaries.',
    descriptionBn: 'পিডিএফ, ডকএক্স ও টেক্সট ফাইল আপলোড করে প্রশ্নোত্তর ও সারাংশ তৈরি করুন।',
    badge: 'RAG',
    stateTarget: 'State 09',
  },
  {
    key: 'analytics',
    href: '/analytics',
    icon: 'bar-chart-3',
    labelEn: 'Analytics',
    labelBn: 'অ্যানালিটিক্স',
    descriptionEn: 'Subject-wise performance, topic mastery estimates, and adaptive study recommendations.',
    descriptionBn: 'বিষয়ভিত্তিক পারফরম্যান্স, টপিক দক্ষতা এবং অগ্রগতি বিশ্লেষণ।',
    stateTarget: 'State 11',
  },
  {
    key: 'notifications',
    href: '/notifications',
    icon: 'bell',
    labelEn: 'Notifications',
    labelBn: 'নোটিফিকেশন',
    descriptionEn: 'Revision alerts, due flashcard reminders, exam countdowns, and achievement milestones.',
    descriptionBn: 'রিভিশন রিমাইন্ডার, ফ্ল্যাশকার্ড অ্যালার্ট এবং অর্জনের নোটিফিকেশন।',
    stateTarget: 'State 11',
  },
  {
    key: 'settings',
    href: '/settings',
    icon: 'settings',
    labelEn: 'Settings',
    labelBn: 'সেটিংস',
    descriptionEn: 'Manage education profile, preferred language, timezone, daily study hours, and privacy.',
    descriptionBn: 'প্রোফাইল, ভাষা, টাইমজোন এবং অধ্যয়নের পছন্দসমূহ পরিচালনা করুন।',
    stateTarget: 'State 03',
  },
] as const;

export const ADMIN_NAV_ITEMS: readonly NavItemConfig[] = [
  {
    key: 'admin-overview',
    href: '/admin',
    icon: 'shield',
    labelEn: 'Overview',
    labelBn: 'ওভারভিউ',
    descriptionEn: 'Platform health, active students, curriculum coverage, and AI gateway metrics.',
    descriptionBn: 'প্ল্যাটফর্মের সার্বিক অবস্থা, শিক্ষার্থী সংখ্যা এবং এআই মেট্রিক্স।',
    stateTarget: 'State 04 / State 12',
  },
  {
    key: 'admin-users',
    href: '/admin/users',
    icon: 'users',
    labelEn: 'Users',
    labelBn: 'ব্যবহারকারী',
    descriptionEn: 'Manage student, educator, and administrator accounts, roles, and access status.',
    descriptionBn: 'শিক্ষার্থী, শিক্ষক এবং অ্যাডমিন অ্যাকাউন্ট ও রোল ব্যবস্থাপনা।',
    stateTarget: 'State 03 / State 04',
  },
  {
    key: 'admin-education-systems',
    href: '/admin/education-systems',
    icon: 'globe-2',
    labelEn: 'Education Systems',
    labelBn: 'শিক্ষা ব্যবস্থা',
    descriptionEn: 'Configure country curricula (Bangladesh NCTB, SSC, HSC, University, BCS, and global).',
    descriptionBn: 'দেশভিত্তিক শিক্ষা ব্যবস্থা ও স্তর কনফিগারেশন।',
    stateTarget: 'State 04',
  },
  {
    key: 'admin-examinations',
    href: '/admin/examinations',
    icon: 'award',
    labelEn: 'Examinations',
    labelBn: 'পরীক্ষাসমূহ',
    descriptionEn: 'Manage board examinations, admission tests, competitive exams, and target dates.',
    descriptionBn: 'বোর্ড পরীক্ষা, ভর্তি পরীক্ষা এবং বিসিএস পরীক্ষার মেটাডেটা।',
    stateTarget: 'State 04',
  },
  {
    key: 'admin-subjects',
    href: '/admin/subjects',
    icon: 'library',
    labelEn: 'Subjects and Chapters',
    labelBn: 'বিষয় ও অধ্যায়',
    descriptionEn: 'Create and organize academic subjects, ordered chapters, and syllabus structure.',
    descriptionBn: 'একাডেমিক বিষয় এবং অধ্যায়সমূহ তৈরি ও বিন্যাস করুন।',
    stateTarget: 'State 04',
  },
  {
    key: 'admin-topics',
    href: '/admin/topics',
    icon: 'list-tree',
    labelEn: 'Topics',
    labelBn: 'টপিকসমূহ',
    descriptionEn: 'Manage learning topics, prerequisites, objectives, difficulty, and JSON/CSV import-export.',
    descriptionBn: 'টপিক, পূর্বশর্ত, শিখন উদ্দেশ্য এবং ইমপোর্ট/এক্সপোর্ট ব্যবস্থাপনা।',
    stateTarget: 'State 04',
  },
  {
    key: 'admin-content',
    href: '/admin/content',
    icon: 'file-check-2',
    labelEn: 'Content Management',
    labelBn: 'কন্টেন্ট ব্যবস্থাপনা',
    descriptionEn: 'Review, curate, and publish verified educational materials and flagged AI outputs.',
    descriptionBn: 'যাচাইকৃত শিক্ষা উপকরণ প্রকাশ এবং ফ্ল্যাগকৃত এআই কন্টেন্ট রিভিউ।',
    stateTarget: 'State 04 / State 06',
  },
  {
    key: 'admin-ai-config',
    href: '/admin/ai-config',
    icon: 'cpu',
    labelEn: 'AI Configuration',
    labelBn: 'এআই কনফিগারেশন',
    descriptionEn: 'Configure OpenRouter models (openrouter/free & fallbacks), quotas, and task routing.',
    descriptionBn: 'ওপেনরাউটার মডেল, কোটা এবং টাস্ক রাউটিং কনফিগারেশন।',
    stateTarget: 'State 05',
  },
  {
    key: 'admin-prompts',
    href: '/admin/prompts',
    icon: 'terminal-square',
    labelEn: 'Prompt Management',
    labelBn: 'প্রম্পট ব্যবস্থাপনা',
    descriptionEn: 'Version and tune system and user prompt templates for each AI task.',
    descriptionBn: 'প্রতিটি এআই টাস্কের জন্য প্রম্পট টেমপ্লেট ভার্সনিং ও টিউনিং।',
    stateTarget: 'State 05',
  },
  {
    key: 'admin-usage-logs',
    href: '/admin/usage-logs',
    icon: 'activity',
    labelEn: 'Usage Logs',
    labelBn: 'ব্যবহার লগ',
    descriptionEn: 'Monitor AI request latency, token consumption, error rates, and fallback invocations.',
    descriptionBn: 'এআই রিকোয়েস্ট ল্যাটেন্সি, টোকেন ব্যবহার এবং এরর রেট পর্যবেক্ষণ।',
    stateTarget: 'State 05',
  },
  {
    key: 'admin-reports',
    href: '/admin/reports',
    icon: 'flag',
    labelEn: 'Reports and Feedback',
    labelBn: 'রিপোর্ট ও ফিডব্যাক',
    descriptionEn: 'Triage and resolve student-submitted content flags and platform feedback.',
    descriptionBn: 'শিক্ষার্থীদের পাঠানো রিপোর্ট ও ফিডব্যাক সমাধান করুন।',
    stateTarget: 'State 06 / State 12',
  },
  {
    key: 'admin-audit-logs',
    href: '/admin/audit-logs',
    icon: 'scroll-text',
    labelEn: 'Audit Logs',
    labelBn: 'অডিট লগ',
    descriptionEn: 'Immutable security trace of administrative actions, role changes, and config updates.',
    descriptionBn: 'অ্যাডমিন কার্যক্রম এবং নিরাপত্তা পরিবর্তনের অডিট লগ।',
    stateTarget: 'State 12',
  },
  {
    key: 'admin-settings',
    href: '/admin/settings',
    icon: 'settings',
    labelEn: 'Settings',
    labelBn: 'প্ল্যাটফর্ম সেটিংস',
    descriptionEn: 'Global platform configuration, rate limits, upload caps, and maintenance controls.',
    descriptionBn: 'গ্লোবাল প্ল্যাটফর্ম সেটিংস, রেট লিমিট এবং আপলোড সীমা।',
    stateTarget: 'State 05 / State 12',
  },
] as const;

export function findNavItemByPath(pathname: string): NavItemConfig | undefined {
  const all = [...ADMIN_NAV_ITEMS, ...STUDENT_NAV_ITEMS];
  return (
    all.find((item) => item.href === pathname) ??
    all.find((item) => item.href !== '/admin' && pathname.startsWith(`${item.href}/`))
  );
}
