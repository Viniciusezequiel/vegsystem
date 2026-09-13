import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Clock3,
  History,
  Monitor,
  PackageSearch,
  Sparkles,
  Tag,
  Wrench,
  Zap,
} from 'lucide-react';
import { useLostItemsCounts } from '@/hooks/useLostItemsCounts';
import { useLostItems } from '@/hooks/useLostItems';
import { useEquipmentList, useEquipmentLoans, useOverdueLoans } from '@/hooks/useEquipment';
import { useClassroomCalls } from '@/hooks/useClassroomCalls';
import { useTasks } from '@/hooks/useTasks';
import {
  getActionLabel,
  getModuleLabel,
  useActivityLogs,
} from '@/hooks/useActivityLogs';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  differenceInHours,
  format,
  formatDistanceToNow,
  startOfDay,
  subDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CHART_COLORS = {
  tasks: '#8b5cf6',
  loans: '#2dd4bf',
  lost: '#ec4899',
  calls: '#f59e0b',
};

const LOST_COLORS = ['#8b5cf6', '#2dd4bf', '#ec4899'];
const LOAN_COLORS = ['#2dd4bf', '#fb7185'];

function dayKey(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function clampLabel(value: string, max = 64) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function DashboardPanel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={`h-full overflow-hidden rounded-2xl border border-border/50 bg-card/70 shadow-[0_18px_45px_-30px_rgba(71,36,150,0.75)] backdrop-blur-sm transition-colors duration-200 hover:border-border/70 ${className}`}
    >
      {children}
    </Card>
  );
}

function MiniSparkline({
  data,
  dataKey,
  color,
  gradientId,
}: {
  data: Array<Record<string, string | number>>;
  dataKey: string;
  color: string;
  gradientId: string;
}) {
  return (
    <div className="hidden h-12 w-24 opacity-95 xs:block sm:w-28" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.42} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2.2}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function KpiCard({
  label,
  value,
  helper,
  icon,
  iconClass,
  data,
  dataKey,
  color,
  onClick,
}: {
  label: string;
  value: number;
  helper: string;
  icon: ReactNode;
  iconClass: string;
  data: Array<Record<string, string | number>>;
  dataKey: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${value}. ${helper}`}
      className="group relative min-h-[126px] w-full overflow-hidden rounded-2xl border border-border/50 bg-card/70 p-4 text-left shadow-[0_18px_45px_-30px_rgba(71,36,150,0.8)] transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:min-h-[132px]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,hsl(var(--primary)/0.11),transparent_42%)] opacity-80" />
      <ArrowRight className="pointer-events-none absolute right-3 top-3 h-3.5 w-3.5 -translate-x-1 text-muted-foreground/0 transition duration-200 group-hover:translate-x-0 group-hover:text-primary/70" />

      <div className="relative flex h-full items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-2.5 sm:gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/5 ${iconClass}`}>
              {icon}
            </span>
            <p className="min-w-0 text-sm font-semibold leading-tight text-foreground/90">{label}</p>
          </div>
          <div className="text-3xl font-bold tracking-tight text-foreground tabular-nums">{value}</div>
          <p className="mt-1 max-w-[190px] text-[11px] leading-snug text-muted-foreground">{helper}</p>
        </div>

        <div className="mt-auto shrink-0 self-end">
          <MiniSparkline
            data={data}
            dataKey={dataKey}
            color={color}
            gradientId={`mini-${dataKey}`}
          />
        </div>
      </div>
    </button>
  );
}

function DepthDonut({
  id,
  title,
  subtitle,
  data,
  colors,
  centerValue,
  centerLabel,
  footer,
}: {
  id: string;
  title: string;
  subtitle: string;
  data: Array<{ name: string; value: number }>;
  colors: string[];
  centerValue: string | number;
  centerLabel: string;
  footer?: ReactNode;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const chartData = data.filter((item) => item.value > 0);
  const legendColumns = data.length === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <DashboardPanel>
      <CardContent className="flex h-full flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
          </div>
          <span className="shrink-0 rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
            atual
          </span>
        </div>

        <div className="relative mx-auto mt-1 h-[210px] w-full max-w-[270px] sm:h-[220px]">
          {chartData.length > 0 ? (
            <>
              <div className="pointer-events-none absolute left-1/2 top-[56%] h-24 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-2xl" />
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {colors.map((color, index) => (
                      <linearGradient key={color} id={`${id}-gradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity={0.5} />
                        <stop offset="18%" stopColor={color} stopOpacity={0.96} />
                        <stop offset="72%" stopColor={color} stopOpacity={1} />
                        <stop offset="100%" stopColor="#111827" stopOpacity={0.72} />
                      </linearGradient>
                    ))}
                    <filter id={`${id}-shadow`} x="-35%" y="-35%" width="170%" height="190%">
                      <feDropShadow dx="0" dy="12" stdDeviation="9" floodColor="#000000" floodOpacity="0.42" />
                      <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#6d28d9" floodOpacity="0.22" />
                    </filter>
                  </defs>

                  <Pie
                    data={chartData}
                    dataKey="value"
                    cx="50%"
                    cy="55%"
                    innerRadius={60}
                    outerRadius={89}
                    paddingAngle={2.8}
                    startAngle={90}
                    endAngle={-270}
                    stroke="transparent"
                    isAnimationActive={false}
                  >
                    {chartData.map((_, index) => (
                      <Cell
                        key={`depth-${index}`}
                        fill={colors[index % colors.length]}
                        opacity={0.32}
                      />
                    ))}
                  </Pie>

                  <Pie
                    data={chartData}
                    dataKey="value"
                    cx="50%"
                    cy="48%"
                    innerRadius={60}
                    outerRadius={89}
                    paddingAngle={2.8}
                    cornerRadius={7}
                    startAngle={90}
                    endAngle={-270}
                    stroke="hsl(var(--background))"
                    strokeWidth={1.5}
                    style={{ filter: `url(#${id}-shadow)` }}
                  >
                    {chartData.map((_, index) => (
                      <Cell
                        key={`top-${index}`}
                        fill={`url(#${id}-gradient-${index % colors.length})`}
                      />
                    ))}
                  </Pie>

                  <Tooltip
                    formatter={(value, name) => [String(value), String(name)]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      boxShadow: '0 18px 50px rgba(0,0,0,.28)',
                    }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-3">
                <div className="rounded-full bg-background/15 px-3 py-2 text-center backdrop-blur-[2px]">
                  <div className="text-[27px] font-bold tracking-tight text-foreground tabular-nums">{centerValue}</div>
                  <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{centerLabel}</div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados no momento</div>
          )}
        </div>

        <div className={`grid ${legendColumns} gap-2`}>
          {data.map((item, index) => {
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
            const color = colors[index % colors.length];

            return (
              <div
                key={item.name}
                className="min-w-0 rounded-xl border border-border/40 bg-background/20 px-2.5 py-2.5 transition-colors hover:bg-background/30"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full shadow-[0_0_10px_currentColor]"
                    style={{ color, backgroundColor: color }}
                  />
                  <span className="truncate text-[10px] font-medium text-muted-foreground">{item.name}</span>
                </div>
                <div className="mt-1.5 flex items-end justify-between gap-1">
                  <span className="text-sm font-bold text-foreground tabular-nums">{item.value}</span>
                  <span className="text-[9px] text-muted-foreground">{pct}%</span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted/30">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
        </div>

        {footer ? <div className="mt-3 border-t border-border/30 pt-3">{footer}</div> : null}
      </CardContent>
    </DashboardPanel>
  );
}

function SectionTitle({
  icon,
  title,
  helper,
  action,
}: {
  icon: ReactNode;
  title: string;
  helper?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 shrink-0 text-primary">{icon}</span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          {helper ? <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{helper}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export default function DashboardStats() {
  const navigate = useNavigate();
  const today = useMemo(() => startOfDay(new Date()), []);
  const startWindow = useMemo(() => subDays(today, 29), [today]);
  const fromDate = format(startWindow, 'yyyy-MM-dd');
  const toDate = format(today, 'yyyy-MM-dd');

  const { data: tasks = [] } = useTasks();
  const { data: equipment = [] } = useEquipmentList();
  const { data: allLoans = [] } = useEquipmentLoans();
  const { data: activeLoans = [] } = useEquipmentLoans('active');
  const { data: overdueLoans = [] } = useOverdueLoans();
  const { data: calls = [] } = useClassroomCalls();
  const { data: lostCounts } = useLostItemsCounts();
  const { data: recentLostData } = useLostItems({
    status: 'all',
    pageSize: 2000,
    dateFrom: fromDate,
    dateTo: toDate,
  });
  const { data: expiredLostData } = useLostItems({ status: 'expired', pageSize: 3 });
  const { data: recentActivity = [], isLoading: activityLoading } = useActivityLogs({ limit: 5 });

  const recentLostItems = recentLostData?.items ?? [];
  const expiredItems = expiredLostData?.items ?? [];

  const openTasks = useMemo(
    () => tasks.filter((task) => task.status === 'pending' || task.status === 'in_progress'),
    [tasks]
  );

  const staleTasks = useMemo(
    () => openTasks
      .filter((task) => differenceInHours(new Date(), new Date(task.created_at)) >= 24)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [openTasks]
  );

  const maintenanceEquipment = useMemo(
    () => equipment.filter((item) => item.status === 'maintenance'),
    [equipment]
  );

  const equipmentAvailableUnits = useMemo(
    () => equipment.reduce((sum, item) => sum + Math.max(0, item.available_quantity ?? 0), 0),
    [equipment]
  );

  const maintenanceUnits = useMemo(
    () => maintenanceEquipment.reduce((sum, item) => sum + Math.max(1, item.quantity ?? 1), 0),
    [maintenanceEquipment]
  );

  const movementData = useMemo(() => {
    const rows = Array.from({ length: 30 }, (_, index) => {
      const date = subDays(today, 29 - index);
      return {
        key: format(date, 'yyyy-MM-dd'),
        label: format(date, 'dd/MM'),
        demandas: 0,
        emprestimos: 0,
        achados: 0,
        chamados: 0,
      };
    });

    const indexByKey = new Map(rows.map((row, index) => [row.key, index]));

    tasks.forEach((task) => {
      const index = indexByKey.get(dayKey(task.created_at));
      if (index !== undefined) rows[index].demandas += 1;
    });

    allLoans.forEach((loan) => {
      const index = indexByKey.get(dayKey(loan.created_at));
      if (index !== undefined) rows[index].emprestimos += 1;
    });

    recentLostItems.forEach((item) => {
      const index = indexByKey.get(dayKey(item.received_date || item.created_at));
      if (index !== undefined) rows[index].achados += 1;
    });

    calls.forEach((call) => {
      const index = indexByKey.get(dayKey(call.created_at));
      if (index !== undefined) rows[index].chamados += 1;
    });

    return rows;
  }, [allLoans, calls, recentLostItems, tasks, today]);

  const lostData = useMemo(
    () => [
      { name: 'Disponíveis', value: lostCounts?.available ?? 0 },
      { name: 'Entregues', value: lostCounts?.delivered ?? 0 },
      { name: 'Expirados', value: lostCounts?.expired ?? 0 },
    ],
    [lostCounts]
  );

  const overdueIds = useMemo(() => new Set(overdueLoans.map((loan) => loan.id)), [overdueLoans]);
  const activeOnTime = Math.max(0, activeLoans.filter((loan) => !overdueIds.has(loan.id)).length);
  const outstandingTotal = activeOnTime + overdueLoans.length;
  const onTimeRate = outstandingTotal > 0 ? Math.round((activeOnTime / outstandingTotal) * 100) : 100;

  const loanStatusData = useMemo(
    () => [
      { name: 'Em dia', value: activeOnTime },
      { name: 'Atrasados', value: overdueLoans.length },
    ],
    [activeOnTime, overdueLoans.length]
  );

  const callProfile = useMemo(() => {
    const total = calls.length;
    const values = [
      { label: 'Pendentes', value: calls.filter((call) => call.status === 'pending').length, color: '#f59e0b' },
      { label: 'Em atendimento', value: calls.filter((call) => call.status === 'accepted').length, color: '#3b82f6' },
      { label: 'Resolvidos', value: calls.filter((call) => call.status === 'resolved').length, color: '#2dd4bf' },
    ];
    return { total, values };
  }, [calls]);

  const attentionItems = useMemo(() => {
    const list: Array<{
      icon: ReactNode;
      title: string;
      detail: string;
      accent: string;
      path: string;
    }> = [];

    const overdue = overdueLoans[0];
    if (overdue) {
      list.push({
        icon: <Clock3 className="h-4 w-4" />,
        title: `Empréstimo vencido · ${clampLabel(overdue.equipment?.name || overdue.manual_item_name || overdue.borrower_name, 48)}`,
        detail: `Devolução prevista para ${format(new Date(`${overdue.expected_return_date}T12:00:00`), 'dd/MM/yyyy')}`,
        accent: '#fb7185',
        path: '/equipment/loans',
      });
    }

    const expired = expiredItems[0];
    if (expired) {
      list.push({
        icon: <PackageSearch className="h-4 w-4" />,
        title: `Item expirado · ${expired.code}`,
        detail: clampLabel(expired.description || 'Prazo de retirada expirado'),
        accent: '#ec4899',
        path: `/lost-found/items/${expired.id}`,
      });
    }

    const staleTask = staleTasks[0];
    if (staleTask) {
      list.push({
        icon: <ClipboardList className="h-4 w-4" />,
        title: `Demanda há mais de 24h · ${clampLabel(staleTask.title || 'Sem título', 48)}`,
        detail: `Aberta ${formatDistanceToNow(new Date(staleTask.created_at), { addSuffix: true, locale: ptBR })}`,
        accent: '#60a5fa',
        path: '/tasks/my-tasks',
      });
    }

    const maintenance = maintenanceEquipment[0];
    if (maintenance) {
      list.push({
        icon: <Wrench className="h-4 w-4" />,
        title: `Equipamento em manutenção · ${clampLabel(maintenance.name, 48)}`,
        detail: maintenance.patrimony_code ? `Patrimônio ${maintenance.patrimony_code}` : 'Indisponível para empréstimo',
        accent: '#f59e0b',
        path: '/equipment',
      });
    }

    return list.slice(0, 4);
  }, [expiredItems, maintenanceEquipment, overdueLoans, staleTasks]);

  const currentDateLabel = format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR });

  return (
    <MainLayout>
      <div className="space-y-4 pb-2">
        <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-[linear-gradient(118deg,hsl(var(--card)/.92),hsl(var(--background)/.74)_48%,hsl(var(--primary)/.10))] px-4 py-5 shadow-[0_22px_70px_-45px_hsl(var(--primary)/.95)] sm:px-6 sm:py-6">
          <div className="pointer-events-none absolute -right-10 -top-20 h-52 w-52 rounded-full bg-primary/16 blur-3xl" />
          <div className="pointer-events-none absolute right-[18%] top-0 hidden h-full w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent lg:block" />

          <div className="relative grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80 sm:tracking-[0.26em]">
                Bem-vindo ao VEG System
              </p>
              <h1 className="max-w-4xl text-[24px] font-bold leading-[1.18] tracking-tight text-foreground sm:text-[30px] sm:leading-tight">
                Grandes resultados começam com <span className="text-primary">pequenas ações bem feitas.</span>
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Organização, clareza e constância transformam a rotina em evolução.
              </p>
            </div>

            <div className="flex w-fit max-w-full items-center gap-3 rounded-xl border border-border/40 bg-background/30 px-3.5 py-3 backdrop-blur-sm sm:px-4">
              <Sparkles className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold capitalize text-foreground/90">{currentDateLabel}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Tenha um ótimo dia.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Demandas abertas"
            value={openTasks.length}
            helper="pendentes ou em andamento"
            icon={<ClipboardList className="h-5 w-5" />}
            iconClass="bg-violet-500/15 text-violet-300"
            data={movementData}
            dataKey="demandas"
            color={CHART_COLORS.tasks}
            onClick={() => navigate('/tasks/my-tasks')}
          />
          <KpiCard
            label="Empréstimos ativos"
            value={activeLoans.length}
            helper="equipamentos ainda em circulação"
            icon={<Monitor className="h-5 w-5" />}
            iconClass="bg-emerald-500/15 text-emerald-300"
            data={movementData}
            dataKey="emprestimos"
            color={CHART_COLORS.loans}
            onClick={() => navigate('/equipment/loans')}
          />
          <KpiCard
            label="Achados registrados (30d)"
            value={recentLostData?.totalCount ?? 0}
            helper="novos itens recebidos no período"
            icon={<Tag className="h-5 w-5" />}
            iconClass="bg-pink-500/15 text-pink-300"
            data={movementData}
            dataKey="achados"
            color={CHART_COLORS.lost}
            onClick={() => navigate('/lost-found/items')}
          />
          <KpiCard
            label="Chamados de Sala"
            value={calls.length}
            helper="total registrado no sistema"
            icon={<Bell className="h-5 w-5" />}
            iconClass="bg-amber-500/15 text-amber-300"
            data={movementData}
            dataKey="chamados"
            color={CHART_COLORS.calls}
            onClick={() => navigate('/classroom-calls')}
          />
        </section>

        <section className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
          <DashboardPanel className="xl:col-span-6">
            <CardContent className="p-4 sm:p-5">
              <SectionTitle
                icon={<Boxes className="h-4 w-4" />}
                title="Movimentações dos últimos 30 dias"
                helper="Volume diário dos principais fluxos operacionais."
                action={
                  <span className="rounded-lg border border-border/40 bg-background/25 px-2.5 py-1 text-[10px] text-muted-foreground">
                    30 dias
                  </span>
                }
              />

              <div className="mt-4 h-[245px] min-w-0 sm:h-[285px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={movementData} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      {Object.entries(CHART_COLORS).map(([key, color]) => (
                        <linearGradient key={key} id={`area-${key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.24} />
                          <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.28} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={28}
                    />
                    <YAxis
                      allowDecimals={false}
                      width={34}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                        boxShadow: '0 18px 50px rgba(0,0,0,.28)',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Area type="monotone" dataKey="demandas" name="Demandas" stroke={CHART_COLORS.tasks} strokeWidth={2.2} fill="url(#area-tasks)" />
                    <Area type="monotone" dataKey="emprestimos" name="Empréstimos" stroke={CHART_COLORS.loans} strokeWidth={2.2} fill="url(#area-loans)" />
                    <Area type="monotone" dataKey="achados" name="Achados e Perdidos" stroke={CHART_COLORS.lost} strokeWidth={2.2} fill="url(#area-lost)" />
                    <Area type="monotone" dataKey="chamados" name="Chamados de Sala" stroke={CHART_COLORS.calls} strokeWidth={2.2} fill="url(#area-calls)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2 text-[10px] text-muted-foreground sm:gap-x-4 sm:text-[11px]">
                {[
                  ['Demandas', CHART_COLORS.tasks],
                  ['Empréstimos', CHART_COLORS.loans],
                  ['Achados e Perdidos', CHART_COLORS.lost],
                  ['Chamados de Sala', CHART_COLORS.calls],
                ].map(([label, color]) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    {label}
                  </span>
                ))}
              </div>
            </CardContent>
          </DashboardPanel>

          <div className="xl:col-span-3">
            <DepthDonut
              id="lost-donut"
              title="Achados e Perdidos"
              subtitle="Distribuição atual dos itens cadastrados."
              data={lostData}
              colors={LOST_COLORS}
              centerValue={lostCounts?.total ?? 0}
              centerLabel="itens"
            />
          </div>

          <div className="xl:col-span-3">
            <DepthDonut
              id="loan-donut"
              title="Empréstimos de Equipamentos"
              subtitle="Situação dos empréstimos ainda em aberto."
              data={loanStatusData}
              colors={LOAN_COLORS}
              centerValue={`${onTimeRate}%`}
              centerLabel="em dia"
              footer={
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-emerald-500/10 bg-emerald-500/8 px-2.5 py-2">
                    <p className="text-[10px] text-muted-foreground">Disponíveis</p>
                    <p className="mt-0.5 text-sm font-semibold text-emerald-300 tabular-nums">{equipmentAvailableUnits}</p>
                  </div>
                  <div className="rounded-lg border border-amber-500/10 bg-amber-500/8 px-2.5 py-2">
                    <p className="text-[10px] text-muted-foreground">Em manutenção</p>
                    <p className="mt-0.5 text-sm font-semibold text-amber-300 tabular-nums">{maintenanceUnits}</p>
                  </div>
                </div>
              }
            />
          </div>
        </section>

        <section className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
          <DashboardPanel className="xl:col-span-5">
            <CardContent className="p-4 sm:p-5">
              <SectionTitle
                icon={<AlertTriangle className="h-4 w-4 text-rose-400" />}
                title="Itens com atenção"
                helper="Situações reais que merecem uma ação agora."
                action={
                  <button
                    type="button"
                    onClick={() => navigate('/activity-history')}
                    className="text-[11px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    Ver histórico
                  </button>
                }
              />

              <div className="mt-4 space-y-2">
                {attentionItems.length > 0 ? (
                  attentionItems.map((item, index) => (
                    <button
                      key={`${item.title}-${index}`}
                      type="button"
                      onClick={() => navigate(item.path)}
                      className="group flex w-full items-center gap-3 rounded-xl border border-border/40 bg-background/20 p-3 text-left transition hover:border-primary/25 hover:bg-background/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{ color: item.accent, backgroundColor: `${item.accent}18` }}
                      >
                        {item.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-foreground/90">{item.title}</p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.detail}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                    </button>
                  ))
                ) : (
                  <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
                    <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-300">
                      <CheckCircle2 className="h-5 w-5" />
                    </span>
                    <p className="text-sm font-semibold">Tudo em dia</p>
                    <p className="mt-1 text-xs text-muted-foreground">Nenhum item crítico identificado agora.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </DashboardPanel>

          <DashboardPanel className="xl:col-span-3">
            <CardContent className="p-4 sm:p-5">
              <SectionTitle
                icon={<Bell className="h-4 w-4" />}
                title="Perfil dos chamados"
                helper="Como estão os chamados de sala registrados."
              />

              <div className="mt-5 overflow-hidden rounded-full bg-muted/30 p-0.5">
                <div className="flex h-2.5 w-full overflow-hidden rounded-full">
                  {callProfile.values.map((item) => {
                    const pct = callProfile.total > 0 ? (item.value / callProfile.total) * 100 : 0;
                    return (
                      <div
                        key={item.label}
                        className="h-full first:rounded-l-full last:rounded-r-full"
                        style={{ width: `${pct}%`, backgroundColor: item.color }}
                        title={`${item.label}: ${item.value}`}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                {callProfile.values.map((item) => {
                  const pct = callProfile.total > 0 ? Math.round((item.value / callProfile.total) * 100) : 0;
                  return (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/30 bg-background/15 px-3 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="truncate text-xs text-muted-foreground">{item.label}</span>
                      </div>
                      <div className="flex shrink-0 items-baseline gap-1.5">
                        <span className="text-sm font-semibold text-foreground tabular-nums">{item.value}</span>
                        <span className="text-[9px] text-muted-foreground">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => navigate('/classroom-calls')}
                className="mt-5 flex w-full items-center justify-between rounded-xl border border-border/40 bg-background/25 px-3 py-2.5 text-xs font-medium text-foreground/80 transition hover:border-primary/25 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                Abrir chamados
                <ArrowRight className="h-4 w-4 text-primary" />
              </button>
            </CardContent>
          </DashboardPanel>

          <DashboardPanel className="xl:col-span-4">
            <CardContent className="p-4 sm:p-5">
              <SectionTitle
                icon={<History className="h-4 w-4" />}
                title="Atividade recente"
                helper="Últimas movimentações registradas no sistema."
                action={
                  <button
                    type="button"
                    onClick={() => navigate('/activity-history')}
                    className="text-[11px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    Ver todas
                  </button>
                }
              />

              <div className="mt-4 divide-y divide-border/30">
                {activityLoading ? (
                  <div className="space-y-3 py-2">
                    {[0, 1, 2, 3].map((item) => (
                      <div key={item} className="flex animate-pulse items-center gap-3 py-2">
                        <span className="h-8 w-8 shrink-0 rounded-lg bg-muted/40" />
                        <div className="flex-1 space-y-2">
                          <div className="h-2.5 w-2/5 rounded bg-muted/40" />
                          <div className="h-2 w-3/5 rounded bg-muted/30" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentActivity.length > 0 ? (
                  recentActivity.map((activity) => (
                    <div key={activity.id} className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <History className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-xs font-semibold text-foreground/90">{activity.user_name || 'Sistema'}</p>
                          <span className="hidden shrink-0 rounded-md bg-muted/40 px-1.5 py-0.5 text-[9px] text-muted-foreground sm:inline-flex">
                            {getModuleLabel(activity.module)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {getActionLabel(activity.action)}
                          {activity.entity_description ? ` · ${activity.entity_description}` : ''}
                        </p>
                      </div>
                      <span className="max-w-[72px] shrink-0 text-right text-[9px] leading-tight text-muted-foreground/70 sm:max-w-[90px] sm:text-[10px]">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center text-xs text-muted-foreground">Nenhuma atividade recente.</div>
                )}
              </div>
            </CardContent>
          </DashboardPanel>
        </section>

        <DashboardPanel>
          <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2.5 lg:w-[190px] lg:shrink-0">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Zap className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Ações rápidas</p>
                <p className="text-[10px] text-muted-foreground">Atalhos do dia a dia</p>
              </div>
            </div>

            <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 xs:grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
              {[
                { label: 'Nova Demanda', path: '/tasks/my-tasks?new=1', icon: <ClipboardList className="h-4 w-4" />, className: 'text-violet-300' },
                { label: 'Registrar Achado', path: '/lost-found/register', icon: <Tag className="h-4 w-4" />, className: 'text-pink-300' },
                { label: 'Consultar Equipamento', path: '/equipment', icon: <Monitor className="h-4 w-4" />, className: 'text-emerald-300' },
                { label: 'Abrir Chamado', path: '/chamado-sala', icon: <Bell className="h-4 w-4" />, className: 'text-amber-300' },
                { label: 'Ver Etiquetas', path: '/labels', icon: <Boxes className="h-4 w-4" />, className: 'text-cyan-300' },
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.path)}
                  className="group flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-xl border border-border/40 bg-background/20 px-3 text-left text-xs font-medium text-foreground/80 transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <span className={`flex min-w-0 items-center gap-2 ${action.className}`}>
                    <span className="shrink-0">{action.icon}</span>
                    <span className="truncate text-foreground/80">{action.label}</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </CardContent>
        </DashboardPanel>
      </div>
    </MainLayout>
  );
}
