import { BarChart3, ClipboardCheck, Settings } from 'lucide-react';
import { ModuleNav, type ModuleNavItem } from '@/components/layout/ModuleNav';
import { useAuth } from '@/contexts/AuthContext';

export function TasksModuleNav() {
  const { isAdmin } = useAuth();
  const items: ModuleNavItem[] = [
    { label: 'Minhas Demandas', href: '/tasks/my-tasks', icon: ClipboardCheck, activeWhen: pathname => pathname.startsWith('/tasks/my-tasks') },
    ...(isAdmin ? [
      { label: 'Gestão', href: '/tasks', icon: Settings, activeWhen: (pathname: string) => pathname === '/tasks' },
      { label: 'Dashboard', href: '/tasks/dashboard', icon: BarChart3, activeWhen: (pathname: string) => pathname.startsWith('/tasks/dashboard') },
    ] : []),
  ];

  return <ModuleNav title="Demandas" description="Acompanhe e gerencie solicitações internas" items={items} />;
}
