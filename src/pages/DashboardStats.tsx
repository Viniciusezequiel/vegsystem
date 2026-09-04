import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Lock,
  ArrowUpRight,
  History,
  Loader2
} from 'lucide-react';
import { useLostItemsCounts } from '@/hooks/useLostItemsCounts';
import { useEquipmentList, useEquipmentLoans } from '@/hooks/useEquipment';
import { useLockersList, useLockerLoans } from '@/hooks/useLockers';
import {
  getActionLabel,
  getModuleLabel,
  useActivityLogs,
} from '@/hooks/useActivityLogs';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
  const navigate = useNavigate();

  const handleCardKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    path: string
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigate(path);
    }
  };

  const { data: lostItemsStats } = useLostItemsCounts();
  const { data: equipment } = useEquipmentList();
  const { data: activeLoans } = useEquipmentLoans('active');
  const { data: lockers } = useLockersList();
  const { data: lockerLoans } = useLockerLoans('active');

  const {
    data: recentActivity,
    isLoading: isLoadingActivity,
  } = useActivityLogs({
    limit: 5,
  });

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

  const activeEquipmentLoans = activeLoans?.length || 0;
  const activeLockerLoans = lockerLoans?.length || 0;
  const availableLostItems = lostItemsStats?.available || 0;
  const totalLostItems = lostItemsStats?.total || 0;

  const equipmentUsagePercent = equipmentStats.total > 0
    ? Math.round((activeEquipmentLoans / equipmentStats.total) * 100)
    : 0;

  const lockerUsagePercent = lockerStats.total > 0
    ? Math.round((activeLockerLoans / lockerStats.total) * 100)
    : 0;

  const availableLostItemsPercent = totalLostItems > 0
    ? Math.round((availableLostItems / totalLostItems) * 100)
    : 0;

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
        <Card
          className="group cursor-pointer rounded-xl border-border/60 bg-card/75 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/90 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          role="link"
          tabIndex={0}
          aria-label="Abrir Achados e Perdidos"
          onClick={() => navigate('/lost-found')}
          onKeyDown={(event) => handleCardKeyDown(event, '/lost-found')}
        >
          <CardHeader className="flex flex-row items-center gap-2.5 space-y-0 px-5 pb-1 pt-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Package className="h-[17px] w-[17px]" />
            </span>
            <CardTitle className="text-sm font-medium text-foreground/90">Achados e Perdidos</CardTitle>
            <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground/50 transition-colors group-hover:text-primary" />
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

        <Card
          className="group cursor-pointer rounded-xl border-border/60 bg-card/75 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/90 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          role="link"
          tabIndex={0}
          aria-label="Abrir Equipamentos"
          onClick={() => navigate('/equipment')}
          onKeyDown={(event) => handleCardKeyDown(event, '/equipment')}
        >
          <CardHeader className="flex flex-row items-center gap-2.5 space-y-0 px-5 pb-1 pt-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Monitor className="h-[17px] w-[17px]" />
            </span>
            <CardTitle className="text-sm font-medium text-foreground/90">Equipamentos</CardTitle>
            <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground/50 transition-colors group-hover:text-primary" />
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

        <Card
          className="group cursor-pointer rounded-xl border-border/60 bg-card/75 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/90 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          role="link"
          tabIndex={0}
          aria-label="Abrir Escaninhos"
          onClick={() => navigate('/lockers')}
          onKeyDown={(event) => handleCardKeyDown(event, '/lockers')}
        >
          <CardHeader className="flex flex-row items-center gap-2.5 space-y-0 px-5 pb-1 pt-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Lock className="h-[17px] w-[17px]" />
            </span>
            <CardTitle className="text-sm font-medium text-foreground/90">Escaninhos</CardTitle>
            <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground/50 transition-colors group-hover:text-primary" />
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
            <CardDescription className="text-xs text-muted-foreground/90">Distribuição por status</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="h-[240px]">
              {equipmentPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={equipmentPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={86}
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
              Status dos Achados e Perdidos
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground/90">Distribuição por status</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="h-[240px]">
              {lostItemsPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={lostItemsPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={86}
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
        <Card
          className="group cursor-pointer rounded-xl border-border/50 bg-card/55 shadow-none transition-all duration-200 hover:border-primary/25 hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          role="link"
          tabIndex={0}
          aria-label="Abrir empréstimos ativos"
          onClick={() => navigate('/equipment/loans')}
          onKeyDown={(event) => handleCardKeyDown(event, '/equipment/loans')}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Empréstimos Ativos</p>
              <p className="truncate text-xs text-muted-foreground">Equipamentos emprestados no momento</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/90">
                {equipmentUsagePercent}% do inventário em uso
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xl font-semibold tabular-nums">{activeEquipmentLoans}</div>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/65 transition-colors group-hover:text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="group cursor-pointer rounded-xl border-border/50 bg-card/55 shadow-none transition-all duration-200 hover:border-primary/25 hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          role="link"
          tabIndex={0}
          aria-label="Abrir alocações de escaninhos"
          onClick={() => navigate('/lockers/loans')}
          onKeyDown={(event) => handleCardKeyDown(event, '/lockers/loans')}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Alocações de Escaninhos</p>
              <p className="truncate text-xs text-muted-foreground">Escaninhos atualmente em uso</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/90">
                {lockerUsagePercent}% dos escaninhos ocupados
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xl font-semibold tabular-nums">{activeLockerLoans}</div>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/65 transition-colors group-hover:text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="group cursor-pointer rounded-xl border-border/50 bg-card/55 shadow-none transition-all duration-200 hover:border-primary/25 hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          role="link"
          tabIndex={0}
          aria-label="Abrir itens disponíveis"
          onClick={() => {
            sessionStorage.setItem('lostItems_status', 'available');
            navigate('/lost-found');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              sessionStorage.setItem('lostItems_status', 'available');
              navigate('/lost-found');
            }
          }}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Itens Disponíveis</p>
              <p className="truncate text-xs text-muted-foreground">Itens aguardando retirada</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/90">
                {availableLostItemsPercent}% do total cadastrado
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xl font-semibold tabular-nums">{availableLostItems}</div>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/65 transition-colors group-hover:text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Atividade recente */}
      <Card className="mt-4 overflow-hidden rounded-xl border-border/60 bg-card/65 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4 px-5 pb-3 pt-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-[15px] font-medium">
              <History className="h-4 w-4 text-primary" />
              Atividade recente
            </CardTitle>

            <CardDescription className="mt-1 text-xs text-muted-foreground/90">
              Últimas movimentações registradas no sistema
            </CardDescription>
          </div>

          <button
            type="button"
            onClick={() => navigate('/activity-history')}
            className="group flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Ver histórico
            <ArrowUpRight className="h-3.5 w-3.5 transition-colors group-hover:text-primary" />
          </button>
        </CardHeader>

        <CardContent className="px-5 pb-4 pt-0">
          {isLoadingActivity ? (
            <div className="flex min-h-[110px] items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : recentActivity && recentActivity.length > 0 ? (
            <div className="divide-y divide-border/50">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-4 py-3 first:pt-1 last:pb-0"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/8">
                    <History className="h-3.5 w-3.5 text-primary/80" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-sm font-medium text-foreground">
                        {activity.user_name || 'Sistema'}
                      </span>

                      <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {getModuleLabel(activity.module)}
                      </span>
                    </div>

                    <p className="mt-0.5 truncate text-xs text-muted-foreground/90">
                      {getActionLabel(activity.action)}
                      {activity.entity_description
                        ? ` · ${activity.entity_description}`
                        : activity.details
                          ? ` · ${activity.details}`
                          : ''}
                    </p>
                  </div>

                  <span className="shrink-0 text-right text-[11px] text-muted-foreground/80">
                    {formatDistanceToNow(
                      new Date(activity.created_at),
                      {
                        addSuffix: true,
                        locale: ptBR,
                      }
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[110px] items-center justify-center text-sm text-muted-foreground">
              Nenhuma atividade recente registrada
            </div>
          )}
        </CardContent>
      </Card>
    </MainLayout>
  );
}
