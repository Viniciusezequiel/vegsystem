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
import { ArrowLeft, Plus, Box, Clock, CheckCircle, AlertTriangle, Phone } from 'lucide-react';
import { useLockerLoans, useOverdueLockerLoans, useReturnLocker, LockerLoan } from '@/hooks/useLockers';
import { ReturnDialog, ReturnData } from '@/components/equipment/ReturnDialog';
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
  const [selectedLoan, setSelectedLoan] = useState<LockerLoan | null>(null);
  
  const { data: activeLoans } = useLockerLoans('active');
  const { data: returnedLoans } = useLockerLoans('returned');
  const { data: overdueLoans } = useOverdueLockerLoans();
  const returnLocker = useReturnLocker();

  const handleOpenReturn = (loan: LockerLoan) => {
    setSelectedLoan(loan);
    setReturnDialogOpen(true);
  };

  const handleReturn = (data: ReturnData) => {
    if (!selectedLoan) return;
    
    returnLocker.mutate(selectedLoan.id, {
      onSuccess: () => {
        setReturnDialogOpen(false);
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
          Nenhuma alocação encontrada
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
              <TableHead className="hidden lg:table-cell">Telefone</TableHead>
              <TableHead className="hidden md:table-cell">Setor</TableHead>
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
                <TableRow key={loan.id} className={overdue ? 'bg-destructive/10' : ''}>
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
                      <span className="text-xs text-muted-foreground md:hidden">
                        {loan.borrower_sector || '-'}
                      </span>
                    </div>
                  </TableCell>
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
                  <TableCell className="hidden md:table-cell">{loan.borrower_sector || '-'}</TableCell>
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
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleOpenReturn(loan)}
                      >
                        <span className="hidden sm:inline">Registrar Devolução</span>
                        <span className="sm:hidden">Devolver</span>
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
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Alocações de Escaninhos</h1>
              <p className="text-sm text-muted-foreground">Gerencie as alocações e devoluções</p>
            </div>
          </div>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/lockers/loan/new">
              <Plus className="mr-2 h-4 w-4" />
              Nova Alocação
            </Link>
          </Button>
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
              Lista de Alocações
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

      {/* Return Dialog */}
      {selectedLoan && (
        <ReturnDialog
          open={returnDialogOpen}
          onOpenChange={setReturnDialogOpen}
          onConfirm={handleReturn}
          itemName={`Escaninho ${selectedLoan.locker?.code || ''}`}
          borrowerName={selectedLoan.borrower_name}
          isPending={returnLocker.isPending}
        />
      )}
    </MainLayout>
  );
}
