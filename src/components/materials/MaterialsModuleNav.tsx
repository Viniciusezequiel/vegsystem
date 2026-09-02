import { ClipboardList, PackagePlus, Settings } from 'lucide-react';
import { ModuleNav, type ModuleNavItem } from '@/components/layout/ModuleNav';
import { useAuth } from '@/contexts/AuthContext';

export function MaterialsModuleNav() {
  const { isAdmin } = useAuth();
  const items: ModuleNavItem[] = [
    { label: 'Minhas Solicitações', href: '/materials/my-requests', icon: ClipboardList, activeWhen: pathname => pathname.startsWith('/materials/my-requests') },
    { label: 'Nova Solicitação', href: '/materials/new', icon: PackagePlus, activeWhen: pathname => pathname.startsWith('/materials/new') },
    ...(isAdmin ? [{ label: 'Gestão', href: '/materials', icon: Settings, activeWhen: (pathname: string) => pathname === '/materials' }] : []),
  ];

  return <ModuleNav title="Materiais" description="Solicitações e gestão de materiais" items={items} />;
}
