import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Package, User, Phone, Mail, Building2, FileText, AlertCircle, Loader2, XCircle, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
import { DatePickerInput } from '@/components/ui/DatePickerInput';

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
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [newRequestedDate, setNewRequestedDate] = useState('');
  const [newExpectedReturnDate, setNewExpectedReturnDate] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (!request) return null;

  const status = statusConfig[request.status] || { label: request.status, variant: 'default' as const, color: 'text-gray-500' };
  const isPast = new Date(request.expected_return_date) < new Date();
  const canCancel = !isPast && ['pending', 'approved', 'awaiting_pickup'].includes(request.status);
  const canReschedule = !isPast && ['pending', 'approved', 'awaiting_pickup'].includes(request.status);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user?.email) {
        throw new Error('Você precisa estar logado para cancelar uma solicitação.');
      }

      if (user.email.toLowerCase() !== request.requester_email.toLowerCase()) {
        throw new Error('Você não tem permissão para cancelar esta solicitação.');
      }

      const { error } = await supabase
        .from('external_equipment_requests')
        .update({ status: 'cancelled' })
        .eq('id', request.id)
        .ilike('requester_email', user.email || '');

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

  const handleReschedule = async () => {
    if (!newRequestedDate || !newExpectedReturnDate) {
      toast({
        title: 'Erro',
        description: 'Selecione as novas datas.',
        variant: 'destructive',
      });
      return;
    }

    if (new Date(newExpectedReturnDate) < new Date(newRequestedDate)) {
      toast({
        title: 'Erro',
        description: 'A data de devolução deve ser igual ou posterior à data de retirada.',
        variant: 'destructive',
      });
      return;
    }

    setIsRescheduling(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user?.email) {
        throw new Error('Você precisa estar logado para reagendar.');
      }

      if (user.email.toLowerCase() !== request.requester_email.toLowerCase()) {
        throw new Error('Você não tem permissão para reagendar esta solicitação.');
      }

      // Check if equipment is available for the new dates
      if (request.equipment_id) {
        const { data: existingRequests, error: checkError } = await supabase
          .from('external_equipment_requests')
          .select('id, quantity_requested')
          .eq('equipment_id', request.equipment_id)
          .neq('id', request.id)
          .in('status', ['pending', 'approved', 'awaiting_pickup', 'loaned'])
          .or(`requested_date.lte.${newExpectedReturnDate},expected_return_date.gte.${newRequestedDate}`);

        if (checkError) {
          console.error('Error checking availability:', checkError);
        } else if (existingRequests && existingRequests.length > 0) {
          // Get equipment info
          const { data: equipmentData } = await supabase
            .from('equipment')
            .select('available_quantity')
            .eq('id', request.equipment_id)
            .single();

          if (equipmentData) {
            const totalRequested = existingRequests.reduce((sum, req) => sum + req.quantity_requested, 0);
            if (totalRequested + request.quantity_requested > equipmentData.available_quantity) {
              toast({
                title: 'Data indisponível',
                description: 'O equipamento não está disponível para as datas selecionadas. Escolha outras datas.',
                variant: 'destructive',
              });
              setIsRescheduling(false);
              return;
            }
          }
        }
      }

      const { error } = await supabase
        .from('external_equipment_requests')
        .update({ 
          requested_date: newRequestedDate,
          expected_return_date: newExpectedReturnDate,
          status: 'pending'
        })
        .eq('id', request.id)
        .ilike('requester_email', user.email || '');

      if (error) {
        throw new Error('Erro ao reagendar solicitação.');
      }

      queryClient.invalidateQueries({ queryKey: ['external-equipment-requests'] });
      queryClient.invalidateQueries({ queryKey: ['external-equipment-requests-by-email'] });
      toast({
        title: 'Solicitação reagendada',
        description: 'Sua solicitação foi reagendada e aguarda nova aprovação.',
      });
      setShowRescheduleForm(false);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsRescheduling(false);
    }
  };

  const resetReschedule = () => {
    setShowRescheduleForm(false);
    setNewRequestedDate('');
    setNewExpectedReturnDate('');
  };

  const handleClose = () => {
    resetReschedule();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {showRescheduleForm ? 'Reagendar Solicitação' : 'Detalhes da Solicitação'}
          </DialogTitle>
          <DialogDescription>
            {showRescheduleForm ? 'Selecione as novas datas' : 'Informações sobre sua solicitação de empréstimo'}
          </DialogDescription>
        </DialogHeader>

        {showRescheduleForm ? (
          <div className="space-y-6 mt-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium">{request.equipment_name}</p>
              <p className="text-xs text-muted-foreground">Quantidade: {request.quantity_requested}</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Nova Data de Retirada *</Label>
                <DatePickerInput
                  value={newRequestedDate}
                  onChange={setNewRequestedDate}
                  placeholder="Selecionar data"
                  className="mt-1.5"
                  minDate={new Date()}
                />
              </div>
              <div>
                <Label>Nova Data de Devolução *</Label>
                <DatePickerInput
                  value={newExpectedReturnDate}
                  onChange={setNewExpectedReturnDate}
                  placeholder="Selecionar data"
                  className="mt-1.5"
                  minDate={newRequestedDate ? new Date(newRequestedDate) : new Date()}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Ao reagendar, sua solicitação voltará ao status "Pendente" e precisará de nova aprovação.
            </p>

            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" onClick={resetReschedule} className="flex-1">
                Voltar
              </Button>
              <Button 
                onClick={handleReschedule} 
                className="flex-1"
                disabled={isRescheduling || !newRequestedDate || !newExpectedReturnDate}
              >
                {isRescheduling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Confirmar Reagendamento
              </Button>
            </div>
          </div>
        ) : (
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
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Fechar
              </Button>
              {canReschedule && (
                <Button 
                  variant="outline" 
                  onClick={() => setShowRescheduleForm(true)} 
                  className="flex-1"
                >
                  <CalendarDays className="w-4 h-4 mr-2" />
                  Reagendar
                </Button>
              )}
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
        )}
      </DialogContent>
    </Dialog>
  );
}
