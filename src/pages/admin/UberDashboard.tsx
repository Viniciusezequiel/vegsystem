import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UberControl from './UberControl';

import {
  Car,
  Plus,
  CalendarClock,
  CheckCircle2,
  XCircle,
  ListChecks,
  Link2,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useUberRequests, UBER_STATUS_LABELS, type UberStatus } from '@/hooks/useUberRequests';
import { formatDateBR } from '@/lib/uberReceipt';

const PIE_COLORS = ['hsl(var(--primary))', '#0ea5e9', '#f59e0b', '#22c55e', '#ef4444'];

export default function UberDashboard() {
  const { data: requests = [], isLoading } = useUberRequests();

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: requests.length,
      today: requests.filter((r) => r.created_at.slice(0, 10) === today).length,
      done: requests.filter((r) => r.status === 'concluida').length,
      cancelled: requests.filter((r) => r.status === 'cancelada').length,
    };
  }, [requests]);

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      map.set(d.toISOString().slice(0, 10), 0);
    }
    requests.forEach((r) => {
      const key = r.created_at.slice(0, 10);
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([date, total]) => ({
      dia: formatDateBR(date).slice(0, 5),
      total,
    }));
  }, [requests]);

  const byStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    requests.forEach((r) => {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
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
    { label: 'Solicitações canceladas', value: stats.cancelled, icon: XCircle },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Car className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Uber Corporativo</h1>
              <p className="text-muted-foreground">Registro, acompanhamento e histórico das solicitações de transporte.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="transition-transform hover:-translate-y-0.5">
              <Link to="/admin-module/uber/nova">
                <Plus className="mr-2 h-4 w-4" /> Nova solicitação de Uber
              </Link>
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="visao">Visão geral</TabsTrigger>
            <TabsTrigger value="solicitacoes">Solicitações</TabsTrigger>
          </TabsList>

          <TabsContent value="visao" className="space-y-6 pt-4">

        <Card className="rounded-2xl">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">

            <div className="flex min-w-0 items-center gap-2 text-sm">
              <Link2 className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate text-muted-foreground">Link externo (sem login): {publicLink}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(publicLink);
                toast.success('Link copiado!');
              }}
            >
              <Copy className="mr-2 h-4 w-4" /> Copiar link
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.label} className="rounded-2xl">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                  <p className="text-3xl font-bold">{isLoading ? '—' : c.value}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <c.icon className="h-5 w-5 text-primary" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Solicitações por dia (14 dias)</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDay}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="dia" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Distribuição por status</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              {byStatus.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                      {byStatus.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend fontSize={11} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Solicitações mais recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {requests.slice(0, 8).map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {r.code} — {r.requester_name}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {r.origin} → {r.destination} · {formatDateBR(r.trip_date)} {r.trip_time}
                  </p>
                </div>
                <Badge variant="secondary">{UBER_STATUS_LABELS[r.status] ?? r.status}</Badge>
              </div>
            ))}
            {!isLoading && requests.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma solicitação registrada.</p>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="solicitacoes" className="pt-4">
            <UberControl embedded />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>

  );
}
