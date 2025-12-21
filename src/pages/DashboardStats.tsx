import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Package, 
  Monitor, 
  CalendarDays, 
  Users, 
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Lock
} from 'lucide-react';
import { useLostItemsCounts } from '@/hooks/useLostItemsCounts';
import { useEquipmentList, useEquipmentLoans } from '@/hooks/useEquipment';
import { useReservations, useReservationRooms } from '@/hooks/useReservations';
import { useLockersList, useLockerLoans } from '@/hooks/useLockers';
import { useLostItemsGlobalPrefetch } from '@/hooks/useLostItemsGlobalPrefetch';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--accent))'];

export default function DashboardStats() {
  // Prefetch lost items data for instant loading when navigating
  useLostItemsGlobalPrefetch();

  const { data: lostItemsStats } = useLostItemsCounts();
  const { data: equipment } = useEquipmentList();
  const { data: activeLoans } = useEquipmentLoans('active');
  const { data: reservations } = useReservations();
  const { data: lockers } = useLockersList();
  const { data: lockerLoans } = useLockerLoans('active');
  const { data: rooms } = useReservationRooms();

  // Lost items stats come directly from the server-side counts hook

  const equipmentStats = {
    total: equipment?.length || 0,
    available: equipment?.filter(e => e.status === 'available').length || 0,
    borrowed: equipment?.filter(e => e.status === 'borrowed').length || 0,
    maintenance: equipment?.filter(e => e.status === 'maintenance').length || 0,
  };

  const reservationStats = {
    total: reservations?.length || 0,
    pending: reservations?.filter(r => r.status === 'pending').length || 0,
    confirmed: reservations?.filter(r => r.status === 'confirmed').length || 0,
    cancelled: reservations?.filter(r => r.status === 'cancelled').length || 0,
  };

  const lockerStats = {
    total: lockers?.length || 0,
    available: lockers?.filter(l => l.status === 'available').length || 0,
    occupied: lockers?.filter(l => l.status === 'occupied').length || 0,
  };

  // Room occupancy data for chart
  const roomOccupancyData = rooms?.map(room => {
    const roomReservations = reservations?.filter(r => 
      r.room_id === room.id && 
      (r.status === 'confirmed' || r.status === 'pending')
    ) || [];
    return {
      name: room.name.length > 15 ? room.name.substring(0, 15) + '...' : room.name,
      reservas: roomReservations.length,
    };
  }).sort((a, b) => b.reservas - a.reservas).slice(0, 10) || [];

  // Reservations by status for pie chart
  const reservationPieData = [
    { name: 'Confirmadas', value: reservationStats.confirmed },
    { name: 'Pendentes', value: reservationStats.pending },
    { name: 'Canceladas', value: reservationStats.cancelled },
  ].filter(d => d.value > 0);

  // Lost items by status for pie chart
  const lostItemsPieData = [
    { name: 'Disponíveis', value: lostItemsStats?.available || 0 },
    { name: 'Entregues', value: lostItemsStats?.delivered || 0 },
    { name: 'Expirados', value: lostItemsStats?.expired || 0 },
  ].filter(d => d.value > 0);

  // Recent reservations (last 7 days)
  const recentReservationsData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const count = reservations?.filter(r => {
      const createdAt = new Date(r.created_at);
      return isWithinInterval(createdAt, {
        start: startOfDay(date),
        end: endOfDay(date),
      });
    }).length || 0;
    return {
      name: format(date, 'EEE', { locale: ptBR }),
      reservas: count,
    };
  });

  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title">Dashboard de Estatísticas</h1>
        <p className="page-subtitle">Visão geral do sistema</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Achados e Perdidos</CardTitle>
            <Package className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lostItemsStats?.total || 0}</div>
            <div className="flex gap-2 mt-2 text-xs">
              <span className="text-green-500">{lostItemsStats?.available || 0} disponíveis</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-blue-500">{lostItemsStats?.delivered || 0} entregues</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Equipamentos</CardTitle>
            <Monitor className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{equipmentStats.total}</div>
            <div className="flex gap-2 mt-2 text-xs">
              <span className="text-green-500">{equipmentStats.available} disponíveis</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-yellow-500">{activeLoans?.length || 0} emprestados</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border-indigo-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Reservas</CardTitle>
            <CalendarDays className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reservationStats.total}</div>
            <div className="flex gap-2 mt-2 text-xs">
              <span className="text-green-500">{reservationStats.confirmed} confirmadas</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-yellow-500">{reservationStats.pending} pendentes</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Escaninhos</CardTitle>
            <Lock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lockerStats.total}</div>
            <div className="flex gap-2 mt-2 text-xs">
              <span className="text-green-500">{lockerStats.available} disponíveis</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-yellow-500">{lockerStats.occupied} ocupados</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Reservations by Room */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Ocupação de Salas
            </CardTitle>
            <CardDescription>Top 10 salas com mais reservas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {roomOccupancyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={roomOccupancyData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar dataKey="reservas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Nenhuma reserva encontrada
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Reservations Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Reservas nos Últimos 7 Dias
            </CardTitle>
            <CardDescription>Quantidade de reservas criadas por dia</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={recentReservationsData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Bar dataKey="reservas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pie Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reservations by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Status das Reservas
            </CardTitle>
            <CardDescription>Distribuição por status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {reservationPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reservationPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {reservationPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Nenhuma reserva encontrada
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lost Items by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Status dos Itens Perdidos
            </CardTitle>
            <CardDescription>Distribuição por status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {lostItemsPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={lostItemsPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {lostItemsPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Nenhum item encontrado
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Empréstimos Ativos</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeLoans?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Equipamentos emprestados no momento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Alocações de Escaninhos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lockerLoans?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Escaninhos atualmente em uso
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ambientes Cadastrados</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rooms?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Salas disponíveis para reserva
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
