import * as React from 'react';
import { AppShell } from '@/components/shared/app-shell';

export default function AdminWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <AppShell mode="admin">{children}</AppShell>;
}
