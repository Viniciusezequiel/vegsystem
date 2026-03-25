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
import { ArrowLeft, Plus, Package, Clock, CheckCircle, AlertTriangle, Phone, Eye, Search, CalendarClock, Trash2 } from 'lucide-react';
import { useEquipmentLoans, useOverdueLoans, useReturnEquipment, useDeleteEquipmentLoan, EquipmentLoan } from '@/hooks/useEquipment';
import { ReturnDialog, ReturnData } from '@/components/equipment/ReturnDialog';
import { EquipmentLoanDetailsDialog } from '@/components/equipment/EquipmentLoanDetailsDialog';
import { ReservationsTabContent } from '@/components/equipment/ReservationsTabContent';
import { ReservationFormDialog } from '@/components/equipment/ReservationFormDialog';
import { useEquipmentReservations } from '@/hooks/useEquipmentReservations';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const statusLabels = {
  active: { label: 'Ativo', variant: 'default' as const, icon: Clock },
  returned: { label: 'Devolvido', variant: 'secondary' as const, icon: CheckCircle },
  overdue: { label: 'Atrasado', variant: 'destructive' as const, icon: AlertTriangle },
};

const borrowerTypeLabels: Record<string, string> = {
  aluno: 'Aluno',
  professor: 'Professor',
  funcionario: 'Funcionário',
};

export type GroupedLoan = {
  groupId: string;
  loans: EquipmentLoan[];
  borrower_name: string;
  borrower_phone: string;
  borrower_sector: string;
  borrower_type: string | null;
  purpose: string | null;
  expected_return_date: string;
  status: 'active' | 'returned' | 'overdue';
  collaborator_name: string | null;
  created_at: string;
};

function groupLoans(loans: EquipmentLoan[]): GroupedLoan[] {
  const groups = new Map<string, EquipmentLoan[]>();
  for (const loan of loans) {
    const key = loan.loan_group_id || loan.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(loan);
  }

  return Array.from(groups.entries()).map(([groupId, items]) => {
    const first = items[0];
    return {
      groupId,
      loans: items,
      borrower_name: first.borrower_name,
      borrower_phone: first.borrower_phone,
      borrower_sector: first.borrower_sector,
      borrower_type: first.borrower_type,
      purpose: first.purpose,
      expected_return_date: first.expected_return_date,
      status: first.status,
      collaborator_name: first.collaborator_name,
      created_at: first.created_at,
    };
  });
}

export default function EquipmentLoans() {
  const [activeTab, setActiveTab] = useState('reservations');
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedLoan | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<EquipmentLoan | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<GroupedLoan | null>(null);
  
  const { profile } = useAuth();
  const isAdmin = profile?.position === 'admin'; // fallback check
  
  const { data: activeLoans } = useEquipmentLoans('active');
  const { data: awaitingReservations } = useEquipmentReservations('awaiting_pickup');
  const { data: returnedLoans } = useEquipmentLoans('returned');
  const { data: overdueLoans } = useOverdueLoans();
  const returnEquipment = useReturnEquipment();
  const deleteEquipmentLoan = useDeleteEquipmentLoan();

  const filterLoans = (loans: EquipmentLoan[] | undefined) => {
    if (!loans || !searchQuery.trim()) return loans;
    const q = searchQuery.toLowerCase();
    return loans.filter(loan =>
      loan.borrower_name.toLowerCase().includes(q) ||
      loan.borrower_phone.includes(q) ||
      loan.borrower_sector.toLowerCase().includes(q) ||
      loan.equipment?.name?.toLowerCase().includes(q) ||
      loan.equipment?.patrimony_code?.toLowerCase().includes(q) ||
      loan.equipment?.old_patrimony_code?.toLowerCase().includes(q) ||
      loan.collaborator_name?.toLowerCase().includes(q) ||
      loan.borrower_type?.toLowerCase().includes(q)
    );
  };

  const filteredActiveLoans = useMemo(() => filterLoans(activeLoans), [activeLoans, searchQuery]);
  const filteredReturnedLoans = useMemo(() => filterLoans(returnedLoans), [returnedLoans, searchQuery]);
  const filteredOverdueLoans = useMemo(() => filterLoans(overdueLoans), [overdueLoans, searchQuery]);

  const groupedActiveLoans = useMemo(() => groupLoans(filteredActiveLoans || []), [filteredActiveLoans]);
  const groupedReturnedLoans = useMemo(() => groupLoans(filteredReturnedLoans || []), [filteredReturnedLoans]);
  const groupedOverdueLoans = useMemo(() => groupLoans(filteredOverdueLoans || []), [filteredOverdueLoans]);

  const handleOpenReturn = (group: GroupedLoan) => {
    setSelectedGroup(group);
    setSelectedLoan(group.loans[0]);
    setReturnDialogOpen(true);
  };

  const handleOpenDetails = (group: GroupedLoan) => {
    setSelectedGroup(group);
    setSelectedLoan(group.loans[0]);
    setDetailsDialogOpen(true);
  };

  const handleReturn = (data: ReturnData) => {
    if (!selectedGroup) return;
    
    // Use selectedLoanIds for partial returns, or all loans for full return
    const loanIds = data.selectedLoanIds && data.selectedLoanIds.length > 0
      ? data.selectedLoanIds
      : selectedGroup.loans.map(l => l.id);
    
    returnEquipment.mutate({
      loanId: loanIds,
      returner_name: data.returner_name,
      returner_phone: data.returner_phone,
      returner_sector: data.returner_sector,
      item_condition: data.item_condition,
      notes: data.notes,
      return_signature: data.return_signature,
      return_collaborator_name: data.return_collaborator_name,
      all_items_returned: data.all_items_returned,
      pending_items_description: data.pending_items_description,
    }, {
      onSuccess: () => {
        setReturnDialogOpen(false);
        setSelectedGroup(null);
        setSelectedLoan(null);
      },
    });
  };

  const handleReturnFromDetails = () => {
    setDetailsDialogOpen(false);
    setReturnDialogOpen(true);
  };

  const handleOpenDelete = (group: GroupedLoan) => {
    setGroupToDelete(group);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!groupToDelete) return;
    const loanIds = groupToDelete.loans.map(l => l.id);
    deleteEquipmentLoan.mutate({ loanIds }, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setGroupToDelete(null);
      },
    });
  };

  const formatDate = (date: string) => {
    return format(parseISO(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const isOverdue = (loan: EquipmentLoan) => {
    if (loan.status !== 'active') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const returnDate = parseISO(loan.expected_return_date);
    returnDate.setHours(0, 0, 0, 0);
    return returnDate < today;
  };

  const isGroupOverdue = (group: GroupedLoan) => {
    return group.loans.some(l => isOverdue(l));
  };

  const renderGroupedLoansTable = (groups: GroupedLoan[], showReturnButton = false) => {
    if (!groups.length) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum empréstimo encontrado
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
              <TableHead className="hidden lg:table-cell">Finalidade</TableHead>
              <TableHead>Prev. Devolução</TableHead>
              <TableHead className="hidden sm:table-cell">Colaborador</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => {
              const overdue = isGroupOverdue(group);
              const isGrouped = group.loans.length > 1;
              const StatusIcon = overdue ? AlertTriangle : statusLabels[group.status].icon;
              
              return (
                <TableRow key={group.groupId} className={overdue ? 'bg-destructive/10' : ''}>
                  <TableCell className="font-medium">
                    <div className="space-y-1">
                      {group.loans.map((loan) => (
                        <div key={loan.id} className="min-w-0">
                          <span className="block truncate text-sm">{loan.equipment?.name || 'N/A'}</span>
                          <span className="text-xs text-muted-foreground">
                            Novo: {loan.equipment?.patrimony_code}{loan.equipment?.old_patrimony_code ? ` | Antigo: ${loan.equipment.old_patrimony_code}` : ''} • Qtd: {loan.quantity_borrowed}
                          </span>
                        </div>
                      ))}
                      {isGrouped && (
                        <Badge variant="outline" className="text-[10px] mt-1">
                          <Package className="h-3 w-3 mr-1" />
                          {group.loans.length} itens
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <span className="block truncate">{group.borrower_name}</span>
                      <span className="text-xs text-muted-foreground md:hidden">{group.borrower_sector}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className="text-xs">
                      {borrowerTypeLabels[group.borrower_type || 'aluno'] || group.borrower_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{group.borrower_sector}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <a 
                      href={`https://wa.me/55${group.borrower_phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <Phone className="h-3 w-3" />
                      {group.borrower_phone}
                    </a>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {group.purpose || '—'}
                  </TableCell>
                  <TableCell className={overdue ? 'text-destructive font-medium' : ''}>
                    <div className="min-w-0">
                      <span className="block">{formatDate(group.expected_return_date)}</span>
                      {overdue && <span className="text-xs">(Atrasado)</span>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="text-xs text-muted-foreground">{group.collaborator_name || '—'}</span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={overdue ? 'destructive' : statusLabels[group.status].variant}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {overdue ? 'Atrasado' : statusLabels[group.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenDetails(group)}>
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">Ver detalhes</span>
                      </Button>
                      {showReturnButton && (
                        <Button variant="outline" size="sm" onClick={() => handleOpenReturn(group)}>
                          <span className="hidden sm:inline">Devolver{isGrouped ? ` (${group.loans.length})` : ''}</span>
                          <span className="sm:hidden">Dev.</span>
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleOpenDelete(group)}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Excluir</span>
                      </Button>
                    </div>
                  </TableCell>
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
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Empréstimos de Equipamentos</h1>
              <p className="text-sm text-muted-foreground">Gerencie os empréstimos e devoluções</p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <PdfExportButton
              title="Relatório de Empréstimos de Equipamentos"
              filename="emprestimos_equipamentos"
              columns={[
                { header: 'Equipamento', accessor: (row) => row.equipment?.name || 'N/A' },
                { header: 'Patrimônio', accessor: (row) => row.equipment?.patrimony_code || 'N/A' },
                { header: 'Qtd.', accessor: (row) => String(row.quantity_borrowed) },
                { header: 'Tipo', accessor: (row) => borrowerTypeLabels[row.borrower_type || 'aluno'] || row.borrower_type || '' },
                { header: 'Solicitante', accessor: 'borrower_name' },
                { header: 'Setor', accessor: 'borrower_sector' },
                { header: 'Telefone', accessor: 'borrower_phone' },
                { header: 'Finalidade', accessor: (row) => row.purpose || '' },
                { header: 'Prev. Devolução', accessor: (row) => formatDate(row.expected_return_date) },
                { header: 'Colaborador', accessor: (row) => row.collaborator_name || '' },
                { header: 'Status', accessor: (row) => statusLabels[row.status as keyof typeof statusLabels]?.label || row.status },
              ]}
              data={[...(activeLoans || []), ...(returnedLoans || [])]}
              filters={[
                {
                  label: 'Status',
                  key: 'status',
                  options: [
                    { label: 'Ativo', value: 'active' },
                    { label: 'Devolvido', value: 'returned' },
                    { label: 'Atrasado', value: 'overdue' },
                  ],
                },
              ]}
            />
            <Button onClick={() => setReservationDialogOpen(true)} variant="outline" className="flex-1 sm:flex-initial">
              <CalendarClock className="mr-2 h-4 w-4" />
              Nova Pré-Reserva
            </Button>
            <Button asChild className="flex-1 sm:flex-initial">
              <Link to="/equipment/loan/new">
                <Plus className="mr-2 h-4 w-4" />
                Novo Empréstimo
              </Link>
            </Button>
          </div>
        </div>

        {overdueLoans && overdueLoans.length > 0 && (
          <Card className="border-destructive bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive text-sm sm:text-base">
                <AlertTriangle className="h-5 w-5" />
                Atenção: {overdueLoans.length} empréstimo(s) com devolução atrasada!
              </CardTitle>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Lista de Empréstimos
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
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="reservations" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <CalendarClock className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Pré-Reservas</span> ({awaitingReservations?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="active" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Ativos</span> ({filteredActiveLoans?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="overdue" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Atrasados</span> ({filteredOverdueLoans?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="returned" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Devolvidos</span> ({filteredReturnedLoans?.length || 0})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="reservations" className="mt-4">
                <ReservationsTabContent searchQuery={searchQuery} />
              </TabsContent>
              <TabsContent value="active" className="mt-4">
                {renderGroupedLoansTable(groupedActiveLoans, true)}
              </TabsContent>
              <TabsContent value="overdue" className="mt-4">
                {renderGroupedLoansTable(groupedOverdueLoans, true)}
              </TabsContent>
              <TabsContent value="returned" className="mt-4">
                {renderGroupedLoansTable(groupedReturnedLoans, false)}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <EquipmentLoanDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        loan={selectedLoan}
        loans={selectedGroup?.loans}
        onReturn={handleReturnFromDetails}
        showReturnButton={selectedGroup?.status === 'active'}
      />

      {selectedGroup && (
        <ReturnDialog
          open={returnDialogOpen}
          onOpenChange={setReturnDialogOpen}
          onConfirm={handleReturn}
          itemName={selectedGroup.loans.length > 1 
            ? `${selectedGroup.loans.length} equipamentos` 
            : (selectedGroup.loans[0]?.equipment?.name || 'Item')
          }
          itemNames={selectedGroup.loans.map(l => ({
            name: l.equipment?.name || 'N/A',
            patrimony: l.equipment?.patrimony_code || '',
            quantity: l.quantity_borrowed,
            loanId: l.id,
          }))}
          borrowerName={selectedGroup.borrower_name}
          isPending={returnEquipment.isPending}
        />
      )}

      <ReservationFormDialog
        open={reservationDialogOpen}
        onOpenChange={setReservationDialogOpen}
      />
    </MainLayout>
  );
}