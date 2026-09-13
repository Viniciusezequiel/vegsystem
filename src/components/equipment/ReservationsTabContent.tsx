import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
import { ArrowRight, CalendarClock, Package, Phone, User, XCircle } from 'lucide-react';
import {
  useEquipmentReservations,
  useCancelReservation,
  groupReservations,
  type GroupedReservation,
} from '@/hooks/useEquipmentReservations';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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
  const { data: reservations = [] } = useEquipmentReservations('awaiting_pickup');
  const cancelReservation = useCancelReservation();

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return reservations;
    const query = searchQuery.toLowerCase();
    return reservations.filter((reservation) =>
      reservation.requester_name.toLowerCase().includes(query) ||
      reservation.requester_sector.toLowerCase().includes(query) ||
      reservation.equipment?.name?.toLowerCase().includes(query) ||
      reservation.equipment?.patrimony_code?.toLowerCase().includes(query)
    );
  }, [reservations, searchQuery]);

  const grouped = useMemo(() => groupReservations(filtered), [filtered]);

  const formatDate = (date: string) => format(parseISO(date), 'dd/MM/yyyy', { locale: ptBR });
  const isOverdue = (date: string) => isPast(parseISO(date)) && !isToday(parseISO(date));

  const handlePickup = (group: GroupedReservation) => {
    navigate('/equipment/loan/new', {
      state: {
        fromReservation: {
          reservationIds: group.reservations.map((reservation) => reservation.id),
          items: group.reservations.map((reservation) => ({
            reservationId: reservation.id,
            equipmentId: reservation.equipment_id,
            equipmentName: reservation.equipment?.name || '',
            equipmentPatrimonyCode: reservation.equipment?.patrimony_code || '',
            quantity: reservation.quantity_reserved,
          })),
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
    group.reservations.forEach((reservation) => cancelReservation.mutate(reservation.id));
  };

  if (!grouped.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card/35 px-5 py-14 text-center">
        <CalendarClock className="mx-auto h-10 w-10 text-muted-foreground/45" />
        <p className="mt-3 text-sm font-medium">Nenhuma pré-reserva aguardando retirada</p>
        <p className="mt-1 text-xs text-muted-foreground">Novas reservas aparecerão aqui prontas para retirada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {grouped.map((group) => {
        const overdue = isOverdue(group.scheduled_pickup_date);
        const today = isToday(parseISO(group.scheduled_pickup_date));
        const first = group.reservations[0];
        const equipmentLabel = group.reservations.length === 1
          ? first?.equipment?.name || 'Equipamento'
          : `${group.reservations.length} equipamentos`;

        return (
          <article
            key={group.groupId}
            className={cn(
              'relative overflow-hidden rounded-2xl border bg-card/55 p-3 transition-all hover:-translate-y-0.5 hover:bg-card/70',
              overdue ? 'border-red-500/30 hover:border-red-500/45' : 'border-border/40 hover:border-primary/25'
            )}
          >
            <div className={cn('pointer-events-none absolute bottom-0 left-0 top-0 w-0.5', overdue ? 'bg-red-400' : 'bg-primary')} />

            <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(240px,1.25fr)_minmax(190px,.9fr)] xl:grid-cols-[minmax(270px,1.35fr)_minmax(190px,.8fr)_minmax(170px,.7fr)_minmax(190px,.75fr)_auto] xl:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border', overdue ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-primary/15 bg-primary/[0.07] text-primary')}>
                  <Package className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold">{equipmentLabel}</h3>
                    {group.reservations.length > 1 && <span className="rounded-md border border-primary/15 bg-primary/[0.07] px-2 py-0.5 text-[9px] font-medium text-primary">{group.reservations.length} itens</span>}
                  </div>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground">
                    {first?.equipment?.patrimony_code || 'Sem patrimônio'} · Qtd. {group.reservations.reduce((sum, reservation) => sum + reservation.quantity_reserved, 0)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-background/20 px-3 py-2 xl:border-0 xl:bg-transparent xl:px-0 xl:py-0">
                <User className="h-4 w-4 shrink-0 text-primary/75" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{group.requester_name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{borrowerTypeLabels[group.requester_type] || group.requester_type}</p>
                </div>
              </div>

              <div className="rounded-xl border border-border/30 bg-background/20 px-3 py-2 xl:border-0 xl:bg-transparent xl:px-0 xl:py-0">
                <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/65">Setor/curso</p>
                <p className="mt-0.5 truncate text-xs font-medium">{group.requester_sector}</p>
              </div>

              <div className="flex items-center justify-between gap-3 xl:block">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/65">Retirada</p>
                  <p className={cn('mt-0.5 text-xs font-semibold tabular-nums', overdue && 'text-red-300')}>{formatDate(group.scheduled_pickup_date)}</p>
                </div>
                <span className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold xl:mt-1',
                  overdue
                    ? 'border-red-500/20 bg-red-500/10 text-red-300'
                    : today
                      ? 'border-primary/20 bg-primary/10 text-primary'
                      : 'border-violet-500/20 bg-violet-500/10 text-violet-300'
                )}>
                  <CalendarClock className="h-3.5 w-3.5" />
                  {overdue ? 'Vencida' : today ? 'Hoje' : 'Aguardando'}
                </span>
              </div>

              <div className="flex items-center justify-end gap-1.5">
                <a
                  href={`https://wa.me/55${group.requester_phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/35 bg-background/20 text-muted-foreground transition hover:border-primary/25 hover:text-primary"
                  title={group.requester_phone}
                >
                  <Phone className="h-4 w-4" />
                </a>

                <Button variant="outline" size="sm" className="h-8 border-primary/20 bg-primary/[0.04] text-[10px] hover:bg-primary/10" onClick={() => handlePickup(group)}>
                  <ArrowRight className="mr-1 h-3.5 w-3.5" /> Retirar
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg border border-border/35 bg-background/20 text-destructive hover:text-destructive" title="Cancelar pré-reserva">
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar reserva?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja cancelar {group.reservations.length > 1 ? `estas ${group.reservations.length} pré-reservas` : 'esta pré-reserva'}? O estoque será restaurado.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleCancelGroup(group)}>Cancelar reserva{group.reservations.length > 1 ? 's' : ''}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {group.reservations.length > 1 && (
              <div className="mt-3 grid gap-1.5 border-t border-border/30 pt-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.reservations.map((reservation) => (
                  <div key={reservation.id} className="rounded-xl border border-border/30 bg-background/20 px-3 py-2 text-[10px]">
                    <p className="truncate font-medium text-foreground">{reservation.equipment?.name || 'Equipamento'}</p>
                    <p className="mt-0.5 truncate text-muted-foreground">{reservation.equipment?.patrimony_code || 'Sem patrimônio'} · Qtd. {reservation.quantity_reserved}</p>
                  </div>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
