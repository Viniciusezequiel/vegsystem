import { useEffect, useState } from 'react';
import { useNavigate, NavLink, Outlet, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarDays, Home, LogOut, Plus, User, Loader2, AlertCircle } from 'lucide-react';

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

    check();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate('/portal-cliente/login');
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Você saiu da sua conta.');
    navigate('/portal-cliente/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status !== 'approved') {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
            {status === 'pending' && (
              <>
                <h2 className="text-xl font-bold">Cadastro em análise</h2>
                <p className="text-muted-foreground text-sm">
                  Seu cadastro foi recebido e está aguardando aprovação da nossa equipe.
                  Você receberá um aviso assim que for liberado.
                </p>
              </>
            )}
            {status === 'rejected' && (
              <>
                <h2 className="text-xl font-bold">Cadastro não aprovado</h2>
                <p className="text-muted-foreground text-sm">
                  Infelizmente seu cadastro não foi aprovado.
                </p>
                {rejectionReason && (
                  <p className="text-sm text-foreground bg-muted p-3 rounded">
                    <strong>Motivo:</strong> {rejectionReason}
                  </p>
                )}
              </>
            )}
            {status === 'missing' && (
              <>
                <h2 className="text-xl font-bold">Cadastro incompleto</h2>
                <p className="text-muted-foreground text-sm">
                  Não encontramos seu cadastro. Por favor, complete-o.
                </p>
                <Button onClick={() => navigate('/portal-cliente/cadastro')}>Completar cadastro</Button>
              </>
            )}
            <Button variant="outline" className="w-full" onClick={handleLogout}>Sair</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const navItems = [
    { to: '/portal-cliente/dashboard', label: 'Início', icon: Home },
    { to: '/portal-cliente/nova-reserva', label: 'Nova Reserva', icon: Plus },
    { to: '/portal-cliente/minhas-reservas', label: 'Minhas Reservas', icon: CalendarDays },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/portal-cliente/dashboard" className="font-bold text-lg">
            Portal do Cliente
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              {externalUser?.full_name}
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" /> Sair
            </Button>
          </div>
        </div>
        <nav className="border-t bg-muted/40">
          <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? 'border-primary text-primary font-medium'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" /> {item.label}
                </NavLink>
              );
            })}
          </div>
        </nav>
      </header>
      <main className="max-w-6xl mx-auto p-4">
        <Outlet context={{ externalUser }} />
      </main>
    </div>
  );
}

export type PortalOutletContext = { externalUser: ExternalUserRow };
