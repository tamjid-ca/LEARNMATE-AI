import { notFound } from 'next/navigation';
import {
  AdminCmsConsole,
  type AdminCmsSection,
} from '@/components/admin/admin-cms-console';
import { WorkspaceModuleScaffold } from '@/components/shared/page-states';
import { Badge } from '@/components/ui/badge';
import { ADMIN_NAV_ITEMS } from '@/config/navigation';

const VALID_ADMIN_SECTIONS = new Set(
  ADMIN_NAV_ITEMS.filter((item) => item.href !== '/admin').map((item) =>
    item.href.replace(/^\/admin\//, ''),
  ),
);

const LIVE_CMS_SECTIONS = new Set<AdminCmsSection>([
  'education-systems',
  'examinations',
  'subjects',
  'topics',
  'users',
  'audit-logs',
]);

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

  const navItem = ADMIN_NAV_ITEMS.find((item) => item.href === `/admin/${section}`);

  if (LIVE_CMS_SECTIONS.has(section as AdminCmsSection)) {
    return (
      <div className="space-y-6">
        <div>
          <Badge variant="default" className="mb-2">
            Administrative CMS · State 04 Live
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {navItem?.labelEn ?? section}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {navItem?.descriptionEn ?? 'Server-authorized administrative management console.'}
          </p>
        </div>
        <AdminCmsConsole section={section as AdminCmsSection} />
      </div>
    );
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
