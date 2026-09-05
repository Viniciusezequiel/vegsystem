import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { format, isAfter, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, CalendarDays, CheckCircle2, Clock, MapPin, Plus, TimerReset } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import type { PortalOutletContext } from './PortalLayout';

interface UpcomingRes {
  id: string;
  title: string;
  start_datetime: string;
  end_datetime: string;
  status: string;
  room?: { name: string; code: string; campus: string } | null;
}

export default function PortalDashboard() {
  const { externalUser } = useOutletContext<PortalOutletContext>();
  const [upcoming, setUpcoming] = useState<UpcomingRes[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('reservations')
        .select('id, title, start_datetime, end_datetime, status, room:reservation_rooms!reservations_room_id_fkey(name, code, campus)')
        .eq('requester_email', externalUser.email)
        .order('start_datetime', { ascending: true });

      const all = (data || []) as unknown as UpcomingRes[];
      const future = all.filter(reservation => isAfter(parseISO(reservation.end_datetime), new Date()) && reservation.status !== 'cancelled');
      setUpcoming(future.slice(0, 5));
      setStats({
        total: all.length,
        pending: all.filter(reservation => reservation.status === 'pending').length,
        confirmed: all.filter(reservation => reservation.status === 'confirmed').length,
      });
      setLoading(false);
    };

    void load();
  }, [externalUser.email]);

  const firstName = externalUser.full_name.split(' ')[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight sm:text-[30px]">Olá, {firstName}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Acompanhe suas reservas e crie novas solicitações.</p>
        </div>
        <Button asChild>
          <Link to="/portal-cliente/nova-reserva">
            <Plus className="mr-2 h-4 w-4" />
            Nova reserva
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/60 bg-card/65 shadow-sm">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-xs text-muted-foreground">Total de reservas</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{stats.total}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/65 shadow-sm">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-xs text-muted-foreground">Aguardando aprovação</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{stats.pending}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10 text-warning">
              <TimerReset className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/65 shadow-sm">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-xs text-muted-foreground">Confirmadas</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{stats.confirmed}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/65 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
          <div>
            <CardTitle className="text-base">Próximas reservas</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Suas próximas solicitações ativas, em ordem de data.</p>
          </div>
          <Button variant="ghost" size="sm" asChild className="shrink-0 text-xs">
            <Link to="/portal-cliente/minhas-reservas">Ver todas</Link>
          </Button>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex min-h-[150px] items-center justify-center text-sm text-muted-foreground">Carregando reservas...</div>
          ) : upcoming.length === 0 ? (
            <div className="flex min-h-[170px] flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/15 px-6 text-center">
              <CalendarDays className="mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium">Nenhuma reserva futura</p>
              <p className="mt-1 text-xs text-muted-foreground">Quando você fizer uma nova solicitação, ela aparecerá aqui.</p>
              <Button size="sm" className="mt-4" asChild>
                <Link to="/portal-cliente/nova-reserva"><Plus className="mr-2 h-4 w-4" />Criar reserva</Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {upcoming.map(reservation => (
                <div key={reservation.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{reservation.title}</span>
                      <Badge variant={reservation.status === 'confirmed' ? 'default' : 'secondary'} className="text-[10px]">
                        {reservation.status === 'confirmed' ? 'Confirmada' : reservation.status === 'pending' ? 'Pendente' : reservation.status}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{reservation.room?.name || 'Sala a definir'}</span>
                      <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{format(parseISO(reservation.start_datetime), 'dd/MM/yyyy', { locale: ptBR })}</span>
                      <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{format(parseISO(reservation.start_datetime), 'HH:mm')} – {format(parseISO(reservation.end_datetime), 'HH:mm')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 sm:hidden">
        <Button variant="outline" className="w-full" asChild>
          <Link to="/portal-cliente/minhas-reservas">
            <CalendarDays className="mr-2 h-4 w-4" />
            Minhas reservas
          </Link>
        </Button>
      </div>
    </div>
  );
}
