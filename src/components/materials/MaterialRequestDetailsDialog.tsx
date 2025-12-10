import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Truck, 
  Package,
  User,
  Calendar,
  MessageSquare,
  UserCheck
} from 'lucide-react';
import { MaterialRequest, useUpdateMaterialRequest, useDeleteMaterialRequest } from '@/hooks/useMaterialRequests';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useUsersList } from '@/hooks/useUsers';
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

const statusConfig = {
  pending: { label: 'Pendente', icon: Clock, variant: 'secondary' as const },
  approved: { label: 'Aprovada', icon: CheckCircle, variant: 'default' as const },
  rejected: { label: 'Rejeitada', icon: XCircle, variant: 'destructive' as const },
  delivered: { label: 'Entregue', icon: Truck, variant: 'outline' as const },
};

const priorityConfig = {
  low: { label: 'Baixa', color: 'bg-slate-500' },
  normal: { label: 'Normal', color: 'bg-blue-500' },
  high: { label: 'Alta', color: 'bg-orange-500' },
  urgent: { label: 'Urgente', color: 'bg-red-500' },
};

interface Props {
  request: MaterialRequest;
  open: boolean;
  onClose: () => void;
  canManage: boolean;
}

export function MaterialRequestDetailsDialog({ request, open, onClose, canManage }: Props) {
  const { isAdmin } = useAuth();
  const updateRequest = useUpdateMaterialRequest();
  const deleteRequest = useDeleteMaterialRequest();
  const { data: users = [] } = useUsersList();
  const [adminNotes, setAdminNotes] = useState(request.admin_notes || '');
  const [assignedTo, setAssignedTo] = useState(request.assigned_to || '');
  
  const status = statusConfig[request.status];
  const priority = priorityConfig[request.priority];
  const StatusIcon = status.icon;

  // Filter only active collaborators and admins
  const collaborators = users.filter(u => u.is_active && (u.role === 'admin' || u.role === 'collaborator'));

  const handleStatusChange = async (newStatus: string) => {
    await updateRequest.mutateAsync({
      id: request.id,
      status: newStatus,
      admin_notes: adminNotes,
    });
    onClose();
  };

  const handleAssign = async () => {
    const selectedUser = users.find(u => u.user_id === assignedTo);
    await updateRequest.mutateAsync({
      id: request.id,
      assigned_to: assignedTo || undefined,
      assigned_to_name: selectedUser?.full_name,
    });
    onClose();
  };

  const handleDelete = async () => {
    await deleteRequest.mutateAsync(request.id);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={status.variant} className="gap-1">
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <div className={`w-2 h-2 rounded-full ${priority.color}`} />
              {priority.label}
            </Badge>
          </div>
          <DialogTitle className="text-xl">{request.title}</DialogTitle>
          <DialogDescription>
            Solicitação de materiais
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info Section */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="w-4 h-4" />
              <span>Solicitante:</span>
              <span className="text-foreground font-medium">{request.requester_name}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>Data:</span>
              <span className="text-foreground font-medium">
                {format(new Date(request.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
            {request.assigned_to_name && (
              <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                <UserCheck className="w-4 h-4" />
                <span>Atribuído a:</span>
                <span className="text-foreground font-medium">{request.assigned_to_name}</span>
              </div>
            )}
          </div>

          {request.description && (
            <div>
              <h4 className="text-sm font-medium mb-2">Descrição / Justificativa</h4>
              <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                {request.description}
              </p>
            </div>
          )}

          <Separator />

          {/* Items Section */}
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Itens Solicitados ({request.items.length})
            </h4>
            <div className="space-y-2">
              {request.items.map((item, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50"
                >
                  <div className="flex-1">
                    <span className="font-medium">{item.name}</span>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                  <Badge variant="outline">Qtd: {item.quantity}</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Assign Collaborator */}
          {canManage && (
            <>
              <Separator />
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <UserCheck className="w-4 h-4" />
                  Atribuir a um Colaborador
                </Label>
                <div className="flex gap-2">
                  <Select value={assignedTo} onValueChange={setAssignedTo}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione um colaborador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {collaborators.map((user) => (
                        <SelectItem key={user.user_id} value={user.user_id}>
                          {user.full_name} - {user.position || user.department || user.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="outline" 
                    onClick={handleAssign}
                    disabled={updateRequest.isPending}
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Admin Notes */}
          {canManage && (
            <>
              <Separator />
              <div>
                <Label htmlFor="admin-notes" className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4" />
                  Observações do Administrador
                </Label>
                <Textarea
                  id="admin-notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Adicione observações sobre esta solicitação..."
                  rows={3}
                />
              </div>
            </>
          )}

          {request.admin_notes && !canManage && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Resposta do Administrador
                </h4>
                <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                  {request.admin_notes}
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          
          <div className="flex-1" />
          
          {canManage && request.status === 'pending' && (
            <>
              <Button 
                variant="destructive" 
                onClick={() => handleStatusChange('rejected')}
                disabled={updateRequest.isPending}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Rejeitar
              </Button>
              <Button 
                onClick={() => handleStatusChange('approved')}
                disabled={updateRequest.isPending}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Aprovar
              </Button>
            </>
          )}
          
          {canManage && request.status === 'approved' && (
            <Button 
              onClick={() => handleStatusChange('delivered')}
              disabled={updateRequest.isPending}
            >
              <Truck className="w-4 h-4 mr-2" />
              Marcar como Entregue
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
