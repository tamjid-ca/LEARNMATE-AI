import { notFound } from 'next/navigation';
import { ADMIN_NAV_ITEMS } from '@/config/navigation';
import { WorkspaceModuleScaffold } from '@/components/shared/page-states';

const VALID_ADMIN_SECTIONS = new Set(
  ADMIN_NAV_ITEMS.filter((item) => item.href !== '/admin').map((item) =>
    item.href.replace(/^\/admin\//, ''),
  ),
);

export function generateStaticParams() {
  return Array.from(VALID_ADMIN_SECTIONS).map((section) => ({ section }));
}

export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!VALID_ADMIN_SECTIONS.has(section)) {
    notFound();
  }

  return (
    <WorkspaceModuleScaffold
      pathname={`/admin/${section}`}
      highlights={[
        {
          labelEn: 'Access Control',
          labelBn: 'অ্যাক্সেস কন্ট্রোল',
          value: 'Server RBAC',
          subtext: 'Enforced via requireRole / requirePermission',
        },
        {
          labelEn: 'Audit Logging',
          labelBn: 'অডিট লগিং',
          value: 'Enabled',
          subtext: 'Recorded in auditLogs collection',
        },
        {
          labelEn: 'Validation',
          labelBn: 'ইনপুট ভ্যালিডেশন',
          value: 'Zod Strict',
          subtext: 'Every request body & query validated',
        },
      ]}
    />
  );
}
