import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Eye, Loader2, RotateCcw, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PS_CRITERIA, PS_CLASSIFICATION_LABEL } from '@/lib/psConstants';
import { getCoordinatorDashboard, getCoordinatorEvaluations, getEvaluatorSessionHistory, getStoredEvaluatorToken, requestCoordinatorRectification, validateEvaluatorSession } from '@/lib/psEvaluatorSession';

const emptyCriteria = () => Object.fromEntries(PS_CRITERIA.map(({ key }) => [key, 0])) as Record<string, number>;

export default function PsCoordinatorReview() {
  const { eventId } = useParams<{ eventId: string }>();
  const [token] = useState(() => eventId ? getStoredEvaluatorToken(eventId) : null);
  const [session, setSession] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [rectifying, setRectifying] = useState<any>(null);

  async function load() {
    if (!eventId || !token) return;
    setLoading(true);
    try {
      const [evaluations, dashboard] = await Promise.all([
        getCoordinatorEvaluations(eventId, token, search, status),
        getCoordinatorDashboard(eventId, token),
      ]);
      setRows(evaluations);
      setStats(dashboard[0] || null);
    } catch {
      toast.error('Não foi possível carregar o painel de coordenação.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (eventId && token) void validateEvaluatorSession(eventId, token).then(setSession).catch(() => setSession(null));
  }, [eventId, token]);
  useEffect(() => {
    if (session?.valid && session.role === 'coordinator') void load();
  }, [session, search, status]);

  if (!eventId || !token || !session?.valid || session.role !== 'coordinator') {
    return <main className="flex min-h-screen items-center justify-center bg-background px-5"><Card><CardHeader><CardTitle>Acesso restrito</CardTitle><CardDescription>Este painel está disponível somente para coordenadores.</CardDescription></CardHeader></Card></main>;
  }

  return <main className="min-h-screen bg-background px-4 py-7 text-foreground sm:px-8"><div className="mx-auto max-w-7xl space-y-6"><header className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck /></div><div><p className="text-sm text-muted-foreground">Processo Seletivo</p><h1 className="text-2xl font-bold">Painel de Coordenação</h1><p className="mt-1 text-muted-foreground">Conferência das avaliações realizadas pelos subcoordenadores</p></div></div><Badge variant="secondary">{session.event_name}</Badge></header><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Avaliações realizadas" value={stats?.total_avaliacoes} /><Kpi label="Fiscais avaliados" value={stats?.total_fiscais_avaliados} /><Kpi label="Pendências" value={stats?.pendencias} /><Kpi label="Retificações" value={stats?.retificacoes} /></div><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por nome, cargo ou local..." value={search} onChange={(e) => setSearch(e.target.value)} /></div><select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="all">Todas</option><option value="subcoordinators">Realizadas pelos subs</option><option value="pending">Pendentes</option><option value="rectified">Retificadas</option></select></div><Card><CardHeader><CardTitle className="text-base">Avaliações</CardTitle><CardDescription>Média geral: {stats?.media_geral ?? 0}</CardDescription></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="border-y bg-muted/30 text-left text-xs uppercase text-muted-foreground"><tr>{['Fiscal', 'Local', 'Avaliado por', 'Cargo', 'Nota', 'Classificação', 'Status', 'Ações'].map((title) => <th key={title} className="px-4 py-3 font-medium">{title}</th>)}</tr></thead><tbody className="divide-y">{loading ? <tr><td colSpan={8} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr> : rows.map((row) => <tr key={row.evaluation_id}><td className="px-4 py-3 font-medium">{row.collaborator_name}</td><td className="px-4 py-3 text-muted-foreground">{[row.campus, row.building, row.floor, row.room && `Sala ${row.room}`].filter(Boolean).join(' · ') || '—'}</td><td className="px-4 py-3">{row.evaluator_name || '—'}<span className="block text-xs text-muted-foreground">{row.evaluation_level}</span></td><td className="px-4 py-3">{row.assigned_role || '—'}</td><td className="px-4 py-3 font-semibold">{Number(row.final_score).toFixed(2)}</td><td className="px-4 py-3">{PS_CLASSIFICATION_LABEL[row.classification] || row.classification}</td><td className="px-4 py-3"><Badge variant={row.review_status === 'corrected' ? 'default' : 'secondary'}>{row.review_status === 'corrected' ? 'Retificada' : row.review_status === 'correction_requested' ? 'Correção solicitada' : 'Pendente'}</Badge></td><td className="px-4 py-3"><Button variant="ghost" size="icon" title="Visualizar" onClick={() => setSelected(row)}><Eye /></Button><Button variant="ghost" size="icon" title="Solicitar retificação" onClick={() => setRectifying(row)}><RotateCcw /></Button></td></tr>)}{!loading && !rows.length && <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">Nenhuma avaliação encontrada.</td></tr>}</tbody></table></div></CardContent></Card></div><DetailDialog row={selected} eventId={eventId} token={token} open={!!selected} onClose={() => setSelected(null)} /><RectificationDialog row={rectifying} eventId={eventId} token={token} open={!!rectifying} onClose={() => setRectifying(null)} onSuccess={() => { setRectifying(null); void load(); }} /></main>;
}

function Kpi({ label, value }: { label: string; value?: number }) { return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value ?? 0}</p></CardContent></Card>; }

function DetailDialog({ row, eventId, token, open, onClose }: any) { const [history, setHistory] = useState<any[]>([]); useEffect(() => { if (open && row) void getEvaluatorSessionHistory(eventId, token, row.evaluation_id).then(setHistory).catch(() => setHistory([])); }, [open, row, eventId, token]); if (!row) return null; return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent><DialogHeader><DialogTitle>{row.collaborator_name}</DialogTitle></DialogHeader><div className="space-y-3"><p>{row.observations || 'Nenhuma observação.'}</p><div className="grid grid-cols-2 gap-2">{PS_CRITERIA.map(({ key, label }) => <div key={key} className="flex justify-between rounded border p-2 text-sm"><span>{label}</span><strong>{row[key]}</strong></div>)}</div><Label>Histórico</Label>{history.map((item, index) => <p key={`${item.kind}-${index}`} className="rounded border p-2 text-sm">{item.kind === 'evaluation' ? 'Avaliação criada' : 'Retificação registrada'} · {new Date(item.created_at).toLocaleString('pt-BR')} {item.reason || ''}</p>)}</div></DialogContent></Dialog>; }

function RectificationDialog({ row, eventId, token, open, onClose, onSuccess }: any) { const [justification, setJustification] = useState(''); const [observations, setObservations] = useState(''); const [criteria, setCriteria] = useState<Record<string, number>>(emptyCriteria()); const [saving, setSaving] = useState(false); useEffect(() => { if (open && row) { setJustification(''); setObservations(row.observations || ''); setCriteria(Object.fromEntries(PS_CRITERIA.map(({ key }) => [key, row[key]]))); } }, [open, row]); async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); try { const result = await requestCoordinatorRectification(eventId, token, row.evaluation_id, justification, { criteria, observations }); if (!result?.success) toast.error(result?.message || 'Não foi possível registrar a retificação.'); else { toast.success('Retificação registrada com sucesso.'); onSuccess(); } } catch { toast.error('Não foi possível registrar a retificação.'); } finally { setSaving(false); } } if (!row) return null; return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Solicitar retificação</DialogTitle></DialogHeader><form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label htmlFor="review-justification">Justificativa *</Label><Textarea id="review-justification" value={justification} onChange={(e) => setJustification(e.target.value)} required /></div><div className="grid gap-2 sm:grid-cols-2">{PS_CRITERIA.map(({ key, label }) => <div key={key} className="space-y-1"><Label htmlFor={`review-${key}`}>{label}</Label><Input id={`review-${key}`} type="number" min={1} max={5} value={criteria[key]} onChange={(e) => setCriteria({ ...criteria, [key]: Number(e.target.value) })} /></div>)}</div><div className="space-y-2"><Label htmlFor="review-observations">Alterações propostas / observações</Label><Textarea id="review-observations" value={observations} onChange={(e) => setObservations(e.target.value)} /></div><DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={saving || !justification.trim()}>{saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}Confirmar retificação</Button></DialogFooter></form></DialogContent></Dialog>; }