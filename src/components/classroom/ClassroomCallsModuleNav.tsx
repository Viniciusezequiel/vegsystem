import { Bell, Settings } from 'lucide-react';
import { ModuleNav, type ModuleNavItem } from '@/components/layout/ModuleNav';
import { useAuth } from '@/contexts/AuthContext';

export function ClassroomCallsModuleNav() {
  const { isAdmin } = useAuth();
  const items: ModuleNavItem[] = [
    { label: 'Chamados', href: '/classroom-calls', icon: Bell, activeWhen: pathname => pathname === '/classroom-calls' },
    ...(isAdmin ? [{ label: 'Configurações', href: '/classroom-calls/settings', icon: Settings, activeWhen: (pathname: string) => pathname.startsWith('/classroom-calls/settings') }] : []),
  ];

  return <ModuleNav title="Chamados de Sala" description="Atendimento e configuração de chamados" items={items} />;
}
