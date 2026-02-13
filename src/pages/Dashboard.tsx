import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Package, 
  Monitor, 
  Users, 
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Lock
} from 'lucide-react';
import { useLostItemsCounts } from '@/hooks/useLostItemsCounts';
import { useEquipmentList, useEquipmentLoans } from '@/hooks/useEquipment';
import { useLockersList, useLockerLoans } from '@/hooks/useLockers';
import { useLostItemsGlobalPrefetch } from '@/hooks/useLostItemsGlobalPrefetch';
import { 
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(var(--accent))'
];

export default function DashboardStats() {

  useLostItemsGlobalPrefetch();

  const { data: lostItemsStats } = useLostItemsCounts();

  const { data: equipmentData } = useEquipmentList();
  const { data: activeLoansData } = useEquipmentLoans('active');
  const { data: lockersData } = useLockersList();
  const { data: lockerLoansData } = useLockerLoans('active');

  // 🔥 BLINDAGEM TOTAL — NUNCA SERÁ UNDEFINED
  const equipment = Array.isArray(equipmentData) ? equipmentData : [];
  const activeLoans = Array.isArray(activeLoansData) ? activeLoansData : [];
  const lockers = Array.isArray(lockersData) ? lockersData : [];
  const lockerLoans = Array.isArray(lockerLoansData) ? lockerLoansData : [];

  const equipmentStats = {
    total: equipment.length,
    available: equipment.filter(e => e.status === 'available').length,
    borrowed: equipment.filter(e => e.status === 'borrowed').length,
    maintenance: equipment.filter(e => e.status === 'maintenance').length,
  };

  const lockerStats = {
    total: lockers.length,
    available: lockers.filter(l => l.status === 'available').length,
    occupied: lockers.filter(l => l.status === 'occupied').length,
  };

  const lostItemsPieData = [
    { name: 'Disponíveis', value: lostItemsStats?.available ?? 0 },
    { name: 'Entregues', value: lostItemsStats?.delivered ?? 0 },
    { name: 'Expirados', value: lostItemsStats?.expired ?? 0 },
  ].filter(d => d.value > 0);

  const equipmentPieData = [
    { name: 'Disponíveis', value: equipmentStats.available },
    { name: 'Emprestados', value: equipmentStats.borrowed },
    { name: 'Manutenção', value: equipmentStats.maintenance },
  ].filter(d => d.value > 0);

  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title">Dashboard de Estatísticas</h1>
        <p className="page-subtitle">Visão geral do sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">

        <Card>
          <CardHeader>
            <CardTitle>Achados e Perdidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lostItemsStats?.total ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Equipamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{equipmentStats.total}</div>
            <div className="text-sm text-muted-foreground">
              {activeLoans.length} emprestados
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Escaninhos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lockerStats.total}</div>
            <div className="text-sm text-muted-foreground">
              {lockerLoans.length} em uso
            </div>
          </CardContent>
        </Card>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <Card>
          <CardHeader>
            <CardTitle>Status dos Equipamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {equipmentPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={equipmentPieData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                    >
                      {equipmentPieData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Nenhum equipamento encontrado
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status dos Itens Perdidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {lostItemsPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={lostItemsPieData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                    >
                      {lostItemsPieData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
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
    </MainLayout>
  );
}
