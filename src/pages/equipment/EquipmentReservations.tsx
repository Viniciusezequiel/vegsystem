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
import { ArrowLeft, Plus, CalendarClock, Clock, CheckCircle, XCircle, Search, Phone, Package } from 'lucide-react';
import { useEquipmentReservations, useCancelReservation, EquipmentReservation, groupReservations, GroupedReservation } from '@/hooks/useEquipmentReservations';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ReservationFormDialog } from '@/components/equipment/ReservationFormDialog';

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
    if (!reservations) return [];
    if (!searchQuery.trim()) return reservations;
    const q = searchQuery.toLowerCase();
    return reservations.filter(r =>
      r.requester_name.toLowerCase().includes(q) ||
      r.requester_sector.toLowerCase().includes(q) ||
      r.equipment?.name?.toLowerCase().includes(q) ||
      r.equipment?.patrimony_code?.toLowerCase().includes(q)
    );
  };

  const groupedAwaiting = useMemo(() => groupReservations(filterReservations(awaitingReservations)), [awaitingReservations, searchQuery]);
  const groupedPickedUp = useMemo(() => groupReservations(filterReservations(pickedUpReservations)), [pickedUpReservations, searchQuery]);
  const groupedCancelled = useMemo(() => groupReservations(filterReservations(cancelledReservations)), [cancelledReservations, searchQuery]);

  const formatDate = (date: string) => {
    return format(parseISO(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const isOverdue = (dateStr: string) => {
    const pickupDate = parseISO(dateStr);
    return isPast(pickupDate) && !isToday(pickupDate);
  };

  const handleCancelGroup = (group: GroupedReservation) => {
    group.reservations.forEach(r => cancelReservation.mutate(r.id));
  };

  const renderTable = (groups: GroupedReservation[], showActions = false) => {
    if (!groups.length) {
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
              <TableHead>Equipamento(s)</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead className="hidden md:table-cell">Tipo</TableHead>
              <TableHead className="hidden md:table-cell">Setor</TableHead>
              <TableHead className="hidden lg:table-cell">Telefone</TableHead>
              <TableHead>Data Retirada</TableHead>
              <TableHead className="hidden md:table-cell">Data Devolução</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              {showActions && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => {
              const overdue = group.status === 'awaiting_pickup' && isOverdue(group.scheduled_pickup_date);
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
                  <TableCell className="hidden md:table-cell">
                    {group.expected_return_date ? formatDate(group.expected_return_date) : '—'}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {group.status === 'awaiting_pickup' && (
                      <Badge variant={overdue ? 'destructive' : 'default'}>
                        <Clock className="h-3 w-3 mr-1" />
                        {overdue ? 'Vencido' : 'Aguardando'}
                      </Badge>
                    )}
                    {group.status === 'picked_up' && (
                      <Badge variant="secondary">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Retirado
                      </Badge>
                    )}
                    {group.status === 'cancelled' && (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        Cancelado
                      </Badge>
                    )}
                  </TableCell>
                  {showActions && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
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
                  <span className="hidden sm:inline">Aguardando</span> ({groupedAwaiting.length})
                </TabsTrigger>
                <TabsTrigger value="picked_up" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Retirados</span> ({groupedPickedUp.length})
                </TabsTrigger>
                <TabsTrigger value="cancelled" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Cancelados</span> ({groupedCancelled.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="awaiting_pickup" className="mt-4">
                {renderTable(groupedAwaiting, true)}
              </TabsContent>
              <TabsContent value="picked_up" className="mt-4">
                {renderTable(groupedPickedUp, false)}
              </TabsContent>
              <TabsContent value="cancelled" className="mt-4">
                {renderTable(groupedCancelled, false)}
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
