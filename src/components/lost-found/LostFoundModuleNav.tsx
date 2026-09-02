import { PackagePlus, Search } from 'lucide-react';
import { ModuleNav, type ModuleNavItem } from '@/components/layout/ModuleNav';

const isRegisterContext = (pathname: string) => pathname.startsWith('/lost-found/register');

const items: ModuleNavItem[] = [
  {
    label: 'Buscar Itens',
    href: '/lost-found/items',
    icon: Search,
    activeWhen: pathname => pathname.startsWith('/lost-found') && !isRegisterContext(pathname),
  },
  {
    label: 'Registrar Item',
    href: '/lost-found/register',
    icon: PackagePlus,
    activeWhen: isRegisterContext,
  },
];

export function LostFoundModuleNav() {
  return (
    <ModuleNav
      title="Achados e Perdidos"
      description="Registro e acompanhamento de itens encontrados"
      items={items}
    />
  );
}
