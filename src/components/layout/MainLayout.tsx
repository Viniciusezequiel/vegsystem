import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  ClipboardList,
  KeyRound,
  Loader2,
  LogOut,
  Menu,
  Settings,
  X,
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import { OnlineUsersIndicator } from './OnlineUsersIndicator';
import { ImagePrefetchIndicator } from './ImagePrefetchIndicator';
import { LostFoundModernShell } from '@/components/lost-found/LostFoundModernShell';
import { cn } from '@/lib/utils';
import { useGlobalRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { usePendingCallsCount } from '@/hooks/useClassroomCalls';
import { useTaskNotifications } from '@/hooks/useTaskNotifications';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import './dashboard-responsive.css';

interface MainLayoutProps {
  children: ReactNode;
}

function roleLabel(role: string | null) {
  switch (role) {
    case 'admin': return 'Administrador';
    case 'supervisor': return 'Supervisor';
    case 'analista': return 'Analista';
    case 'assistente': return 'Assistente';
    case 'atendente': return 'Atendente';
    case 'visualizador': return 'Visualizador';
    default: return 'Usuário';
  }
}

function initials(name?: string | null) {
  if (!name) return 'U';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function PendingShortcut({
  label,
  value,
  icon,
  onClick,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  onClick: () => void;
}) {
  const hasPending = value > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-9 items-center gap-2 rounded-xl border px-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        hasPending
          ? 'border-primary/20 bg-primary/[0.07] hover:border-primary/30 hover:bg-primary/[0.11]'
          : 'border-border/35 bg-card/35 hover:border-border/60 hover:bg-card/55'
      )}
      aria-label={`${label}: ${value} pendência${value === 1 ? '' : 's'}`}
    >
      <span className={cn('shrink-0', hasPending ? 'text-primary' : 'text-muted-foreground/70')}>
        {icon}
      </span>
      <span className="hidden text-[10px] font-medium text-muted-foreground xl:inline">{label}</span>
      <span
        className={cn(
          'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums',
          hasPending ? 'bg-primary/15 text-primary' : 'bg-muted/35 text-muted-foreground'
        )}
      >
        {value > 99 ? '99+' : value}
      </span>
    </button>
  );
}

export function MainLayout({ children }: MainLayoutProps) {
  useGlobalRealtimeSubscription();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, role, isAdmin, signOut } = useAuth();
  const { pendingTasksCount = 0 } = useTaskNotifications();
  const { data: pendingCallsCount = 0 } = usePendingCallsCount();

  const topBarRef = useRef<HTMLDivElement | null>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    return stored === 'true';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const totalPending = pendingTasksCount + pendingCallsCount;

  const isLostFoundItemsPage =
    location.pathname === '/lost-found' || location.pathname === '/lost-found/items';

  useLayoutEffect(() => {
    const el = topBarRef.current;
    if (!el) return;

    const setTopbarHeightVar = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--app-topbar-height', `${h}px`);
    };

    setTopbarHeightVar();
    const ro = new ResizeObserver(setTopbarHeightVar);
    ro.observe(el);
    window.addEventListener('resize', setTopbarHeightVar);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', setTopbarHeightVar);
    };
  }, []);

  useEffect(() => {
    if (!isMobile && mobileMenuOpen) setMobileMenuOpen(false);
  }, [isMobile, mobileMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname.startsWith('/labels')) {
      navigate('/', { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (!isMobile || !mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile, mobileMenuOpen]);

  const handleToggleSidebar = () => {
    if (isMobile) {
      setMobileMenuOpen((previous) => !previous);
      return;
    }

    setSidebarCollapsed((previous) => {
      const next = !previous;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
      navigate('/admin-auth');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -right-64 -top-72 h-[560px] w-[560px] rounded-full bg-primary/[0.055] blur-3xl" />
        <div className="absolute left-[28%] top-[12%] h-[420px] w-[420px] rounded-full bg-cyan-500/[0.018] blur-3xl" />
        <div className="absolute inset-0 mesh-gradient opacity-[0.11]" />
      </div>

      {isMobile && mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] xl:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div
        className={cn(
          'xl:block',
          isMobile && !mobileMenuOpen && 'hidden',
          isMobile && mobileMenuOpen && 'block'
        )}
      >
        <Sidebar
          collapsed={isMobile ? false : sidebarCollapsed}
          onToggle={handleToggleSidebar}
          isMobile={isMobile}
          onCloseMobile={() => setMobileMenuOpen(false)}
          pendingTasksCount={pendingTasksCount}
          pendingCallsCount={pendingCallsCount}
        />
      </div>

      <main
        className={cn(
          'relative z-10 min-h-screen min-w-0 transition-all duration-300',
          !isMobile && (sidebarCollapsed ? 'xl:ml-[68px]' : 'xl:ml-60'),
          'ml-0'
        )}
      >
        <div
          ref={topBarRef}
          className={cn(
            'fixed left-0 right-0 top-0 z-20 h-[64px] border-b border-border/30 bg-background/90 px-3 backdrop-blur-xl transition-all duration-200 sm:px-4 xl:px-6',
            !isMobile && (sidebarCollapsed ? 'xl:left-[68px]' : 'xl:left-60')
          )}
        >
          <div className="mx-auto flex h-full max-w-[1560px] items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 xl:hidden"
              onClick={handleToggleSidebar}
              aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="flex h-9 items-center gap-2 rounded-xl border border-border/35 bg-card/35 px-3 text-xs font-medium text-foreground/80 transition hover:border-primary/20 hover:bg-card/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 lg:hidden"
                aria-label={`Resumo operacional: ${totalPending} pendências`}
              >
                <Bell className={cn('h-4 w-4', totalPending > 0 ? 'text-primary' : 'text-muted-foreground')} />
                <span>Pendências</span>
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums', totalPending > 0 ? 'bg-primary/15 text-primary' : 'bg-muted/40 text-muted-foreground')}>
                  {totalPending > 99 ? '99+' : totalPending}
                </span>
              </button>

              <div className="hidden min-w-0 items-center gap-2 lg:flex">
                <div className="mr-1 hidden min-w-0 2xl:block">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">Atenção do dia</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Pendências que pedem ação</p>
                </div>
                <PendingShortcut
                  label="Demandas"
                  value={pendingTasksCount}
                  icon={<ClipboardList className="h-4 w-4" />}
                  onClick={() => navigate('/tasks/my-tasks')}
                />
                <PendingShortcut
                  label="Chamados"
                  value={pendingCallsCount}
                  icon={<Bell className="h-4 w-4" />}
                  onClick={() => navigate('/classroom-calls')}
                />
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2.5">
              <div className="hidden lg:block">
                <OnlineUsersIndicator />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2.5 rounded-xl border border-border/40 bg-card/50 px-2 py-1.5 text-left transition hover:border-primary/25 hover:bg-card/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 data-[state=open]:border-primary/25 data-[state=open]:bg-card/65"
                    aria-label="Abrir menu do perfil"
                  >
                    <Avatar className="h-8 w-8 ring-1 ring-primary/25">
                      <AvatarImage src={profile?.avatar_url || ''} alt={profile?.full_name || 'Usuário'} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-[11px] font-bold text-primary-foreground">
                        {initials(profile?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden min-w-0 md:block">
                      <p className="max-w-[180px] truncate text-[11px] font-semibold leading-tight text-foreground/90">
                        {profile?.full_name || 'Usuário'}
                      </p>
                      <p className="mt-0.5 text-[9px] leading-tight text-muted-foreground">{roleLabel(role)}</p>
                    </div>
                    <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground/70 md:block" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" sideOffset={8} className="w-[min(340px,calc(100vw-24px))] rounded-xl border-border/60 bg-popover/95 p-1.5 shadow-2xl backdrop-blur-xl">
                  <DropdownMenuLabel className="p-3 font-normal">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 shrink-0 ring-1 ring-primary/20">
                        <AvatarImage src={profile?.avatar_url || ''} alt={profile?.full_name || 'Usuário'} />
                        <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary">
                          {initials(profile?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{profile?.full_name || 'Usuário'}</p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{user?.email || 'E-mail não informado'}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded-md border border-primary/15 bg-primary/[0.07] px-2 py-1 text-[9px] font-medium text-primary">
                            {roleLabel(role)}
                          </span>
                          {profile?.position ? (
                            <span className="max-w-full truncate rounded-md border border-border/40 bg-muted/20 px-2 py-1 text-[9px] text-muted-foreground">
                              {profile.position}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {profile?.department ? (
                      <div className="mt-3 rounded-lg border border-border/35 bg-background/25 px-3 py-2">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">Setor</p>
                        <p className="mt-0.5 truncate text-[11px] font-medium text-foreground/80">{profile.department}</p>
                      </div>
                    ) : null}
                  </DropdownMenuLabel>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onSelect={() => navigate('/change-password')}
                    className="cursor-pointer rounded-lg px-3 py-2.5 text-xs"
                  >
                    <KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />
                    Alterar senha
                  </DropdownMenuItem>

                  {isAdmin ? (
                    <DropdownMenuItem
                      onSelect={() => navigate('/settings')}
                      className="cursor-pointer rounded-lg px-3 py-2.5 text-xs"
                    >
                      <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                      Configurações do sistema
                    </DropdownMenuItem>
                  ) : null}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    disabled={isSigningOut}
                    onSelect={() => void handleSignOut()}
                    className="cursor-pointer rounded-lg px-3 py-2.5 text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                    {isSigningOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                    {isSigningOut ? 'Saindo...' : 'Sair do sistema'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div
          className={cn(
            'mx-auto min-w-0 max-w-[1560px] overflow-x-hidden p-3 sm:p-4 xl:px-6 xl:pb-6',
            location.pathname === '/' && 'dashboard-route'
          )}
          style={{ paddingTop: 'calc(var(--app-topbar-height, 64px) + 1rem)' }}
        >
          {isLostFoundItemsPage ? (
            <LostFoundModernShell>{children}</LostFoundModernShell>
          ) : (
            children
          )}
        </div>

        <ImagePrefetchIndicator />
      </main>
    </div>
  );
}