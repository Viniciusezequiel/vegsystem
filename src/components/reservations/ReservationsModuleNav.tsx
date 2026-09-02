import { Building2, CalendarDays, Plus } from 'lucide-react';
import { ModuleNav, type ModuleNavItem } from '@/components/layout/ModuleNav';
import { useAuth } from '@/contexts/AuthContext';

export function ReservationsModuleNav() {
  const { isAdmin } = useAuth();
  const items: ModuleNavItem[] = [
    { label: 'Reservas', href: '/reservations', icon: CalendarDays, activeWhen: pathname => pathname === '/reservations' },
    { label: 'Nova Reserva', href: '/reservations/new', icon: Plus, activeWhen: pathname => pathname.startsWith('/reservations/new') },
    ...(isAdmin ? [{ label: 'Cadastro de Salas', href: '/reservations/rooms', icon: Building2, activeWhen: (pathname: string) => pathname.startsWith('/reservations/rooms') }] : []),
  ];

  return <ModuleNav title="Reservas de Salas" description="Reservas e gerenciamento dos espaços" items={items} />;
}
