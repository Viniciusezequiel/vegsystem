import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Clock, CheckCircle, XCircle, Phone, ArrowRight, Package } from 'lucide-react';
import { useEquipmentReservations, useCancelReservation, EquipmentReservation, groupReservations, GroupedReservation } from '@/hooks/useEquipmentReservations';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const borrowerTypeLabels: Record<string, string> = {
  aluno: 'Aluno',
  professor: 'Professor',
  funcionario: 'Funcionário',
};

interface ReservationsTabContentProps {
  searchQuery: string;
}

export function ReservationsTabContent({ searchQuery }: ReservationsTabContentProps) {
  const navigate = useNavigate();
  const { data: reservations } = useEquipmentReservations('awaiting_pickup');
  const cancelReservation = useCancelReservation();

  const filtered = useMemo(() => {
    if (!reservations) return [];
    let items = reservations;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(r =>
        r.requester_name.toLowerCase().includes(q) ||
        r.requester_sector.toLowerCase().includes(q) ||
        r.equipment?.name?.toLowerCase().includes(q) ||
        r.equipment?.patrimony_code?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [reservations, searchQuery]);

  const grouped = useMemo(() => groupReservations(filtered), [filtered]);

  const formatDate = (date: string) => {
    return format(parseISO(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const isOverdue = (dateStr: string) => {
    const pickupDate = parseISO(dateStr);
    return isPast(pickupDate) && !isToday(pickupDate);
  };

  const handlePickup = (group: GroupedReservation) => {
    const reservationItems = group.reservations.map(r => ({
      reservationId: r.id,
      equipmentId: r.equipment_id,
      equipmentName: r.equipment?.name || '',
      equipmentPatrimonyCode: r.equipment?.patrimony_code || '',
      quantity: r.quantity_reserved,
    }));

    navigate('/equipment/loan/new', {
      state: {
        fromReservation: {
          reservationIds: group.reservations.map(r => r.id),
          items: reservationItems,
          borrowerName: group.requester_name,
          borrowerPhone: group.requester_phone,
          borrowerSector: group.requester_sector,
          borrowerType: group.requester_type,
          purpose: group.purpose,
          notes: group.notes,
        },
      },
    });
  };

  const handleCancelGroup = (group: GroupedReservation) => {
    group.reservations.forEach(r => cancelReservation.mutate(r.id));
  };

  if (!grouped.length) {
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
            <TableHead>Equipamento(s)</TableHead>
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
          {grouped.map((group) => {
            const overdue = isOverdue(group.scheduled_pickup_date);
            const isGrouped = group.reservations.length > 1;

            return (
              <TableRow key={group.groupId} className={overdue ? 'bg-destructive/10' : ''}>
                <TableCell className="font-medium">
                  <div className="space-y-1">
                    {group.reservations.map(r => (
                      <div key={r.id} className="min-w-0">
                        <span className="block truncate text-sm">{r.equipment?.name || 'N/A'}</span>
                        <span className="text-xs text-muted-foreground">
                          {r.equipment?.patrimony_code} • Qtd: {r.quantity_reserved}
                        </span>
                      </div>
                    ))}
                    {isGrouped && (
                      <Badge variant="outline" className="text-[10px] mt-1">
                        <Package className="h-3 w-3 mr-1" />
                        {group.reservations.length} itens
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="min-w-0">
                    <span className="block truncate">{group.requester_name}</span>
                    <span className="text-xs text-muted-foreground md:hidden">{group.requester_sector}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="outline" className="text-xs">
                    {borrowerTypeLabels[group.requester_type] || group.requester_type}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">{group.requester_sector}</TableCell>
                <TableCell className="hidden lg:table-cell">
                  <a
                    href={`https://wa.me/55${group.requester_phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Phone className="h-3 w-3" />
                    {group.requester_phone}
                  </a>
                </TableCell>
                <TableCell className={overdue ? 'text-destructive font-medium' : ''}>
                  <div className="min-w-0">
                    <span className="block">{formatDate(group.scheduled_pickup_date)}</span>
                    {overdue && <span className="text-xs">(Vencido)</span>}
                    {isToday(parseISO(group.scheduled_pickup_date)) && !overdue && (
                      <span className="text-xs text-primary font-medium">(Hoje)</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant={overdue ? 'destructive' : 'default'}>
                    {overdue ? (
                      <><Clock className="h-3 w-3 mr-1" />Vencido</>
                    ) : (
                      <><Clock className="h-3 w-3 mr-1" />Aguardando</>
                    )}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePickup(group)}
                    >
                      <ArrowRight className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">Retirar</span>
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
                            Tem certeza que deseja cancelar {isGrouped ? `estas ${group.reservations.length} pré-reservas` : 'esta pré-reserva'}? O estoque será restaurado.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Voltar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleCancelGroup(group)}>
                            Cancelar Reserva{isGrouped ? 's' : ''}
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
