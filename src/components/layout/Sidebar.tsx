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
import { useState, createContext, useContext, useCallback } from 'react';
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
  module?: Module; // Maps to permission module
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
      { name: 'Novo Checklist Semestral', href: '/semester/new', icon: PackagePlus },
      { name: 'Competências', href: '/semester/competencies', icon: Settings, adminOnly: true },
      { name: 'Dashboard', href: '/semester/dashboard', icon: BarChart3 },
      { name: 'Resumo p/ Chamados', href: '/semester/summary', icon: FileText },
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
  {
    name: 'Etiquetas',
    icon: Tag,
    basePath: '/labels',
    gradient: 'from-fuchsia-500 to-purple-500',
    items: [
      { name: 'Modelos', href: '/labels', icon: Tag },
      { name: 'Novo Modelo', href: '/labels/new', icon: PackagePlus },
    ],
  },
];

const bottomNav: NavItem[] = [
  { name: 'Relatórios', href: '/reports', icon: BarChart3 },
  { name: 'Histórico de Atividades', href: '/activity-history', icon: History, module: 'activityHistory' },
  { name: 'Usuários', href: '/users', icon: Users, adminOnly: true, module: 'users' },
  { name: 'Aprovação de Clientes', href: '/external-users-approval', icon: Users, adminOnly: true },
  { name: 'Permissões', href: '/permissions', icon: Shield, adminOnly: true },
  { name: 'Configurações', href: '/settings', icon: Settings, module: 'settings' },
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

  // Filter module groups based on view permissions
  const visibleModuleGroups = moduleGroups.filter(group => {
    if (!group.module) return true; // No module restriction
    if (isAdmin) return true; // Admin sees everything
    return canView(group.module);
  });

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

          {!collapsed && (
            <div className="pt-5 pb-2">
              <span className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest px-3">
                Módulos
              </span>
            </div>
          )}

          {collapsed && <div className="h-4" />}

          {/* Module Groups */}
          {visibleModuleGroups.map((group) => {
            const isGroupActive = location.pathname.startsWith(group.basePath);
            const isOpen = openGroups.includes(group.basePath) && !collapsed;

            if (collapsed) {
              return (
                <Tooltip key={group.basePath}>
                  <TooltipTrigger asChild>
                    <RouterNavLink
                      to={group.items[0].href}
                      onClick={handleNavClick}
                      className={cn(
                        'sidebar-link justify-center px-2',
                        isGroupActive && 'sidebar-link-active'
                      )}
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
                <CollapsibleTrigger className={cn(
                  'sidebar-link w-full justify-between',
                  isGroupActive && 'text-primary'
                )}>
                  <div className="flex items-center gap-3">
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
                    <span className="font-medium text-sm truncate">{group.name}</span>
                  </div>
                  <ChevronDown className={cn(
                    'w-4 h-4 transition-transform duration-300 shrink-0',
                    isOpen && 'rotate-180'
                  )} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-5 space-y-1 pt-1 animate-accordion-down">
                  {group.items
                    .filter(item => !item.adminOnly || isAdmin)
                    .map((item) => {
                    const isActive = location.pathname === item.href;
                    // Determine which notification count to show based on module
                    const badgeCount = item.hasBadge 
                      ? (group.basePath === '/materials' ? pendingMaterialsCount 
                        : pendingTasksCount)
                      : 0;
                    const showBadge = item.hasBadge && badgeCount && badgeCount > 0;
                    return (
                      <RouterNavLink
                        key={item.href}
                        to={item.href}
                        onClick={handleNavClick}
                        className={cn(
                          'sidebar-link text-sm py-2',
                          isActive && 'sidebar-link-active'
                        )}
                      >
                        <div className="relative">
                          <item.icon className="w-4 h-4" />
                          {showBadge && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary text-primary-foreground text-[8px] font-bold rounded-full flex items-center justify-center">
                              {badgeCount > 9 ? '9+' : badgeCount}
                            </span>
                          )}
                        </div>
                        <span className="truncate">{item.name}</span>
                        {showBadge && (
                          <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {badgeCount}
                          </span>
                        )}
                      </RouterNavLink>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })}

          {!collapsed && (
            <div className="pt-5 pb-2">
              <span className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest px-3">
                Sistema
              </span>
            </div>
          )}

          {collapsed && <div className="h-4" />}

          {/* Bottom Nav */}
          {bottomNav.map((item) => {
            // Check adminOnly flag first
            if (item.adminOnly && !isAdmin) return null;
            // Check module permission if specified
            if (item.module && !isAdmin && !canView(item.module)) return null;
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
