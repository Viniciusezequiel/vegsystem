import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarClock,
  Car,
  CheckCircle2,
  Copy,
  Link2,
  ListChecks,
  Plus,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUberRequests, UBER_STATUS_LABELS, type UberStatus } from '@/hooks/useUberRequests';
import { formatDateBR } from '@/lib/uberReceipt';
import UberControl from './UberControl';

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(var(--muted-foreground))',
];

export default function UberDashboard() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'solicitacoes' ? 'solicitacoes' : 'visao';
  const { data: requests = [], isLoading } = useUberRequests();

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: requests.length,
      today: requests.filter(request => request.created_at.slice(0, 10) === today).length,
      done: requests.filter(request => request.status === 'concluida').length,
      cancelled: requests.filter(request => request.status === 'cancelada').length,
    };
  }, [requests]);

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (let index = 13; index >= 0; index--) {
      const date = new Date();
      date.setDate(date.getDate() - index);
      map.set(date.toISOString().slice(0, 10), 0);
    }

    requests.forEach(request => {
      const key = request.created_at.slice(0, 10);
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
    });

    return Array.from(map.entries()).map(([date, total]) => ({
      dia: formatDateBR(date).slice(0, 5),
      total,
    }));
  }, [requests]);

  const byStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    requests.forEach(request => {
      counts[request.status] = (counts[request.status] ?? 0) + 1;
    });

    return Object.entries(counts).map(([status, value]) => ({
      name: UBER_STATUS_LABELS[status as UberStatus] ?? status,
      value,
    }));
  }, [requests]);

  const publicLink = `${window.location.origin}/solicitar-uber`;

  const cards = [
    { label: 'Total de solicitações', value: stats.total, icon: ListChecks },
    { label: 'Solicitações de hoje', value: stats.today, icon: CalendarClock },
    { label: 'Viagens concluídas', value: stats.done, icon: CheckCircle2 },
    { label: 'Canceladas', value: stats.cancelled, icon: XCircle },
  ];

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '10px',
    color: 'hsl(var(--foreground))',
  };

  return (
    <MainLayout>
      <PageHeader
        title="Uber Corporativo"
        description="Acompanhe solicitações, status das viagens e histórico de transporte corporativo."
        actions={
          <Button asChild>
            <Link to="/admin-module/uber/nova">
              <Plus className="mr-2 h-4 w-4" />
              Nova solicitação
            </Link>
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={value => setParams({ tab: value })} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl border border-border/60 bg-muted/25 p-1 sm:w-[320px]">
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="solicitacoes">Solicitações</TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="mt-0 space-y-4">
          <Card className="border-border/60 bg-card/65 shadow-sm">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Link2 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">Link público para solicitação</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{publicLink}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => {
                  void navigator.clipboard.writeText(publicLink);
                  toast.success('Link copiado!');
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar link
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(card => {
              const Icon = card.icon;
              return (
                <Card key={card.label} className="border-border/60 bg-card/65 shadow-sm">
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div>
                      <p className="text-xs text-muted-foreground">{card.label}</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums">{isLoading ? '—' : card.value}</p>
                    </div>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="border-border/60 bg-card/65 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Solicitações nos últimos 14 dias</CardTitle>
              </CardHeader>
              <CardContent className="h-[290px] px-2 pb-3 sm:px-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byDay} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="dia" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 2, 2]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/65 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Distribuição por status</CardTitle>
              </CardHeader>
              <CardContent className="h-[290px] px-2 pb-3 sm:px-4">
                {byStatus.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados ainda.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={byStatus}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={86}
                        paddingAngle={3}
                      >
                        {byStatus.map((_, index) => (
                          <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/60 bg-card/65 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
              <div>
                <CardTitle className="text-base">Solicitações recentes</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Últimos registros enviados para o módulo.</p>
              </div>
              <Badge variant="secondary">{Math.min(requests.length, 8)}</Badge>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Carregando solicitações...</div>
              ) : requests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-6 py-9 text-center">
                  <Car className="mx-auto h-8 w-8 text-muted-foreground/45" />
                  <p className="mt-3 text-sm font-medium">Nenhuma solicitação registrada</p>
                  <p className="mt-1 text-xs text-muted-foreground">As solicitações aparecerão aqui assim que forem criadas.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {requests.slice(0, 8).map(request => (
                    <div key={request.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{request.code} · {request.requester_name}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {request.origin} → {request.destination} · {formatDateBR(request.trip_date)} {request.trip_time}
                        </p>
                      </div>
                      <Badge variant="secondary" className="w-fit shrink-0">{UBER_STATUS_LABELS[request.status] ?? request.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="solicitacoes" className="mt-0">
          <UberControl embedded />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
