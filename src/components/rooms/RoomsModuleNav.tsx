import { Building2, ClipboardCheck, ClipboardPlus, RefreshCw } from 'lucide-react';
import { ModuleNav, type ModuleNavItem } from '@/components/layout/ModuleNav';
import { useAuth } from '@/contexts/AuthContext';

export function RoomsModuleNav() {
  const { isAdmin } = useAuth();
  const items: ModuleNavItem[] = [
    { label: 'Checklists', href: '/rooms/checklists', icon: ClipboardCheck, activeWhen: pathname => pathname.startsWith('/rooms/checklists') },
    { label: 'Novo Checklist', href: '/rooms/checklist/new', icon: ClipboardPlus, activeWhen: pathname => pathname.startsWith('/rooms/checklist/') },
    { label: 'Passagem de Plantão', href: '/rooms/shift-handovers', icon: RefreshCw, activeWhen: pathname => pathname.startsWith('/rooms/shift-handover') },
    ...(isAdmin ? [{ label: 'Gestão de Salas', href: '/rooms', icon: Building2, activeWhen: (pathname: string) => pathname === '/rooms' }] : []),
  ];

  return <ModuleNav title="Checklist de Salas" description="Checklists, salas e passagens de plantão" items={items} />;
}
