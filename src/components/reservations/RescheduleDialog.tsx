import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Reservation, useUpdateReservation, useReservations, useFindAvailableRooms, ReservationRoom } from '@/hooks/useReservations';
import { useReservationRooms } from '@/hooks/useReservations';
import { useCreateRescheduling } from '@/hooks/useReschedulings';
import { format, parseISO, isSameDay, getDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, Calendar, MapPin, AlertTriangle, Loader2, RefreshCw, CheckCircle2, Users } from 'lucide-react';

interface RescheduleDialogProps {
  reservation: Reservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RescheduleDialog({ reservation, open, onOpenChange }: RescheduleDialogProps) {
  const [newRoomId, setNewRoomId] = useState('');
  const [reason, setReason] = useState('');
  const [applyToRecurring, setApplyToRecurring] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<ReservationRoom[]>([]);
  
  const { data: rooms = [] } = useReservationRooms();
  const { data: allReservations = [] } = useReservations();
  const updateReservation = useUpdateReservation();
  const createRescheduling = useCreateRescheduling();
  const findAvailableRooms = useFindAvailableRooms();

  useEffect(() => {
    if (reservation && open) {
      setNewRoomId('');
      setReason('');
      setApplyToRecurring(false);
      
      // Fetch available rooms for the reservation's date/time
      findAvailableRooms.mutate(
        {
          start_datetime: reservation.start_datetime,
          end_datetime: reservation.end_datetime,
          attendees_count: reservation.attendees_count || 1,
        },
        {
          onSuccess: (data) => {
            // Filter out the current room
            const filtered = data.filter(room => room.id !== reservation.room_id);
            setAvailableRooms(filtered);
          },
        }
      );
    }
  }, [reservation, open]);

  if (!reservation) return null;

  const isRecurring = reservation.is_fixed;
  
  // Find recurring reservations (same title, same time, same weekday)
  const getRecurringReservations = () => {
    if (!isRecurring) return [];
    
    const reservationDate = parseISO(reservation.start_datetime);
    const weekday = getDay(reservationDate);
    const startTime = format(reservationDate, 'HH:mm');
    const endTime = format(parseISO(reservation.end_datetime), 'HH:mm');
    
    return allReservations.filter(r => {
      if (r.id === reservation.id) return false;
      if (!r.is_fixed) return false;
      if (r.title !== reservation.title) return false;
      if (r.room_id !== reservation.room_id) return false;
      
      const rDate = parseISO(r.start_datetime);
      const rWeekday = getDay(rDate);
      const rStartTime = format(rDate, 'HH:mm');
      const rEndTime = format(parseISO(r.end_datetime), 'HH:mm');
      
      return rWeekday === weekday && rStartTime === startTime && rEndTime === endTime;
    });
  };

  const recurringReservations = getRecurringReservations();
  const affectedCount = applyToRecurring ? recurringReservations.length + 1 : 1;

  const handleReschedule = async () => {
    if (!newRoomId) return;

    const reservationsToUpdate = applyToRecurring 
      ? [reservation, ...recurringReservations] 
      : [reservation];

    try {
      // Create rescheduling record
      await createRescheduling.mutateAsync({
        reservation_id: reservation.id,
        original_room_id: reservation.room_id,
        new_room_id: newRoomId,
        original_start_datetime: reservation.start_datetime,
        original_end_datetime: reservation.end_datetime,
        new_start_datetime: reservation.start_datetime,
        new_end_datetime: reservation.end_datetime,
        reason: reason || undefined,
        is_recurring_update: applyToRecurring,
        affected_reservations_count: affectedCount,
      });

      // Update all affected reservations
      for (const res of reservationsToUpdate) {
        await updateReservation.mutateAsync({
          id: res.id,
          room_id: newRoomId,
        });
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error rescheduling:', error);
    }
  };

  const isPending = createRescheduling.isPending || updateReservation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            Remanejar Aula
          </DialogTitle>
          <DialogDescription>
            Selecione um novo ambiente para esta reserva.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Info */}
          <div className="glass-card rounded-lg p-4 space-y-2">
            <div className="text-sm text-muted-foreground">Reserva atual</div>
            <div className="font-semibold">{reservation.title}</div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-primary" />
              <span>{reservation.reservation_rooms?.name} ({reservation.reservation_rooms?.code})</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>
                {format(parseISO(reservation.start_datetime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
          </div>

          {/* Arrow indicator */}
          <div className="flex justify-center">
            <ArrowRight className="w-6 h-6 text-primary" />
          </div>

          {/* New Room Selection */}
          <div className="space-y-2">
            <Label>Novo Ambiente (disponíveis para este horário)</Label>
            {findAvailableRooms.isPending ? (
              <div className="flex items-center justify-center py-4 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Buscando salas disponíveis...
              </div>
            ) : availableRooms.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground bg-muted/30 rounded-lg">
                Nenhuma sala disponível para este horário
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {availableRooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => setNewRoomId(room.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                      newRoomId === room.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className={`w-4 h-4 ${newRoomId === room.id ? 'text-primary' : 'text-success'}`} />
                      <div>
                        <span className="font-medium text-foreground">{room.name}</span>
                        <span className="text-xs text-primary font-mono ml-1">({room.code})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="w-3 h-3" />
                      {room.capacity}
                      <span className="ml-2">{room.campus}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Motivo do Remanejamento (opcional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Informe o motivo do remanejamento..."
              rows={2}
            />
          </div>

          {/* Recurring option */}
          {isRecurring && recurringReservations.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="space-y-3">
                <p>
                  Esta é uma reserva fixa recorrente. Foram encontradas{' '}
                  <strong>{recurringReservations.length}</strong> outras reservas similares.
                </p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="applyToRecurring"
                    checked={applyToRecurring}
                    onCheckedChange={(checked) => setApplyToRecurring(checked === true)}
                  />
                  <label htmlFor="applyToRecurring" className="text-sm cursor-pointer">
                    Aplicar remanejamento a todas as reservas recorrentes ({affectedCount} no total)
                  </label>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleReschedule}
              className="flex-1 gap-2"
              disabled={!newRoomId || isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Remanejando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Remanejar {affectedCount > 1 ? `(${affectedCount})` : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
