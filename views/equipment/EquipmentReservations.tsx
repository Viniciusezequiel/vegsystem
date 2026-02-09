import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { ArrowLeft, Plus, CalendarClock, Clock, CheckCircle, XCircle, Search, Phone } from 'lucide-react';
import { useEquipmentReservations, useCancelReservation, EquipmentReservation } from '@/hooks/useEquipmentReservations';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ReservationFormDialog } from '@/components/equipment/ReservationFormDialog';

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

export default function EquipmentReservations() {
  const [activeTab, setActiveTab] = useState('awaiting_pickup');
  const [searchQuery, setSearchQuery] = useState('');
  const [formDialogOpen, setFormDialogOpen] = useState(false);

  const { data: awaitingReservations } = useEquipmentReservations('awaiting_pickup');
  const { data: pickedUpReservations } = useEquipmentReservations('picked_up');
  const { data: cancelledReservations } = useEquipmentReservations('cancelled');
  const cancelReservation = useCancelReservation();

  const filterReservations = (reservations: EquipmentReservation[] | undefined) => {
    if (!reservations || !searchQuery.trim()) return reservations;
    const q = searchQuery.toLowerCase();
    return reservations.filter(r =>
      r.requester_name.toLowerCase().includes(q) ||
      r.requester_sector.toLowerCase().includes(q) ||
      r.equipment?.name?.toLowerCase().includes(q) ||
      r.equipment?.patrimony_code?.toLowerCase().includes(q)
    );
  };

  const filteredAwaiting = useMemo(() => filterReservations(awaitingReservations), [awaitingReservations, searchQuery]);
  const filteredPickedUp = useMemo(() => filterReservations(pickedUpReservations), [pickedUpReservations, searchQuery]);
  const filteredCancelled = useMemo(() => filterReservations(cancelledReservations), [cancelledReservations, searchQuery]);

  const formatDate = (date: string) => {
    return format(parseISO(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const isOverdue = (reservation: EquipmentReservation) => {
    if (reservation.status !== 'awaiting_pickup') return false;
    const pickupDate = parseISO(reservation.scheduled_pickup_date);
    return isPast(pickupDate) && !isToday(pickupDate);
  };

  const handleMarkPickedUp = (id: string) => {
    // This page is legacy - pickup now goes through the loan form
  };

  const handleCancel = (id: string) => {
    cancelReservation.mutate(id);
  };

  const renderTable = (reservations: EquipmentReservation[] | undefined, showActions = false) => {
    if (!reservations?.length) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma pré-reserva encontrada
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
              {showActions && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {reservations.map((reservation) => {
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
                  {showActions && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkPickedUp(reservation.id)}
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
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link to="/equipment">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Pré-Reservas de Equipamentos</h1>
              <p className="text-sm text-muted-foreground">Agende equipamentos para retirada futura</p>
            </div>
          </div>
          <Button onClick={() => setFormDialogOpen(true)} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Nova Pré-Reserva
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5" />
                Pré-Reservas
              </CardTitle>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, equipamento, setor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="awaiting_pickup" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Aguardando</span> ({filteredAwaiting?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="picked_up" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Retirados</span> ({filteredPickedUp?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="cancelled" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Cancelados</span> ({filteredCancelled?.length || 0})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="awaiting_pickup" className="mt-4">
                {renderTable(filteredAwaiting, true)}
              </TabsContent>
              <TabsContent value="picked_up" className="mt-4">
                {renderTable(filteredPickedUp, false)}
              </TabsContent>
              <TabsContent value="cancelled" className="mt-4">
                {renderTable(filteredCancelled, false)}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <ReservationFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
      />
    </MainLayout>
  );
}
