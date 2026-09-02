import { ClipboardCheck, Printer, Settings } from 'lucide-react';
import { ModuleNav, type ModuleNavItem } from '@/components/layout/ModuleNav';
import { useAuth } from '@/contexts/AuthContext';

export function SemesterModuleNav() {
  const { isAdmin } = useAuth();
  const items: ModuleNavItem[] = [
    { label: 'Checklists', href: '/semester', icon: ClipboardCheck, activeWhen: pathname => pathname === '/semester' || pathname.startsWith('/semester/new') || pathname.startsWith('/semester/dashboard') || pathname.startsWith('/semester/summary') || /^\/semester\/[0-9a-f-]+$/i.test(pathname) },
    ...(isAdmin ? [{ label: 'Competências', href: '/semester/competencies', icon: Settings, activeWhen: (pathname: string) => pathname.startsWith('/semester/competencies') }] : []),
    { label: 'Etiquetas', href: '/semester/labels', icon: Printer, activeWhen: pathname => pathname.startsWith('/semester/labels') },
  ];

  return <ModuleNav title="Checklist Semestral" description="Gestão e acompanhamento dos checklists semestrais" items={items} />;
}
