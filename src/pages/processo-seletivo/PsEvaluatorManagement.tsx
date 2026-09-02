import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Building2, CheckCircle2, KeyRound, Loader2, MapPin, Pencil, ShieldCheck, Users, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
    if (error || data === false) { toast.error('Não foi possível concluir a ação.'); return false; }
    toast.success(success);
    await load();
    return true;
  };

  function openScope(item: Evaluator) {
    setScopeTarget(item); setScopeType(item.scope_type || (item.role === 'coordinator' ? 'event' : 'floor'));
    setCampus(item.campus || ''); setBuilding(item.building || ''); setFloor(item.floor || '');
  }

  async function saveScope() {
    if (!scopeTarget) return;
    setSaving(true);
    await runAction('ps_admin_set_evaluator_scope', { p_account_id: scopeTarget.account_id, p_scope_type: scopeType, p_campus: campus || null, p_building: building || null, p_floor: floor || null }, 'Escopo atualizado.');
    setSaving(false); setScopeTarget(null);
  }

  const coordinators = items.filter((item) => item.role === 'coordinator').length;
  const subcoordinators = items.filter((item) => item.role === 'subcoordinator').length;
  const active = items.filter((item) => item.active).length;
  const pending = items.filter((item) => item.scope_state === 'pending').length;

  if (!eventId) return <div className="p-8 text-muted-foreground">Evento não informado.</div>;
  return (
    <main className="min-h-screen bg-background px-5 py-7 text-foreground sm:px-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-6 w-6" /></div><div><p className="text-sm text-muted-foreground">Processo Seletivo</p><h1 className="text-2xl font-bold">Equipe de Avaliação</h1><p className="mt-1 text-muted-foreground">Coordenadores e subcoordenadores identificados na escala do evento.</p></div></div>
          <Button asChild variant="outline"><Link to={`/admin-module/processo-seletivo/eventos/${eventId}`}>Voltar ao evento</Link></Button>
        </header>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi icon={<Users />} label="Coordenadores" value={coordinators} /><Kpi icon={<ShieldCheck />} label="Subcoordenadores" value={subcoordinators} /><Kpi icon={<CheckCircle2 />} label="Acessos ativos" value={active} /><Kpi icon={<MapPin />} label="Escopos pendentes" value={pending} /></section>
        <Card><CardHeader><CardTitle className="text-base">Avaliadores provisionados</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="border-y bg-muted/30 text-left text-xs uppercase text-muted-foreground"><tr>{['Nome', 'CPF', 'Função', 'Campus', 'Prédio', 'Andar', 'Escopo', 'Acesso', 'Último acesso', ''].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}</tr></thead><tbody className="divide-y">{loading ? <tr><td colSpan={10} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /></td></tr> : items.map((item) => <tr key={item.account_id} className="hover:bg-muted/20"><td className="px-4 py-3 font-medium">{item.evaluator_name}</td><td className="px-4 py-3 font-mono text-xs">{maskedCpf(item.username)}</td><td className="px-4 py-3">{roleLabel(item.role)}</td><td className="px-4 py-3">{item.campus || '—'}</td><td className="px-4 py-3">{item.building || '—'}</td><td className="px-4 py-3">{item.floor || '—'}</td><td className="px-4 py-3"><Badge variant={item.scope_state === 'pending' ? 'destructive' : 'secondary'}>{item.scope_state === 'adjusted' ? 'Ajustado manualmente' : item.scope_state === 'pending' ? 'Pendente' : `Configurado · ${scopeLabel(item.scope_type)}`}</Badge></td><td className="px-4 py-3"><Badge variant={item.active ? 'default' : 'outline'}>{item.active ? 'Ativo' : 'Desativado'}</Badge></td><td className="px-4 py-3 text-muted-foreground">{item.last_login ? new Date(item.last_login).toLocaleString('pt-BR') : 'Nunca acessou'}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" title="Ajustar escopo" onClick={() => openScope(item)}><Pencil /></Button><Button variant="ghost" size="icon" title="Redefinir senha para CPF" onClick={() => { if (window.confirm('Redefinir a senha para o CPF?')) void runAction('ps_admin_reset_evaluator_password', { p_account_id: item.account_id }, 'Senha redefinida para o CPF.'); }}><KeyRound /></Button><Button variant="ghost" size="icon" title={item.active ? 'Desativar acesso' : 'Ativar acesso'} onClick={() => void runAction('ps_admin_set_evaluator_access', { p_account_id: item.account_id, p_active: !item.active }, item.active ? 'Acesso desativado.' : 'Acesso ativado.')}>{item.active ? <XCircle /> : <CheckCircle2 />}</Button></div></td></tr>)}{!loading && !items.length && <tr><td colSpan={10} className="p-10 text-center text-muted-foreground">Nenhum coordenador ou subcoordenador foi identificado neste evento.</td></tr>}</tbody></table></div></CardContent></Card>
      </div>
      <Dialog open={!!scopeTarget} onOpenChange={(open) => !open && setScopeTarget(null)}><DialogContent><DialogHeader><DialogTitle>Ajustar escopo de {scopeTarget?.evaluator_name}</DialogTitle></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label htmlFor="scope-type">Tipo de escopo</Label><select id="scope-type" value={scopeType} onChange={(e) => setScopeType(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" disabled={scopeTarget?.role === 'coordinator'}><option value="event">Evento inteiro</option><option value="campus">Campus</option><option value="building">Prédio</option><option value="floor">Andar</option></select></div><Field label="Campus" value={campus} onChange={setCampus} /><Field label="Prédio" value={building} onChange={setBuilding} /><Field label="Andar" value={floor} onChange={setFloor} /></div><DialogFooter><Button variant="outline" onClick={() => setScopeTarget(null)}>Cancelar</Button><Button onClick={saveScope} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Pencil />}Salvar escopo</Button></DialogFooter></DialogContent></Dialog>
    </main>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <Card><CardContent className="flex items-center gap-3 p-4"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div></CardContent></Card>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div className="space-y-2"><Label>{label}</Label><Input value={value} onChange={(e) => onChange(e.target.value)} /></div>; }