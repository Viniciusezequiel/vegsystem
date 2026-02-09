import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { 
  Package, 
  Plus, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Truck,
  Search,
  AlertTriangle
} from 'lucide-react';
import { useMaterialRequests, useMyMaterialRequests, MaterialRequest } from '@/hooks/useMaterialRequests';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from '@/hooks/usePermissions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MaterialRequestDetailsDialog } from '@/components/materials/MaterialRequestDetailsDialog';

const statusConfig = {
  pending: { label: 'Pendente', icon: Clock, variant: 'secondary' as const, color: 'text-amber-500' },
  approved: { label: 'Aprovada', icon: CheckCircle, variant: 'default' as const, color: 'text-green-500' },
  rejected: { label: 'Rejeitada', icon: XCircle, variant: 'destructive' as const, color: 'text-red-500' },
  delivered: { label: 'Entregue', icon: Truck, variant: 'outline' as const, color: 'text-blue-500' },
};

const priorityConfig = {
  low: { label: 'Baixa', color: 'bg-slate-500' },
  normal: { label: 'Normal', color: 'bg-blue-500' },
  high: { label: 'Alta', color: 'bg-orange-500' },
  urgent: { label: 'Urgente', color: 'bg-red-500' },
};

export default function MaterialRequestsList() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { canApprove, canEdit } = useUserPermissions();
  const [search, setSearch] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null);
  
  // Fetch all requests for admins/collaborators, only own for viewers
  const { data: allRequests, isLoading: loadingAll } = useMaterialRequests();
  const { data: myRequests, isLoading: loadingMy } = useMyMaterialRequests();
  
  // Use permission system: can manage if can approve or edit materials
  const canManage = isAdmin || canApprove('materials') || canEdit('materials');
  const requests = canManage ? allRequests : myRequests;
  const isLoading = canManage ? loadingAll : loadingMy;

  const filteredRequests = requests?.filter(req =>
    req.title.toLowerCase().includes(search.toLowerCase()) ||
    req.requester_name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const pendingCount = requests?.filter(r => r.status === 'pending').length || 0;
  const approvedCount = requests?.filter(r => r.status === 'approved').length || 0;

  const RequestCard = ({ request }: { request: MaterialRequest }) => {
    const status = statusConfig[request.status];
    const priority = priorityConfig[request.priority];
    const StatusIcon = status.icon;
    
    return (
      <Card 
        className="cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => setSelectedRequest(request)}
      >
        <CardContent className="pt-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${priority.color}`} />
              <span className="text-xs text-muted-foreground">{priority.label}</span>
            </div>
            <Badge variant={status.variant} className="gap-1">
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </Badge>
          </div>
          
          <h3 className="font-semibold mb-1 line-clamp-1">{request.title}</h3>
          <p className="text-sm text-muted-foreground mb-3">
            {request.requester_name}
          </p>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{request.items.length} {request.items.length === 1 ? 'item' : 'itens'}</span>
            <span>{format(new Date(request.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <MainLayout>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 flex items-center justify-center shadow-lg">
                <Package className="w-5 h-5 text-white" />
              </div>
              <h1 className="page-title">Solicitação de Materiais</h1>
            </div>
            <p className="page-subtitle">Gerencie solicitações de materiais da equipe</p>
          </div>
          <Button onClick={() => navigate('/materials/new')} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Solicitação
          </Button>
        </div>
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
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{approvedCount}</p>
                <p className="text-xs text-muted-foreground">Aprovadas</p>
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
                <p className="text-2xl font-bold">{requests?.filter(r => r.status === 'delivered').length || 0}</p>
                <p className="text-xs text-muted-foreground">Entregues</p>
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
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="pending" className="gap-1">
            <Clock className="w-3 h-3" />
            Pendentes
          </TabsTrigger>
          <TabsTrigger value="approved">Aprovadas</TabsTrigger>
          <TabsTrigger value="delivered">Entregues</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : filteredRequests.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhuma solicitação encontrada</p>
                <Button className="mt-4" onClick={() => navigate('/materials/new')}>
                  Criar Primeira Solicitação
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRequests.map(request => (
                <RequestCard key={request.id} request={request} />
              ))}
            </div>
          )}
        </TabsContent>

        {(['pending', 'approved', 'delivered'] as const).map(status => (
          <TabsContent key={status} value={status} className="mt-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRequests
                .filter(r => r.status === status)
                .map(request => (
                  <RequestCard key={request.id} request={request} />
                ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {selectedRequest && (
        <MaterialRequestDetailsDialog
          request={selectedRequest}
          open={!!selectedRequest}
          onClose={() => setSelectedRequest(null)}
          canManage={canManage}
        />
      )}
    </MainLayout>
  );
}
