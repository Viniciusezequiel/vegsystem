import { NavLink as RouterNavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  PackagePlus,
  Search,
  History,
  Users,
  Settings,
  LogOut,
  Monitor,
  ClipboardCheck,
  Lock,
  ChevronDown,
  Loader2,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  CalendarDays,
  ShoppingCart,
  RefreshCw,
  Bell,
  Shield,
  FileText,
  Tag,
  Upload,
  Car,
  ShieldCheck,
  GraduationCap,

} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePendingCallsCount } from '@/hooks/useClassroomCalls';
import { useTaskNotifications } from '@/hooks/useTaskNotifications';
import { useMaterialNotifications } from '@/hooks/useMaterialNotifications';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions, type Module } from '@/hooks/usePermissions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState, createContext, useContext, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from './ThemeToggle';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import vegSystemLogo from '@/assets/veg-system-logo.png';
import { prefetchLostItemsOnHover } from '@/hooks/useLostItemsGlobalPrefetch';

interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({ collapsed: false, setCollapsed: () => {} });

export const useSidebarCollapse = () => useContext(SidebarContext);

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  hasBadge?: boolean;
  module?: Module;
}

interface NavGroup {
  name: string;
  icon: React.ElementType;
  items: NavItem[];
  basePath: string;
  gradient?: string;
  adminOnly?: boolean;
  module?: Module; // Maps to permission module
}

interface NavSection {
  key: string;
  name: string;
  groups?: NavGroup[];
  items?: NavItem[];
  adminOnly?: boolean;
}

const mainNav: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
];

const moduleGroups: NavGroup[] = [
  {
    name: 'Demandas',
    icon: ClipboardCheck,
    basePath: '/tasks',
    gradient: 'from-teal-500 to-cyan-500',
    module: 'tasks',
    items: [
      { name: 'Gestão de Demandas', href: '/tasks', icon: ClipboardCheck, adminOnly: true },
      { name: 'Minhas Demandas', href: '/tasks/my-tasks', icon: ClipboardCheck, hasBadge: true },
      { name: 'Dashboard', href: '/tasks/dashboard', icon: BarChart3, adminOnly: true },
    ],
  },
  {
    name: 'Achados e Perdidos',
    icon: Package,
    basePath: '/lost-found',
    gradient: 'from-purple-500 to-pink-500',
    module: 'lostAndFound',
    items: [
      { name: 'Registrar Item', href: '/lost-found/register', icon: PackagePlus },
      { name: 'Buscar Itens', href: '/lost-found/items', icon: Search },
    ],
  },
  {
    name: 'Equipamentos',
    icon: Monitor,
    basePath: '/equipment',
    gradient: 'from-cyan-500 to-blue-500',
    module: 'equipment',
    items: [
      { name: 'Patrimônios', href: '/equipment', icon: Package },
      { name: 'Empréstimos', href: '/equipment/loans', icon: PackagePlus },
    ],
  },
  {
    name: 'Checklist de Salas',
    icon: ClipboardCheck,
    basePath: '/rooms',
    gradient: 'from-green-500 to-emerald-500',
    module: 'rooms',
    items: [
      { name: 'Novo Checklist', href: '/rooms/checklist/new', icon: ClipboardCheck },
      { name: 'Checklists', href: '/rooms/checklists', icon: Search },
      { name: 'Passagem de Plantão', href: '/rooms/shift-handovers', icon: RefreshCw },
      { name: 'Gestão de Salas', href: '/rooms', icon: ClipboardCheck, adminOnly: true },
    ],
  },
  {
    name: 'Checklist Semestral',
    icon: CalendarDays,
    basePath: '/semester',
    gradient: 'from-teal-500 to-green-600',
    module: 'rooms',
    items: [
      { name: 'Checklists Semestrais', href: '/semester', icon: ClipboardCheck },
      { name: 'Competências', href: '/semester/competencies', icon: Settings, adminOnly: true },
      { name: 'Etiquetas (Pimaco A4365)', href: '/semester/labels', icon: Tag },
    ],
  },
  {
    name: 'Escaninhos',
    icon: Lock,
    basePath: '/lockers',
    gradient: 'from-orange-500 to-amber-500',
    module: 'lockers',
    items: [
      { name: 'Escaninhos', href: '/lockers', icon: Lock },
      { name: 'Alocações', href: '/lockers/loans', icon: Users },
    ],
  },
  {
    name: 'Gestão de Salas',
    icon: CalendarDays,
    basePath: '/reservations',
    gradient: 'from-indigo-500 to-violet-500',
    module: 'reservations' as Module,
    items: [
      { name: 'Reservas', href: '/reservations', icon: CalendarDays },
      { name: 'Nova Reserva', href: '/reservations/new', icon: PackagePlus },
      { name: 'Cadastro de Salas', href: '/reservations/rooms', icon: Settings, adminOnly: true },
    ],
  },
  {
    name: 'Materiais',
    icon: ShoppingCart,
    basePath: '/materials',
    gradient: 'from-rose-500 to-pink-500',
    module: 'materials',
    items: [
      { name: 'Minhas Solicitações', href: '/materials/my-requests', icon: FileText, hasBadge: true },
      { name: 'Nova Solicitação', href: '/materials/new', icon: PackagePlus },
      { name: 'Gestão de Solicitações', href: '/materials', icon: ShoppingCart, adminOnly: true },
    ],
  },
  {
    name: 'Chamados de Sala',
    icon: Bell,
    basePath: '/classroom-calls',
    gradient: 'from-red-500 to-orange-500',
    module: 'classroomCalls',
    items: [
      { name: 'Chamados', href: '/classroom-calls', icon: Bell },
      { name: 'Configurações', href: '/classroom-calls/settings', icon: Settings, adminOnly: true },
    ],
  },
];

const managementNav: NavItem[] = [
  { name: 'Uber Corporativo', href: '/admin-module/uber', icon: Car, adminOnly: true },
  { name: 'Processo Seletivo', href: '/admin-module/processo-seletivo', icon: GraduationCap, adminOnly: true },
  { name: 'Etiquetas', href: '/labels', icon: Tag, adminOnly: true },
  { name: 'Aprovações', href: '/external-users-approval', icon: Users, adminOnly: true },
  { name: 'Relatórios', href: '/reports', icon: BarChart3 },
  { name: 'Histórico', href: '/activity-history', icon: History, module: 'activityHistory' },
];

const administrationNav: NavItem[] = [
  { name: 'Configurações', href: '/settings', icon: Settings, module: 'settings' },
  { name: 'Administração', href: '/admin-module', icon: ShieldCheck, adminOnly: true },
];

const navSections: NavSection[] = [
  {
    key: 'operation',
    name: 'Operação',
    groups: moduleGroups.filter(group => ['Demandas', 'Achados e Perdidos', 'Equipamentos', 'Chamados de Sala', 'Escaninhos', 'Materiais'].includes(group.name)),
  },
  {
    key: 'rooms',
    name: 'Salas e Checklists',
    groups: moduleGroups.filter(group => ['Gestão de Salas', 'Checklist de Salas', 'Checklist Semestral'].includes(group.name)),
  },
  { key: 'management', name: 'Gestão', items: managementNav },
  { key: 'administration', name: 'Administração', items: administrationNav },
  { key: 'system', name: 'Sistema', items: [], adminOnly: true },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ collapsed, onToggle, isMobile, onCloseMobile }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, role, signOut, isAdmin } = useAuth();
  const { canView } = useUserPermissions();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { data: pendingCallsCount } = usePendingCallsCount();
  const { pendingTasksCount } = useTaskNotifications();
  const { pendingMaterialsCount } = useMaterialNotifications();
  
  // Prefetch lost items on hover
  const handleLostItemsHover = useCallback(() => {
    prefetchLostItemsOnHover(queryClient);
  }, [queryClient]);

  const isGroupVisible = (group: NavGroup) => {
    if (group.adminOnly && !isAdmin) return false;
    if (!group.module || isAdmin) return true;
    return canView(group.module);
  };

  const isItemVisible = (item: NavItem) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.module && !isAdmin && !canView(item.module)) return false;
    return true;
  };

  const visibleSections = navSections
    .filter(section => !section.adminOnly || isAdmin)
    .map(section => ({
      ...section,
      groups: (section.groups ?? []).filter(isGroupVisible),
      items: (section.items ?? []).filter(isItemVisible),
    }))
    .filter(section => section.key === 'system' || section.groups.length > 0 || section.items.length > 0);

  const routeCandidates = visibleSections.flatMap(section => [
    ...section.groups.map(group => ({ sectionKey: section.key, path: group.basePath })),
    ...section.items.map(item => ({ sectionKey: section.key, path: item.href })),
  ]).filter(candidate => location.pathname === candidate.path || location.pathname.startsWith(`${candidate.path}/`));
  const activeSectionKey = routeCandidates.sort((a, b) => b.path.length - a.path.length)[0]?.sectionKey;

  // Close mobile menu on navigation
  const handleNavClick = () => {
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };
  
  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    const currentGroup = moduleGroups.find(group => 
      location.pathname.startsWith(group.basePath)
    );
    return currentGroup ? [currentGroup.basePath] : [];
  });

  const [openSections, setOpenSections] = useState<string[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('sidebar-open-sections') || '[]');
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!activeSectionKey) return;
    setOpenSections(prev => prev.includes(activeSectionKey) ? prev : [...prev, activeSectionKey]);
  }, [activeSectionKey]);

  useEffect(() => {
    const currentGroup = moduleGroups.find(group => location.pathname.startsWith(group.basePath));
    if (!currentGroup) return;
    setOpenGroups(prev => prev.includes(currentGroup.basePath) ? prev : [...prev, currentGroup.basePath]);
  }, [location.pathname]);

  const toggleSection = (sectionKey: string) => {
    if (collapsed) return;
    setOpenSections(prev => {
      const next = prev.includes(sectionKey) ? prev.filter(key => key !== sectionKey) : [...prev, sectionKey];
      localStorage.setItem('sidebar-open-sections', JSON.stringify(next));
      return next;
    });
  };

  const toggleGroup = (basePath: string) => {
    if (collapsed) return;
    setOpenGroups(prev => 
      prev.includes(basePath) 
        ? prev.filter(p => p !== basePath)
        : [...prev, basePath]
    );
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      toast({
        title: 'Logout realizado',
        description: 'Você foi desconectado do sistema.',
      });
      navigate('/admin-auth');
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível fazer logout.',
        variant: 'destructive',
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'supervisor': return 'Supervisor';
      case 'analista': return 'Analista';
      case 'assistente': return 'Assistente';
      case 'atendente': return 'Atendente de Chamados';
      default: return 'Usuário';
    }
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const NavItemContent = ({ item, isActive }: { item: NavItem; isActive: boolean }) => (
    <>
      <div className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0',
        isActive ? 'gradient-primary shadow-glow' : 'bg-sidebar-accent'
      )}>
        <item.icon className={cn('w-4 h-4', isActive ? 'text-primary-foreground' : 'text-sidebar-foreground/70')} />
      </div>
      {!collapsed && <span className="font-medium truncate">{item.name}</span>}
    </>
  );

  const renderSimpleItem = (item: NavItem) => {
    const isActive = location.pathname === item.href;
    const link = (
      <RouterNavLink
        to={item.href}
        onClick={handleNavClick}
        className={cn('sidebar-link', isActive && 'sidebar-link-active', collapsed && 'justify-center px-2')}
      >
        <NavItemContent item={item} isActive={isActive} />
      </RouterNavLink>
    );

    return collapsed ? (
      <Tooltip key={item.href}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.name}</TooltipContent>
      </Tooltip>
    ) : <div key={item.href}>{link}</div>;
  };

  const renderModuleGroup = (group: NavGroup) => {
    const isGroupActive = location.pathname.startsWith(group.basePath);
    const isOpen = openGroups.includes(group.basePath) && !collapsed;

    if (collapsed) {
      return (
        <Tooltip key={group.basePath}>
          <TooltipTrigger asChild>
            <RouterNavLink
              to={group.items[0].href}
              onClick={handleNavClick}
              className={cn('sidebar-link justify-center px-2', isGroupActive && 'sidebar-link-active')}
            >
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center transition-all relative',
                isGroupActive ? `bg-gradient-to-r ${group.gradient} shadow-lg` : 'bg-sidebar-accent'
              )}>
                <group.icon className={cn('w-4 h-4', isGroupActive ? 'text-white' : 'text-sidebar-foreground/70')} />
                {group.basePath === '/classroom-calls' && pendingCallsCount !== undefined && pendingCallsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {pendingCallsCount > 9 ? '9+' : pendingCallsCount}
                  </span>
                )}
              </div>
            </RouterNavLink>
          </TooltipTrigger>
          <TooltipContent side="right">{group.name}</TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Collapsible
        key={group.basePath}
        open={isOpen}
        onOpenChange={() => toggleGroup(group.basePath)}
        onMouseEnter={group.basePath === '/lost-found' ? handleLostItemsHover : undefined}
      >
        <CollapsibleTrigger className={cn('sidebar-link w-full justify-between', isGroupActive && 'text-primary')}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-all relative shrink-0',
              isGroupActive ? `bg-gradient-to-r ${group.gradient} shadow-lg` : 'bg-sidebar-accent'
            )}>
              <group.icon className={cn('w-4 h-4', isGroupActive ? 'text-white' : 'text-sidebar-foreground/70')} />
              {group.basePath === '/classroom-calls' && pendingCallsCount !== undefined && pendingCallsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {pendingCallsCount > 9 ? '9+' : pendingCallsCount}
                </span>
              )}
            </div>
            <span className="font-medium text-sm whitespace-normal leading-tight text-left">{group.name}</span>
          </div>
          <ChevronDown className={cn('w-4 h-4 transition-transform duration-200 shrink-0', isOpen && 'rotate-180')} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-5 space-y-1 pt-1 animate-accordion-down">
          {group.items.filter(item => !item.adminOnly || isAdmin).map(item => {
            const isActive = location.pathname === item.href;
            const badgeCount = item.hasBadge
              ? (group.basePath === '/materials' ? pendingMaterialsCount : pendingTasksCount)
              : 0;
            const showBadge = item.hasBadge && badgeCount && badgeCount > 0;
            return (
              <RouterNavLink
                key={item.href}
                to={item.href}
                onClick={handleNavClick}
                className={cn('sidebar-link text-sm py-2', isActive && 'sidebar-link-active')}
              >
                <div className="relative shrink-0">
                  <item.icon className="w-4 h-4" />
                  {showBadge && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary text-primary-foreground text-[8px] font-bold rounded-full flex items-center justify-center">
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                  )}
                </div>
                <span className="whitespace-normal leading-tight">{item.name}</span>
                {showBadge && (
                  <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badgeCount}</span>
                )}
              </RouterNavLink>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside className={cn(
        'fixed left-0 top-0 h-screen bg-sidebar flex flex-col z-50 border-r border-sidebar-border/50 transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}>
        {/* Logo */}
        <div className={cn('p-4 border-b border-sidebar-border/50', collapsed && 'p-3')}>
        <div className="flex items-center gap-3">
            <div className={cn(
              'rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-sidebar-border/30',
              collapsed ? 'w-10 h-10' : 'w-11 h-11'
            )}>
              <img src={vegSystemLogo} alt="VEG System" className="w-full h-full object-cover" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="font-bold text-sidebar-foreground text-sm leading-tight">VEG System</h1>
                <p className="text-xs text-sidebar-foreground/50">Sistema Integrado</p>
              </div>
            )}
          </div>
        </div>

        {/* Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border shadow-md hover:bg-sidebar-accent z-50"
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronLeft className="w-3 h-3" />
          )}
        </Button>

        {/* Navigation */}
        <nav className={cn(
          'flex-1 space-y-1 overflow-y-auto scrollbar-thin',
          collapsed ? 'p-2' : 'p-3'
        )}>
          {/* Main Nav */}
          {mainNav.map((item) => {
            const isActive = location.pathname === item.href;
            const link = (
              <RouterNavLink
                key={item.name}
                to={item.href}
                onClick={handleNavClick}
                className={cn(
                  'sidebar-link',
                  isActive && 'sidebar-link-active',
                  collapsed && 'justify-center px-2'
                )}
              >
                <NavItemContent item={item} isActive={isActive} />
              </RouterNavLink>
            );

            return collapsed ? (
              <Tooltip key={item.name}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.name}</TooltipContent>
              </Tooltip>
            ) : link;
          })}

          {collapsed && <div className="h-4" />}

          {visibleSections.map(section => {
            const isSectionOpen = openSections.includes(section.key) && !collapsed;
            const isSectionActive = activeSectionKey === section.key;

            if (collapsed) {
              return (
                <div key={section.key} className="space-y-1">
                  {section.groups.map(renderModuleGroup)}
                  {section.items.map(renderSimpleItem)}
                </div>
              );
            }

            return (
              <Collapsible
                key={section.key}
                open={isSectionOpen}
                onOpenChange={() => toggleSection(section.key)}
                className="pt-2"
                data-testid={`sidebar-section-${section.key}`}
              >
                <CollapsibleTrigger
                  aria-label={`${isSectionOpen ? 'Recolher' : 'Expandir'} ${section.name}`}
                  className={cn(
                    'w-full flex items-center justify-between rounded-md px-3 py-2 text-[10px] font-semibold uppercase tracking-widest transition-colors duration-200',
                    isSectionActive ? 'text-primary bg-sidebar-accent/40' : 'text-sidebar-foreground/45 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/25'
                  )}
                >
                  <span>{section.name}</span>
                  <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', isSectionOpen && 'rotate-180')} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pt-1 animate-accordion-down">
                  {section.groups.map(renderModuleGroup)}
                  {section.items.map(renderSimpleItem)}
                  {section.key === 'system' && (
                    <p className="px-3 py-2 text-xs text-sidebar-foreground/35">Reservado para recursos técnicos.</p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>

        {/* Theme Toggle & User */}
        <div className={cn('border-t border-sidebar-border/50', collapsed ? 'p-2' : 'p-4')}>
          {/* Theme Toggle */}
          <div className={cn('mb-3', collapsed && 'flex justify-center')}>
            <ThemeToggle collapsed={collapsed} />
          </div>

          {/* User */}
          {!collapsed ? (
            <>
              <div className="flex items-center gap-3 mb-3 p-2 rounded-xl bg-sidebar-accent/50">
                <Avatar className="w-10 h-10 ring-2 ring-primary/30">
                  <AvatarImage src={profile?.avatar_url || ''} alt={profile?.full_name || ''} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold text-sm">
                    {getInitials(profile?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-sidebar-foreground truncate">
                    {profile?.full_name || 'Usuário'}
                  </p>
                  <p className="text-xs text-primary capitalize font-medium">
                    {getRoleLabel(role)}
                  </p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="sidebar-link w-full text-destructive/80 hover:text-destructive hover:bg-destructive/10 disabled:opacity-50 justify-center"
              >
                {isLoggingOut ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                <span className="text-sm">{isLoggingOut ? 'Saindo...' : 'Sair do Sistema'}</span>
              </button>
            </>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  aria-label="Sair do Sistema"
                  className="sidebar-link w-full text-destructive/80 hover:text-destructive hover:bg-destructive/10 disabled:opacity-50 justify-center px-2"
                >
                  {isLoggingOut ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Sair do Sistema</TooltipContent>
            </Tooltip>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
