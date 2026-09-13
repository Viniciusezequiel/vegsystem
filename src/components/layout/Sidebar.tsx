import { useMemo, useState, type ElementType } from 'react';
import { NavLink as RouterNavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  CalendarDays,
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  History,
  LayoutDashboard,
  Lock,
  Monitor,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions, type Module } from '@/hooks/usePermissions';
import { ThemeToggle } from './ThemeToggle';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import vegSystemLogo from '@/assets/veg-system-logo.png';

interface NavItem {
  name: string;
  href: string;
  icon: ElementType;
  adminOnly?: boolean;
  module?: Module;
  badge?: 'tasks' | 'materials' | 'calls';
}

interface NavSection {
  key: string;
  name: string;
  items: NavItem[];
  adminOnly?: boolean;
}

const sections: NavSection[] = [
  {
    key: 'operation',
    name: 'Operação',
    items: [
      { name: 'Demandas', href: '/tasks/my-tasks', icon: ClipboardCheck, module: 'tasks', badge: 'tasks' },
      { name: 'Achados e Perdidos', href: '/lost-found/items', icon: Package, module: 'lostAndFound' },
      { name: 'Equipamentos', href: '/equipment', icon: Monitor, module: 'equipment' },
      { name: 'Escaninhos', href: '/lockers', icon: Lock, module: 'lockers' },
      { name: 'Materiais', href: '/materials/my-requests', icon: ShoppingCart, module: 'materials', badge: 'materials' },
      { name: 'Chamados de Sala', href: '/classroom-calls', icon: Bell, module: 'classroomCalls', badge: 'calls' },
    ],
  },
  {
    key: 'rooms',
    name: 'Salas e Checklists',
    items: [
      { name: 'Checklist de Salas', href: '/rooms/checklists', icon: ClipboardCheck, module: 'rooms' },
      { name: 'Checklist Semestral', href: '/semester', icon: CalendarDays, module: 'rooms' },
      { name: 'Reservas de Salas', href: '/reservations', icon: CalendarDays, module: 'reservations' as Module },
    ],
  },
  {
    key: 'management',
    name: 'Gestão',
    items: [
      { name: 'Uber Corporativo', href: '/admin-module/uber', icon: Car, adminOnly: true },
      { name: 'Processo Seletivo', href: '/admin-module/processo-seletivo', icon: GraduationCap, adminOnly: true },
      { name: 'Relatórios', href: '/reports', icon: BarChart3 },
      { name: 'Histórico', href: '/activity-history', icon: History, module: 'activityHistory' },
    ],
  },
  {
    key: 'administration',
    name: 'Administração',
    items: [
      { name: 'Configurações', href: '/settings', icon: Settings, module: 'settings' },
      { name: 'Administração', href: '/admin-module', icon: ShieldCheck, adminOnly: true },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  onCloseMobile?: () => void;
  pendingTasksCount?: number;
  pendingMaterialsCount?: number;
  pendingCallsCount?: number;
}

export function Sidebar({
  collapsed,
  onToggle,
  isMobile,
  onCloseMobile,
  pendingTasksCount = 0,
  pendingMaterialsCount = 0,
  pendingCallsCount = 0,
}: SidebarProps) {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const { canView } = useUserPermissions();
  const [closedSections, setClosedSections] = useState<string[]>([]);

  const badgeCounts = {
    tasks: pendingTasksCount,
    materials: pendingMaterialsCount,
    calls: pendingCallsCount,
  };

  const visibleSections = useMemo(
    () => sections
      .filter((section) => !section.adminOnly || isAdmin)
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (item.adminOnly && !isAdmin) return false;
          if (item.module && !isAdmin && !canView(item.module)) return false;
          return true;
        }),
      }))
      .filter((section) => section.items.length > 0),
    [canView, isAdmin]
  );

  const handleNavClick = () => {
    if (isMobile) onCloseMobile?.();
  };

  const renderLink = (item: NavItem) => {
    const active = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(`${item.href}/`));
    const badgeCount = item.badge ? badgeCounts[item.badge] : 0;

    const content = (
      <RouterNavLink
        key={item.href}
        to={item.href}
        onClick={handleNavClick}
        className={cn(
          'group relative flex min-h-10 items-center gap-2.5 rounded-lg border border-transparent px-2.5 text-[13px] font-medium text-sidebar-foreground/70 transition-all duration-200',
          'hover:border-sidebar-border/20 hover:bg-sidebar-accent/20 hover:text-sidebar-foreground',
          active && 'border-primary/15 bg-primary/10 text-sidebar-foreground before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-full before:bg-primary',
          collapsed && 'justify-center px-2'
        )}
      >
        <span className={cn('relative flex h-8 w-8 shrink-0 items-center justify-center', active ? 'text-primary' : 'text-sidebar-foreground/60')}>
          <item.icon className="h-[18px] w-[18px] stroke-[1.8]" />
          {collapsed && badgeCount > 0 ? (
            <span className="absolute -right-1 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-destructive-foreground">
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          ) : null}
        </span>
        {!collapsed ? <span className="min-w-0 flex-1 truncate">{item.name}</span> : null}
        {!collapsed && badgeCount > 0 ? (
          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        ) : null}
      </RouterNavLink>
    );

    if (!collapsed) return content;
    return (
      <Tooltip key={item.href}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">{item.name}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen flex-col overflow-hidden border-r border-sidebar-border/30 bg-sidebar shadow-[18px_0_55px_-40px_rgba(90,48,190,.55)] backdrop-blur-xl transition-all duration-200',
          isMobile ? 'w-[min(280px,calc(100vw-24px))]' : collapsed ? 'w-[68px]' : 'w-60'
        )}
      >
        <div className={cn('flex h-[64px] items-center border-b border-sidebar-border/30 px-3', collapsed ? 'justify-center px-2.5' : 'gap-2.5')}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-primary/15 bg-primary/5 shadow-[0_0_24px_-10px_hsl(var(--primary))]">
            <img src={vegSystemLogo} alt="VEG System" className="h-full w-full object-cover" />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <h1 className="text-[13px] font-semibold leading-tight text-sidebar-foreground">VEG System</h1>
              <p className="mt-0.5 text-[10px] text-sidebar-foreground/50">Sistema Integrado</p>
            </div>
          ) : null}
        </div>

        {!isMobile ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            className="absolute -right-2.5 top-[75px] z-50 h-5 w-5 rounded-md border border-sidebar-border/60 bg-sidebar text-sidebar-foreground/60 shadow-sm hover:bg-primary/10 hover:text-primary"
          >
            {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </Button>
        ) : null}

        <nav className={cn('flex-1 overflow-y-auto scrollbar-thin', collapsed ? 'space-y-1 p-2' : 'space-y-1 px-2 py-2')}>
          {renderLink({ name: 'Dashboard', href: '/', icon: LayoutDashboard })}

          <div className={cn('mt-1.5', collapsed && 'mt-2')}>
            {visibleSections.map((section) => {
              const isClosed = closedSections.includes(section.key);
              if (collapsed) {
                return <div key={section.key} className="space-y-0.5">{section.items.map(renderLink)}</div>;
              }

              return (
                <div key={section.key} className="border-t border-sidebar-border/20 pt-1.5 first:border-t-0">
                  <button
                    type="button"
                    onClick={() => setClosedSections((previous) => previous.includes(section.key) ? previous.filter((key) => key !== section.key) : [...previous, section.key])}
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/40 transition hover:bg-sidebar-accent/20 hover:text-sidebar-foreground/70"
                    aria-expanded={!isClosed}
                  >
                    <span>{section.name}</span>
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !isClosed && 'rotate-180')} />
                  </button>
                  {!isClosed ? <div className="space-y-0.5 pb-1">{section.items.map(renderLink)}</div> : null}
                </div>
              );
            })}
          </div>
        </nav>

        <div className={cn('border-t border-sidebar-border/30 bg-sidebar/95', collapsed ? 'p-2' : 'p-2.5')}>
          <div className={cn(collapsed && 'flex justify-center')}>
            <ThemeToggle collapsed={collapsed} />
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
