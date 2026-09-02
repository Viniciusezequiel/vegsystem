import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, BarChart3, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCoordinatorEvaluationDashboard, getStoredEvaluatorToken, validateEvaluatorSession } from '@/lib/psEvaluatorSession';

const colors = { primary: 'hsl(265 85% 60%)', grid: 'hsl(var(--border))', text: 'hsl(var(--muted-foreground))' };

export default function PsEvaluationDashboard() {
  const { eventId } = useParams<{ eventId: string }>();
  const [token] = useState(() => eventId ? getStoredEvaluatorToken(eventId) : null);
  const [session, setSession] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId || !token) { setLoading(false); return; }
    validateEvaluatorSession(eventId, token).then(setSession).catch(() => setSession(null));
  }, [eventId, token]);
  useEffect(() => {
    if (!eventId || !token || !session?.valid || session.role !== 'coordinator') return;
    getCoordinatorEvaluationDashboard(eventId, token).then(setData).catch(() => toast.error('Não foi possível carregar o dashboard.')).finally(() => setLoading(false));
  }, [eventId, token, session]);

  if (!eventId || !token || !session?.valid || session.role !== 'coordinator') return <main className="flex min-h-screen items-center justify-center bg-background px-5"><Card><CardHeader><CardTitle>Acesso restrito</CardTitle><CardDescription>Este dashboard está disponível somente para coordenadores.</CardDescription></CardHeader></Card></main>;
  const distribution = data?.distribuicao || [];
  const criteria = data?.medias_criterios || [];
  const subs = data?.desempenho_subcoordenadores || [];
  return <main className="min-h-screen bg-background px-4 py-7 text-foreground sm:px-8"><div className="mx-auto max-w-7xl space-y-6"><header className="flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck /></div><div><p className="text-sm text-muted-foreground">{session.event_name}</p><h1 className="text-2xl font-bold">Dashboard de Avaliação</h1><p className="mt-1 text-muted-foreground">Visão geral da qualidade das avaliações de fiscais</p></div></header><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Avaliações" value={data?.total_avaliacoes} /><Kpi label="Fiscais avaliados" value={data?.total_fiscais_avaliados} /><Kpi label="Média geral" value={Number(data?.media_geral || 0).toFixed(2)} /><Kpi label="Retificações" value={data?.total_retificacoes} /></section><section className="grid gap-4 xl:grid-cols-2"><ChartCard title="Distribuição de notas" description="Quantidade de avaliações por faixa de estrelas"><ResponsiveContainer width="100%" height={260}><BarChart data={distribution}><CartesianGrid stroke={colors.grid} vertical={false} /><XAxis dataKey="stars" tick={{ fill: colors.text }} /><YAxis allowDecimals={false} tick={{ fill: colors.text }} /><Tooltip /><Bar dataKey="count" name="Avaliações" fill={colors.primary} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard><ChartCard title="Média por critério" description="Desempenho médio nos critérios existentes"><ResponsiveContainer width="100%" height={260}><BarChart data={criteria} layout="vertical" margin={{ left: 24, right: 20 }}><CartesianGrid stroke={colors.grid} horizontal={false} /><XAxis type="number" domain={[0, 5]} tick={{ fill: colors.text }} /><YAxis type="category" dataKey="criterio" width={125} tick={{ fill: colors.text, fontSize: 11 }} /><Tooltip /><Bar dataKey="media" name="Média" fill={colors.primary} radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></ChartCard></section><Card><CardHeader><CardTitle className="text-base">Desempenho por subcoordenador</CardTitle><CardDescription>Comparativo objetivo de volume, média e retificações relacionadas</CardDescription></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="border-y bg-muted/30 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Subcoordenador</th><th className="px-4 py-3">Avaliações</th><th className="px-4 py-3">Média</th><th className="px-4 py-3">Retificações</th></tr></thead><tbody className="divide-y">{subs.map((item: any) => <tr key={item.subcoordinator_name}><td className="px-4 py-3 font-medium">{item.subcoordinator_name}</td><td className="px-4 py-3">{item.quantidade_avaliacoes}</td><td className="px-4 py-3">{Number(item.media_das_avaliacoes || 0).toFixed(2)}</td><td className="px-4 py-3">{item.total_retificacoes_relacionadas}</td></tr>)}{!subs.length && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Ainda não há avaliações de subcoordenadores.</td></tr>}</tbody></table></div></CardContent></Card><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Alert label="Abaixo de 3 estrelas" value={data?.avaliacoes_abaixo_tres} /><Alert label="Fiscais com nota baixa" value={data?.fiscais_nota_baixa} /><Alert label="Alterações de cargo" value={data?.alteracoes_cargo} /><Alert label="Avaliações retificadas" value={data?.avaliacoes_retificadas} /></section>{loading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />}</div></main>;
}

function Kpi({ label, value }: { label: string; value?: string | number }) { return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value ?? 0}</p></CardContent></Card>; }
function Alert({ label, value }: { label: string; value?: number }) { return <Card><CardContent className="flex items-center gap-3 p-4"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10 text-warning"><AlertTriangle className="h-4 w-4" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value ?? 0}</p></div></CardContent></Card>; }
function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <Card><CardHeader><div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /><CardTitle className="text-base">{title}</CardTitle></div><CardDescription>{description}</CardDescription></CardHeader><CardContent>{children}</CardContent></Card>; }