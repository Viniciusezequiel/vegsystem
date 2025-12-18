import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Plus, Package, Clock, CheckCircle, AlertTriangle, Phone, Eye, Inbox, User, Calendar } from 'lucide-react';
import { useEquipmentLoans, useOverdueLoans, useReturnEquipment, EquipmentLoan } from '@/hooks/useEquipment';
import { useExternalEquipmentRequests } from '@/hooks/useExternalEquipmentRequests';
import { ReturnDialog, ReturnData } from '@/components/equipment/ReturnDialog';
import { EquipmentLoanDetailsDialog } from '@/components/equipment/EquipmentLoanDetailsDialog';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { format, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusLabels = {
  active: { label: 'Ativo', variant: 'default' as const, icon: Clock },
  returned: { label: 'Devolvido', variant: 'secondary' as const, icon: CheckCircle },
  overdue: { label: 'Atrasado', variant: 'destructive' as const, icon: AlertTriangle },
};

export default function EquipmentLoans() {
  const [activeTab, setActiveTab] = useState('active');
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<EquipmentLoan | null>(null);
  
  const { data: activeLoans } = useEquipmentLoans('active');
  const { data: returnedLoans } = useEquipmentLoans('returned');
  const { data: overdueLoans } = useOverdueLoans();
  const { data: awaitingPickupRequests } = useExternalEquipmentRequests('awaiting_pickup');
  const returnEquipment = useReturnEquipment();

  const handleOpenReturn = (loan: EquipmentLoan) => {
    setSelectedLoan(loan);
    setReturnDialogOpen(true);
  };

  const handleOpenDetails = (loan: EquipmentLoan) => {
    setSelectedLoan(loan);
    setDetailsDialogOpen(true);
  };

  const handleReturn = (data: ReturnData) => {
    if (!selectedLoan) return;
    
    returnEquipment.mutate({
      loanId: selectedLoan.id,
      returner_name: data.returner_name,
      returner_phone: data.returner_phone,
      returner_sector: data.returner_sector,
      item_condition: data.item_condition,
      notes: data.notes,
      return_signature: data.return_signature,
    }, {
      onSuccess: () => {
        setReturnDialogOpen(false);
        setSelectedLoan(null);
      },
    });
  };

  const handleReturnFromDetails = () => {
    setDetailsDialogOpen(false);
    setReturnDialogOpen(true);
  };

  const formatDate = (date: string) => {
    return format(parseISO(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const isOverdue = (loan: EquipmentLoan) => {
    return loan.status === 'active' && isPast(parseISO(loan.expected_return_date));
  };

  const renderLoansTable = (loans: EquipmentLoan[] | undefined, showReturnButton = false) => {
    if (!loans?.length) {
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
              <TableHead>Equipamento</TableHead>
              <TableHead className="hidden sm:table-cell">Qtd.</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead className="hidden md:table-cell">Setor</TableHead>
              <TableHead className="hidden lg:table-cell">Telefone</TableHead>
              <TableHead>Prev. Devolução</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.map((loan) => {
              const overdue = isOverdue(loan);
              const StatusIcon = overdue ? AlertTriangle : statusLabels[loan.status].icon;
              
              return (
                <TableRow key={loan.id} className={overdue ? 'bg-destructive/10' : ''}>
                  <TableCell className="font-medium">
                    <div className="min-w-0">
                      <span className="block truncate">{loan.equipment?.name || 'N/A'}</span>
                      <span className="text-xs text-muted-foreground block">
                        {loan.equipment?.patrimony_code}
                      </span>
                      <span className="text-xs text-muted-foreground sm:hidden">
                        Qtd: {loan.quantity_borrowed}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{loan.quantity_borrowed}</TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <span className="block truncate">{loan.borrower_name}</span>
                      <span className="text-xs text-muted-foreground md:hidden">
                        {loan.borrower_sector}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{loan.borrower_sector}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <a 
                      href={`https://wa.me/55${loan.borrower_phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <Phone className="h-3 w-3" />
                      {loan.borrower_phone}
                    </a>
                  </TableCell>
                  <TableCell className={overdue ? 'text-destructive font-medium' : ''}>
                    <div className="min-w-0">
                      <span className="block">{formatDate(loan.expected_return_date)}</span>
                      {overdue && <span className="text-xs">(Atrasado)</span>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={overdue ? 'destructive' : statusLabels[loan.status].variant}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {overdue ? 'Atrasado' : statusLabels[loan.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleOpenDetails(loan)}
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">Ver detalhes</span>
                      </Button>
                      {showReturnButton && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleOpenReturn(loan)}
                        >
                          <span className="hidden sm:inline">Devolver</span>
                          <span className="sm:hidden">Dev.</span>
                        </Button>
                      )}
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
                { header: 'Solicitante', accessor: 'borrower_name' },
                { header: 'Setor', accessor: 'borrower_sector' },
                { header: 'Telefone', accessor: 'borrower_phone' },
                { header: 'Prev. Devolução', accessor: (row) => formatDate(row.expected_return_date) },
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
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Lista de Empréstimos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="active" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Ativos</span> ({activeLoans?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="awaiting" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <Inbox className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Aguardando</span> ({awaitingPickupRequests?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="overdue" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Atrasados</span> ({overdueLoans?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="returned" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Devolvidos</span> ({returnedLoans?.length || 0})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="active" className="mt-4">
                {renderLoansTable(activeLoans, true)}
              </TabsContent>
              <TabsContent value="awaiting" className="mt-4">
                {awaitingPickupRequests && awaitingPickupRequests.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground mb-4">
                      Solicitações externas aprovadas aguardando retirada pelo solicitante
                    </p>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Equipamento</TableHead>
                            <TableHead className="hidden sm:table-cell">Qtd.</TableHead>
                            <TableHead>Solicitante</TableHead>
                            <TableHead className="hidden md:table-cell">Telefone</TableHead>
                            <TableHead>Data Retirada</TableHead>
                            <TableHead className="hidden sm:table-cell">Devolução</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {awaitingPickupRequests.map((req) => (
                            <TableRow key={req.id} className="bg-purple-500/5">
                              <TableCell className="font-medium">
                                <div className="min-w-0">
                                  <span className="block truncate">{req.equipment_name}</span>
                                  {req.equipment?.patrimony_code && (
                                    <span className="text-xs text-muted-foreground block">
                                      {req.equipment.patrimony_code}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">{req.quantity_requested}</TableCell>
                              <TableCell>
                                <div className="min-w-0">
                                  <span className="block truncate">{req.requester_name}</span>
                                  <span className="text-xs text-muted-foreground block truncate">
                                    {req.requester_email}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <a 
                                  href={`https://wa.me/55${req.requester_phone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-primary hover:underline"
                                >
                                  <Phone className="h-3 w-3" />
                                  {req.requester_phone}
                                </a>
                              </TableCell>
                              <TableCell>
                                {format(parseISO(req.requested_date), "dd/MM/yyyy", { locale: ptBR })}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                {format(parseISO(req.expected_return_date), "dd/MM/yyyy", { locale: ptBR })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="pt-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to="/equipment/external-requests">
                          Ver todas as solicitações externas
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma solicitação aguardando retirada
                  </div>
                )}
              </TabsContent>
              <TabsContent value="overdue" className="mt-4">
                {renderLoansTable(overdueLoans, true)}
              </TabsContent>
              <TabsContent value="returned" className="mt-4">
                {renderLoansTable(returnedLoans, false)}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Details Dialog */}
      <EquipmentLoanDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        loan={selectedLoan}
        onReturn={handleReturnFromDetails}
        showReturnButton={selectedLoan?.status === 'active'}
      />

      {/* Return Dialog */}
      {selectedLoan && (
        <ReturnDialog
          open={returnDialogOpen}
          onOpenChange={setReturnDialogOpen}
          onConfirm={handleReturn}
          itemName={selectedLoan.equipment?.name || 'Item'}
          borrowerName={selectedLoan.borrower_name}
          isPending={returnEquipment.isPending}
        />
      )}
    </MainLayout>
  );
}
