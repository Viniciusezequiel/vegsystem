import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Calendar, Clock, MapPin, X, ArrowRightLeft, Loader2 } from 'lucide-react';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import type { PortalOutletContext } from './PortalLayout';

interface MyRes {
  id: string;
  title: string;
  start_datetime: string;
  end_datetime: string;
  status: string;
  description: string | null;
  notes: string | null;
  room_id: string;
  attendees_count: number;
  room?: { name: string; code: string; campus: string } | null;
}

export default function PortalMyReservations() {
  const navigate = useNavigate();
  const { externalUser } = useOutletContext<PortalOutletContext>();
  const [reservations, setReservations] = useState<MyRes[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescheduling, setRescheduling] = useState<MyRes | null>(null);
  const [reschedForm, setReschedForm] = useState({ date: '', start_time: '', end_time: '' });
  const [submittingResched, setSubmittingResched] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reservations')
      .select('id, title, start_datetime, end_datetime, status, description, notes, room_id, attendees_count, room:reservation_rooms!reservations_room_id_fkey(name, code, campus)')
      .eq('requester_email', externalUser.email)
      .order('start_datetime', { ascending: false });

    if (error) toast.error('Erro ao carregar reservas');
    setReservations((data || []) as unknown as MyRes[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [externalUser.email]);

  const now = new Date();
  const futureRes = reservations.filter(r => isAfter(parseISO(r.end_datetime), now) && r.status !== 'cancelled');
  const pastRes = reservations.filter(r => isBefore(parseISO(r.end_datetime), now) && r.status !== 'cancelled');
  const cancelledRes = reservations.filter(r => r.status === 'cancelled');

  const handleCancel = async (id: string) => {
    const { error } = await supabase
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', id);
    if (error) toast.error('Erro ao cancelar');
    else { toast.success('Reserva cancelada'); load(); }
  };

  const openReschedule = (r: MyRes) => {
    const start = parseISO(r.start_datetime);
    const end = parseISO(r.end_datetime);
    setRescheduling(r);
    setReschedForm({
      date: format(start, 'yyyy-MM-dd'),
      start_time: format(start, 'HH:mm'),
      end_time: format(end, 'HH:mm'),
    });
  };

  const submitReschedule = async () => {
    if (!rescheduling) return;
    if (!reschedForm.date || !reschedForm.start_time || !reschedForm.end_time) {
      return toast.error('Preencha todos os campos.');
    }
    const newStart = `${reschedForm.date}T${reschedForm.start_time}:00`;
    const newEnd = `${reschedForm.date}T${reschedForm.end_time}:00`;
    if (newEnd <= newStart) return toast.error('Término deve ser após início.');

    setSubmittingResched(true);
    try {
      // Check conflict for the new date/time
      const { data: hasConflict } = await supabase.rpc('check_reservation_conflict', {
        p_room_id: rescheduling.room_id,
        p_start_datetime: newStart,
        p_end_datetime: newEnd,
        p_exclude_reservation_id: rescheduling.id,
        p_is_external: true,
      });
      if (hasConflict) throw new Error('Conflito de horário nessa sala.');

      // Cancel old + create new pending linked
      const { error: cancelErr } = await supabase
        .from('reservations')
        .update({ status: 'cancelled', notes: `${rescheduling.notes || ''}\n[Remarcada pelo cliente]`.trim() })
        .eq('id', rescheduling.id);
      if (cancelErr) throw cancelErr;

      const { error: insertErr } = await supabase.from('reservations').insert({
        title: rescheduling.title,
        description: rescheduling.description,
        room_id: rescheduling.room_id,
        start_datetime: newStart,
        end_datetime: newEnd,
        attendees_count: rescheduling.attendees_count,
        requester_name: externalUser.full_name,
        requester_email: externalUser.email,
        status: 'pending',
        is_external: true,
        external_user_id: externalUser.id,
        notes: '[Remarcação do cliente]',
        original_reservation_id: rescheduling.id,
      } as never);
      if (insertErr) throw insertErr;

      toast.success('Remarcação enviada! Aguarde a aprovação.');
      setRescheduling(null);
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao remarcar';
      toast.error(msg);
    } finally {
      setSubmittingResched(false);
    }
  };

  const renderCard = (r: MyRes, opts?: { actions?: boolean }) => {
    const statusLabel: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'Pendente', variant: 'secondary' },
      confirmed: { label: 'Confirmada', variant: 'default' },
      cancelled: { label: 'Cancelada', variant: 'destructive' },
      completed: { label: 'Concluída', variant: 'outline' },
    };
    const st = statusLabel[r.status] || { label: r.status, variant: 'outline' as const };

    return (
      <Card key={r.id}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold">{r.title}</h3>
                <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
              </div>
              <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{r.room?.name} ({r.room?.code}) • {r.room?.campus}</span>
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(parseISO(r.start_datetime), 'dd/MM/yyyy', { locale: ptBR })}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(parseISO(r.start_datetime), 'HH:mm')} - {format(parseISO(r.end_datetime), 'HH:mm')}</span>
              </div>
              {r.description && <p className="text-xs mt-2 text-muted-foreground">{r.description}</p>}
            </div>
            {opts?.actions && (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => openReschedule(r)}>
                  <ArrowRightLeft className="h-3 w-3 mr-1" /> Remarcar
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-destructive">
                      <X className="h-3 w-3 mr-1" /> Cancelar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar reserva?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Essa ação cancela a reserva. Você poderá criar uma nova se precisar.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleCancel(r.id)}>Sim, cancelar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Minhas Reservas</h1>
          <p className="text-sm text-muted-foreground">Acompanhe e gerencie suas reservas</p>
        </div>
        <Button onClick={() => navigate('/portal-cliente/nova-reserva')}>Nova Reserva</Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : (
        <Tabs defaultValue="future">
          <TabsList>
            <TabsTrigger value="future">Futuras ({futureRes.length})</TabsTrigger>
            <TabsTrigger value="past">Passadas ({pastRes.length})</TabsTrigger>
            <TabsTrigger value="cancelled">Canceladas ({cancelledRes.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="future" className="space-y-2 mt-3">
            {futureRes.length === 0
              ? <p className="text-muted-foreground text-sm py-4">Você não tem reservas futuras.</p>
              : futureRes.map(r => renderCard(r, { actions: true }))}
          </TabsContent>
          <TabsContent value="past" className="space-y-2 mt-3">
            {pastRes.length === 0
              ? <p className="text-muted-foreground text-sm py-4">Sem reservas anteriores.</p>
              : pastRes.map(r => renderCard(r))}
          </TabsContent>
          <TabsContent value="cancelled" className="space-y-2 mt-3">
            {cancelledRes.length === 0
              ? <p className="text-muted-foreground text-sm py-4">Nenhuma reserva cancelada.</p>
              : cancelledRes.map(r => renderCard(r))}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!rescheduling} onOpenChange={v => { if (!v) setRescheduling(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remarcar reserva</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sala: <strong>{rescheduling?.room?.name}</strong>. A reserva atual será cancelada e uma nova ficará pendente de aprovação.
            </p>
            <div>
              <Label>Nova data</Label>
              <Input type="date" min={new Date().toISOString().split('T')[0]}
                value={reschedForm.date}
                onChange={e => setReschedForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input type="time" value={reschedForm.start_time}
                  onChange={e => setReschedForm(f => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div>
                <Label>Término</Label>
                <Input type="time" value={reschedForm.end_time}
                  onChange={e => setReschedForm(f => ({ ...f, end_time: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduling(null)}>Voltar</Button>
            <Button onClick={submitReschedule} disabled={submittingResched}>
              {submittingResched && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar remarcação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
