'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ADMIN_NAV_ITEMS } from '@/config/navigation';
import { useUIPreferences } from '@/components/providers/app-providers';
import { NavIcon } from '@/components/shared/nav-icon';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function AdminOverviewPage() {
  const { language } = useUIPreferences();

  const metrics = [
    {
      labelEn: 'Registered Collections',
      labelBn: 'ডাটাবেস কালেকশন',
      value: '27',
      sub: 'Normalized Mongoose schemas & indexes',
    },
    {
      labelEn: 'AI Task Pipelines',
      labelBn: 'এআই টাস্ক পাইপলাইন',
      value: '9',
      sub: 'Default: openrouter/free with Zod validation',
    },
    {
      labelEn: 'Curriculum Hierarchy',
      labelBn: 'পাঠ্যক্রম স্তর',
      value: '6 Tiers',
      sub: 'System → Level → Exam → Subject → Chapter → Topic',
    },
    {
      labelEn: 'RBAC Roles',
      labelBn: 'অ্যাক্সেস রোল',
      value: '3 Roles',
      sub: 'student · content_manager · admin',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <Badge variant="default">Administrator Control Plane</Badge>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {language === 'bn'
            ? 'অ্যাডমিনিস্ট্রেটর ওভারভিউ ড্যাশবোর্ড'
            : 'Platform Administration & CMS Overview'}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {language === 'bn'
            ? 'শিক্ষা ব্যবস্থা, সিলেবাস, ওপেনরাউটার এআই কনফিগারেশন, প্রম্পট টেমপ্লেট এবং অডিট লগ পরিচালনা করুন।'
            : 'Manage education systems, 6-tier curriculum structures, OpenRouter model routing, prompt templates, and security audit logs.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.labelEn}>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                {language === 'bn' ? m.labelBn : m.labelEn}
              </CardDescription>
              <CardTitle className="text-2xl font-bold">{m.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-[var(--muted-foreground)]">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_NAV_ITEMS.filter((item) => item.href !== '/admin').map((item) => (
          <Link key={item.key} href={item.href} className="group block">
            <Card className="h-full transition-colors group-hover:border-[var(--primary)]">
              <CardHeader>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)]">
                    <NavIcon name={item.icon} className="size-4" />
                  </div>
                  <ArrowRight className="size-4 text-[var(--muted-foreground)] group-hover:text-[var(--primary)]" />
                </div>
                <CardTitle className="text-base">
                  {language === 'bn' ? item.labelBn : item.labelEn}
                </CardTitle>
                <CardDescription>
                  {language === 'bn' ? item.descriptionBn : item.descriptionEn}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
