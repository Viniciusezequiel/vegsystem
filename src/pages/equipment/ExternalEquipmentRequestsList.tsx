import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Truck,
  Search,
  User,
  Calendar,
  FileText,
  AlertTriangle,
  UserCircle
} from 'lucide-react';
import { 
  useExternalEquipmentRequests, 
  useUpdateExternalEquipmentRequest,
  useDeleteExternalEquipmentRequest,
  ExternalEquipmentRequest 
} from '@/hooks/useExternalEquipmentRequests';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

const statusConfig = {
  pending: { label: 'Pendente', icon: Clock, variant: 'secondary' as const, color: 'text-amber-500' },
  approved: { label: 'Aprovada', icon: CheckCircle, variant: 'default' as const, color: 'text-green-500' },
  awaiting_pickup: { label: 'Aguardando Retirada', icon: Package, variant: 'default' as const, color: 'text-purple-500' },
  rejected: { label: 'Rejeitada', icon: XCircle, variant: 'destructive' as const, color: 'text-red-500' },
  loaned: { label: 'Retirado', icon: Truck, variant: 'outline' as const, color: 'text-blue-500' },
  returned: { label: 'Devolvido', icon: CheckCircle, variant: 'outline' as const, color: 'text-slate-500' },
};

export default function ExternalEquipmentRequestsList() {
  const { user, isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<ExternalEquipmentRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  
  const { data: requests, isLoading } = useExternalEquipmentRequests();
  const updateRequest = useUpdateExternalEquipmentRequest();
  const deleteRequest = useDeleteExternalEquipmentRequest();

  const filteredRequests = requests?.filter(req =>
    req.requester_name.toLowerCase().includes(search.toLowerCase()) ||
    req.equipment_name.toLowerCase().includes(search.toLowerCase()) ||
    req.requester_email.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const pendingCount = requests?.filter(r => r.status === 'pending').length || 0;
  const awaitingPickupCount = requests?.filter(r => r.status === 'awaiting_pickup').length || 0;
  const loanedCount = requests?.filter(r => r.status === 'loaned').length || 0;

  const handleStatusChange = async (
    id: string, 
    newStatus: string, 
    options?: { 
      updateEquipmentQuantity?: boolean; 
      equipmentId?: string; 
      quantityChange?: number;
    }
  ) => {
    await updateRequest.mutateAsync({
      id,
      status: newStatus,
      admin_notes: adminNotes || undefined,
      processed_by: user?.id,
      processed_at: new Date().toISOString(),
      ...options,
    });
    setSelectedRequest(null);
    setAdminNotes('');
  };

  const handleDelete = async (id: string) => {
    await deleteRequest.mutateAsync(id);
    setSelectedRequest(null);
  };

  const RequestCard = ({ request }: { request: ExternalEquipmentRequest }) => {
    const status = statusConfig[request.status];
    const StatusIcon = status.icon;
    
    return (
      <Card 
        className="cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => {
          setSelectedRequest(request);
          setAdminNotes(request.admin_notes || '');
        }}
      >
        <CardContent className="pt-4">
          <div className="flex items-start justify-between mb-3">
            <Badge variant={status.variant} className="gap-1">
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {format(parseISO(request.created_at), "dd/MM/yy", { locale: ptBR })}
            </span>
          </div>
          
          <h3 className="font-semibold mb-1 line-clamp-1">{request.equipment_name}</h3>
          <p className="text-sm text-muted-foreground mb-2">
            Qtd: {request.quantity_requested}
          </p>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="w-3 h-3" />
            <span className="truncate">{request.requester_name}</span>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <Calendar className="w-3 h-3" />
            <span>
              {format(parseISO(request.requested_date), "dd/MM", { locale: ptBR })} - {format(parseISO(request.expected_return_date), "dd/MM", { locale: ptBR })}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <MainLayout>
      <div className="page-header">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg">
            <Package className="w-5 h-5 text-white" />
          </div>
          <h1 className="page-title">Solicitações Externas de Empréstimo</h1>
        </div>
        <p className="page-subtitle">Gerencie solicitações de empréstimo de clientes externos</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Package className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{awaitingPickupCount}</p>
                <p className="text-xs text-muted-foreground">Aguardando</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Truck className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{loanedCount}</p>
                <p className="text-xs text-muted-foreground">Emprestados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{requests?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar solicitações..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="gap-1">
            <Clock className="w-3 h-3" />
            Pendentes
          </TabsTrigger>
          <TabsTrigger value="awaiting_pickup" className="gap-1">
            <Package className="w-3 h-3" />
            Aguardando
          </TabsTrigger>
          <TabsTrigger value="loaned">Retirados</TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>

        {['pending', 'awaiting_pickup', 'loaned', 'all'].map(tab => (
          <TabsContent key={tab} value={tab} className="mt-6">
            {isLoading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRequests
                  .filter(r => tab === 'all' || r.status === tab)
                  .map(request => (
                    <RequestCard key={request.id} request={request} />
                  ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Details Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedRequest && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={statusConfig[selectedRequest.status].variant} className="gap-1">
                    {React.createElement(statusConfig[selectedRequest.status].icon, { className: 'w-3 h-3' })}
                    {statusConfig[selectedRequest.status].label}
                  </Badge>
                </div>
                <DialogTitle>{selectedRequest.equipment_name}</DialogTitle>
                <DialogDescription>
                  Solicitação de empréstimo externo
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Solicitante:</span>
                    <span className="font-medium">{selectedRequest.requester_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Quantidade:</span>
                    <span className="font-medium">{selectedRequest.quantity_requested}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <p className="font-medium">{selectedRequest.requester_email}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Telefone:</span>
                    <p className="font-medium">{selectedRequest.requester_phone}</p>
                  </div>
                </div>

                {selectedRequest.requester_organization && (
                  <div className="flex items-center gap-2 text-sm">
                    <UserCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Tipo:</span>
                    <span className="font-medium capitalize">{selectedRequest.requester_organization === 'professor' ? 'Professor' : selectedRequest.requester_organization === 'funcionario' ? 'Funcionário' : selectedRequest.requester_organization}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Data solicitada:</span>
                    <p className="font-medium">{format(parseISO(selectedRequest.requested_date), "dd/MM/yyyy", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Previsão de devolução:</span>
                    <p className="font-medium">{format(parseISO(selectedRequest.expected_return_date), "dd/MM/yyyy", { locale: ptBR })}</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <FileText className="w-4 h-4" />
                    Finalidade
                  </div>
                  <p className="text-sm bg-secondary/50 p-3 rounded-lg">{selectedRequest.purpose}</p>
                </div>

                <div className="space-y-2">
                  <Label>Observações do Administrador</Label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Adicione observações..."
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter className="flex-wrap gap-2">
                {isAdmin && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">Excluir</Button>
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
                        <AlertDialogAction onClick={() => handleDelete(selectedRequest.id)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                
                <div className="flex-1" />
                
                {selectedRequest.status === 'pending' && (
                  <>
                    <Button 
                      variant="destructive" 
                      onClick={() => handleStatusChange(selectedRequest.id, 'rejected')}
                      disabled={updateRequest.isPending}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Rejeitar
                    </Button>
                    <Button 
                      onClick={() => handleStatusChange(selectedRequest.id, 'awaiting_pickup', {
                        updateEquipmentQuantity: true,
                        equipmentId: selectedRequest.equipment_id || undefined,
                        quantityChange: -selectedRequest.quantity_requested,
                      })}
                      disabled={updateRequest.isPending}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Aprovar
                    </Button>
                  </>
                )}
                
                {selectedRequest.status === 'awaiting_pickup' && (
                  <Button 
                    onClick={() => handleStatusChange(selectedRequest.id, 'loaned')}
                    disabled={updateRequest.isPending}
                  >
                    <Truck className="w-4 h-4 mr-2" />
                    Registrar Retirada
                  </Button>
                )}
                
                {selectedRequest.status === 'loaned' && (
                  <Button 
                    onClick={() => handleStatusChange(selectedRequest.id, 'returned', {
                      updateEquipmentQuantity: true,
                      equipmentId: selectedRequest.equipment_id || undefined,
                      quantityChange: selectedRequest.quantity_requested,
                    })}
                    disabled={updateRequest.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Registrar Devolução
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
