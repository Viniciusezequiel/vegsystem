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
  Package, 
  User, 
  Phone, 
  Calendar, 
  Clock, 
  MapPin,
  Building2,
  FileText,
  PenTool
} from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EquipmentLoan } from '@/hooks/useEquipment';

interface EquipmentLoanDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: EquipmentLoan | null;
  onReturn?: () => void;
  showReturnButton?: boolean;
}

const statusLabels = {
  active: { label: 'Ativo', variant: 'default' as const },
  returned: { label: 'Devolvido', variant: 'secondary' as const },
  overdue: { label: 'Atrasado', variant: 'destructive' as const },
};

export function EquipmentLoanDetailsDialog({
  open,
  onOpenChange,
  loan,
  onReturn,
  showReturnButton = false,
}: EquipmentLoanDetailsDialogProps) {
  if (!loan) return null;

  const isOverdue = loan.status === 'active' && isPast(parseISO(loan.expected_return_date));
  const status = isOverdue ? 'overdue' : loan.status;

  const formatDate = (date: string) => {
    return format(parseISO(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Detalhes do Empréstimo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Equipment Info */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Equipamento</p>
                <p className="text-xl font-bold">{loan.equipment?.name || 'N/A'}</p>
                <p className="text-sm text-muted-foreground">{loan.equipment?.patrimony_code}</p>
              </div>
              <Badge variant={statusLabels[status].variant} className="text-sm">
                {statusLabels[status].label}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Building2 className="w-4 h-4" />
                {loan.equipment?.campus}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                {loan.equipment?.location}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Package className="w-4 h-4" />
                Qtd: {loan.quantity_borrowed}
              </div>
            </div>
          </div>

          <Separator />

          {/* Borrower Info */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Informações do Solicitante
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
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Setor</span>
                <span>{loan.borrower_sector}</span>
              </div>
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
                <span className="text-muted-foreground">Data do Empréstimo</span>
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
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 whitespace-pre-wrap">
                  {loan.notes}
                </p>
              </div>
            </>
          )}

          {/* Borrower Signature */}
          {loan.borrower_signature && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <PenTool className="w-4 h-4" />
                  Assinatura de Retirada
                </h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Assinado por: {loan.borrower_name}
                </p>
                <img 
                  src={loan.borrower_signature} 
                  alt="Assinatura de retirada" 
                  className="border rounded-lg bg-white max-w-full"
                />
              </div>
            </>
          )}

          {/* Return Signature */}
          {loan.return_signature && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <PenTool className="w-4 h-4" />
                  Assinatura de Devolução
                </h4>
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
            <div className="pt-2">
              <Button onClick={onReturn} className="w-full">
                <Clock className="w-4 h-4 mr-2" />
                Registrar Devolução
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
