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
import { ArrowLeft, Plus, Package, Clock, CheckCircle, AlertTriangle, Phone } from 'lucide-react';
import { useEquipmentLoans, useOverdueLoans, useReturnEquipment, EquipmentLoan } from '@/hooks/useEquipment';
import { format, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusLabels = {
  active: { label: 'Ativo', variant: 'default' as const, icon: Clock },
  returned: { label: 'Devolvido', variant: 'secondary' as const, icon: CheckCircle },
  overdue: { label: 'Atrasado', variant: 'destructive' as const, icon: AlertTriangle },
};

export default function EquipmentLoans() {
  const [activeTab, setActiveTab] = useState('active');
  const { data: activeLoans } = useEquipmentLoans('active');
  const { data: returnedLoans } = useEquipmentLoans('returned');
  const { data: overdueLoans } = useOverdueLoans();
  const returnEquipment = useReturnEquipment();

  const handleReturn = (loanId: string) => {
    returnEquipment.mutate(loanId);
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
              <TableHead>Qtd.</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Prev. Devolução</TableHead>
              <TableHead>Status</TableHead>
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
                    {loan.equipment?.name || 'N/A'}
                    <div className="text-xs text-muted-foreground">
                      {loan.equipment?.patrimony_code}
                    </div>
                  </TableCell>
                  <TableCell>{loan.quantity_borrowed}</TableCell>
                  <TableCell>{loan.borrower_name}</TableCell>
                  <TableCell>{loan.borrower_sector}</TableCell>
                  <TableCell>
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
                    {formatDate(loan.expected_return_date)}
                    {overdue && <span className="text-xs ml-1">(Atrasado)</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={overdue ? 'destructive' : statusLabels[loan.status].variant}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {overdue ? 'Atrasado' : statusLabels[loan.status].label}
                    </Badge>
                  </TableCell>
                  {showReturnButton && (
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            Registrar Devolução
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar devolução</AlertDialogTitle>
                            <AlertDialogDescription>
                              Confirmar a devolução de {loan.quantity_borrowed}x "{loan.equipment?.name}" 
                              por {loan.borrower_name}?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleReturn(loan.id)}>
                              Confirmar Devolução
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
              <h1 className="text-2xl font-bold text-foreground">Empréstimos de Equipamentos</h1>
              <p className="text-muted-foreground">Gerencie os empréstimos e devoluções</p>
            </div>
          </div>
          <Button asChild>
            <Link to="/equipment/loan/new">
              <Plus className="mr-2 h-4 w-4" />
              Novo Empréstimo
            </Link>
          </Button>
        </div>

        {overdueLoans && overdueLoans.length > 0 && (
          <Card className="border-destructive bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
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
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="active" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Ativos ({activeLoans?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="overdue" className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Atrasados ({overdueLoans?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="returned" className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Devolvidos ({returnedLoans?.length || 0})
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
    </MainLayout>
  );
}
