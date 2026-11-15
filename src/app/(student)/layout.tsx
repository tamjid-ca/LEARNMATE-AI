import * as React from 'react';
import { AppShell } from '@/components/shared/app-shell';

export default function StudentWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <AppShell mode="student">{children}</AppShell>;
}
