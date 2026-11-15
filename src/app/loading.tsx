import { PageLoadingState } from '@/components/shared/page-states';

export default function GlobalLoading() {
  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-10">
      <PageLoadingState title="Loading LearnMate AI..." />
    </div>
  );
}
