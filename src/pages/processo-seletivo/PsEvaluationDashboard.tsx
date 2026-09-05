import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, BarChart3, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCoordinatorEvaluationDashboard, getStoredEvaluatorToken, validateEvaluatorSession } from '@/lib/psEvaluatorSession';

export default function PsEvaluationDashboard() {
  const { eventId } = useParams<{ eventId: string }>();
  const [token] = useState(() => eventId ? getStoredEvaluatorToken(eventId) : null);
  const [session, setSession] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId || !token) {
      setLoading(false);
      return;
    }
    validateEvaluatorSession(eventId, token).then(setSession).catch(() => setSession(null));
  }, [eventId, token]);

  useEffect(() => {
    if (!eventId || !token || !session?.valid || session.role !== 'coordinator') return;
    getCoordinatorEvaluationDashboard(eventId, token)
      .then(setData)
      .catch(() => toast.error('Não foi possível carregar o dashboard.'))
      .finally(() => setLoading(false));
  }, [eventId, token, session]);

  if (!eventId || !token || !session?.valid || session.role !== 'coordinator') {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/8 to-transparent" />
        <Card className="relative w-full max-w-md border-border/60 bg-card/85 shadow-xl shadow-black/5">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <CardTitle className="pt-2">Acesso restrito</CardTitle>
            <CardDescription>Este dashboard está disponível somente para coordenadores autenticados.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const distribution = data?.distribuicao || [];
  const criteria = data?.medias_criterios || [];
  const subs = data?.desempenho_subcoordenadores || [];
  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '10px',
    color: 'hsl(var(--foreground))',
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-3 border-b border-border/50 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{session.event_name}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">Dashboard de Avaliação</h1>
              <p className="mt-1 text-sm text-muted-foreground">Indicadores de qualidade e desempenho das avaliações de fiscais.</p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit">Visão do coordenador</Badge>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Avaliações" value={data?.total_avaliacoes} />
          <Kpi label="Fiscais avaliados" value={data?.total_fiscais_avaliados} />
          <Kpi label="Média geral" value={Number(data?.media_geral || 0).toFixed(2)} />
          <Kpi label="Retificações" value={data?.total_retificacoes} />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Distribuição de notas" description="Quantidade de avaliações por faixa de estrelas">
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={distribution} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="hsl(var(--border))" opacity={0.18} vertical={false} />
                <XAxis dataKey="stars" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'hsl(var(--foreground))' }} labelStyle={{ color: 'hsl(var(--foreground))' }} />
                <Bar dataKey="count" name="Avaliações" fill="hsl(var(--primary))" radius={[6, 6, 2, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Média por critério" description="Desempenho médio nos critérios avaliados">
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={criteria} layout="vertical" margin={{ left: 24, right: 20 }}>
                <CartesianGrid stroke="hsl(var(--border))" opacity={0.18} horizontal={false} />
                <XAxis type="number" domain={[0, 5]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="criterio" width={125} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'hsl(var(--foreground))' }} labelStyle={{ color: 'hsl(var(--foreground))' }} />
                <Bar dataKey="media" name="Média" fill="hsl(var(--primary))" radius={[2, 6, 6, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        <Card className="overflow-hidden border-border/60 bg-card/65 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Desempenho por subcoordenador</CardTitle>
            <CardDescription>Volume, média das avaliações e retificações relacionadas.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="border-y border-border/50 bg-muted/25 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Subcoordenador</th>
                    <th className="px-4 py-3">Avaliações</th>
                    <th className="px-4 py-3">Média</th>
                    <th className="px-5 py-3">Retificações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {subs.map((item: any) => (
                    <tr key={item.subcoordinator_name} className="transition-colors hover:bg-muted/15">
                      <td className="px-5 py-3 font-medium">{item.subcoordinator_name}</td>
                      <td className="px-4 py-3 tabular-nums">{item.quantidade_avaliacoes}</td>
                      <td className="px-4 py-3 font-medium tabular-nums">{Number(item.media_das_avaliacoes || 0).toFixed(2)}</td>
                      <td className="px-5 py-3 tabular-nums">{item.total_retificacoes_relacionadas}</td>
                    </tr>
                  ))}
                  {!subs.length && (
                    <tr><td colSpan={4} className="p-9 text-center text-sm text-muted-foreground">Ainda não há avaliações de subcoordenadores.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AlertMetric label="Abaixo de 3 estrelas" value={data?.avaliacoes_abaixo_tres} />
          <AlertMetric label="Fiscais com nota baixa" value={data?.fiscais_nota_baixa} />
          <AlertMetric label="Alterações de cargo" value={data?.alteracoes_cargo} />
          <AlertMetric label="Avaliações retificadas" value={data?.avaliacoes_retificadas} />
        </section>

        {loading && (
          <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        )}
      </div>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value?: string | number }) {
  return (
    <Card className="border-border/60 bg-card/65 shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value ?? 0}</p>
      </CardContent>
    </Card>
  );
}

function AlertMetric({ label, value }: { label: string; value?: number }) {
  return (
    <Card className="border-border/60 bg-card/65 shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums">{value ?? 0}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card className="border-border/60 bg-card/65 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
