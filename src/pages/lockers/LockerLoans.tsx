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
import { ArrowLeft, Plus, Box, Clock, CheckCircle, AlertTriangle, Phone, Mail, Eye } from 'lucide-react';
import { useLockerLoans, useOverdueLockerLoans, useReturnLocker, useExchangeLocker, useLockersList, LockerLoan } from '@/hooks/useLockers';
import { LockerReturnDialog, LockerReturnData } from '@/components/lockers/LockerReturnDialog';
import { LockerExchangeDialog } from '@/components/lockers/LockerExchangeDialog';
import { LockerLoanDetailsDialog } from '@/components/lockers/LockerLoanDetailsDialog';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { format, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusLabels = {
  active: { label: 'Ativo', variant: 'default' as const, icon: Clock },
  returned: { label: 'Devolvido', variant: 'secondary' as const, icon: CheckCircle },
  overdue: { label: 'Atrasado', variant: 'destructive' as const, icon: AlertTriangle },
};

export default function LockerLoans() {
  const [activeTab, setActiveTab] = useState('active');
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [exchangeDialogOpen, setExchangeDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<LockerLoan | null>(null);
  
  const { data: activeLoans } = useLockerLoans('active');
  const { data: returnedLoans } = useLockerLoans('returned');
  const { data: overdueLoans } = useOverdueLockerLoans();
  const { data: availableLockers } = useLockersList('available');
  const returnLocker = useReturnLocker();
  const exchangeLocker = useExchangeLocker();

  const handleOpenReturn = (loan: LockerLoan) => {
    setSelectedLoan(loan);
    setReturnDialogOpen(true);
  };

  const handleOpenDetails = (loan: LockerLoan) => {
    setSelectedLoan(loan);
    setDetailsDialogOpen(true);
  };

  const handleReturn = (data: LockerReturnData) => {
    if (!selectedLoan) return;
    
    returnLocker.mutate({
      loanId: selectedLoan.id,
      returnerName: data.returner_name,
      signature: data.signature,
      notes: data.notes,
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

  const handleExchangeFromDetails = () => {
    setDetailsDialogOpen(false);
    setExchangeDialogOpen(true);
  };

  const handleExchange = (newLockerId: string, reason: string) => {
    if (!selectedLoan) return;
    
    exchangeLocker.mutate({
      loanId: selectedLoan.id,
      newLockerId,
      reason,
    }, {
      onSuccess: () => {
        setExchangeDialogOpen(false);
        setSelectedLoan(null);
      },
    });
  };

  const formatDate = (date: string) => {
    return format(parseISO(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const isOverdue = (loan: LockerLoan) => {
    return loan.status === 'active' && isPast(parseISO(loan.expected_return_date));
  };

  const renderLoansTable = (loans: LockerLoan[] | undefined, showReturnButton = false) => {
    if (!loans?.length) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma locação encontrada
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Escaninho</TableHead>
              <TableHead className="hidden sm:table-cell">Campus</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden lg:table-cell">Contato</TableHead>
              <TableHead>Prev. Devolução</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              {showReturnButton && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.map((loan) => {
              const overdue = isOverdue(loan);
              const StatusIcon = overdue ? AlertTriangle : statusLabels[loan.status].icon;
              
              return (
                <TableRow 
                  key={loan.id} 
                  className={`${overdue ? 'bg-destructive/10' : ''} cursor-pointer hover:bg-muted/50`}
                  onClick={() => handleOpenDetails(loan)}
                >
                  <TableCell className="font-medium">
                    <div className="min-w-0">
                      <span className="block">{loan.locker?.code || 'N/A'}</span>
                      <span className="text-xs text-muted-foreground sm:hidden">
                        {loan.locker?.campus}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{loan.locker?.campus}</TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <span className="block truncate">{loan.borrower_name}</span>
                      <span className="text-xs text-muted-foreground lg:hidden">
                        {loan.borrower_phone}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="space-y-1">
                      <a 
                        href={`https://wa.me/55${loan.borrower_phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="h-3 w-3" />
                        {loan.borrower_phone}
                      </a>
                      {loan.borrower_email && (
                        <a 
                          href={`mailto:${loan.borrower_email}`}
                          className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Mail className="h-3 w-3" />
                          {loan.borrower_email}
                        </a>
                      )}
                    </div>
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
                  {showReturnButton && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetails(loan);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenReturn(loan);
                          }}
                        >
                          <span className="hidden sm:inline">Devolver</span>
                          <span className="sm:hidden">Dev.</span>
                        </Button>
                      </div>
                    </TableCell>
                  )}
                  {!showReturnButton && (
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetails(loan);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
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
              <Link to="/lockers">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Locações de Escaninhos</h1>
              <p className="text-sm text-muted-foreground">Gerencie as locações e devoluções</p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <PdfExportButton
              title="Relatório de Locações de Escaninhos"
              filename="locacoes_escaninhos"
              columns={[
                { header: 'Escaninho', accessor: (row) => row.locker?.code || 'N/A' },
                { header: 'Campus', accessor: (row) => row.locker?.campus || 'N/A' },
                { header: 'Cliente', accessor: 'borrower_name' },
                { header: 'Telefone', accessor: 'borrower_phone' },
                { header: 'Email', accessor: (row) => row.borrower_email || '-' },
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
              <Link to="/lockers/loan/new">
                <Plus className="mr-2 h-4 w-4" />
                Nova Locação
              </Link>
            </Button>
          </div>
        </div>

        {overdueLoans && overdueLoans.length > 0 && (
          <Card className="border-destructive bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive text-sm sm:text-base">
                <AlertTriangle className="h-5 w-5" />
                Atenção: {overdueLoans.length} escaninho(s) com devolução atrasada!
              </CardTitle>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Box className="h-5 w-5" />
              Lista de Locações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="active" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Ativos</span> ({activeLoans?.length || 0})
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
      <LockerLoanDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        loan={selectedLoan}
        onReturn={handleReturnFromDetails}
        onExchange={handleExchangeFromDetails}
        showReturnButton={selectedLoan?.status === 'active'}
      />

      {/* Return Dialog */}
      {selectedLoan && (
        <LockerReturnDialog
          open={returnDialogOpen}
          onOpenChange={setReturnDialogOpen}
          onConfirm={handleReturn}
          lockerCode={selectedLoan.locker?.code || ''}
          borrowerName={selectedLoan.borrower_name}
          isPending={returnLocker.isPending}
        />
      )}

      {/* Exchange Dialog */}
      {selectedLoan && (
        <LockerExchangeDialog
          open={exchangeDialogOpen}
          onOpenChange={setExchangeDialogOpen}
          onConfirm={handleExchange}
          currentLocker={selectedLoan.locker || null}
          availableLockers={availableLockers || []}
          isPending={exchangeLocker.isPending}
        />
      )}
    </MainLayout>
  );
}
