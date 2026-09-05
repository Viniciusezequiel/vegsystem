import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  MapPin,
  Pencil,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

type Evaluator = {
  account_id: string;
  evaluator_name: string;
  username: string;
  role: 'coordinator' | 'subcoordinator';
  campus: string | null;
  building: string | null;
  floor: string | null;
  scope_type: string | null;
  scope_source: 'import' | 'manual' | null;
  active: boolean;
  last_login: string | null;
  scope_state: 'configured' | 'pending' | 'adjusted';
};

const roleLabel = (role: Evaluator['role']) => role === 'coordinator' ? 'Coordenador' : 'Subcoordenador';
const scopeLabel = (scope?: string | null) => ({ event: 'Evento', campus: 'Campus', building: 'Prédio', floor: 'Andar' }[scope || ''] || 'Pendente');
const maskedCpf = (value: string) => value.length === 11 ? `***.***.***-${value.slice(-2)}` : 'CPF cadastrado';

export default function PsEvaluatorManagement() {
  const { id: eventId } = useParams();
  const [items, setItems] = useState<Evaluator[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopeTarget, setScopeTarget] = useState<Evaluator | null>(null);
  const [scopeType, setScopeType] = useState('floor');
  const [campus, setCampus] = useState('');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!eventId) return;
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('ps_admin_list_evaluator_accounts', { p_event_id: eventId });
    if (error) toast.error('Não foi possível carregar a equipe de avaliação.');
    else setItems((data || []) as Evaluator[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [eventId]);

  const runAction = async (name: string, params: Record<string, unknown>, success: string) => {
    const { data, error } = await (supabase as any).rpc(name, params);
    if (error || data === false) {
      toast.error('Não foi possível concluir a ação.');
      return false;
    }
    toast.success(success);
    await load();
    return true;
  };

  function openScope(item: Evaluator) {
    setScopeTarget(item);
    setScopeType(item.scope_type || (item.role === 'coordinator' ? 'event' : 'floor'));
    setCampus(item.campus || '');
    setBuilding(item.building || '');
    setFloor(item.floor || '');
  }

  async function saveScope() {
    if (!scopeTarget) return;
    setSaving(true);
    await runAction(
      'ps_admin_set_evaluator_scope',
      {
        p_account_id: scopeTarget.account_id,
        p_scope_type: scopeType,
        p_campus: campus || null,
        p_building: building || null,
        p_floor: floor || null,
      },
      'Escopo atualizado.'
    );
    setSaving(false);
    setScopeTarget(null);
  }

  const coordinators = items.filter(item => item.role === 'coordinator').length;
  const subcoordinators = items.filter(item => item.role === 'subcoordinator').length;
  const active = items.filter(item => item.active).length;
  const pending = items.filter(item => item.scope_state === 'pending').length;
  const portalUrl = `${window.location.origin}/ps/avaliador/${eventId}`;

  const copyPortalUrl = async () => {
    await navigator.clipboard.writeText(portalUrl);
    toast.success('Link do Portal de Avaliação copiado.');
  };

  if (!eventId) {
    return <div className="p-8 text-muted-foreground">Evento não informado.</div>;
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
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Processo Seletivo</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">Equipe de Avaliação</h1>
              <p className="mt-1 text-sm text-muted-foreground">Gerencie acessos e escopos de coordenadores e subcoordenadores do evento.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <a href={portalUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />Abrir Portal
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void copyPortalUrl()}>
              <Copy className="mr-2 h-4 w-4" />Copiar link
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/admin-module/processo-seletivo/eventos/${eventId}`}>Voltar ao evento</Link>
            </Button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi icon={<Users className="h-4 w-4" />} label="Coordenadores" value={coordinators} />
          <Kpi icon={<ShieldCheck className="h-4 w-4" />} label="Subcoordenadores" value={subcoordinators} />
          <Kpi icon={<CheckCircle2 className="h-4 w-4" />} label="Acessos ativos" value={active} />
          <Kpi icon={<MapPin className="h-4 w-4" />} label="Escopos pendentes" value={pending} />
        </section>

        <Card className="overflow-hidden border-border/60 bg-card/65 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="text-base">Avaliadores provisionados</CardTitle>
            <Badge variant="secondary">{items.length}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="border-y border-border/50 bg-muted/25 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {['Nome', 'CPF', 'Função', 'Campus', 'Prédio', 'Andar', 'Escopo', 'Acesso', 'Último acesso', ''].map(heading => (
                      <th key={heading} className="px-4 py-3 font-medium">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {loading ? (
                    <tr><td colSpan={10} className="p-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /></td></tr>
                  ) : items.map(item => (
                    <tr key={item.account_id} className="transition-colors hover:bg-muted/15">
                      <td className="px-4 py-3 font-medium">{item.evaluator_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{maskedCpf(item.username)}</td>
                      <td className="px-4 py-3">{roleLabel(item.role)}</td>
                      <td className="px-4 py-3">{item.campus || '—'}</td>
                      <td className="px-4 py-3">{item.building || '—'}</td>
                      <td className="px-4 py-3">{item.floor || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={item.scope_state === 'pending' ? 'destructive' : 'secondary'} className="whitespace-nowrap text-[10px]">
                          {item.scope_state === 'adjusted'
                            ? 'Ajustado manualmente'
                            : item.scope_state === 'pending'
                              ? 'Pendente'
                              : `Configurado · ${scopeLabel(item.scope_type)}`}
                        </Badge>
                      </td>
                      <td className="px-4 py-3"><Badge variant={item.active ? 'default' : 'outline'}>{item.active ? 'Ativo' : 'Desativado'}</Badge></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{item.last_login ? new Date(item.last_login).toLocaleString('pt-BR') : 'Nunca acessou'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Ajustar escopo" onClick={() => openScope(item)}><Pencil className="h-4 w-4" /></Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Redefinir senha para CPF"
                            onClick={() => {
                              if (window.confirm('Redefinir a senha para o CPF?')) {
                                void runAction('ps_admin_reset_evaluator_password', { p_account_id: item.account_id }, 'Senha redefinida para o CPF.');
                              }
                            }}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={item.active ? 'Desativar acesso' : 'Ativar acesso'}
                            onClick={() => void runAction(
                              'ps_admin_set_evaluator_access',
                              { p_account_id: item.account_id, p_active: !item.active },
                              item.active ? 'Acesso desativado.' : 'Acesso ativado.'
                            )}
                          >
                            {item.active ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-success" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && !items.length && (
                    <tr><td colSpan={10} className="p-10 text-center text-sm text-muted-foreground">Nenhum coordenador ou subcoordenador foi identificado neste evento.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!scopeTarget} onOpenChange={open => !open && setScopeTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Ajustar escopo de {scopeTarget?.evaluator_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="scope-type" className="text-xs text-muted-foreground">Tipo de escopo</Label>
              <select
                id="scope-type"
                value={scopeType}
                onChange={event => setScopeType(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={scopeTarget?.role === 'coordinator'}
              >
                <option value="event">Evento inteiro</option>
                <option value="campus">Campus</option>
                <option value="building">Prédio</option>
                <option value="floor">Andar</option>
              </select>
            </div>
            <Field label="Campus" value={campus} onChange={setCampus} />
            <Field label="Prédio" value={building} onChange={setBuilding} />
            <Field label="Andar" value={floor} onChange={setFloor} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScopeTarget(null)}>Cancelar</Button>
            <Button onClick={() => void saveScope()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
              Salvar escopo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Kpi({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <Card className="border-border/60 bg-card/65 shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={event => onChange(event.target.value)} />
    </div>
  );
}
