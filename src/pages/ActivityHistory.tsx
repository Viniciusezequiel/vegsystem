import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import {
  Activity,
  BarChart3,
  Bell,
  Box,
  Building2,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileText,
  GraduationCap,
  History,
  Layers3,
  Loader2,
  MoreVertical,
  Package,
  Search,
  Settings,
  Sparkles,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useActivityLogs, getActionLabel, getModuleLabel, ActivityLog } from '@/hooks/useActivityLogs';
import { ActivityDetailDialog } from '@/components/activity/ActivityDetailDialog';
import { format, parseISO, startOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 15;

const moduleOptions = [
  { value: 'all', label: 'Todos os Módulos', icon: Layers3 },
  { value: 'lost-items', label: 'Achados e Perdidos', icon: Package },
  { value: 'reservations', label: 'Reservas', icon: CalendarIcon },
  { value: 'equipment', label: 'Equipamentos', icon: Box },
  { value: 'lockers', label: 'Escaninhos', icon: Box },
  { value: 'tasks', label: 'Demandas', icon: FileText },
  { value: 'users', label: 'Usuários', icon: User },
  { value: 'rooms', label: 'Salas', icon: Building2 },
  { value: 'semester', label: 'Checklist Semestral', icon: ClipboardCheck },
  { value: 'classroom-calls', label: 'Chamados de Sala', icon: Bell },
  { value: 'uber', label: 'Uber Corporativo', icon: Activity },
  { value: 'processo-seletivo', label: 'Processo Seletivo', icon: GraduationCap },
  { value: 'settings', label: 'Configurações', icon: Settings },
];

const actionOptions = [
  { value: 'all', label: 'Todas as Ações' },
  { value: 'create', label: 'Criou' },
  { value: 'update', label: 'Atualizou' },
  { value: 'delete', label: 'Excluiu' },
  { value: 'approve', label: 'Aprovou' },
  { value: 'reject', label: 'Rejeitou' },
  { value: 'return', label: 'Devolveu' },
  { value: 'deliver', label: 'Entregou' },
  { value: 'import', label: 'Importou' },
  { value: 'export', label: 'Exportou' },
];

const actionStyles: Record<string, string> = {
  create: 'border-violet-500/25 bg-violet-500/12 text-violet-300',
  update: 'border-blue-500/25 bg-blue-500/12 text-blue-300',
  delete: 'border-red-500/25 bg-red-500/12 text-red-300',
  approve: 'border-emerald-500/25 bg-emerald-500/12 text-emerald-300',
  reject: 'border-rose-500/25 bg-rose-500/12 text-rose-300',
  return: 'border-cyan-500/25 bg-cyan-500/12 text-cyan-300',
  deliver: 'border-emerald-500/25 bg-emerald-500/12 text-emerald-300',
  import: 'border-amber-500/25 bg-amber-500/12 text-amber-300',
  export: 'border-indigo-500/25 bg-indigo-500/12 text-indigo-300',
};

const moduleStyles: Record<string, string> = {
  'lost-items': 'border-blue-500/25 bg-blue-500/10 text-blue-300',
  equipment: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  lockers: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300',
  tasks: 'border-violet-500/25 bg-violet-500/10 text-violet-300',
  reservations: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
  'processo-seletivo': 'border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-300',
  users: 'border-indigo-500/25 bg-indigo-500/10 text-indigo-300',
  rooms: 'border-teal-500/25 bg-teal-500/10 text-teal-300',
  semester: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  'classroom-calls': 'border-orange-500/25 bg-orange-500/10 text-orange-300',
};

const chartBarStyles = [
  'bg-violet-500',
  'bg-fuchsia-500',
  'bg-amber-500',
  'bg-blue-500',
  'bg-cyan-500',
];

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'US';
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
  accent = 'violet',
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  helper: string;
  accent?: 'violet' | 'blue' | 'cyan' | 'fuchsia';
}) {
  const accents = {
    violet: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
    blue: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
    cyan: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
    fuchsia: 'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300',
  };

  return (
    <Card className="group overflow-hidden rounded-2xl border-border/45 bg-card/65 shadow-[0_18px_40px_-30px_rgba(124,58,237,.6)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-primary/25">
      <CardContent className="flex items-center gap-3.5 p-4">
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border', accents[accent])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">{label}</p>
          <p className="mt-1 truncate text-2xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ActivityHistory() {
  const [selectedActivity, setSelectedActivity] = useState<ActivityLog | null>(null);
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: logs, isLoading } = useActivityLogs({
    module: moduleFilter !== 'all' ? moduleFilter : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    search: search || undefined,
    limit: 200,
  });

  const sourceLogs = logs ?? [];

  const collaborators = useMemo(() => {
    const map = new Map<string, string>();
    sourceLogs.forEach((log) => {
      const key = log.user_id || log.user_name;
      if (key && log.user_name) map.set(key, log.user_name);
    });
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [sourceLogs]);

  const filteredLogs = useMemo(() => sourceLogs.filter((log) => {
    if (actionFilter !== 'all' && log.action !== actionFilter) return false;
    if (userFilter !== 'all' && (log.user_id || log.user_name) !== userFilter) return false;
    return true;
  }), [sourceLogs, actionFilter, userFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, moduleFilter, actionFilter, userFilter, dateFrom, dateTo]);

  const metrics = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const weekStart = startOfDay(subDays(now, 6));
    const todayLogs = filteredLogs.filter((log) => parseISO(log.created_at) >= today);
    const weekLogs = filteredLogs.filter((log) => parseISO(log.created_at) >= weekStart);
    const activeToday = new Set(todayLogs.map((log) => log.user_id || log.user_name)).size;
    const activeWeek = new Set(weekLogs.map((log) => log.user_id || log.user_name)).size;
    const modulesWeek = new Set(weekLogs.map((log) => log.module)).size;

    const moduleCounts = filteredLogs.reduce<Record<string, number>>((acc, log) => {
      acc[log.module] = (acc[log.module] || 0) + 1;
      return acc;
    }, {});

    const sortedModules = Object.entries(moduleCounts).sort((a, b) => b[1] - a[1]);
    const [topModule, topCount] = sortedModules[0] || ['-', 0];

    return {
      total: filteredLogs.length,
      today: todayLogs.length,
      activeToday,
      topModule,
      topCount,
      sortedModules,
      weekTotal: weekLogs.length,
      weekAverage: Math.round(weekLogs.length / 7),
      activeWeek,
      modulesWeek,
    };
  }, [filteredLogs]);

  const moduleDistribution = useMemo(() => {
    const top = metrics.sortedModules.slice(0, 4);
    const other = metrics.sortedModules.slice(4).reduce((sum, [, count]) => sum + count, 0);
    const items = other > 0 ? [...top, ['other', other] as [string, number]] : top;
    return items.map(([module, count]) => ({
      module,
      count,
      percentage: metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0,
    }));
  }, [metrics.sortedModules, metrics.total]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageLogs = filteredLogs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const hasFilters = Boolean(
    search || moduleFilter !== 'all' || actionFilter !== 'all' || userFilter !== 'all' || dateFrom || dateTo
  );

  const clearFilters = () => {
    setSearch('');
    setModuleFilter('all');
    setActionFilter('all');
    setUserFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const formatDateTime = (date: string) => format(parseISO(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const exportCsv = () => {
    if (!filteredLogs.length) return;
    const escape = (value: string | null | undefined) => `"${String(value || '').replaceAll('"', '""')}"`;
    const rows = filteredLogs.map((log) => [
      formatDateTime(log.created_at),
      log.user_name,
      getModuleLabel(log.module),
      getActionLabel(log.action),
      log.entity_description || '',
      log.details || '',
    ]);
    const csv = [
      ['Data/Hora', 'Colaborador', 'Módulo', 'Ação', 'Descrição', 'Detalhes'].map(escape).join(';'),
      ...rows.map((row) => row.map(escape).join(';')),
    ].join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historico-atividades-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout>
      <div className="space-y-4 pb-2">
        <section className="flex flex-col gap-4 rounded-2xl border border-border/35 bg-gradient-to-r from-card/70 via-card/45 to-primary/[0.05] p-5 shadow-[0_24px_70px_-50px_rgba(124,58,237,.85)] backdrop-blur-xl sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/80">Gestão · Auditoria</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Histórico de Atividades</h1>
            <p className="mt-1 text-sm text-muted-foreground">Acompanhe e monitore as ações realizadas no sistema.</p>
          </div>
          <div className="hidden max-w-[310px] items-center gap-3 rounded-xl border border-primary/20 bg-primary/[0.055] px-4 py-3 lg:flex">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <BarChart3 className="h-4 w-4" />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Transparência para uma gestão mais eficiente.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-border/45 bg-card/60 p-3 shadow-[0_20px_50px_-40px_rgba(124,58,237,.6)] backdrop-blur-xl sm:p-4">
          <div className="flex flex-wrap items-end gap-2.5">
            <div className="min-w-[230px] flex-1">
              <label className="mb-1.5 block text-[10px] font-medium text-muted-foreground">Busca</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/80" />
                <Input
                  placeholder="Buscar por usuário, descrição, item..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-10 rounded-xl border-border/50 bg-background/35 pl-9 pr-3 text-xs focus-visible:ring-primary/30"
                />
              </div>
            </div>

            <div className="w-full sm:w-[190px]">
              <label className="mb-1.5 block text-[10px] font-medium text-muted-foreground">Módulo</label>
              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger className="h-10 rounded-xl border-border/50 bg-background/35 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {moduleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-3.5 w-3.5" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[calc(50%-5px)] min-w-[155px] sm:w-[170px]">
              <label className="mb-1.5 block text-[10px] font-medium text-muted-foreground">Ação</label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="h-10 rounded-xl border-border/50 bg-background/35 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {actionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[calc(50%-5px)] min-w-[180px] sm:w-[205px]">
              <label className="mb-1.5 block text-[10px] font-medium text-muted-foreground">Colaborador</label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="h-10 rounded-xl border-border/50 bg-background/35 text-xs">
                  <SelectValue placeholder="Todos os colaboradores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os colaboradores</SelectItem>
                  {collaborators.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex w-full items-end gap-2 sm:w-auto">
              <div className="min-w-0 flex-1 sm:w-[128px] sm:flex-none">
                <label className="mb-1.5 block text-[10px] font-medium text-muted-foreground">De</label>
                <DatePickerInput value={dateFrom} onChange={setDateFrom} placeholder="De" className="h-10 w-full rounded-xl bg-background/35 text-xs" />
              </div>
              <span className="mb-3 text-xs text-muted-foreground/60">—</span>
              <div className="min-w-0 flex-1 sm:w-[128px] sm:flex-none">
                <label className="mb-1.5 block text-[10px] font-medium text-muted-foreground">Até</label>
                <DatePickerInput value={dateTo} onChange={setDateTo} placeholder="Até" className="h-10 w-full rounded-xl bg-background/35 text-xs" />
              </div>
            </div>

            {hasFilters ? (
              <Button variant="ghost" size="icon" onClick={clearFilters} className="h-10 w-10 rounded-xl text-muted-foreground" title="Limpar filtros">
                <X className="h-4 w-4" />
              </Button>
            ) : null}

            <Button onClick={exportCsv} disabled={!filteredLogs.length} className="h-10 rounded-xl bg-primary px-4 text-xs shadow-[0_10px_30px_-12px_hsl(var(--primary))]">
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
          <div className="min-w-0 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              <MetricCard icon={FileText} label="Total de registros" value={metrics.total} helper="Na seleção atual" accent="blue" />
              <MetricCard icon={Zap} label="Ações hoje" value={metrics.today} helper={format(new Date(), "dd 'de' MMMM", { locale: ptBR })} accent="violet" />
              <MetricCard icon={Users} label="Usuários ativos" value={metrics.activeToday} helper="Realizaram ações hoje" accent="cyan" />
              <MetricCard
                icon={Box}
                label="Módulo mais movimentado"
                value={metrics.topModule === '-' ? '—' : getModuleLabel(metrics.topModule)}
                helper={metrics.topCount ? `${metrics.topCount} ações na seleção` : 'Sem atividade'}
                accent="fuchsia"
              />
            </div>

            <section className="overflow-hidden rounded-2xl border border-border/45 bg-card/65 shadow-[0_22px_60px_-45px_rgba(124,58,237,.7)] backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/35 px-4 py-3.5 sm:px-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                    <History className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Atividades Recentes</h2>
                    <p className="text-[10px] text-muted-foreground">Clique em um registro para visualizar os detalhes.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-border/45 bg-background/25 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                    {filteredLogs.length} registros
                  </span>
                  {totalPages > 1 ? (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <span className="min-w-[52px] text-center text-[10px] tabular-nums text-muted-foreground">{currentPage}/{totalPages}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
              ) : pageLogs.length === 0 ? (
                <div className="px-4 py-16 text-center">
                  <History className="mx-auto h-12 w-12 text-muted-foreground/30" />
                  <h3 className="mt-4 text-sm font-semibold text-foreground">Nenhuma atividade encontrada</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros para ampliar a busca.</p>
                </div>
              ) : (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/35 hover:bg-transparent">
                          <TableHead className="w-[165px] pl-5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Data/Hora</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Colaborador</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Módulo</TableHead>
                          <TableHead className="w-[120px] text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Ação</TableHead>
                          <TableHead className="hidden text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70 lg:table-cell">Descrição</TableHead>
                          <TableHead className="hidden text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70 2xl:table-cell">Detalhes</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageLogs.map((log) => (
                          <TableRow
                            key={log.id}
                            className="group cursor-pointer border-border/25 transition-colors hover:bg-primary/[0.045]"
                            onClick={() => setSelectedActivity(log)}
                          >
                            <TableCell className="whitespace-nowrap pl-5 text-[11px] font-medium tabular-nums text-foreground/85">{formatDateTime(log.created_at)}</TableCell>
                            <TableCell>
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-gradient-to-br from-primary/25 to-blue-500/15 text-[9px] font-bold text-primary">
                                  {initials(log.user_name)}
                                </span>
                                <span className="max-w-[210px] truncate text-[11px] font-semibold text-foreground/90">{log.user_name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={cn('inline-flex max-w-[180px] items-center truncate rounded-full border px-2.5 py-1 text-[9px] font-semibold', moduleStyles[log.module] || 'border-border/50 bg-muted/20 text-muted-foreground')}>
                                {getModuleLabel(log.module)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-[9px] font-semibold', actionStyles[log.action] || 'border-border/50 bg-muted/20 text-muted-foreground')}>
                                {getActionLabel(log.action)}
                              </span>
                            </TableCell>
                            <TableCell className="hidden max-w-[260px] truncate text-[11px] text-foreground/80 lg:table-cell">{log.entity_description || '—'}</TableCell>
                            <TableCell className="hidden max-w-[280px] truncate text-[11px] text-muted-foreground 2xl:table-cell">{log.details || '—'}</TableCell>
                            <TableCell>
                              <MoreVertical className="h-4 w-4 text-muted-foreground/60 transition group-hover:text-primary" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="divide-y divide-border/25 md:hidden">
                    {pageLogs.map((log) => (
                      <button
                        key={log.id}
                        type="button"
                        onClick={() => setSelectedActivity(log)}
                        className="w-full p-4 text-left transition hover:bg-primary/[0.04]"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-[9px] font-bold text-primary">
                            {initials(log.user_name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-foreground">{log.user_name}</p>
                                <p className="mt-0.5 text-[10px] text-muted-foreground">{formatDateTime(log.created_at)}</p>
                              </div>
                              <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold', actionStyles[log.action] || 'border-border/50 bg-muted/20 text-muted-foreground')}>
                                {getActionLabel(log.action)}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-semibold', moduleStyles[log.module] || 'border-border/50 bg-muted/20 text-muted-foreground')}>
                                {getModuleLabel(log.module)}
                              </span>
                            </div>
                            <p className="mt-2 line-clamp-2 text-[11px] text-foreground/80">{log.entity_description || log.details || 'Sem descrição'}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-border/45 bg-card/65 p-4 shadow-[0_20px_50px_-40px_rgba(124,58,237,.7)] backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-foreground">Ações por módulo</h3>
                  <p className="text-[9px] text-muted-foreground">Distribuição da seleção atual</p>
                </div>
              </div>

              <div className="space-y-3.5">
                {moduleDistribution.length ? moduleDistribution.map((item, index) => (
                  <div key={item.module}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px]">
                      <span className="min-w-0 truncate font-medium text-foreground/80">{item.module === 'other' ? 'Outros' : getModuleLabel(item.module)}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{item.count} · {item.percentage}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                      <div className={cn('h-full rounded-full transition-all', chartBarStyles[index % chartBarStyles.length])} style={{ width: `${Math.max(item.percentage, 3)}%` }} />
                    </div>
                  </div>
                )) : (
                  <p className="py-6 text-center text-[10px] text-muted-foreground">Sem dados para exibir.</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border/45 bg-card/65 p-4 backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-300">
                  <CalendarIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-foreground">Resumo da semana</h3>
                  <p className="text-[9px] text-muted-foreground">Últimos 7 dias na seleção</p>
                </div>
              </div>

              <div className="divide-y divide-border/25">
                {[
                  ['Total de ações', metrics.weekTotal],
                  ['Média por dia', metrics.weekAverage],
                  ['Usuários ativos', metrics.activeWeek],
                  ['Módulos utilizados', metrics.modulesWeek],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex items-center justify-between py-2.5 text-[10px]">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold tabular-nums text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.075] to-card/60 p-4 backdrop-blur-xl">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-foreground">Dica</h3>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                    Combine módulo, ação, colaborador e período para localizar eventos específicos. A exportação respeita os filtros aplicados.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>

      <ActivityDetailDialog
        open={!!selectedActivity}
        onOpenChange={(open) => !open && setSelectedActivity(null)}
        activity={selectedActivity}
      />
    </MainLayout>
  );
}
