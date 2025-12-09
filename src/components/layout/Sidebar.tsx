import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

interface NavGroup {
  name: string;
  icon: React.ElementType;
  items: NavItem[];
  basePath: string;
  gradient?: string;
}

const mainNav: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
];

const moduleGroups: NavGroup[] = [
  {
    name: 'Achados e Perdidos',
    icon: Package,
    basePath: '/lost-found',
    gradient: 'from-purple-500 to-pink-500',
    items: [
      { name: 'Registrar Item', href: '/lost-found/register', icon: PackagePlus },
      { name: 'Buscar Itens', href: '/lost-found/items', icon: Search },
      { name: 'Histórico', href: '/lost-found/history', icon: History },
    ],
  },
  {
    name: 'Equipamentos',
    icon: Monitor,
    basePath: '/equipment',
    gradient: 'from-cyan-500 to-blue-500',
    items: [
      { name: 'Inventário', href: '/equipment', icon: Monitor },
      { name: 'Empréstimos', href: '/equipment/loans', icon: PackagePlus },
    ],
  },
  {
    name: 'Checklist de Salas',
    icon: ClipboardCheck,
    basePath: '/rooms',
    gradient: 'from-green-500 to-emerald-500',
    items: [
      { name: 'Salas', href: '/rooms', icon: ClipboardCheck },
      { name: 'Checklists', href: '/rooms/checklists', icon: Search },
    ],
  },
  {
    name: 'Escaninhos',
    icon: Lock,
    basePath: '/lockers',
    gradient: 'from-orange-500 to-amber-500',
    items: [
      { name: 'Escaninhos', href: '/lockers', icon: Lock },
      { name: 'Alocações', href: '/lockers/loans', icon: Users },
    ],
  },
];

const bottomNav: NavItem[] = [
  { name: 'Usuários', href: '/users', icon: Users, adminOnly: true },
  { name: 'Configurações', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut, isAdmin } = useAuth();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    const currentGroup = moduleGroups.find(group => 
      location.pathname.startsWith(group.basePath)
    );
    return currentGroup ? [currentGroup.basePath] : [];
  });

  const toggleGroup = (basePath: string) => {
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
      navigate('/auth');
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
      case 'collaborator': return 'Colaborador';
      case 'viewer': return 'Visualizador';
      default: return 'Usuário';
    }
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar flex flex-col z-50 border-r border-sidebar-border/50">
      {/* Logo */}
      <div className="p-5 border-b border-sidebar-border/50">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-sidebar-foreground text-sm leading-tight">Setor Recursos</h1>
            <p className="text-xs text-sidebar-foreground/50">Sistema Integrado</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
        {/* Main Nav */}
        {mainNav.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={cn(
                'sidebar-link',
                isActive && 'sidebar-link-active'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                isActive ? 'gradient-primary shadow-glow' : 'bg-sidebar-accent'
              )}>
                <item.icon className={cn('w-4 h-4', isActive ? 'text-primary-foreground' : 'text-sidebar-foreground/70')} />
              </div>
              <span className="font-medium">{item.name}</span>
            </NavLink>
          );
        })}

        <div className="pt-5 pb-2">
          <span className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest px-3">
            Módulos
          </span>
        </div>

        {/* Module Groups */}
        {moduleGroups.map((group) => {
          const isGroupActive = location.pathname.startsWith(group.basePath);
          const isOpen = openGroups.includes(group.basePath);

          return (
            <Collapsible 
              key={group.basePath} 
              open={isOpen}
              onOpenChange={() => toggleGroup(group.basePath)}
            >
              <CollapsibleTrigger className={cn(
                'sidebar-link w-full justify-between',
                isGroupActive && 'text-primary'
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                    isGroupActive ? `bg-gradient-to-r ${group.gradient} shadow-lg` : 'bg-sidebar-accent'
                  )}>
                    <group.icon className={cn('w-4 h-4', isGroupActive ? 'text-white' : 'text-sidebar-foreground/70')} />
                  </div>
                  <span className="font-medium text-sm">{group.name}</span>
                </div>
                <ChevronDown className={cn(
                  'w-4 h-4 transition-transform duration-300',
                  isOpen && 'rotate-180'
                )} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-5 space-y-1 pt-1 animate-accordion-down">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      className={cn(
                        'sidebar-link text-sm py-2',
                        isActive && 'sidebar-link-active'
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </NavLink>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          );
        })}

        <div className="pt-5 pb-2">
          <span className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest px-3">
            Sistema
          </span>
        </div>

        {/* Bottom Nav */}
        {bottomNav.map((item) => {
          if (item.adminOnly && !isAdmin) return null;
          const isActive = location.pathname === item.href;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={cn(
                'sidebar-link',
                isActive && 'sidebar-link-active'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                isActive ? 'gradient-primary shadow-glow' : 'bg-sidebar-accent'
              )}>
                <item.icon className={cn('w-4 h-4', isActive ? 'text-primary-foreground' : 'text-sidebar-foreground/70')} />
              </div>
              <span className="font-medium">{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-sidebar-border/50">
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
      </div>
    </aside>
  );
}
