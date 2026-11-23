import { Suspense } from 'react';
import { AcademicWorkspace } from '@/components/learning/academic-workspace';
import { PageLoadingState } from '@/components/shared/page-states';

export default function MyLearningPage() {
  return (
    <Suspense fallback={<PageLoadingState title="Loading Academic Workspace..." />}>
      <AcademicWorkspace />
    </Suspense>
  );
}
