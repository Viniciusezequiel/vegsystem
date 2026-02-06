import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
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
import { Clock, CheckCircle, XCircle, Phone } from 'lucide-react';
import { useEquipmentReservations, useUpdateReservationStatus, EquipmentReservation } from '@/hooks/useEquipmentReservations';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusLabels = {
  awaiting_pickup: { label: 'Aguardando Retirada', variant: 'default' as const, icon: Clock },
  picked_up: { label: 'Retirado', variant: 'secondary' as const, icon: CheckCircle },
  cancelled: { label: 'Cancelado', variant: 'destructive' as const, icon: XCircle },
};

const borrowerTypeLabels: Record<string, string> = {
  aluno: 'Aluno',
  professor: 'Professor',
  funcionario: 'Funcionário',
};

interface ReservationsTabContentProps {
  searchQuery: string;
}

export function ReservationsTabContent({ searchQuery }: ReservationsTabContentProps) {
  const { data: reservations } = useEquipmentReservations('awaiting_pickup');
  const updateStatus = useUpdateReservationStatus();

  const filtered = useMemo(() => {
    if (!reservations || !searchQuery.trim()) return reservations;
    const q = searchQuery.toLowerCase();
    return reservations.filter(r =>
      r.requester_name.toLowerCase().includes(q) ||
      r.requester_sector.toLowerCase().includes(q) ||
      r.equipment?.name?.toLowerCase().includes(q) ||
      r.equipment?.patrimony_code?.toLowerCase().includes(q)
    );
  }, [reservations, searchQuery]);

  const formatDate = (date: string) => {
    return format(parseISO(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const isOverdue = (reservation: EquipmentReservation) => {
    if (reservation.status !== 'awaiting_pickup') return false;
    const pickupDate = parseISO(reservation.scheduled_pickup_date);
    return isPast(pickupDate) && !isToday(pickupDate);
  };

  const handleMarkPickedUp = (id: string) => {
    updateStatus.mutate({ id, status: 'picked_up' });
  };

  const handleCancel = (id: string) => {
    updateStatus.mutate({ id, status: 'cancelled' });
  };

  if (!filtered?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma pré-reserva aguardando retirada
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Equipamento</TableHead>
            <TableHead className="hidden sm:table-cell">Qtd.</TableHead>
            <TableHead>Solicitante</TableHead>
            <TableHead className="hidden md:table-cell">Tipo</TableHead>
            <TableHead className="hidden md:table-cell">Setor</TableHead>
            <TableHead className="hidden lg:table-cell">Telefone</TableHead>
            <TableHead>Data Retirada</TableHead>
            <TableHead className="hidden sm:table-cell">Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((reservation) => {
            const overdue = isOverdue(reservation);
            const StatusIcon = overdue ? Clock : statusLabels[reservation.status as keyof typeof statusLabels]?.icon || Clock;

            return (
              <TableRow key={reservation.id} className={overdue ? 'bg-destructive/10' : ''}>
                <TableCell className="font-medium">
                  <div className="min-w-0">
                    <span className="block truncate">{reservation.equipment?.name || 'N/A'}</span>
                    <span className="text-xs text-muted-foreground block">{reservation.equipment?.patrimony_code}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">{reservation.quantity_reserved}</TableCell>
                <TableCell>
                  <div className="min-w-0">
                    <span className="block truncate">{reservation.requester_name}</span>
                    <span className="text-xs text-muted-foreground md:hidden">{reservation.requester_sector}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="outline" className="text-xs">
                    {borrowerTypeLabels[reservation.requester_type] || reservation.requester_type}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">{reservation.requester_sector}</TableCell>
                <TableCell className="hidden lg:table-cell">
                  <a
                    href={`https://wa.me/55${reservation.requester_phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Phone className="h-3 w-3" />
                    {reservation.requester_phone}
                  </a>
                </TableCell>
                <TableCell className={overdue ? 'text-destructive font-medium' : ''}>
                  <div className="min-w-0">
                    <span className="block">{formatDate(reservation.scheduled_pickup_date)}</span>
                    {overdue && <span className="text-xs">(Vencido)</span>}
                    {isToday(parseISO(reservation.scheduled_pickup_date)) && !overdue && (
                      <span className="text-xs text-primary font-medium">(Hoje)</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant={overdue ? 'destructive' : statusLabels[reservation.status as keyof typeof statusLabels]?.variant || 'default'}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {overdue ? 'Vencido' : statusLabels[reservation.status as keyof typeof statusLabels]?.label || reservation.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleMarkPickedUp(reservation.id)}
                      disabled={updateStatus.isPending}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">Retirado</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive">
                          <XCircle className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancelar reserva?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja cancelar esta pré-reserva de {reservation.equipment?.name}?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Voltar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleCancel(reservation.id)}>
                            Cancelar Reserva
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
