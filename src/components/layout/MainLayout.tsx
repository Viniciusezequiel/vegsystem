import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Menu, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { OnlineUsersIndicator } from './OnlineUsersIndicator';
import { ImagePrefetchIndicator } from './ImagePrefetchIndicator';
import { cn } from '@/lib/utils';
import { useGlobalRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';

interface MainLayoutProps {
  children: ReactNode;
}

const SEARCH_TARGETS = [
  { terms: ['dashboard', 'inicio', 'início'], path: '/' },
  { terms: ['demanda', 'demandas', 'tarefas'], path: '/tasks/my-tasks' },
  { terms: ['achados', 'perdidos', 'achados e perdidos'], path: '/lost-found/items' },
  { terms: ['equipamento', 'equipamentos', 'patrimonio', 'patrimônio'], path: '/equipment' },
  { terms: ['emprestimo', 'empréstimo', 'emprestimos', 'empréstimos'], path: '/equipment/loans' },
  { terms: ['escaninho', 'escaninhos'], path: '/lockers' },
  { terms: ['material', 'materiais'], path: '/materials/my-requests' },
  { terms: ['chamado', 'chamados', 'chamados de sala'], path: '/classroom-calls' },
  { terms: ['checklist', 'checklists', 'salas'], path: '/rooms/checklists' },
  { terms: ['semestral', 'checklist semestral'], path: '/semester' },
  { terms: ['processo seletivo', 'processo'], path: '/admin-module/processo-seletivo' },
  { terms: ['etiqueta', 'etiquetas'], path: '/labels' },
  { terms: ['relatorio', 'relatório', 'relatorios', 'relatórios'], path: '/reports' },
  { terms: ['historico', 'histórico', 'atividade', 'atividades'], path: '/activity-history' },
  { terms: ['configuracao', 'configuração', 'configuracoes', 'configurações'], path: '/settings' },
  { terms: ['saude do sistema', 'saúde do sistema'], path: '/admin-module/system-health' },
];

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function roleLabel(role: string | null) {
  switch (role) {
    case 'admin': return 'Administrador';
    case 'supervisor': return 'Supervisor';
    case 'analista': return 'Analista';
    case 'assistente': return 'Assistente';
    case 'atendente': return 'Atendente';
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

export function MainLayout({ children }: MainLayoutProps) {
  useGlobalRealtimeSubscription();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role } = useAuth();

  const topBarRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    return stored === 'true';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

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
    if (!isMobile || !mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile, mobileMenuOpen]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

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

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = normalizeSearch(searchValue);
    if (!query) return;

    const target = SEARCH_TARGETS.find(({ terms }) =>
      terms.some((term) => {
        const normalizedTerm = normalizeSearch(term);
        return normalizedTerm.includes(query) || query.includes(normalizedTerm);
      })
    );

    if (target) {
      navigate(target.path);
      setSearchValue('');
      searchInputRef.current?.blur();
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

            <form onSubmit={handleSearch} className="hidden min-w-0 flex-1 sm:block sm:max-w-[560px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                <input
                  ref={searchInputRef}
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Pesquisar módulos no sistema..."
                  aria-label="Pesquisar módulos"
                  className="h-9 w-full rounded-xl border border-border/50 bg-card/50 pl-9 pr-16 text-xs text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/30 focus:bg-card/60 focus:ring-2 focus:ring-primary/10"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-border/40 bg-background/30 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                  Ctrl + K
                </span>
              </div>
            </form>

            <div className="ml-auto flex items-center gap-2.5">
              <div className="hidden lg:block">
                <OnlineUsersIndicator />
              </div>

              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="flex items-center gap-2.5 rounded-xl border border-border/40 bg-card/50 px-2 py-1.5 text-left transition hover:border-primary/25 hover:bg-card/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label="Abrir configurações do perfil"
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
              </button>
            </div>
          </div>
        </div>

        <div
          className="mx-auto min-w-0 max-w-[1560px] overflow-x-hidden p-3 sm:p-4 xl:px-6 xl:pb-6"
          style={{ paddingTop: 'calc(var(--app-topbar-height, 64px) + 1rem)' }}
        >
          {children}
        </div>

        <ImagePrefetchIndicator />
      </main>
    </div>
  );
}
