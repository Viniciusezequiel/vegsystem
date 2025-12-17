import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Users, MapPin, FileText, AlertCircle, CheckCircle2, Loader2, CalendarDays, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useFindAvailableRooms, useCancelExternalReservation, Reservation, ReservationRoom } from '@/hooks/useReservations';
import { useCreateExternalReservation } from '@/hooks/useExternalReservation';
import { DatePickerInput } from '@/components/ui/DatePickerInput';

interface ExternalReservationDetailsDialogProps {
  reservation: Reservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
  pending: { label: 'Pendente', variant: 'default', color: 'text-yellow-500' },
  confirmed: { label: 'Confirmada', variant: 'secondary', color: 'text-green-500' },
  approved: { label: 'Aprovada', variant: 'secondary', color: 'text-green-500' },
  cancelled: { label: 'Cancelada', variant: 'destructive', color: 'text-red-500' },
  rejected: { label: 'Rejeitada', variant: 'destructive', color: 'text-red-500' },
  completed: { label: 'Concluída', variant: 'outline', color: 'text-gray-500' },
};

export function ExternalReservationDetailsDialog({ 
  reservation, 
  open, 
  onOpenChange 
}: ExternalReservationDetailsDialogProps) {
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({
    date: '',
    start_time: '',
    end_time: '',
  });
  const [selectedRoom, setSelectedRoom] = useState<ReservationRoom | null>(null);
  const [availableRooms, setAvailableRooms] = useState<ReservationRoom[]>([]);
  const [rescheduleStep, setRescheduleStep] = useState<'form' | 'select' | 'success'>('form');
  
  const findRooms = useFindAvailableRooms();
  const createReservation = useCreateExternalReservation();
  const cancelReservation = useCancelExternalReservation();

  if (!reservation) return null;

  const status = statusConfig[reservation.status] || { label: reservation.status, variant: 'default' as const, color: 'text-gray-500' };
  const isPast = new Date(reservation.end_datetime) < new Date();
  const canReschedule = !isPast && ['pending', 'confirmed', 'approved'].includes(reservation.status);
  const canCancel = !isPast && ['pending', 'confirmed'].includes(reservation.status);

  const handleSearchRooms = () => {
    if (!rescheduleData.date || !rescheduleData.start_time || !rescheduleData.end_time) return;

    const start_datetime = `${rescheduleData.date}T${rescheduleData.start_time}:00`;
    const end_datetime = `${rescheduleData.date}T${rescheduleData.end_time}:00`;

    if (new Date(end_datetime) <= new Date(start_datetime)) {
      return;
    }

    findRooms.mutate(
      {
        start_datetime,
        end_datetime,
        attendees_count: reservation.attendees_count,
        is_external: true,
      },
      {
        onSuccess: (rooms) => {
          setAvailableRooms(rooms);
          setRescheduleStep('select');
        },
      }
    );
  };

  const handleReschedule = () => {
    if (!selectedRoom || !rescheduleData.date || !rescheduleData.start_time || !rescheduleData.end_time) return;

    const start_datetime = `${rescheduleData.date}T${rescheduleData.start_time}:00`;
    const end_datetime = `${rescheduleData.date}T${rescheduleData.end_time}:00`;

    createReservation.mutate(
      {
        room_id: selectedRoom.id,
        title: `${reservation.title} (Reagendamento)`,
        requester_name: reservation.requester_name,
        requester_email: reservation.requester_email,
        requester_phone: reservation.requester_phone || undefined,
        attendees_count: reservation.attendees_count,
        start_datetime,
        end_datetime,
        description: reservation.description || undefined,
      },
      {
        onSuccess: () => {
          setRescheduleStep('success');
        },
      }
    );
  };

  const resetReschedule = () => {
    setShowReschedule(false);
    setRescheduleStep('form');
    setRescheduleData({ date: '', start_time: '', end_time: '' });
    setSelectedRoom(null);
    setAvailableRooms([]);
  };

  const handleClose = () => {
    resetReschedule();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Detalhes da Reserva
          </DialogTitle>
          <DialogDescription>
            Informações completas sobre sua reserva
          </DialogDescription>
        </DialogHeader>

        {!showReschedule ? (
          <div className="space-y-6 mt-4">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="w-4 h-4" />
                <span className="text-sm">Título</span>
              </div>
              <p className="font-medium">{reservation.title}</p>
            </div>

            {/* Room */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">Sala</span>
              </div>
              <p className="font-medium">{reservation.reservation_rooms?.name || 'N/A'}</p>
              {reservation.reservation_rooms?.location && (
                <p className="text-sm text-muted-foreground">{reservation.reservation_rooms.location}</p>
              )}
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="w-4 h-4" />
                  <span className="text-sm">Data</span>
                </div>
                <p className="font-medium">
                  {format(parseISO(reservation.start_datetime), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Horário</span>
                </div>
                <p className="font-medium">
                  {format(parseISO(reservation.start_datetime), 'HH:mm')} - {format(parseISO(reservation.end_datetime), 'HH:mm')}
                </p>
              </div>
            </div>

            {/* Attendees */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-4 h-4" />
                <span className="text-sm">Participantes</span>
              </div>
              <p className="font-medium">{reservation.attendees_count} pessoas</p>
            </div>

            {/* Description */}
            {reservation.description && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="w-4 h-4" />
                  <span className="text-sm">Descrição</span>
                </div>
                <p className="text-sm">{reservation.description}</p>
              </div>
            )}

            {/* Notes from admin */}
            {reservation.notes && (
              <div className="space-y-1 p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Observações</span>
                </div>
                <p className="text-sm">{reservation.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Fechar
              </Button>
              {canCancel && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="flex-1">
                      <XCircle className="w-4 h-4 mr-2" />
                      Cancelar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar Reserva</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja cancelar esta reserva? Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          cancelReservation.mutate(
                            { id: reservation.id, requesterEmail: reservation.requester_email },
                            { onSuccess: () => handleClose() }
                          );
                        }}
                        disabled={cancelReservation.isPending}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {cancelReservation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : null}
                        Confirmar Cancelamento
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {canReschedule && (
                <Button onClick={() => setShowReschedule(true)} className="flex-1">
                  <CalendarDays className="w-4 h-4 mr-2" />
                  Reagendar
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {rescheduleStep === 'form' && (
              <>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Reserva original: <strong>{reservation.title}</strong>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(parseISO(reservation.start_datetime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Nova Data *</Label>
                    <DatePickerInput
                      value={rescheduleData.date}
                      onChange={(value) => setRescheduleData({ ...rescheduleData, date: value })}
                      placeholder="Selecionar data"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Início *</Label>
                      <input
                        type="time"
                        value={rescheduleData.start_time}
                        onChange={(e) => setRescheduleData({ ...rescheduleData, start_time: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      />
                    </div>
                    <div>
                      <Label>Término *</Label>
                      <input
                        type="time"
                        value={rescheduleData.end_time}
                        onChange={(e) => setRescheduleData({ ...rescheduleData, end_time: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={resetReschedule} className="flex-1">
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleSearchRooms} 
                    disabled={!rescheduleData.date || !rescheduleData.start_time || !rescheduleData.end_time || findRooms.isPending}
                    className="flex-1"
                  >
                    {findRooms.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Buscar Salas
                  </Button>
                </div>
              </>
            )}

            {rescheduleStep === 'select' && (
              <>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    Nova data: <strong>{format(new Date(rescheduleData.date), 'dd/MM/yyyy', { locale: ptBR })}</strong> das <strong>{rescheduleData.start_time}</strong> às <strong>{rescheduleData.end_time}</strong>
                  </p>
                </div>

                {availableRooms.length === 0 ? (
                  <div className="text-center py-6">
                    <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhuma sala disponível para este horário.</p>
                    <Button variant="outline" onClick={() => setRescheduleStep('form')} className="mt-4">
                      Escolher outro horário
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {availableRooms.map((room) => (
                        <div
                          key={room.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            selectedRoom?.id === room.id 
                              ? 'border-primary bg-primary/10' 
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => setSelectedRoom(room)}
                        >
                          <p className="font-medium">{room.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {room.campus} • Capacidade: {room.capacity}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setRescheduleStep('form')} className="flex-1">
                        Voltar
                      </Button>
                      <Button 
                        onClick={handleReschedule} 
                        disabled={!selectedRoom || createReservation.isPending}
                        className="flex-1"
                      >
                        {createReservation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Confirmar Reagendamento
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}

            {rescheduleStep === 'success' && (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-success" />
                </div>
                <h3 className="text-lg font-bold mb-2">Reagendamento Solicitado!</h3>
                <p className="text-muted-foreground mb-4">
                  Sua nova reserva foi criada e está aguardando aprovação.
                </p>
                <Button onClick={handleClose}>
                  Fechar
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}