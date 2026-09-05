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
import { PS_CLASSIFICATION_LABEL, PS_CRITERIA } from '@/lib/psConstants';
import {
  getCoordinatorDashboard,
  getCoordinatorEvaluations,
  getEvaluatorSessionHistory,
  getStoredEvaluatorToken,
  requestCoordinatorRectification,
  validateEvaluatorSession,
} from '@/lib/psEvaluatorSession';

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
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/8 to-transparent" />
        <Card className="relative w-full max-w-md border-border/60 bg-card/85 shadow-xl shadow-black/5">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
            <CardTitle className="pt-2">Acesso restrito</CardTitle>
            <CardDescription>Este painel está disponível somente para coordenadores autenticados.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-3 border-b border-border/50 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Processo Seletivo</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">Painel de Coordenação</h1>
              <p className="mt-1 text-sm text-muted-foreground">Conferência e retificação das avaliações realizadas pelos subcoordenadores.</p>
            </div>
          </div>
          <Badge variant="secondary" className="w-fit">{session.event_name}</Badge>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Avaliações realizadas" value={stats?.total_avaliacoes} />
          <Kpi label="Fiscais avaliados" value={stats?.total_fiscais_avaliados} />
          <Kpi label="Pendências" value={stats?.pendencias} />
          <Kpi label="Retificações" value={stats?.retificacoes} />
        </section>

        <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card/65 p-3 shadow-sm md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome, cargo ou local..." value={search} onChange={event => setSearch(event.target.value)} />
          </div>
          <select
            value={status}
            onChange={event => setStatus(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm md:w-[220px]"
          >
            <option value="all">Todas as avaliações</option>
            <option value="pending">Pendentes de revisão</option>
            <option value="rectified">Retificadas</option>
          </select>
        </div>

        <Card className="overflow-hidden border-border/60 bg-card/65 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
            <div>
              <CardTitle className="text-base">Avaliações</CardTitle>
              <CardDescription>Média geral: {Number(stats?.media_geral || 0).toFixed(2)}</CardDescription>
            </div>
            <Badge variant="secondary">{rows.length}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] text-sm">
                <thead className="border-y border-border/50 bg-muted/25 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {['Fiscal', 'Local', 'Avaliado por', 'Cargo', 'Nota', 'Classificação', 'Status', 'Ações'].map(title => (
                      <th key={title} className="px-4 py-3 font-medium">{title}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {loading ? (
                    <tr><td colSpan={8} className="p-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /></td></tr>
                  ) : rows.map(row => (
                    <tr key={row.evaluation_id} className="transition-colors hover:bg-muted/15">
                      <td className="px-4 py-3 font-medium">{row.collaborator_name}</td>
                      <td className="max-w-[220px] px-4 py-3 text-xs text-muted-foreground">{[row.campus, row.building, row.floor, row.room && `Sala ${row.room}`].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="px-4 py-3">{row.evaluator_name || '—'}<span className="block text-[10px] text-muted-foreground">{row.evaluation_level}</span></td>
                      <td className="px-4 py-3">{row.assigned_role || '—'}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums">{Number(row.final_score).toFixed(2)}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className="text-[10px]">{PS_CLASSIFICATION_LABEL[row.classification] || row.classification}</Badge></td>
                      <td className="px-4 py-3">
                        <Badge variant={row.review_status === 'corrected' ? 'default' : 'secondary'} className="text-[10px]">
                          {row.review_status === 'corrected' ? 'Retificada' : row.review_status === 'correction_requested' ? 'Correção solicitada' : 'Pendente'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Visualizar" onClick={() => setSelected(row)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Solicitar retificação" onClick={() => setRectifying(row)}><RotateCcw className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && !rows.length && (
                    <tr><td colSpan={8} className="p-10 text-center text-sm text-muted-foreground">Nenhuma avaliação encontrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <DetailDialog row={selected} eventId={eventId} token={token} open={!!selected} onClose={() => setSelected(null)} />
      <RectificationDialog
        row={rectifying}
        eventId={eventId}
        token={token}
        open={!!rectifying}
        onClose={() => setRectifying(null)}
        onSuccess={() => { setRectifying(null); void load(); }}
      />
    </main>
  );
}

function Kpi({ label, value }: { label: string; value?: number }) {
  return (
    <Card className="border-border/60 bg-card/65 shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value ?? 0}</p>
      </CardContent>
    </Card>
  );
}

function DetailDialog({ row, eventId, token, open, onClose }: any) {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (open && row) void getEvaluatorSessionHistory(eventId, token, row.evaluation_id).then(setHistory).catch(() => setHistory([]));
  }, [open, row, eventId, token]);

  if (!row) return null;

  return (
    <Dialog open={open} onOpenChange={value => !value && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>{row.collaborator_name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-muted/15 p-3 text-sm leading-relaxed">{row.observations || 'Nenhuma observação.'}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {PS_CRITERIA.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <strong>{row[key]}</strong>
              </div>
            ))}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Histórico</Label>
            <div className="mt-2 space-y-2">
              {history.map((item, index) => (
                <div key={`${item.kind}-${index}`} className="rounded-lg border border-border/60 bg-muted/10 p-3 text-xs">
                  <p className="font-medium">{item.kind === 'evaluation' ? 'Avaliação criada' : 'Retificação registrada'}</p>
                  <p className="mt-1 text-muted-foreground">{new Date(item.created_at).toLocaleString('pt-BR')} {item.reason || ''}</p>
                </div>
              ))}
              {!history.length && <p className="text-xs text-muted-foreground">Nenhum histórico adicional.</p>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RectificationDialog({ row, eventId, token, open, onClose, onSuccess }: any) {
  const [justification, setJustification] = useState('');
  const [observations, setObservations] = useState('');
  const [criteria, setCriteria] = useState<Record<string, number>>(emptyCriteria());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && row) {
      setJustification('');
      setObservations(row.observations || '');
      setCriteria(Object.fromEntries(PS_CRITERIA.map(({ key }) => [key, row[key]])));
    }
  }, [open, row]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await requestCoordinatorRectification(eventId, token, row.evaluation_id, justification, { criteria, observations });
      if (!result?.success) toast.error(result?.message || 'Não foi possível registrar a retificação.');
      else {
        toast.success('Retificação registrada com sucesso.');
        onSuccess();
      }
    } catch {
      toast.error('Não foi possível registrar a retificação.');
    } finally {
      setSaving(false);
    }
  }

  if (!row) return null;

  return (
    <Dialog open={open} onOpenChange={value => !value && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Solicitar retificação</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="review-justification" className="text-xs text-muted-foreground">Justificativa *</Label>
            <Textarea id="review-justification" value={justification} onChange={event => setJustification(event.target.value)} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {PS_CRITERIA.map(({ key, label }) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`review-${key}`} className="text-xs text-muted-foreground">{label}</Label>
                <Input id={`review-${key}`} type="number" min={1} max={5} value={criteria[key]} onChange={event => setCriteria({ ...criteria, [key]: Number(event.target.value) })} />
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="review-observations" className="text-xs text-muted-foreground">Alterações propostas / observações</Label>
            <Textarea id="review-observations" value={observations} onChange={event => setObservations(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button disabled={saving || !justification.trim()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Confirmar retificação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
