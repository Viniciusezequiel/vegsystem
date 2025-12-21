import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReservations } from '@/hooks/useReservations';
import { useExternalEquipmentRequestsByEmail } from '@/hooks/useExternalEquipmentRequests';
import { useExternalUserProfile } from '@/hooks/useExternalUsers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Package, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  ArrowRight,
  TrendingUp,
  History,
  User
} from 'lucide-react';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import vegSystemLogo from '@/assets/veg-system-logo.png';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-500' },
  confirmed: { label: 'Confirmada', color: 'bg-green-500' },
  cancelled: { label: 'Cancelada', color: 'bg-destructive' },
  completed: { label: 'Concluída', color: 'bg-muted' },
  approved: { label: 'Aprovado', color: 'bg-green-500' },
  awaiting_pickup: { label: 'Aguardando Retirada', color: 'bg-blue-500' },
  rejected: { label: 'Rejeitado', color: 'bg-destructive' },
  loaned: { label: 'Emprestado', color: 'bg-purple-500' },
  returned: { label: 'Devolvido', color: 'bg-muted' },
};

export default function ExternalDashboard() {
  const navigate = useNavigate();
  const { data: profile } = useExternalUserProfile();
  const { data: allReservations } = useReservations();
  const { data: equipmentRequests } = useExternalEquipmentRequestsByEmail(profile?.email || '');

  // Filter reservations for this user
  const myReservations = useMemo(() => {
    if (!profile?.email || !allReservations) return [];
    return allReservations.filter(
      (r) => r.requester_email.toLowerCase() === profile.email.toLowerCase()
    );
  }, [allReservations, profile?.email]);

  // Calculate statistics
  const stats = useMemo(() => {
    const now = new Date();
    
    // Reservation stats
    const totalReservations = myReservations.length;
    const activeReservations = myReservations.filter(r => 
      ['pending', 'confirmed'].includes(r.status) && isAfter(parseISO(r.end_datetime), now)
    ).length;
    const completedReservations = myReservations.filter(r => 
      r.status === 'completed' || (r.status === 'confirmed' && isBefore(parseISO(r.end_datetime), now))
    ).length;
    const cancelledReservations = myReservations.filter(r => r.status === 'cancelled').length;
    
    // Equipment stats
    const totalEquipmentRequests = equipmentRequests?.length || 0;
    const pendingEquipment = equipmentRequests?.filter(e => e.status === 'pending').length || 0;
    const activeLoans = equipmentRequests?.filter(e => 
      ['approved', 'awaiting_pickup', 'loaned'].includes(e.status)
    ).length || 0;
    const returnedEquipment = equipmentRequests?.filter(e => e.status === 'returned').length || 0;
    
    return {
      totalReservations,
      activeReservations,
      completedReservations,
      cancelledReservations,
      totalEquipmentRequests,
      pendingEquipment,
      activeLoans,
      returnedEquipment,
    };
  }, [myReservations, equipmentRequests]);

  // Get upcoming reservations (next 5)
  const upcomingReservations = useMemo(() => {
    const now = new Date();
    return myReservations
      .filter(r => ['pending', 'confirmed'].includes(r.status) && isAfter(parseISO(r.start_datetime), now))
      .sort((a, b) => parseISO(a.start_datetime).getTime() - parseISO(b.start_datetime).getTime())
      .slice(0, 5);
  }, [myReservations]);

  // Get pending equipment requests
  const pendingEquipmentList = useMemo(() => {
    return equipmentRequests?.filter(e => ['pending', 'approved', 'awaiting_pickup'].includes(e.status)).slice(0, 5) || [];
  }, [equipmentRequests]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={vegSystemLogo} alt="VEG System" className="h-10" />
            <div>
              <h1 className="text-xl font-bold">Meu Painel</h1>
              <p className="text-sm text-muted-foreground">Bem-vindo, {profile?.full_name || 'Usuário'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={() => navigate('/booking/profile')}>
              <User className="h-4 w-4 mr-2" />
              Meu Perfil
            </Button>
            <Button variant="default" size="sm" onClick={() => navigate('/booking')}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Fazer Reserva
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Reservas Ativas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{stats.activeReservations}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Reservas Concluídas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{stats.completedReservations}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Empréstimos Ativos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-600">{stats.activeLoans}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pendentes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-yellow-600">{stats.pendingEquipment}</p>
            </CardContent>
          </Card>
        </div>

        {/* Two columns: Upcoming Reservations + Pending Equipment */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Upcoming Reservations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Próximas Reservas
              </CardTitle>
              <CardDescription>Suas reservas agendadas</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingReservations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma reserva agendada</p>
                  <Button variant="link" className="mt-2" onClick={() => navigate('/booking')}>
                    Fazer uma reserva
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingReservations.map((reservation) => (
                    <div 
                      key={reservation.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{reservation.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {reservation.reservation_rooms?.name} • {format(parseISO(reservation.start_datetime), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`ml-2 ${statusLabels[reservation.status]?.color || 'bg-muted'} text-white border-0`}
                      >
                        {statusLabels[reservation.status]?.label || reservation.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Equipment Requests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Empréstimos Pendentes
              </CardTitle>
              <CardDescription>Solicitações em andamento</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingEquipmentList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum empréstimo pendente</p>
                  <Button variant="link" className="mt-2" onClick={() => navigate('/booking')}>
                    Solicitar equipamento
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingEquipmentList.map((request) => (
                    <div 
                      key={request.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{request.equipment_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Qtd: {request.quantity_requested} • {format(parseISO(request.requested_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`ml-2 ${statusLabels[request.status]?.color || 'bg-muted'} text-white border-0`}
                      >
                        {statusLabels[request.status]?.label || request.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Historical Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Resumo Histórico
            </CardTitle>
            <CardDescription>Seu histórico de uso do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{stats.totalReservations}</p>
                <p className="text-sm text-muted-foreground">Total de Reservas</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <XCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
                <p className="text-2xl font-bold">{stats.cancelledReservations}</p>
                <p className="text-sm text-muted-foreground">Canceladas</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <Package className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold">{stats.totalEquipmentRequests}</p>
                <p className="text-sm text-muted-foreground">Empréstimos Solicitados</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold">{stats.returnedEquipment}</p>
                <p className="text-sm text-muted-foreground">Devolvidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
