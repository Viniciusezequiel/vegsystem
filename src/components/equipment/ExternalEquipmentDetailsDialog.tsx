import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Package, User, Phone, Mail, Building2, FileText, AlertCircle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface ExternalEquipmentRequest {
  id: string;
  equipment_id: string | null;
  equipment_name: string;
  quantity_requested: number;
  requester_name: string;
  requester_email: string;
  requester_phone: string;
  requester_organization: string | null;
  purpose: string;
  requested_date: string;
  expected_return_date: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

interface ExternalEquipmentDetailsDialogProps {
  request: ExternalEquipmentRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
  pending: { label: 'Pendente', variant: 'default', color: 'text-yellow-500' },
  approved: { label: 'Aprovado', variant: 'secondary', color: 'text-green-500' },
  awaiting_pickup: { label: 'Aguardando Retirada', variant: 'secondary', color: 'text-blue-500' },
  loaned: { label: 'Emprestado', variant: 'outline', color: 'text-purple-500' },
  returned: { label: 'Devolvido', variant: 'outline', color: 'text-gray-500' },
  rejected: { label: 'Rejeitado', variant: 'destructive', color: 'text-red-500' },
  cancelled: { label: 'Cancelado', variant: 'destructive', color: 'text-red-500' },
};

export function ExternalEquipmentDetailsDialog({ 
  request, 
  open, 
  onOpenChange 
}: ExternalEquipmentDetailsDialogProps) {
  const [isCancelling, setIsCancelling] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (!request) return null;

  const status = statusConfig[request.status] || { label: request.status, variant: 'default' as const, color: 'text-gray-500' };
  const isPast = new Date(request.expected_return_date) < new Date();
  const canCancel = !isPast && ['pending', 'approved', 'awaiting_pickup'].includes(request.status);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user?.email) {
        throw new Error('Você precisa estar logado para cancelar uma solicitação.');
      }

      // Verify ownership
      if (user.email.toLowerCase() !== request.requester_email.toLowerCase()) {
        throw new Error('Você não tem permissão para cancelar esta solicitação.');
      }

      const { error } = await supabase
        .from('external_equipment_requests')
        .update({ status: 'cancelled' })
        .eq('id', request.id)
        .eq('requester_email', request.requester_email);

      if (error) {
        throw new Error('Erro ao cancelar solicitação.');
      }

      queryClient.invalidateQueries({ queryKey: ['external-equipment-requests'] });
      toast({
        title: 'Solicitação cancelada',
        description: 'Sua solicitação foi cancelada com sucesso.',
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Detalhes da Solicitação
          </DialogTitle>
          <DialogDescription>
            Informações sobre sua solicitação de empréstimo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>

          {/* Equipment */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="w-4 h-4" />
              <span className="text-sm">Equipamento</span>
            </div>
            <p className="font-medium">{request.equipment_name}</p>
            <p className="text-sm text-muted-foreground">Quantidade: {request.quantity_requested}</p>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Retirada</span>
              </div>
              <p className="font-medium">
                {format(parseISO(request.requested_date), 'dd/MM/yyyy', { locale: ptBR })}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Devolução</span>
              </div>
              <p className="font-medium">
                {format(parseISO(request.expected_return_date), 'dd/MM/yyyy', { locale: ptBR })}
              </p>
            </div>
          </div>

          {/* Requester Info */}
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <h4 className="text-sm font-medium">Dados do Solicitante</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{request.requester_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{request.requester_email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{request.requester_phone}</span>
              </div>
              {request.requester_organization && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="capitalize">{request.requester_organization}</span>
                </div>
              )}
            </div>
          </div>

          {/* Purpose */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="w-4 h-4" />
              <span className="text-sm">Finalidade</span>
            </div>
            <p className="text-sm">{request.purpose}</p>
          </div>

          {/* Admin Notes */}
          {request.admin_notes && (
            <div className="space-y-1 p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Observações</span>
              </div>
              <p className="text-sm">{request.admin_notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Fechar
            </Button>
            {canCancel && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="flex-1">
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar Solicitação</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja cancelar esta solicitação de empréstimo? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancel}
                      disabled={isCancelling}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isCancelling ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Confirmar Cancelamento
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
