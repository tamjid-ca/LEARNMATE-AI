import * as React from 'react';
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  CalendarRange,
  ClipboardCheck,
  Cpu,
  FileCheck2,
  FileText,
  Flag,
  FolderUp,
  Globe2,
  Layers,
  LayoutDashboard,
  Library,
  ListTree,
  ScrollText,
  Settings,
  Shield,
  TerminalSquare,
  Users,
} from 'lucide-react';
import type { NavIconName } from '@/config/navigation';

export function NavIcon({
  name,
  className = 'size-4 shrink-0',
}: {
  name: NavIconName;
  className?: string;
}) {
  switch (name) {
    case 'layout-dashboard':
      return <LayoutDashboard className={className} />;
    case 'book-open':
      return <BookOpen className={className} />;
    case 'bot':
      return <Bot className={className} />;
    case 'file-text':
      return <FileText className={className} />;
    case 'clipboard-check':
      return <ClipboardCheck className={className} />;
    case 'layers':
      return <Layers className={className} />;
    case 'calendar-range':
      return <CalendarRange className={className} />;
    case 'folder-up':
      return <FolderUp className={className} />;
    case 'bar-chart-3':
      return <BarChart3 className={className} />;
    case 'bell':
      return <Bell className={className} />;
    case 'settings':
      return <Settings className={className} />;
    case 'shield':
      return <Shield className={className} />;
    case 'users':
      return <Users className={className} />;
    case 'globe-2':
      return <Globe2 className={className} />;
    case 'award':
      return <Award className={className} />;
    case 'library':
      return <Library className={className} />;
    case 'list-tree':
      return <ListTree className={className} />;
    case 'file-check-2':
      return <FileCheck2 className={className} />;
    case 'cpu':
      return <Cpu className={className} />;
    case 'terminal-square':
      return <TerminalSquare className={className} />;
    case 'activity':
      return <Activity className={className} />;
    case 'flag':
      return <Flag className={className} />;
    case 'scroll-text':
      return <ScrollText className={className} />;
  }
}
