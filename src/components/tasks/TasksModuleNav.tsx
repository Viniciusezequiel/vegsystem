import { ClipboardCheck, Settings } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { ModuleNav, type ModuleNavItem } from '@/components/layout/ModuleNav';
import { useAuth } from '@/contexts/AuthContext';
import { RecurringTasksControl } from '@/components/tasks/RecurringTasksControl';

export function TasksModuleNav() {
  const { isAdmin } = useAuth();
  const { pathname } = useLocation();
  const items: ModuleNavItem[] = [
    {
      label: 'Minhas Demandas',
      href: '/tasks/my-tasks',
      icon: ClipboardCheck,
      activeWhen: currentPath => currentPath.startsWith('/tasks/my-tasks'),
    },
    ...(isAdmin
      ? [
          {
            label: 'Gestão de Demandas',
            href: '/tasks',
            icon: Settings,
            activeWhen: (currentPath: string) => currentPath === '/tasks' || currentPath.startsWith('/tasks/dashboard'),
          },
        ]
      : []),
  ];

  return (
    <>
      <ModuleNav
        title="Demandas"
        description="Acompanhe e gerencie solicitações internas"
        items={items}
      />
      {isAdmin && pathname === '/tasks' && <RecurringTasksControl />}
    </>
  );
}
