import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Box, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  Clock, 
  MapPin,
  Building2,
  FileText,
  ArrowLeftRight
} from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LockerLoan } from '@/hooks/useLockers';

interface LockerLoanDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: LockerLoan | null;
  onReturn?: () => void;
  onExchange?: () => void;
  showReturnButton?: boolean;
}

const statusLabels = {
  active: { label: 'Ativo', variant: 'default' as const },
  returned: { label: 'Devolvido', variant: 'secondary' as const },
  overdue: { label: 'Atrasado', variant: 'destructive' as const },
};

export function LockerLoanDetailsDialog({
  open,
  onOpenChange,
  loan,
  onReturn,
  onExchange,
  showReturnButton = false,
}: LockerLoanDetailsDialogProps) {
  if (!loan) return null;

  const isOverdue = loan.status === 'active' && isPast(parseISO(loan.expected_return_date));
  const status = isOverdue ? 'overdue' : loan.status;

  const formatDate = (date: string) => {
    return format(parseISO(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Box className="w-5 h-5" />
            Detalhes da Locação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Locker Info */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Escaninho</p>
                <p className="text-2xl font-bold">{loan.locker?.code || 'N/A'}</p>
              </div>
              <Badge variant={statusLabels[status].variant} className="text-sm">
                {statusLabels[status].label}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Building2 className="w-4 h-4" />
                {loan.locker?.campus}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                {loan.locker?.location}
              </div>
            </div>
          </div>

          <Separator />

          {/* Client Info */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Informações do Cliente
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Nome</span>
                <span className="font-medium">{loan.borrower_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Telefone</span>
                <a 
                  href={`https://wa.me/55${loan.borrower_phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Phone className="h-3 w-3" />
                  {loan.borrower_phone}
                </a>
              </div>
              {loan.borrower_email && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <a 
                    href={`mailto:${loan.borrower_email}`}
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Mail className="h-3 w-3" />
                    {loan.borrower_email}
                  </a>
                </div>
              )}
              {loan.borrower_sector && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Setor</span>
                  <span>{loan.borrower_sector}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Datas
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Data da Locação</span>
                <span>{formatDate(loan.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Previsão de Devolução</span>
                <span className={isOverdue ? 'text-destructive font-medium' : ''}>
                  {formatDate(loan.expected_return_date)}
                  {isOverdue && ' (Atrasado)'}
                </span>
              </div>
              {loan.actual_return_date && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Data da Devolução</span>
                  <span className="text-green-600">{formatDate(loan.actual_return_date)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {loan.notes && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Observações
                </h4>
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                  {loan.notes}
                </p>
              </div>
            </>
          )}

          {/* Return signature */}
          {loan.return_signature && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">Assinatura de Devolução</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Devolvido por: {loan.returner_name || 'N/A'}
                </p>
                <img 
                  src={loan.return_signature} 
                  alt="Assinatura de devolução" 
                  className="border rounded-lg bg-white max-w-full"
                />
              </div>
            </>
          )}

          {/* Action Buttons */}
          {showReturnButton && loan.status === 'active' && (
            <div className="pt-2 space-y-2">
              <Button onClick={onReturn} className="w-full">
                <Clock className="w-4 h-4 mr-2" />
                Registrar Devolução
              </Button>
              {onExchange && (
                <Button onClick={onExchange} variant="outline" className="w-full">
                  <ArrowLeftRight className="w-4 h-4 mr-2" />
                  Trocar Escaninho
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
