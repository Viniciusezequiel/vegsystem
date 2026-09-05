import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { format, isAfter, isBefore, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRightLeft, Calendar, Clock, Loader2, MapPin, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
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

  useEffect(() => {
    void load();
  }, [externalUser.email]);

  const now = new Date();
  const futureRes = reservations.filter(reservation => isAfter(parseISO(reservation.end_datetime), now) && reservation.status !== 'cancelled');
  const pastRes = reservations.filter(reservation => isBefore(parseISO(reservation.end_datetime), now) && reservation.status !== 'cancelled');
  const cancelledRes = reservations.filter(reservation => reservation.status === 'cancelled');

  const handleCancel = async (id: string) => {
    const { error } = await supabase.from('reservations').update({ status: 'cancelled' }).eq('id', id);
    if (error) toast.error('Erro ao cancelar');
    else {
      toast.success('Reserva cancelada');
      void load();
    }
  };

  const openReschedule = (reservation: MyRes) => {
    const start = parseISO(reservation.start_datetime);
    const end = parseISO(reservation.end_datetime);
    setRescheduling(reservation);
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
      const { data: hasConflict } = await supabase.rpc('check_reservation_conflict', {
        p_room_id: rescheduling.room_id,
        p_start_datetime: newStart,
        p_end_datetime: newEnd,
        p_exclude_reservation_id: rescheduling.id,
        p_is_external: true,
      });
      if (hasConflict) throw new Error('Conflito de horário nessa sala.');

      const { error: cancelError } = await supabase
        .from('reservations')
        .update({ status: 'cancelled', notes: `${rescheduling.notes || ''}\n[Remarcada pelo cliente]`.trim() })
        .eq('id', rescheduling.id);
      if (cancelError) throw cancelError;

      const { error: insertError } = await supabase.from('reservations').insert({
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
      if (insertError) throw insertError;

      toast.success('Remarcação enviada! Aguarde a aprovação.');
      setRescheduling(null);
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remarcar');
    } finally {
      setSubmittingResched(false);
    }
  };

  const renderCard = (reservation: MyRes, options?: { actions?: boolean }) => {
    const statusLabel: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'Pendente', variant: 'secondary' },
      confirmed: { label: 'Confirmada', variant: 'default' },
      cancelled: { label: 'Cancelada', variant: 'destructive' },
      completed: { label: 'Concluída', variant: 'outline' },
    };
    const status = statusLabel[reservation.status] || { label: reservation.status, variant: 'outline' as const };

    return (
      <Card key={reservation.id} className="border-border/60 bg-card/65 shadow-sm transition-colors hover:bg-card/80">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-sm font-semibold">{reservation.title}</h3>
                <Badge variant={status.variant} className="text-[10px]">{status.label}</Badge>
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {reservation.room?.name || 'Sala a definir'}{reservation.room?.code ? ` (${reservation.room.code})` : ''}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(parseISO(reservation.start_datetime), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {format(parseISO(reservation.start_datetime), 'HH:mm')} – {format(parseISO(reservation.end_datetime), 'HH:mm')}
                </span>
              </div>

              {reservation.room?.campus && <p className="mt-1 text-[11px] text-muted-foreground">{reservation.room.campus}</p>}
              {reservation.description && <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{reservation.description}</p>}
            </div>

            {options?.actions && (
              <div className="flex shrink-0 flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={() => openReschedule(reservation)}>
                  <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
                  Remarcar
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      Cancelar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar reserva?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Essa ação cancela a reserva selecionada. Você poderá fazer uma nova solicitação depois.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void handleCancel(reservation.id)}>Sim, cancelar</AlertDialogAction>
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

  const emptyState = (message: string) => (
    <div className="rounded-xl border border-dashed border-border/60 bg-card/35 px-6 py-10 text-center">
      <Calendar className="mx-auto h-8 w-8 text-muted-foreground/45" />
      <p className="mt-3 text-sm font-medium">{message}</p>
      <p className="mt-1 text-xs text-muted-foreground">As reservas correspondentes aparecerão aqui.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight sm:text-[30px]">Minhas reservas</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Acompanhe solicitações, remarcações e histórico.</p>
        </div>
        <Button onClick={() => navigate('/portal-cliente/nova-reserva')}>
          <Plus className="mr-2 h-4 w-4" />
          Nova reserva
        </Button>
      </div>

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/35 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Carregando reservas...
        </div>
      ) : (
        <Tabs defaultValue="future" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl border border-border/60 bg-muted/25 p-1 sm:w-[440px]">
            <TabsTrigger value="future">Futuras ({futureRes.length})</TabsTrigger>
            <TabsTrigger value="past">Passadas ({pastRes.length})</TabsTrigger>
            <TabsTrigger value="cancelled">Canceladas ({cancelledRes.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="future" className="mt-0 space-y-2.5">
            {futureRes.length === 0 ? emptyState('Você não tem reservas futuras') : futureRes.map(reservation => renderCard(reservation, { actions: true }))}
          </TabsContent>
          <TabsContent value="past" className="mt-0 space-y-2.5">
            {pastRes.length === 0 ? emptyState('Sem reservas anteriores') : pastRes.map(reservation => renderCard(reservation))}
          </TabsContent>
          <TabsContent value="cancelled" className="mt-0 space-y-2.5">
            {cancelledRes.length === 0 ? emptyState('Nenhuma reserva cancelada') : cancelledRes.map(reservation => renderCard(reservation))}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!rescheduling} onOpenChange={open => { if (!open) setRescheduling(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remarcar reserva</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-muted/25 px-4 py-3 text-sm">
              <p className="font-medium">{rescheduling?.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Sala: {rescheduling?.room?.name || 'não informada'}. A reserva atual será cancelada e a nova ficará pendente de aprovação.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nova data</Label>
              <Input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={reschedForm.date}
                onChange={event => setReschedForm(current => ({ ...current, date: event.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Início</Label>
                <Input type="time" value={reschedForm.start_time} onChange={event => setReschedForm(current => ({ ...current, start_time: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Término</Label>
                <Input type="time" value={reschedForm.end_time} onChange={event => setReschedForm(current => ({ ...current, end_time: event.target.value }))} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduling(null)}>Voltar</Button>
            <Button onClick={() => void submitReschedule()} disabled={submittingResched}>
              {submittingResched && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar remarcação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
