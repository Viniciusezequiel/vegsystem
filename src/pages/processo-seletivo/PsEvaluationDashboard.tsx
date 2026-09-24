import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getCoordinatorEvaluationDashboard,
  getStoredEvaluatorToken,
  validateEvaluatorSession,
} from '@/lib/psEvaluatorSession';

export default function PsEvaluationDashboard() {
  const { eventId } = useParams<{ eventId: string }>();
  const [token] = useState(() =>
    eventId ? getStoredEvaluatorToken(eventId) : null
  );

  const [session, setSession] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId || !token) {
      setLoading(false);
      return;
    }

    void validateEvaluatorSession(eventId, token)
      .then(setSession)
      .catch(() => setSession(null));
  }, [eventId, token]);

  useEffect(() => {
    if (
      !eventId ||
      !token ||
      !session?.valid ||
      session.role !== 'coordinator'
    ) {
      return;
    }

    void getCoordinatorEvaluationDashboard(eventId, token)
      .then(setData)
      .catch(() => toast.error('Não foi possível carregar o dashboard.'))
      .finally(() => setLoading(false));
  }, [eventId, token, session]);

  const distribution = data?.distribuicao || [];
  const criteria = data?.medias_criterios || [];
  const subs = data?.desempenho_subcoordenadores || [];

  const criteriaSummary = useMemo(() => {
    const valid = criteria
      .map((item: any) => ({
        ...item,
        media: Number(item.media || 0),
      }))
      .filter((item: any) => item.media > 0);

    return {
      weakest: valid.length
        ? [...valid].sort((a, b) => a.media - b.media)[0]
        : null,
      strongest: valid.length
        ? [...valid].sort((a, b) => b.media - a.media)[0]
        : null,
    };
  }, [criteria]);

  const attentionCount =
    Number(data?.avaliacoes_abaixo_tres || 0) +
    Number(data?.alteracoes_cargo || 0);

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '10px',
    color: 'hsl(var(--foreground))',
  };

  if (
    !eventId ||
    !token ||
    !session?.valid ||
    session.role !== 'coordinator'
  ) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/8 to-transparent" />
        <Card className="relative w-full max-w-md border-border/60 bg-card/85 shadow-xl shadow-black/5">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <CardTitle className="pt-2">Acesso restrito</CardTitle>
            <CardDescription>
              Este dashboard está disponível somente para coordenadores autenticados.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-4 border-b border-border/50 pb-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BarChart3 className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Processo Seletivo · Coordenação
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Dashboard de Avaliação
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Indicadores consolidados de qualidade, desempenho e pontos que exigem revisão.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="rounded-xl">
              <Link to={`/ps/coordenacao/${eventId}/avaliacoes`}>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Revisar avaliações
              </Link>
            </Button>

            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link to={`/ps/avaliador/${eventId}`}>
                Voltar ao portal
              </Link>
            </Button>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 text-primary">
            {session.event_name}
          </Badge>
          <Badge variant="outline" className="rounded-full text-[10px]">
            Visão do coordenador
          </Badge>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Avaliações"
            value={data?.total_avaliacoes}
            helper={`${data?.total_fiscais_avaliados || 0} fiscal(is) diferente(s)`}
            icon={<CheckCircle2 className="h-4 w-4" />}
          />

          <Kpi
            label="Média geral"
            value={Number(data?.media_geral || 0).toFixed(2)}
            helper="média consolidada dos critérios"
            icon={<BarChart3 className="h-4 w-4" />}
          />

          <Kpi
            label="Notas abaixo de 3"
            value={data?.avaliacoes_abaixo_tres}
            helper={`${data?.fiscais_nota_baixa || 0} fiscal(is) com nota baixa`}
            icon={<AlertTriangle className="h-4 w-4" />}
            tone={Number(data?.avaliacoes_abaixo_tres || 0) ? 'warning' : 'success'}
          />

          <Kpi
            label="Retificações"
            value={data?.total_retificacoes}
            helper={`${data?.avaliacoes_retificadas || 0} avaliação(ões) afetada(s)`}
            icon={<ClipboardCheck className="h-4 w-4" />}
          />
        </section>

        {attentionCount > 0 && (
          <Card className="rounded-2xl border-amber-500/20 bg-amber-500/[0.025]">
            <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold">Pontos para conferência</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {[
                    Number(data?.avaliacoes_abaixo_tres || 0)
                      ? `${data.avaliacoes_abaixo_tres} avaliação(ões) abaixo de 3.`
                      : '',
                    Number(data?.alteracoes_cargo || 0)
                      ? `${data.alteracoes_cargo} avaliação(ões) registraram alteração de cargo.`
                      : '',
                  ].filter(Boolean).join(' ')}
                </p>
              </div>

              <Button asChild variant="outline" size="sm" className="rounded-xl">
                <Link to={`/ps/coordenacao/${eventId}/avaliacoes`}>
                  Abrir fila de revisão
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-2xl border-border/60 bg-card/65 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle className="text-base">Leitura dos critérios</CardTitle>
                <CardDescription>
                  Identifique rapidamente os critérios com maior e menor média.
                </CardDescription>
              </div>

              <div className="flex flex-wrap gap-2">
                {criteriaSummary.weakest && (
                  <Badge
                    variant="outline"
                    className="rounded-full border-amber-500/20 text-[9px] text-amber-500"
                  >
                    <TrendingDown className="mr-1 h-3 w-3" />
                    Menor média: {criteriaSummary.weakest.criterio} · {criteriaSummary.weakest.media.toFixed(2)}
                  </Badge>
                )}

                {criteriaSummary.strongest && (
                  <Badge
                    variant="outline"
                    className="rounded-full border-emerald-500/20 text-[9px] text-emerald-500"
                  >
                    <TrendingUp className="mr-1 h-3 w-3" />
                    Maior média: {criteriaSummary.strongest.criterio} · {criteriaSummary.strongest.media.toFixed(2)}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {criteria.map((item: any) => {
                const value = Number(item.media || 0);

                return (
                  <div
                    key={item.criterio}
                    className={`rounded-xl border p-3 ${value > 0 && value < 3
                      ? 'border-amber-500/20 bg-amber-500/[0.025]'
                      : 'border-border/60 bg-muted/[0.08]'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className="truncate text-[10px] font-semibold"
                        title={item.criterio}
                      >
                        {item.criterio}
                      </p>

                      <span className={`text-xs font-bold tabular-nums ${value > 0 && value < 3 ? 'text-amber-500' : ''}`}>
                        {value ? value.toFixed(2) : '—'}
                      </span>
                    </div>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/70">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${value ? Math.min(100, (value / 5) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 xl:grid-cols-2">
          <ChartCard
            title="Distribuição de notas"
            description="Quantidade de avaliações por faixa de estrelas."
          >
            <ResponsiveContainer width="100%" height={270}>
              <BarChart
                data={distribution}
                margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
              >
                <CartesianGrid
                  stroke="hsl(var(--border))"
                  opacity={0.18}
                  vertical={false}
                />
                <XAxis
                  dataKey="stars"
                  tick={{
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 11,
                  }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 11,
                  }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar
                  dataKey="count"
                  name="Avaliações"
                  fill="hsl(var(--primary))"
                  radius={[6, 6, 2, 2]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Média por critério"
            description="Desempenho médio nos nove critérios avaliados."
          >
            <ResponsiveContainer width="100%" height={270}>
              <BarChart
                data={criteria}
                layout="vertical"
                margin={{ left: 24, right: 20 }}
              >
                <CartesianGrid
                  stroke="hsl(var(--border))"
                  opacity={0.18}
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  domain={[0, 5]}
                  tick={{
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 11,
                  }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="criterio"
                  width={125}
                  tick={{
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 11,
                  }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar
                  dataKey="media"
                  name="Média"
                  fill="hsl(var(--primary))"
                  radius={[2, 6, 6, 2]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        <Card className="overflow-hidden rounded-2xl border-border/60 bg-card/65 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Produção por subcoordenador
            </CardTitle>
            <CardDescription>
              Volume de avaliações, média das notas registradas e retificações relacionadas.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
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
                    <tr
                      key={item.subcoordinator_name}
                      className="transition-colors hover:bg-muted/15"
                    >
                      <td className="px-5 py-3 font-medium">
                        {item.subcoordinator_name}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {item.quantidade_avaliacoes}
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums">
                        {Number(item.media_das_avaliacoes || 0).toFixed(2)}
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          variant={Number(item.total_retificacoes_relacionadas || 0) ? 'outline' : 'secondary'}
                          className={Number(item.total_retificacoes_relacionadas || 0)
                            ? 'border-amber-500/20 text-[10px] text-amber-500'
                            : 'text-[10px]'}
                        >
                          {item.total_retificacoes_relacionadas}
                        </Badge>
                      </td>
                    </tr>
                  ))}

                  {!subs.length && (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-9 text-center text-sm text-muted-foreground"
                      >
                        Ainda não há avaliações de subcoordenadores.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AlertMetric
            label="Abaixo de 3 estrelas"
            value={data?.avaliacoes_abaixo_tres}
          />
          <AlertMetric
            label="Fiscais com nota baixa"
            value={data?.fiscais_nota_baixa}
          />
          <AlertMetric
            label="Alterações de cargo"
            value={data?.alteracoes_cargo}
          />
          <AlertMetric
            label="Avaliações retificadas"
            value={data?.avaliacoes_retificadas}
            neutral
          />
        </section>

        {loading && (
          <div className="flex justify-center py-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
      </div>
    </main>
  );
}

function Kpi({
  label,
  value,
  helper,
  icon,
  tone = 'default',
}: {
  label: string;
  value?: string | number;
  helper?: string;
  icon?: ReactNode;
  tone?: 'default' | 'warning' | 'success';
}) {
  return (
    <Card
      className={`rounded-2xl shadow-sm ${tone === 'warning'
        ? 'border-amber-500/25 bg-amber-500/[0.035]'
        : tone === 'success'
          ? 'border-emerald-500/20 bg-emerald-500/[0.025]'
          : 'border-border/60 bg-card/65'}`}
    >
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value ?? 0}</p>
          {helper && (
            <p className="mt-1 text-[10px] text-muted-foreground">{helper}</p>
          )}
        </div>

        {icon && (
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone === 'warning'
              ? 'bg-amber-500/10 text-amber-500'
              : tone === 'success'
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-primary/10 text-primary'}`}
          >
            {icon}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertMetric({
  label,
  value,
  neutral = false,
}: {
  label: string;
  value?: number;
  neutral?: boolean;
}) {
  const hasValue = Number(value || 0) > 0;

  return (
    <Card
      className={`rounded-2xl shadow-sm ${!neutral && hasValue
        ? 'border-amber-500/20 bg-amber-500/[0.025]'
        : 'border-border/60 bg-card/65'}`}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${!neutral && hasValue
            ? 'bg-amber-500/10 text-amber-500'
            : 'bg-primary/10 text-primary'}`}
        >
          {neutral
            ? <CheckCircle2 className="h-4 w-4" />
            : <AlertTriangle className="h-4 w-4" />}
        </div>

        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums">
            {value ?? 0}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-2xl border-border/60 bg-card/65 shadow-sm">
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
