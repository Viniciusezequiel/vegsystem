import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, Plus, CalendarDays } from 'lucide-react';
import { format, parseISO, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
      const future = all.filter(r => isAfter(parseISO(r.end_datetime), new Date()) && r.status !== 'cancelled');
      setUpcoming(future.slice(0, 5));
      setStats({
        total: all.length,
        pending: all.filter(r => r.status === 'pending').length,
        confirmed: all.filter(r => r.status === 'confirmed').length,
      });
      setLoading(false);
    };
    load();
  }, [externalUser.email]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Olá, {externalUser.full_name.split(' ')[0]}! 👋</h1>
        <p className="text-muted-foreground">Bem-vindo ao seu portal de reservas.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total de reservas</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Aguardando aprovação</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Confirmadas</p>
            <p className="text-2xl font-bold text-primary">{stats.confirmed}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/portal-cliente/nova-reserva"><Plus className="h-4 w-4 mr-2" /> Nova reserva</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/portal-cliente/minhas-reservas"><CalendarDays className="h-4 w-4 mr-2" /> Minhas reservas</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Próximas reservas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : upcoming.length === 0 ? (
            <p className="text-muted-foreground text-sm">Você não tem reservas futuras. Que tal criar uma?</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{r.title}</span>
                      <Badge variant={r.status === 'confirmed' ? 'default' : 'secondary'} className="text-[10px]">
                        {r.status === 'confirmed' ? 'Confirmada' : r.status === 'pending' ? 'Pendente' : r.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {r.room?.name}</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(parseISO(r.start_datetime), 'dd/MM/yyyy', { locale: ptBR })}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(parseISO(r.start_datetime), 'HH:mm')} - {format(parseISO(r.end_datetime), 'HH:mm')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
