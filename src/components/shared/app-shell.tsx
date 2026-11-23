'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Menu,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ADMIN_NAV_ITEMS, STUDENT_NAV_ITEMS, type NavItemConfig } from '@/config/navigation';
import { useUIPreferences } from '@/components/providers/app-providers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';
import { NavIcon } from './nav-icon';
import { ThemeLanguageControls } from './theme-language-controls';
import { HeaderNotificationBell } from '@/components/notifications/header-notification-bell';

export function AppShell({
  mode,
  children,
}: {
  mode: 'student' | 'admin';
  children: React.ReactNode;
}) {
  const pathname = usePathname() || '/dashboard';
  const { language, sidebarCollapsed, toggleSidebar } = useUIPreferences();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [filterQuery, setFilterQuery] = React.useState('');

  const items: readonly NavItemConfig[] = mode === 'admin' ? ADMIN_NAV_ITEMS : STUDENT_NAV_ITEMS;

  const filteredItems = React.useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.labelEn.toLowerCase().includes(q) ||
        item.labelBn.toLowerCase().includes(q) ||
        item.descriptionEn.toLowerCase().includes(q),
    );
  }, [items, filterQuery]);

  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const renderNavLinks = (collapsed: boolean) => (
    <nav
      aria-label={mode === 'admin' ? 'Administrator navigation' : 'Student navigation'}
      className="flex-1 space-y-1 overflow-y-auto px-3 py-3"
    >
      {filteredItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== '/admin' && item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
        const label = language === 'bn' ? item.labelBn : item.labelEn;

        const linkNode = (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-xs'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]',
              collapsed && 'justify-center px-2',
            )}
          >
            <NavIcon name={item.icon} className="size-4 shrink-0" />
            {!collapsed ? (
              <>
                <span className="truncate">{label}</span>
                {item.badge ? (
                  <Badge
                    variant={isActive ? 'secondary' : 'accent'}
                    className="ml-auto px-1.5 py-0 text-[10px]"
                  >
                    {item.badge}
                  </Badge>
                ) : null}
              </>
            ) : null}
          </Link>
        );

        return collapsed ? (
          <Tooltip key={item.key} label={label} className="w-full">
            {linkNode}
          </Tooltip>
        ) : (
          linkNode
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={cn(
          'hidden border-r border-[var(--border)] bg-[var(--card)] transition-all duration-200 md:flex md:flex-col',
          sidebarCollapsed ? 'md:w-18' : 'md:w-68',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-[var(--border)] px-4">
          <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)]">
              <GraduationCap className="size-5" />
            </div>
            {!sidebarCollapsed ? (
              <div className="flex flex-col">
                <span className="text-sm font-bold leading-none">LearnMate AI</span>
                <span className="mt-1 text-[11px] font-medium text-[var(--muted-foreground)]">
                  {mode === 'admin'
                    ? language === 'bn'
                      ? 'অ্যাডমিন প্যানেল'
                      : 'Admin Console'
                    : language === 'bn'
                      ? 'শিক্ষার্থী ওয়ার্কস্পেস'
                      : 'Student Workspace'}
                </span>
              </div>
            ) : null}
          </Link>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden md:inline-flex"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </Button>
        </div>

        {!sidebarCollapsed ? (
          <div className="px-3 pt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-[var(--muted-foreground)]" />
              <Input
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder={language === 'bn' ? 'মেনু খুঁজুন...' : 'Filter navigation...'}
                aria-label="Filter navigation links"
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>
        ) : null}

        {renderNavLinks(sidebarCollapsed)}

        <div className="border-t border-[var(--border)] p-3">
          <Link
            href={mode === 'admin' ? '/dashboard' : '/admin'}
            className={cn(
              'flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/60 px-3 py-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--secondary)]',
              sidebarCollapsed && 'justify-center px-2',
            )}
          >
            <ShieldCheck className="size-4 shrink-0 text-[var(--primary)]" />
            {!sidebarCollapsed ? (
              <span>
                {mode === 'admin'
                  ? language === 'bn'
                    ? 'শিক্ষার্থী ভিউতে যান'
                    : 'Switch to Student View'
                  : language === 'bn'
                    ? 'অ্যাডমিন কনসোল'
                    : 'Admin Console'}
              </span>
            ) : null}
          </Link>
        </div>
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 flex w-72 max-w-[85vw] flex-col bg-[var(--card)] shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-[var(--border)] px-4">
              <Link href="/" className="flex items-center gap-2.5 font-bold">
                <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]">
                  <GraduationCap className="size-4" />
                </div>
                <span className="text-sm">LearnMate AI</span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
              >
                <X className="size-4" />
              </Button>
            </div>
            {renderNavLinks(false)}
          </div>
        </div>
      ) : null}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--card)]/90 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="md:hidden"
            >
              <Menu className="size-4" />
            </Button>

            <div className="flex items-center gap-2">
              <Badge variant={mode === 'admin' ? 'default' : 'accent'}>
                {mode === 'admin'
                  ? language === 'bn'
                    ? 'অ্যাডমিন'
                    : 'Administrator'
                  : language === 'bn'
                    ? 'এইচএসসি ২০২৭ · বিজ্ঞান'
                    : 'HSC 2027 · Science'}
              </Badge>
              <span className="hidden text-xs text-[var(--muted-foreground)] sm:inline">
                {language === 'bn'
                  ? 'ওপেনরাউটার এআই গেটওয়ে (openrouter/free)'
                  : 'OpenRouter AI Gateway (openrouter/free)'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {mode === 'student' ? (
              <HeaderNotificationBell label={language === 'bn' ? 'বিজ্ঞপ্তি' : 'Notifications'} />
            ) : null}
            <ThemeLanguageControls />
            <Link href="/login" className="hidden sm:inline-flex">
              <Button variant="secondary" size="sm">
                {language === 'bn' ? 'সাইন ইন' : 'Sign In'}
              </Button>
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
