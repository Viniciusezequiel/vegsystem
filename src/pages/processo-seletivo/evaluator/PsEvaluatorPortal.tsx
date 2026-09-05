import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  CheckCircle2,
  Loader2,
  LockKeyhole,
  LogOut,
  Plus,
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
import { Textarea } from '@/components/ui/textarea';
import { PS_CLASSIFICATION_LABEL, PS_CRITERIA, psClassification } from '@/lib/psConstants';
import {
  addEvaluatorOverride,
  changeEvaluatorPassword,
  clearEvaluatorToken,
  getEvaluatorDashboard,
  getEvaluatorQueue,
  getStoredEvaluatorToken,
  logoutEvaluator,
  searchExternalEvaluators,
  submitEvaluatorEvaluation,
  validateEvaluatorSession,
} from '@/lib/psEvaluatorSession';
import PsEvaluatorLogin from './PsEvaluatorLogin';

const emptyCriteria = () => Object.fromEntries(PS_CRITERIA.map(({ key }) => [key, 0])) as Record<string, number>;

export default function PsEvaluatorPortal({ eventId }: { eventId?: string }) {
  const { eventId: routeEventId } = useParams<{ eventId: string }>();
  const id = eventId ?? routeEventId;
  const [token, setToken] = useState<string | null>(id ? getStoredEvaluatorToken(id) : null);
  const [session, setSession] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState({ pending_count: 0, completed_count: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(Boolean(token));
  const [selected, setSelected] = useState<any>(null);
  const [externalOpen, setExternalOpen] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (!id || !token) {
      setLoading(false);
      return;
    }
    validateEvaluatorSession(id, token)
      .then(result => {
        if (result?.valid) setSession(result);
        else {
          clearEvaluatorToken(id);
          setToken(null);
        }
      })
      .catch(() => {
        clearEvaluatorToken(id);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [id, token]);

  useEffect(() => {
    if (!id || !token || !session || session.must_change_password) return;
    Promise.all([getEvaluatorQueue(id, token, search), getEvaluatorDashboard(id, token)])
      .then(([nextQueue, nextDashboard]) => {
        setQueue(nextQueue);
        setDashboard(nextDashboard);
      })
      .catch(() => toast.error('Não foi possível carregar a fila de avaliação.'));
  }, [id, token, session, search]);

  if (!id) return <PsEvaluatorLogin />;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-card/70 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <p className="text-xs">Validando acesso...</p>
        </div>
      </div>
    );
  }

  if (!token || !session) {
    return <PsEvaluatorLogin eventId={id} onAuthenticated={() => setToken(getStoredEvaluatorToken(id))} />;
  }

  if (session.must_change_password) {
    return (
      <PasswordChange
        eventId={id}
        token={token}
        error={passwordError}
        setError={setPasswordError}
        onChanged={() => setSession({ ...session, must_change_password: false })}
      />
    );
  }

  async function handleLogout() {
    await logoutEvaluator(id!, token!);
    setToken(null);
    setSession(null);
  }

  async function handleAdd(item: any, reason: string) {
    if (await addEvaluatorOverride(id!, token!, item.id, reason)) {
      const [nextQueue, nextDashboard] = await Promise.all([
        getEvaluatorQueue(id!, token!, search),
        getEvaluatorDashboard(id!, token!),
      ]);
      setQueue(nextQueue);
      setDashboard(nextDashboard);
      toast.success('Fiscal adicionado à sua lista.');
      setExternalOpen(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-4 border-b border-border/50 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Portal de Avaliação de Fiscais</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{session.event_name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{session.evaluator_name}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {session.role === 'coordinator' ? 'Coordenador' : 'Subcoordenador'}
                </Badge>
              </div>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => void handleLogout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </header>

        <section className="grid gap-3 sm:grid-cols-2">
          <Kpi label="A avaliar" value={dashboard.pending_count} />
          <Kpi label="Realizadas por você" value={dashboard.completed_count} />
        </section>

        <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card/65 p-3 shadow-sm sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar fiscal..." className="pl-9" />
          </div>
          {session.role === 'subcoordinator' && (
            <Button variant="outline" onClick={() => setExternalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar fiscal de outra área
            </Button>
          )}
        </div>

        {queue.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {queue.map(item => (
              <Card key={item.event_collaborator_id} className="border-border/60 bg-card/65 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/85 hover:shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{item.collaborator_name}</CardTitle>
                  <CardDescription>{item.role_name || item.assigned_role || 'Função não informada'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="min-h-8 text-xs leading-relaxed text-muted-foreground">
                    {[item.campus, item.building, item.floor, item.room && `Sala ${item.room}`].filter(Boolean).join(' · ') || 'Local não informado'}
                  </p>
                  <Button className="w-full" onClick={() => setSelected(item)}>Avaliar fiscal</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/35 px-6 text-center">
            <CheckCircle2 className="h-9 w-9 text-success/70" />
            <p className="mt-3 text-sm font-medium">Todas as avaliações disponíveis foram concluídas</p>
            <p className="mt-1 text-xs text-muted-foreground">Novos fiscais aparecerão aqui caso sejam adicionados ao seu escopo.</p>
          </div>
        )}
      </div>

      <EvaluationDialog
        item={selected}
        open={!!selected}
        eventId={id}
        token={token}
        onClose={() => setSelected(null)}
        onSuccess={() => {
          setSelected(null);
          void getEvaluatorQueue(id, token, search).then(setQueue);
          void getEvaluatorDashboard(id, token).then(setDashboard);
        }}
      />
      <ExternalDialog open={externalOpen} eventId={id} token={token} onClose={() => setExternalOpen(false)} onAdd={handleAdd} />
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-border/60 bg-card/65 shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function EvaluationDialog({ item, open, eventId, token, onClose, onSuccess }: any) {
  const [criteria, setCriteria] = useState(emptyCriteria());
  const [observations, setObservations] = useState('');
  const [changed, setChanged] = useState(false);
  const [reportedRole, setReportedRole] = useState('');
  const [justification, setJustification] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCriteria(emptyCriteria());
      setObservations('');
      setChanged(false);
      setReportedRole('');
      setJustification('');
    }
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await submitEvaluatorEvaluation(eventId, token, item.event_collaborator_id, criteria, observations, changed, reportedRole, justification);
      if (!result?.success) toast.error(result?.message || 'Não foi possível registrar a avaliação.');
      else {
        toast.success('Avaliação registrada com sucesso.');
        onSuccess();
      }
    } catch {
      toast.error('Não foi possível registrar a avaliação. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  if (!item) return null;
  const score = Number((Object.values(criteria).reduce((sum, value) => sum + Number(value), 0) / PS_CRITERIA.length).toFixed(2));

  return (
    <Dialog open={open} onOpenChange={value => !value && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Avaliar {item.collaborator_name}</DialogTitle>
          <p className="text-xs text-muted-foreground">{[item.role_name || item.assigned_role, item.campus, item.building, item.floor, item.room && `Sala ${item.room}`].filter(Boolean).join(' · ')}</p>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            {PS_CRITERIA.map(criterion => (
              <div key={criterion.key} className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                <Label>{criterion.label} *</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(value => (
                    <Button
                      key={value}
                      type="button"
                      size="icon"
                      variant={criteria[criterion.key] >= value ? 'default' : 'outline'}
                      className="h-8 w-8"
                      onClick={() => setCriteria({ ...criteria, [criterion.key]: value })}
                    >
                      <Star className={`h-3.5 w-3.5 ${criteria[criterion.key] >= value ? 'fill-current' : ''}`} />
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm font-medium">
            <span>Nota final</span>
            <span>{score.toFixed(2)} · {PS_CLASSIFICATION_LABEL[psClassification(score)]}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evaluation-observations" className="text-xs text-muted-foreground">Observações gerais</Label>
            <Textarea id="evaluation-observations" rows={3} value={observations} onChange={event => setObservations(event.target.value)} />
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 p-3 text-sm">
            <input type="checkbox" checked={changed} onChange={event => setChanged(event.target.checked)} />
            Houve alteração de cargo
          </label>

          {changed && (
            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-3">
              <Field id="reported-role" label="Cargo exercido *" value={reportedRole} onChange={setReportedRole} />
              <div className="space-y-1.5">
                <Label htmlFor="role-justification" className="text-xs text-muted-foreground">Justificativa *</Label>
                <Textarea id="role-justification" value={justification} onChange={event => setJustification(event.target.value)} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button disabled={saving || Object.values(criteria).some(value => !value)}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Registrar avaliação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExternalDialog({ open, eventId, token, onClose, onAdd }: any) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (search.trim().length < 3) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void searchExternalEvaluators(eventId, token, search).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, eventId, token]);

  return (
    <Dialog open={open} onOpenChange={value => !value && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Adicionar fiscal de outra área</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nome..." autoFocus className="pl-9" />
          </div>
          <div className="space-y-2">
            {results.map(item => (
              <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.nome}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{[item.cargo, item.campus, item.building, item.floor, item.room && `Sala ${item.room}`].filter(Boolean).join(' · ')}</p>
                </div>
                <Button size="sm" onClick={() => onAdd(item, reason)}>Adicionar</Button>
              </div>
            ))}
            {search.length > 0 && search.length < 3 && <p className="text-xs text-muted-foreground">Digite pelo menos 3 caracteres.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="override-reason" className="text-xs text-muted-foreground">Motivo (opcional)</Label>
            <Input id="override-reason" value={reason} onChange={event => setReason(event.target.value)} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PasswordChange({ eventId, token, onChanged, error, setError }: { eventId: string; token: string; onChanged: () => void; error: string; setError: (value: string) => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (next !== confirm) {
      setError('As novas senhas não conferem.');
      return;
    }
    setLoading(true);
    try {
      const success = await changeEvaluatorPassword(eventId, token, current, next);
      if (!success) setError('Não foi possível alterar a senha. Confira os requisitos e tente novamente.');
      else onChanged();
    } catch {
      setError('Não foi possível alterar a senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/10 to-transparent" />
      <Card className="relative w-full max-w-md border-border/60 bg-card/85 shadow-xl shadow-black/5">
        <CardHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><LockKeyhole className="h-5 w-5" /></div>
          <CardTitle>Defina sua nova senha</CardTitle>
          <CardDescription>Por segurança, altere a senha inicial antes de continuar.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <Field id="current-password" label="Senha atual" value={current} onChange={setCurrent} />
            <Field id="new-password" label="Nova senha" value={next} onChange={setNext} />
            <Field id="confirm-password" label="Confirmar nova senha" value={confirm} onChange={setConfirm} />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">Use pelo menos 8 caracteres, com uma letra e um número.</p>
            <Button className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Salvar nova senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function Field({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <Input id={id} type="password" value={value} onChange={event => onChange(event.target.value)} autoComplete="off" />
    </div>
  );
}
