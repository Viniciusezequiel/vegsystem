import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CalendarDays,
  Home,
  Loader2,
  LogOut,
  Plus,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface ExternalUserRow {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  approval_status?: string;
  rejection_reason?: string | null;
}

export default function PortalLayout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [externalUser, setExternalUser] = useState<ExternalUserRow | null>(null);
  const [status, setStatus] = useState<'approved' | 'pending' | 'rejected' | 'missing' | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/portal-cliente/login');
        return;
      }

      const { data, error } = await supabase
        .from('external_users')
        .select('id, user_id, full_name, email, approval_status, rejection_reason')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error || !data) {
        setStatus('missing');
        setLoading(false);
        return;
      }

      const row = data as unknown as ExternalUserRow;
      setExternalUser(row);
      const approval = row.approval_status || 'pending';

      if (approval === 'approved') {
        setStatus('approved');
      } else if (approval === 'rejected') {
        setStatus('rejected');
        setRejectionReason(row.rejection_reason || null);
      } else {
        setStatus('pending');
      }

      setLoading(false);
    };

    void check();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate('/portal-cliente/login');
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Você saiu da sua conta.');
    navigate('/portal-cliente/login');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-card/70 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <p className="text-xs">Carregando seu acesso...</p>
        </div>
      </div>
    );
  }

  if (status !== 'approved') {
    const statusCopy = status === 'pending'
      ? {
          title: 'Cadastro em análise',
          description: 'Seu cadastro foi recebido e está aguardando aprovação da nossa equipe. Assim que for liberado, o portal ficará disponível para você.',
        }
      : status === 'rejected'
        ? {
            title: 'Cadastro não aprovado',
            description: 'Seu acesso não foi liberado neste momento. Consulte o motivo abaixo ou entre em contato com a equipe responsável.',
          }
        : {
            title: 'Cadastro incompleto',
            description: 'Não encontramos um cadastro externo vinculado à sua conta. Complete seus dados para continuar.',
          };

    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/8 to-transparent" />
        <Card className="relative w-full max-w-md border-border/60 bg-card/85 shadow-xl shadow-black/5 backdrop-blur">
          <CardContent className="p-6 sm:p-7">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <AlertCircle className="h-5 w-5" />
            </div>

            <div className="mt-5 text-center">
              <h2 className="text-xl font-semibold tracking-tight">{statusCopy.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{statusCopy.description}</p>
            </div>

            {status === 'rejected' && rejectionReason && (
              <div className="mt-5 rounded-xl border border-border/60 bg-muted/30 p-4 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Motivo informado</p>
                <p className="mt-1.5 leading-relaxed text-foreground">{rejectionReason}</p>
              </div>
            )}

            <div className="mt-6 space-y-2">
              {status === 'missing' && (
                <Button className="w-full" onClick={() => navigate('/portal-cliente/cadastro')}>
                  Completar cadastro
                </Button>
              )}
              <Button variant="outline" className="w-full" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const navItems = [
    { to: '/portal-cliente/dashboard', label: 'Início', icon: Home },
    { to: '/portal-cliente/nova-reserva', label: 'Nova reserva', icon: Plus },
    { to: '/portal-cliente/minhas-reservas', label: 'Minhas reservas', icon: CalendarDays },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/portal-cliente/dashboard" className="group flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
              <CalendarDays className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">Portal do Cliente</p>
              <p className="hidden truncate text-[11px] text-muted-foreground sm:block">Reservas de salas e acompanhamento</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden max-w-[220px] items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground md:flex">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{externalUser?.full_name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-1.5 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>

        <nav className="border-t border-border/40 bg-muted/15">
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `relative flex shrink-0 items-center gap-2 px-3 py-3 text-sm transition-colors ${
                      isActive
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : ''}`} />
                      {item.label}
                      {isActive && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" />}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
        <Outlet context={{ externalUser }} />
      </main>
    </div>
  );
}

export type PortalOutletContext = { externalUser: ExternalUserRow };
