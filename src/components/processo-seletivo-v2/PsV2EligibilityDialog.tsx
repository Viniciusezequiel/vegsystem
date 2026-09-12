import { useMemo, useState } from 'react';
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { usePsRoles } from '@/hooks/useProcessoSeletivo';
import { usePsV2Eligibility, usePsV2EligibilityMutations, type PsV2EligibilityRuleInput } from '@/hooks/usePsV2Eligibility';

const decisions = [
  { value: 'allow', label: 'Permitir', tone: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500' },
  { value: 'prefer', label: 'Priorizar', tone: 'border-primary/25 bg-primary/10 text-primary' },
  { value: 'deny', label: 'Bloquear', tone: 'border-destructive/25 bg-destructive/10 text-destructive' },
] as const;
const fields = [['role', 'Cargo/perfil'], ['position', 'Função institucional'], ['sector', 'Setor'], ['unit', 'Unidade'], ['preferred_role', 'Função preferida'], ['any', 'Qualquer campo']] as const;
const operators = [['contains', 'Contém'], ['equals', 'É exatamente'], ['starts_with', 'Começa com'], ['any', 'Qualquer valor']] as const;
const blankForm = (): PsV2EligibilityRuleInput => ({ event_role_id: '', decision: 'prefer', collaborator_field: 'role', match_operator: 'contains', match_value: '', min_participations: null, min_rating: null, weight: 10, notes: '', active: true });

export function PsV2EligibilityDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: roles = [] } = usePsRoles();
  const query = usePsV2Eligibility();
  const mutations = usePsV2EligibilityMutations();
  const [form, setForm] = useState<PsV2EligibilityRuleInput | null>(null);
  const roleById = useMemo(() => new Map<string, any>(roles.map((role: any) => [role.id, role])), [roles]);
  const rules = query.data?.rules || [];

  const save = async () => {
    if (!form?.event_role_id) return;
    if (form.match_operator !== 'any' && !form.match_value?.trim()) return;
    await mutations.save.mutateAsync(form);
    setForm(null);
  };

  const close = (next: boolean) => {
    if (!next && mutations.save.isPending) return;
    if (!next) setForm(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl" onInteractOutside={(event) => { if (mutations.save.isPending) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>Elegibilidade e prioridades</DialogTitle></DialogHeader>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
          <div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><p className="text-xs leading-relaxed text-muted-foreground"><strong className="text-foreground">Somente V2.</strong> Estas regras orientam o ranking automático e não alteram o módulo oficial.</p></div>
        </div>

        {query.data?.schemaReady === false ? (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-4 text-sm"><strong>Estrutura V2 ainda não ativada.</strong><p className="mt-1 text-xs text-muted-foreground">As regras poderão ser gravadas quando as tabelas ps_v2_* forem ativadas.</p></div>
        ) : form ? (
          <div className="grid gap-4 py-1 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label>Função do evento *</Label><Select value={form.event_role_id} onValueChange={(value) => setForm({ ...form, event_role_id: value })}><SelectTrigger><SelectValue placeholder="Selecione a função" /></SelectTrigger><SelectContent>{roles.filter((role: any) => role.active !== false).map((role: any) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Decisão</Label><Select value={form.decision} onValueChange={(value: any) => setForm({ ...form, decision: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{decisions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Campo do fiscal</Label><Select value={form.collaborator_field} onValueChange={(value: any) => setForm({ ...form, collaborator_field: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{fields.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Comparação</Label><Select value={form.match_operator} onValueChange={(value: any) => setForm({ ...form, match_operator: value, match_value: value === 'any' ? '' : form.match_value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{operators.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Valor {form.match_operator !== 'any' ? '*' : ''}</Label><Input value={form.match_value || ''} onChange={(event) => setForm({ ...form, match_value: event.target.value })} disabled={form.match_operator === 'any'} placeholder="Ex.: Higienização" /></div>
            <div className="space-y-1.5"><Label>Participações mínimas</Label><Input type="number" min={0} value={form.min_participations ?? ''} onChange={(event) => setForm({ ...form, min_participations: event.target.value === '' ? null : Number(event.target.value) })} /></div>
            <div className="space-y-1.5"><Label>Nota mínima</Label><Input type="number" min={0} step="0.1" value={form.min_rating ?? ''} onChange={(event) => setForm({ ...form, min_rating: event.target.value === '' ? null : Number(event.target.value) })} /></div>
            <div className="space-y-1.5"><Label>Peso</Label><Input type="number" value={form.weight ?? 0} onChange={(event) => setForm({ ...form, weight: Number(event.target.value) })} disabled={form.decision === 'deny'} /></div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 sm:col-span-2"><div><p className="text-sm font-medium">Regra ativa</p><p className="text-xs text-muted-foreground">Pode ser desligada sem excluir.</p></div><Switch checked={form.active !== false} onCheckedChange={(active) => setForm({ ...form, active })} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Observações</Label><Textarea value={form.notes || ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
            <DialogFooter className="sm:col-span-2"><Button variant="outline" onClick={() => setForm(null)} disabled={mutations.save.isPending}>Cancelar</Button><Button onClick={() => void save()} disabled={mutations.save.isPending || !form.event_role_id || (form.match_operator !== 'any' && !form.match_value?.trim())}>{mutations.save.isPending ? 'Salvando...' : 'Salvar regra'}</Button></DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Matriz de decisão</p><p className="text-xs text-muted-foreground">Bloquear vence Priorizar. Se houver regras “Permitir”, apenas os perfis permitidos entram no ranking.</p></div><Button size="sm" onClick={() => setForm(blankForm())}><Plus className="mr-2 h-4 w-4" />Nova regra</Button></div>
            {query.isLoading ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Carregando regras...</div> : rules.length ? rules.map((rule: any) => { const meta = decisions.find((item) => item.value === rule.decision) || decisions[1]; return (
              <div key={rule.id} className={`rounded-xl border border-border/60 p-3 ${rule.active === false ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold">{roleById.get(rule.event_role_id)?.name || 'Função removida'}</p><Badge variant="outline" className={meta.tone}>{meta.label}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{fields.find(([value]) => value === rule.collaborator_field)?.[1]} · {operators.find(([value]) => value === rule.match_operator)?.[1]}{rule.match_operator !== 'any' ? ` “${rule.match_value || ''}”` : ''}</p></div><Switch checked={rule.active !== false} onCheckedChange={(active) => mutations.toggle.mutate({ id: rule.id, active })} /></div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><span>Participações: {rule.min_participations ?? '—'}</span><span>•</span><span>Nota: {rule.min_rating ?? '—'}</span><span>•</span><span>Peso: {Number(rule.weight || 0)}</span></div>
                <div className="mt-3 flex gap-2 border-t border-border/50 pt-3"><Button size="sm" variant="outline" onClick={() => setForm({ ...rule })}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</Button><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (window.confirm('Remover esta regra?')) mutations.remove.mutate(rule.id); }}><Trash2 className="mr-2 h-3.5 w-3.5" />Remover</Button></div>
              </div>
            ); }) : <div className="rounded-xl border border-dashed p-8 text-center"><p className="text-sm font-medium">Nenhuma regra cadastrada.</p><p className="mt-1 text-xs text-muted-foreground">O motor continua usando histórico, função preferida, avaliações e experiência.</p></div>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
