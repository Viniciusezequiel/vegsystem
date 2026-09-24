import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Eye,
  FilterX,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const emptyCriteria = () =>
  Object.fromEntries(
    PS_CRITERIA.map(({ key }) => [key, 0])
  ) as Record<string, number>;

type ReviewFilter =
  | 'all'
  | 'attention'
  | 'pending'
  | 'correction_requested'
  | 'corrected';

export default function PsCoordinatorReview() {
  const { eventId } = useParams<{ eventId: string }>();
  const [token] = useState(() =>
    eventId ? getStoredEvaluatorToken(eventId) : null
  );

  const [session, setSession] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [classificationFilter, setClassificationFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [rectifying, setRectifying] = useState<any>(null);

  async function load() {
    if (!eventId || !token) return;

    setLoading(true);

    try {
      const [evaluations, dashboard] = await Promise.all([
        getCoordinatorEvaluations(eventId, token, '', 'all'),
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
    if (!eventId || !token) return;

    void validateEvaluatorSession(eventId, token)
      .then(setSession)
      .catch(() => setSession(null));
  }, [eventId, token]);

  useEffect(() => {
    if (session?.valid && session.role === 'coordinator') {
      void load();
    }
  }, [session]);

  const summary = useMemo(() => {
    const lowScores = rows.filter(
      row => Number(row.final_score || 0) < 3
    ).length;

    const corrected = rows.filter(
      row => row.review_status === 'corrected'
    ).length;

    const correctionRequested = rows.filter(
      row => row.review_status === 'correction_requested'
    ).length;

    const pending = rows.filter(
      row =>
        !row.review_status ||
        row.review_status === 'correction_requested'
    ).length;

    return {
      lowScores,
      corrected,
      correctionRequested,
      pending,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = search
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    return [...rows]
      .filter(row => {
        const score = Number(row.final_score || 0);
        const reviewStatus = String(row.review_status || '');

        if (
          classificationFilter !== 'all' &&
          row.classification !== classificationFilter
        ) {
          return false;
        }

        if (reviewFilter === 'attention' && score >= 3) return false;
        if (
          reviewFilter === 'pending' &&
          reviewStatus &&
          reviewStatus !== 'correction_requested'
        ) {
          return false;
        }
        if (
          reviewFilter === 'correction_requested' &&
          reviewStatus !== 'correction_requested'
        ) {
          return false;
        }
        if (
          reviewFilter === 'corrected' &&
          reviewStatus !== 'corrected'
        ) {
          return false;
        }

        if (!query) return true;

        const haystack = [
          row.collaborator_name,
          row.assigned_role,
          row.evaluator_name,
          row.campus,
          row.building,
          row.floor,
          row.room,
          row.observations,
        ]
          .filter(Boolean)
          .join(' ')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort((a, b) => {
        const aStatus = String(a.review_status || '');
        const bStatus = String(b.review_status || '');

        const priority = (row: any) => {
          if (row.review_status === 'correction_requested') return 0;
          if (Number(row.final_score || 0) < 3) return 1;
          if (!row.review_status) return 2;
          if (row.review_status === 'corrected') return 3;
          return 4;
        };

        return (
          priority(a) - priority(b) ||
          Number(a.final_score || 0) - Number(b.final_score || 0) ||
          String(b.evaluated_at || '').localeCompare(
            String(a.evaluated_at || '')
          )
        );
      });
  }, [rows, search, reviewFilter, classificationFilter]);

  const clearFilters = () => {
    setSearch('');
    setReviewFilter('all');
    setClassificationFilter('all');
  };

  const hasFilters =
    !!search ||
    reviewFilter !== 'all' ||
    classificationFilter !== 'all';

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
            <CardDescription>
              Este painel está disponível somente para coordenadores autenticados.
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
              <ShieldCheck className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Processo Seletivo · Coordenação
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Revisão das Avaliações
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Priorize notas baixas, acompanhe solicitações de correção e consulte o histórico de cada avaliação.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="rounded-xl">
              <Link to={`/ps/coordenacao/${eventId}/dashboard`}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Dashboard
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
          {session.event_date && (
            <Badge variant="outline" className="rounded-full text-[10px]">
              {new Date(`${session.event_date}T00:00:00`).toLocaleDateString('pt-BR')}
            </Badge>
          )}
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Avaliações realizadas"
            value={stats?.total_avaliacoes}
            helper={`${stats?.total_fiscais_avaliados || 0} fiscal(is) avaliado(s)`}
            icon={<Star className="h-4 w-4" />}
          />

          <button
            type="button"
            className="text-left"
            onClick={() =>
              setReviewFilter(reviewFilter === 'attention' ? 'all' : 'attention')
            }
          >
            <Kpi
              label="Notas abaixo de 3"
              value={summary.lowScores}
              helper="merecem conferência prioritária"
              icon={<AlertTriangle className="h-4 w-4" />}
              tone={summary.lowScores ? 'warning' : 'success'}
            />
          </button>

          <button
            type="button"
            className="text-left"
            onClick={() =>
              setReviewFilter(reviewFilter === 'pending' ? 'all' : 'pending')
            }
          >
            <Kpi
              label="Pendentes de revisão"
              value={summary.pending}
              helper={summary.correctionRequested
                ? `${summary.correctionRequested} com correção solicitada`
                : 'sem correção aguardando'}
              icon={<RotateCcw className="h-4 w-4" />}
              tone={summary.pending ? 'warning' : 'success'}
            />
          </button>

          <Kpi
            label="Média geral"
            value={Number(stats?.media_geral || 0).toFixed(2)}
            helper={`${summary.corrected} avaliação(ões) retificada(s)`}
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
        </section>

        {(summary.lowScores > 0 || summary.correctionRequested > 0) && (
          <Card className="rounded-2xl border-amber-500/20 bg-amber-500/[0.025]">
            <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold">Atenção da coordenação</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {[
                    summary.lowScores
                      ? `${summary.lowScores} avaliação(ões) têm nota final abaixo de 3.`
                      : '',
                    summary.correctionRequested
                      ? `${summary.correctionRequested} correção(ões) estão solicitadas.`
                      : '',
                  ].filter(Boolean).join(' ')}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {summary.lowScores > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setReviewFilter('attention')}
                  >
                    Ver notas baixas
                  </Button>
                )}

                {summary.correctionRequested > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setReviewFilter('correction_requested')}
                  >
                    Ver correções solicitadas
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-2xl border-border/60 bg-card/65 shadow-sm">
          <CardContent className="space-y-3 p-3">
            <div className="grid gap-2 xl:grid-cols-[minmax(300px,1fr)_220px_220px_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 rounded-xl pl-9"
                  placeholder="Buscar fiscal, cargo, avaliador ou local..."
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                />
              </div>

              <Select
                value={reviewFilter}
                onValueChange={(value: ReviewFilter) => setReviewFilter(value)}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Situação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as situações</SelectItem>
                  <SelectItem value="attention">Notas abaixo de 3</SelectItem>
                  <SelectItem value="pending">Pendentes de revisão</SelectItem>
                  <SelectItem value="correction_requested">Correção solicitada</SelectItem>
                  <SelectItem value="corrected">Retificadas</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={classificationFilter}
                onValueChange={setClassificationFilter}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Classificação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as classificações</SelectItem>
                  {Object.entries(PS_CLASSIFICATION_LABEL).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="ghost"
                className="h-10 rounded-xl"
                disabled={!hasFilters}
                onClick={clearFilters}
              >
                <FilterX className="mr-2 h-4 w-4" />
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-border/60 bg-card/65 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
            <div>
              <CardTitle className="text-base">Fila de revisão</CardTitle>
              <CardDescription>
                Correções solicitadas e notas menores aparecem primeiro.
              </CardDescription>
            </div>

            <Badge variant="secondary" className="rounded-full">
              {filteredRows.length} de {rows.length}
            </Badge>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1020px] text-sm">
                <thead className="border-y border-border/50 bg-muted/25 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {[
                      'Fiscal',
                      'Local',
                      'Avaliado por',
                      'Cargo',
                      'Nota',
                      'Classificação',
                      'Situação',
                      'Ações',
                    ].map(title => (
                      <th key={title} className="px-4 py-3 font-medium">{title}</th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-border/50">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-10 text-center">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
                      </td>
                    </tr>
                  ) : filteredRows.map(row => {
                    const score = Number(row.final_score || 0);
                    const lowScore = score < 3;

                    return (
                      <tr
                        key={row.evaluation_id}
                        className={`transition-colors hover:bg-muted/15 ${row.review_status === 'correction_requested'
                          ? 'bg-amber-500/[0.028]'
                          : lowScore
                            ? 'bg-amber-500/[0.018]'
                            : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{row.collaborator_name}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {row.evaluated_at
                                ? new Date(row.evaluated_at).toLocaleString('pt-BR')
                                : ''}
                            </p>
                          </div>
                        </td>

                        <td className="max-w-[240px] px-4 py-3 text-xs text-muted-foreground">
                          {[
                            row.campus,
                            row.building,
                            row.floor && `${row.floor}º andar`,
                            row.room && `Sala ${row.room}`,
                          ].filter(Boolean).join(' · ') || '—'}
                        </td>

                        <td className="px-4 py-3">
                          <p>{row.evaluator_name || '—'}</p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            Subcoordenação
                          </p>
                        </td>

                        <td className="px-4 py-3">
                          {row.assigned_role || '—'}
                        </td>

                        <td className="px-4 py-3">
                          <span className={`font-semibold tabular-nums ${lowScore ? 'text-amber-500' : ''}`}>
                            {score.toFixed(2)}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <Badge
                            variant={lowScore ? 'outline' : 'secondary'}
                            className={`text-[10px] ${lowScore ? 'border-amber-500/25 text-amber-500' : ''}`}
                          >
                            {PS_CLASSIFICATION_LABEL[row.classification] || row.classification}
                          </Badge>
                        </td>

                        <td className="px-4 py-3">
                          <ReviewStatusBadge status={row.review_status} />
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg"
                              title="Visualizar"
                              onClick={() => setSelected(row)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg"
                              title="Solicitar retificação"
                              onClick={() => setRectifying(row)}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {!loading && !filteredRows.length && (
                    <tr>
                      <td colSpan={8} className="p-10 text-center">
                        <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground/40" />
                        <p className="mt-2 text-sm font-semibold">
                          {rows.length
                            ? 'Nenhuma avaliação encontrada'
                            : 'Nenhuma avaliação disponível para revisão'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {rows.length
                            ? 'Ajuste os filtros para continuar.'
                            : 'As avaliações dos subcoordenadores aparecerão aqui.'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <DetailDialog
        row={selected}
        eventId={eventId}
        token={token}
        open={!!selected}
        onClose={() => setSelected(null)}
      />

      <RectificationDialog
        row={rectifying}
        eventId={eventId}
        token={token}
        open={!!rectifying}
        onClose={() => setRectifying(null)}
        onSuccess={() => {
          setRectifying(null);
          void load();
        }}
      />
    </main>
  );
}

function ReviewStatusBadge({ status }: { status?: string | null }) {
  if (status === 'corrected') {
    return <Badge className="text-[10px]">Retificada</Badge>;
  }

  if (status === 'correction_requested') {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/25 text-[10px] text-amber-500"
      >
        Correção solicitada
      </Badge>
    );
  }

  return <Badge variant="secondary" className="text-[10px]">Pendente</Badge>;
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
      className={`h-full rounded-2xl shadow-sm ${tone === 'warning'
        ? 'border-amber-500/25 bg-amber-500/[0.035]'
        : tone === 'success'
          ? 'border-emerald-500/20 bg-emerald-500/[0.025]'
          : 'border-border/60 bg-card/65'}`}
    >
      <CardContent className="flex h-full items-start justify-between gap-3 p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value ?? 0}</p>
          {helper && <p className="mt-1 text-[10px] text-muted-foreground">{helper}</p>}
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

function DetailDialog({
  row,
  eventId,
  token,
  open,
  onClose,
}: any) {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !row) return;

    void getEvaluatorSessionHistory(
      eventId,
      token,
      row.evaluation_id
    )
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [open, row, eventId, token]);

  if (!row) return null;

  const score = Number(row.final_score || 0);

  return (
    <Dialog open={open} onOpenChange={value => !value && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{row.collaborator_name}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {[row.assigned_role, row.campus, row.building, row.floor, row.room && `Sala ${row.room}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/10 p-3">
            <Badge variant={score < 3 ? 'outline' : 'secondary'} className={score < 3 ? 'border-amber-500/25 text-amber-500' : ''}>
              Nota {score.toFixed(2)}
            </Badge>
            <Badge variant="outline">
              {PS_CLASSIFICATION_LABEL[row.classification] || row.classification}
            </Badge>
            <ReviewStatusBadge status={row.review_status} />
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/15 p-3 text-sm leading-relaxed">
            {row.observations || 'Nenhuma observação.'}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {PS_CRITERIA.map(({ key, label }) => {
              const value = Number(row[key] || 0);

              return (
                <div
                  key={key}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${value <= 2
                    ? 'border-amber-500/20 bg-amber-500/[0.025]'
                    : 'border-border/60'}`}
                >
                  <span className="text-muted-foreground">{label}</span>
                  <strong className={value <= 2 ? 'text-amber-500' : ''}>
                    {value || '—'}
                  </strong>
                </div>
              );
            })}
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Histórico</Label>

            <div className="mt-2 space-y-2">
              {history.map((item, index) => (
                <div
                  key={`${item.kind}-${index}`}
                  className="rounded-xl border border-border/60 bg-muted/10 p-3 text-xs"
                >
                  <p className="font-medium">
                    {item.kind === 'evaluation'
                      ? 'Avaliação criada'
                      : 'Retificação registrada'}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {new Date(item.created_at).toLocaleString('pt-BR')}
                    {item.reason ? ` · ${item.reason}` : ''}
                  </p>
                </div>
              ))}

              {!history.length && (
                <p className="text-xs text-muted-foreground">
                  Nenhum histórico adicional.
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RectificationDialog({
  row,
  eventId,
  token,
  open,
  onClose,
  onSuccess,
}: any) {
  const [justification, setJustification] = useState('');
  const [observations, setObservations] = useState('');
  const [criteria, setCriteria] = useState<Record<string, number>>(emptyCriteria());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && row) {
      setJustification('');
      setObservations(row.observations || '');
      setCriteria(
        Object.fromEntries(
          PS_CRITERIA.map(({ key }) => [key, row[key]])
        )
      );
    }
  }, [open, row]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      const result = await requestCoordinatorRectification(
        eventId,
        token,
        row.evaluation_id,
        justification,
        { criteria, observations }
      );

      if (!result?.success) {
        toast.error(
          result?.message ||
          'Não foi possível registrar a retificação.'
        );
      } else {
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

  const criteriaValid = PS_CRITERIA.every(({ key }) =>
    Number(criteria[key]) >= 1 &&
    Number(criteria[key]) <= 5
  );

  const proposedScore = criteriaValid
    ? (
        PS_CRITERIA.reduce(
          (sum, { key }) => sum + Number(criteria[key] || 0),
          0
        ) / PS_CRITERIA.length
      ).toFixed(2)
    : '—';

  return (
    <Dialog open={open} onOpenChange={value => !value && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Solicitar retificação</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {row.collaborator_name} · nota atual {Number(row.final_score || 0).toFixed(2)}
          </p>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="review-justification"
              className="text-xs text-muted-foreground"
            >
              Justificativa *
            </Label>
            <Textarea
              id="review-justification"
              value={justification}
              onChange={event => setJustification(event.target.value)}
              placeholder="Explique por que a avaliação precisa ser ajustada."
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {PS_CRITERIA.map(({ key, label }) => (
              <div key={key} className="space-y-1.5">
                <Label
                  htmlFor={`review-${key}`}
                  className="text-xs text-muted-foreground"
                >
                  {label}
                </Label>
                <Input
                  id={`review-${key}`}
                  type="number"
                  min={1}
                  max={5}
                  value={criteria[key]}
                  onChange={event =>
                    setCriteria({
                      ...criteria,
                      [key]: Number(event.target.value),
                    })
                  }
                  className="rounded-xl"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
            <span className="font-medium">Nova média proposta</span>
            <span className="font-bold tabular-nums">{proposedScore}</span>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="review-observations"
              className="text-xs text-muted-foreground"
            >
              Alterações propostas / observações
            </Label>
            <Textarea
              id="review-observations"
              value={observations}
              onChange={event => setObservations(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={onClose}
            >
              Cancelar
            </Button>

            <Button
              className="rounded-xl"
              disabled={
                saving ||
                !justification.trim() ||
                !criteriaValid
              }
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Confirmar retificação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
