import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, MapPin, Users, Check, Search } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useFindAvailableRooms, useRescheduleReservation, type RoomReservation, type AvailableRoom } from '@/hooks/useRoomReservations';
import type { Database } from '@/integrations/supabase/types';

type CampusEnum = Database['public']['Enums']['campus_enum'];
const campusOptions: CampusEnum[] = ['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm'];

interface RescheduleDialogProps {
  reservation: RoomReservation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RescheduleDialog({ reservation, open, onOpenChange }: RescheduleDialogProps) {
  const reschedule = useRescheduleReservation();

  // Parse existing datetime
  const existingStart = new Date(reservation.start_datetime);
  const existingEnd = new Date(reservation.end_datetime);
  const dateStr = existingStart.toISOString().split('T')[0];
  const startTime = existingStart.toTimeString().slice(0, 5);
  const endTime = existingEnd.toTimeString().slice(0, 5);

  const [params, setParams] = useState({
    date: dateStr,
    start_time: startTime,
    end_time: endTime,
    campus: '' as CampusEnum | '',
  });
  const [selectedRoom, setSelectedRoom] = useState<AvailableRoom | null>(null);
  const [reason, setReason] = useState('');

  const canSearch = params.date && params.start_time && params.end_time;
  const startDt = canSearch ? `${params.date}T${params.start_time}:00` : '';
  const endDt = canSearch ? `${params.date}T${params.end_time}:00` : '';

  const { data: rooms, isLoading, refetch } = useFindAvailableRooms({
    startDatetime: startDt,
    endDatetime: endDt,
    attendeesCount: reservation.attendees_count,
    campus: params.campus || undefined,
    enabled: false,
  });

  const handleSearch = () => {
    if (canSearch) refetch();
  };

  const handleConfirm = async () => {
    if (!selectedRoom) return;
    await reschedule.mutateAsync({
      reservationId: reservation.id,
      newRoomId: selectedRoom.id,
      newStartDatetime: startDt,
      newEndDatetime: endDt,
      originalRoomId: reservation.room_id,
      originalStartDatetime: reservation.start_datetime,
      originalEndDatetime: reservation.end_datetime,
      reason: reason || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Remanejar Reserva</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current info */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="font-medium">{reservation.title}</p>
            <p className="text-muted-foreground">
              Sala atual: {reservation.room?.name} ({reservation.room?.code}) • {reservation.room?.campus}
            </p>
          </div>

          {/* New datetime */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Nova Data</Label>
              <Input
                type="date"
                value={params.date}
                onChange={e => setParams(p => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div>
              <Label>Início</Label>
              <Input
                type="time"
                value={params.start_time}
                onChange={e => setParams(p => ({ ...p, start_time: e.target.value }))}
              />
            </div>
            <div>
              <Label>Término</Label>
              <Input
                type="time"
                value={params.end_time}
                onChange={e => setParams(p => ({ ...p, end_time: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-xs">
              <Label>Campus (opcional)</Label>
              <Select value={params.campus} onValueChange={v => setParams(p => ({ ...p, campus: v as CampusEnum }))}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {campusOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSearch} disabled={isLoading || !canSearch} size="sm">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
              Buscar
            </Button>
          </div>

          {/* Results */}
          {rooms !== undefined && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {rooms.length > 0 ? `${rooms.length} sala(s) disponível(is)` : 'Nenhuma sala disponível'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {rooms.map(room => (
                  <Card
                    key={room.id}
                    className={`cursor-pointer transition-colors ${selectedRoom?.id === room.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                    onClick={() => setSelectedRoom(room)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{room.name} ({room.code})</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" /> {room.capacity}
                            {room.location && <><MapPin className="h-3 w-3 ml-2" /> {room.location}</>}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{room.campus}</Badge>
                      </div>
                      {selectedRoom?.id === room.id && (
                        <Badge className="mt-2 text-[10px]"><Check className="h-3 w-3 mr-1" />Selecionada</Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label>Motivo do remanejamento</Label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Motivo (opcional)"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!selectedRoom || reschedule.isPending}>
            {reschedule.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar Remanejamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
