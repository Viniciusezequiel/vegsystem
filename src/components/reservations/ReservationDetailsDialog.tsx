import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Reservation, useUpdateReservation } from '@/hooks/useReservations';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, X, Calendar, Clock, Users, Mail, Phone, MapPin, Building } from 'lucide-react';

const statusConfig = {
  pending: { label: 'Pendente', className: 'bg-warning/20 text-warning border-warning/30' },
  confirmed: { label: 'Confirmada', className: 'bg-success/20 text-success border-success/30' },
  cancelled: { label: 'Cancelada', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  completed: { label: 'Concluída', className: 'bg-muted text-muted-foreground border-border' },
};

interface ReservationDetailsDialogProps {
  reservation: Reservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReservationDetailsDialog({ reservation, open, onOpenChange }: ReservationDetailsDialogProps) {
  const updateReservation = useUpdateReservation();

  if (!reservation) return null;

  const handleStatusChange = (status: string) => {
    updateReservation.mutate({ id: reservation.id, status: status as Reservation['status'] }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Detalhes da Reserva
          </DialogTitle>
          <DialogDescription>Informações completas sobre a reserva.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${statusConfig[reservation.status].className} border`}>
              {statusConfig[reservation.status].label}
            </Badge>
            {reservation.is_external && (
              <Badge variant="outline" className="border-accent text-accent">
                Reserva Externa
              </Badge>
            )}
          </div>

          <div className="glass-card rounded-lg p-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Título</label>
              <p className="text-foreground font-semibold text-lg">{reservation.title}</p>
            </div>

            <div className="border-t pt-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ambiente</label>
              <div className="flex items-center gap-2 mt-1">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-foreground font-medium">
                  {reservation.reservation_rooms?.name} ({reservation.reservation_rooms?.code})
                </span>
              </div>
              {reservation.reservation_rooms?.location && (
                <div className="flex items-center gap-2 mt-1 ml-6">
                  <span className="text-sm text-muted-foreground">{reservation.reservation_rooms.location}</span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-1 ml-6">
                <Building className="w-3 h-3 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{reservation.reservation_rooms?.campus}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card rounded-lg p-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Início
              </label>
              <p className="text-foreground font-medium mt-1">
                {format(new Date(reservation.start_datetime), "dd/MM/yyyy", { locale: ptBR })}
              </p>
              <p className="text-primary font-bold">
                {format(new Date(reservation.start_datetime), "HH:mm", { locale: ptBR })}
              </p>
            </div>
            <div className="glass-card rounded-lg p-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Término
              </label>
              <p className="text-foreground font-medium mt-1">
                {format(new Date(reservation.end_datetime), "dd/MM/yyyy", { locale: ptBR })}
              </p>
              <p className="text-primary font-bold">
                {format(new Date(reservation.end_datetime), "HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>

          <div className="glass-card rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-foreground font-medium">{reservation.requester_name}</p>
                <p className="text-xs text-muted-foreground">{reservation.attendees_count} participantes</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="w-4 h-4" />
              <span>{reservation.requester_email}</span>
            </div>
            {reservation.requester_phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-4 h-4" />
                <span>{reservation.requester_phone}</span>
              </div>
            )}
          </div>

          {reservation.description && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Descrição</label>
              <p className="text-foreground mt-1">{reservation.description}</p>
            </div>
          )}

          {reservation.notes && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Observações</label>
              <p className="text-foreground mt-1">{reservation.notes}</p>
            </div>
          )}

          {reservation.status === 'pending' && (
            <div className="flex gap-2 pt-4 border-t">
              <Button
                onClick={() => handleStatusChange('confirmed')}
                className="flex-1 gap-2 bg-success hover:bg-success/90"
                disabled={updateReservation.isPending}
              >
                <Check className="w-4 h-4" />
                Confirmar Reserva
              </Button>
              <Button
                onClick={() => handleStatusChange('cancelled')}
                variant="destructive"
                className="flex-1 gap-2"
                disabled={updateReservation.isPending}
              >
                <X className="w-4 h-4" />
                Cancelar Reserva
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
