import { notFound } from 'next/navigation';
import { STUDENT_NAV_ITEMS } from '@/config/navigation';
import { WorkspaceModuleScaffold } from '@/components/shared/page-states';

const VALID_STUDENT_MODULES = new Set(
  STUDENT_NAV_ITEMS.filter(
    (item) =>
      item.href !== '/dashboard' &&
      item.href !== '/settings' &&
      item.href !== '/my-learning' &&
      item.href !== '/tutor' &&
      item.href !== '/materials',
  ).map((item) => item.href.replace(/^\//, '')),
);

export function generateStaticParams() {
  return Array.from(VALID_STUDENT_MODULES).map((module) => ({ module }));
}

export default async function StudentModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  if (!VALID_STUDENT_MODULES.has(module)) {
    notFound();
  }

  return (
    <WorkspaceModuleScaffold
      pathname={`/${module}`}
      highlights={[
        {
          labelEn: 'Curriculum Scope',
          labelBn: 'পাঠ্যক্রম পরিধি',
          value: 'HSC · BCS · SSC',
          subtext: '6-tier hierarchical syllabus context',
        },
        {
          labelEn: 'AI Gateway',
          labelBn: 'এআই গেটওয়ে',
          value: 'openrouter/free',
          subtext: 'Schema-validated with fallback routing',
        },
        {
          labelEn: 'Data Isolation',
          labelBn: 'তথ্য সুরক্ষা',
          value: 'User-Scoped',
          subtext: 'Compound userId ownership indexes',
        },
      ]}
    />
  );
}
