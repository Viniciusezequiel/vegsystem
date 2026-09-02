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
import { 
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--accent))'];

export default function DashboardStats() {
  const { data: lostItemsStats } = useLostItemsCounts();
  const { data: equipment } = useEquipmentList();
  const { data: activeLoans } = useEquipmentLoans('active');
  const { data: lockers } = useLockersList();
  const { data: lockerLoans } = useLockerLoans('active');

  const equipmentStats = {
    total: equipment?.length || 0,
    available: equipment?.filter(e => e.status === 'available').length || 0,
    borrowed: equipment?.filter(e => e.status === 'borrowed').length || 0,
    maintenance: equipment?.filter(e => e.status === 'maintenance').length || 0,
  };

  const lockerStats = {
    total: lockers?.length || 0,
    available: lockers?.filter(l => l.status === 'available').length || 0,
    occupied: lockers?.filter(l => l.status === 'occupied').length || 0,
  };

  // Lost items by status for pie chart
  const lostItemsPieData = [
    { name: 'Disponíveis', value: lostItemsStats?.available || 0 },
    { name: 'Entregues', value: lostItemsStats?.delivered || 0 },
    { name: 'Expirados', value: lostItemsStats?.expired || 0 },
  ].filter(d => d.value > 0);

  // Equipment by status for pie chart
  const equipmentPieData = [
    { name: 'Disponíveis', value: equipmentStats.available },
    { name: 'Emprestados', value: equipmentStats.borrowed },
    { name: 'Manutenção', value: equipmentStats.maintenance },
  ].filter(d => d.value > 0);

  return (
    <MainLayout>
      <div className="mb-4">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[30px]">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do sistema</p>
      </div>

      {/* Indicadores principais */}
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="rounded-xl border-border/60 bg-card/75 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2.5 space-y-0 px-5 pb-1 pt-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Package className="h-[17px] w-[17px]" />
            </span>
            <CardTitle className="text-sm font-medium text-foreground/80">Achados e Perdidos</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-1">
            <div className="text-[28px] font-semibold leading-tight tracking-tight">{lostItemsStats?.total || 0}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="text-success">{lostItemsStats?.available || 0} disponíveis</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-primary">{lostItemsStats?.delivered || 0} entregues</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-warning">{lostItemsStats?.expired || 0} expirados</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/60 bg-card/75 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2.5 space-y-0 px-5 pb-1 pt-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Monitor className="h-[17px] w-[17px]" />
            </span>
            <CardTitle className="text-sm font-medium text-foreground/80">Equipamentos</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-1">
            <div className="text-[28px] font-semibold leading-tight tracking-tight">{equipmentStats.total}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="text-success">{equipmentStats.available} disponíveis</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-warning">{activeLoans?.length || 0} emprestados</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/60 bg-card/75 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2.5 space-y-0 px-5 pb-1 pt-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Lock className="h-[17px] w-[17px]" />
            </span>
            <CardTitle className="text-sm font-medium text-foreground/80">Escaninhos</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-1">
            <div className="text-[28px] font-semibold leading-tight tracking-tight">{lockerStats.total}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="text-success">{lockerStats.available} disponíveis</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-warning">{lockerStats.occupied} ocupados</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribuições por status */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="rounded-xl border-border/60 bg-card/75 shadow-sm">
          <CardHeader className="px-5 pb-0 pt-4">
            <CardTitle className="flex items-center gap-2 text-[15px] font-medium">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Status dos Equipamentos
            </CardTitle>
            <CardDescription className="text-xs">Distribuição por status</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="h-[205px]">
              {equipmentPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={equipmentPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={74}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {equipmentPieData.map((entry, index) => (
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
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Nenhum equipamento encontrado
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/60 bg-card/75 shadow-sm">
          <CardHeader className="px-5 pb-0 pt-4">
            <CardTitle className="flex items-center gap-2 text-[15px] font-medium">
              <AlertCircle className="h-4 w-4 text-primary" />
              Status dos Itens Perdidos
            </CardTitle>
            <CardDescription className="text-xs">Distribuição por status</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="h-[205px]">
              {lostItemsPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={lostItemsPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={74}
                      paddingAngle={3}
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
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Nenhum item encontrado
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Indicadores operacionais */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="rounded-xl border-border/50 bg-card/55 shadow-none">
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Empréstimos Ativos</p>
              <p className="truncate text-xs text-muted-foreground">Equipamentos emprestados no momento</p>
            </div>
            <div className="text-xl font-semibold tabular-nums">{activeLoans?.length || 0}</div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/50 bg-card/55 shadow-none">
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Alocações de Escaninhos</p>
              <p className="truncate text-xs text-muted-foreground">Escaninhos atualmente em uso</p>
            </div>
            <div className="text-xl font-semibold tabular-nums">{lockerLoans?.length || 0}</div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/50 bg-card/55 shadow-none">
          <CardContent className="flex items-center gap-3 p-4">
            <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Itens Disponíveis</p>
              <p className="truncate text-xs text-muted-foreground">Itens aguardando retirada</p>
            </div>
            <div className="text-xl font-semibold tabular-nums">{lostItemsStats?.available || 0}</div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
