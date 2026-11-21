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
      item.href !== '/materials' &&
      item.href !== '/quizzes' &&
      item.href !== '/flashcards' &&
      item.href !== '/documents' &&
      item.href !== '/planner' &&
      item.href !== '/analytics' &&
      item.href !== '/notifications',
  ).map((item) => item.href.replace(/^\//, '')),
);

export default async function StudentModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  if (!VALID_STUDENT_MODULES.has(module)) {
    notFound();
  }

  return <WorkspaceModuleScaffold pathname={`/${module}`} highlights={[]} />;
}
