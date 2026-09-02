import { ArrowLeftRight, Package } from 'lucide-react';
import { ModuleNav, type ModuleNavItem } from '@/components/layout/ModuleNav';

const isLoansContext = (pathname: string) => pathname.startsWith('/equipment/loans') || pathname.startsWith('/equipment/loan/') || pathname.startsWith('/equipment/reservations');

const moduleItems: ModuleNavItem[] = [
  { label: 'Patrimônios', href: '/equipment', icon: Package, activeWhen: pathname => pathname.startsWith('/equipment') && !isLoansContext(pathname) },
  { label: 'Empréstimos', href: '/equipment/loans', icon: ArrowLeftRight, activeWhen: isLoansContext },
];

export function EquipmentModuleNav() {
  return (
    <ModuleNav
      title="Equipamentos"
      description="Controle de patrimônios e empréstimos"
      items={moduleItems}
    />
  );
}
