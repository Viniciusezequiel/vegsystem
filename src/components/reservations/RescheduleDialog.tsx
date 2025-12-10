import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Reservation, useUpdateReservation, useReservations } from '@/hooks/useReservations';
import { useReservationRooms } from '@/hooks/useReservations';
import { useCreateRescheduling } from '@/hooks/useReschedulings';
import { format, parseISO, isSameDay, getDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, Calendar, MapPin, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

interface RescheduleDialogProps {
  reservation: Reservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RescheduleDialog({ reservation, open, onOpenChange }: RescheduleDialogProps) {
  const [newRoomId, setNewRoomId] = useState('');
  const [reason, setReason] = useState('');
  const [applyToRecurring, setApplyToRecurring] = useState(false);
  
  const { data: rooms = [] } = useReservationRooms();
  const { data: allReservations = [] } = useReservations();
  const updateReservation = useUpdateReservation();
  const createRescheduling = useCreateRescheduling();

  useEffect(() => {
    if (reservation) {
      setNewRoomId('');
      setReason('');
      setApplyToRecurring(false);
    }
  }, [reservation]);

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

  const availableRooms = rooms.filter(room => room.id !== reservation.room_id && room.is_active);

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
            <Label>Novo Ambiente</Label>
            <Select value={newRoomId} onValueChange={setNewRoomId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o novo ambiente" />
              </SelectTrigger>
              <SelectContent>
                {availableRooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name} ({room.code}) - {room.campus}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
