import { useMemo, useState } from 'react';
import { MapPinned, Pencil, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { usePsRoles } from '@/hooks/useProcessoSeletivo';
import {
  usePsV2EventStaffing,
  usePsV2StaffingCatalog,
  usePsV2StaffingMutations,
  type PsV2StaffingRequirementInput,
  type PsV2StaffingScope,
} from '@/hooks/usePsV2EventStaffing';

const scopeLabels: Record<PsV2StaffingScope['scopeType'], string> = {
  location: 'Local', building: 'Prédio', floor: 'Andar', area: 'Área', environment: 'Ambiente',
};
const blankForm = (): PsV2StaffingRequirementInput => ({ scope_type: 'environment', scope_id: '', role_id: '', role_name_snapshot: '', quantity: 1, start_time: null, end_time: null, priority: 100, required: true, notes: '', active: true });

export function PsV2StaffingDialog({ open, onOpenChange, eventId }: { open: boolean; onOpenChange: (open: boolean) => void; eventId?: string }) {
  const { data: roles = [] } = usePsRoles();
  const staffing = usePsV2EventStaffing(eventId);
  const catalog = usePsV2StaffingCatalog();
  const mutations = usePsV2StaffingMutations(eventId);
  const [form, setForm] = useState<PsV2StaffingRequirementInput | null>(null);
  const data = catalog.data;
  const requirements = staffing.data?.requirements || [];
  const scopes = staffing.data?.scopes || {};
  const schemaReady = staffing.data?.schemaReady !== false && catalog.data?.schemaReady !== false;

  const locationById = useMemo(() => new Map<string, any>((data?.locations || []).map((item: any) => [item.id, item])), [data?.locations]);
  const buildingById = useMemo(() => new Map<string, any>((data?.buildings || []).map((item: any) => [item.id, item])), [data?.buildings]);
  const floorById = useMemo(() => new Map<string, any>((data?.floors || []).map((item: any) => [item.id, item])), [data?.floors]);
  const areaById = useMemo(() => new Map<string, any>((data?.areas || []).map((item: any) => [item.id, item])), [data?.areas]);
  const roleById = useMemo(() => new Map<string, any>(roles.map((role: any) => [role.id, role])), [roles]);

  const scopeOptions = useMemo(() => {
    if (!data || !form) return [] as Array<{ id: string; label: string }>;
    const list = form.scope_type === 'location' ? data.locations : form.scope_type === 'building' ? data.buildings : form.scope_type === 'floor' ? data.floors : form.scope_type === 'area' ? data.areas : data.environments;
    return (list || []).map((item: any) => {
      if (form.scope_type === 'location') return { id: item.id, label: item.name };
      if (form.scope_type === 'building') return { id: item.id, label: `${locationById.get(item.location_id)?.name || 'Local'} › ${item.name}` };
      if (form.scope_type === 'floor') { const building = buildingById.get(item.building_id); return { id: item.id, label: `${locationById.get(building?.location_id)?.name || 'Local'} › ${building?.name || 'Prédio'} › ${item.name}` }; }
      if (form.scope_type === 'area') { const floor = floorById.get(item.floor_id); const building = buildingById.get(floor?.building_id); return { id: item.id, label: `${locationById.get(building?.location_id)?.name || 'Local'} › ${floor?.name || 'Andar'} › ${item.name}` }; }
      const floor = floorById.get(item.floor_id); const building = buildingById.get(floor?.building_id); const area = areaById.get(item.area_id);
      return { id: item.id, label: `${locationById.get(building?.location_id)?.name || 'Local'} › ${floor?.name || 'Andar'} › ${area ? `${area.name} › ` : ''}${item.name}` };
    });
  }, [data, form, locationById, buildingById, floorById, areaById]);

  const getScopeName = (item: any) => {
    const id = item[`${item.scope_type}_id`];
    return scopes[`${item.scope_type}:${id}`]?.name || 'Estrutura não localizada';
  };

  const edit = (item: any) => setForm({ id: item.id, scope_type: item.scope_type, scope_id: item[`${item.scope_type}_id`] || '', role_id: item.role_id || '', role_name_snapshot: item.role_name_snapshot || '', quantity: Number(item.quantity || 1), start_time: item.start_time || null, end_time: item.end_time || null, priority: Number(item.priority ?? 100), required: item.required !== false, notes: item.notes || '', active: item.active !== false });
  const save = async () => { if (!form?.scope_id || !form.role_name_snapshot || Number(form.quantity) < 1) return; await mutations.saveRequirement.mutateAsync(form); setForm(null); };
  const close = (next: boolean) => { if (!next && mutations.saveRequirement.isPending) return; if (!next) setForm(null); onOpenChange(next); };
  const totalDemand = requirements.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl" onInteractOutside={(event) => { if (mutations.saveRequirement.isPending) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>Necessidades de equipe</DialogTitle></DialogHeader>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3"><div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><p className="text-xs leading-relaxed text-muted-foreground"><strong className="text-foreground">Planejamento isolado.</strong> Estas regras ficam no V2 e apenas alimentam a proposta automática.</p></div></div>

        {!schemaReady ? <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-4 text-sm"><strong>Estrutura V2 ainda não ativada.</strong><p className="mt-1 text-xs text-muted-foreground">O cadastro ficará disponível depois da ativação segura das tabelas ps_v2_*.</p></div> : form ? (
          <div className="grid gap-4 py-1 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Nível da estrutura *</Label><Select value={form.scope_type} onValueChange={(value: any) => setForm({ ...form, scope_type: value, scope_id: '' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(scopeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Local específico *</Label><Select value={form.scope_id} onValueChange={(value) => setForm({ ...form, scope_id: value })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{scopeOptions.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Função *</Label><Select value={form.role_id || ''} onValueChange={(value) => { const role = roleById.get(value); setForm({ ...form, role_id: value, role_name_snapshot: role?.name || '' }); }}><SelectTrigger><SelectValue placeholder="Selecione a função" /></SelectTrigger><SelectContent>{roles.filter((role: any) => role.active !== false).map((role: any) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Quantidade *</Label><Input type="number" min={1} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} /></div>
            <div className="space-y-1.5"><Label>Prioridade</Label><Input type="number" value={form.priority ?? 100} onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })} /></div>
            <div className="space-y-1.5"><Label>Início</Label><Input type="time" value={form.start_time || ''} onChange={(event) => setForm({ ...form, start_time: event.target.value || null })} /></div>
            <div className="space-y-1.5"><Label>Fim</Label><Input type="time" value={form.end_time || ''} onChange={(event) => setForm({ ...form, end_time: event.target.value || null })} /></div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 sm:col-span-2"><div><p className="text-sm font-medium">Necessidade obrigatória</p><p className="text-xs text-muted-foreground">Vagas obrigatórias são processadas antes das opcionais.</p></div><Switch checked={form.required !== false} onCheckedChange={(required) => setForm({ ...form, required })} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Observações</Label><Textarea value={form.notes || ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Ex.: precisa conhecer o prédio, ficar próximo à coordenação..." /></div>
            <DialogFooter className="sm:col-span-2"><Button variant="outline" onClick={() => setForm(null)} disabled={mutations.saveRequirement.isPending}>Cancelar</Button><Button onClick={() => void save()} disabled={mutations.saveRequirement.isPending || !form.scope_id || !form.role_name_snapshot || Number(form.quantity) < 1}>{mutations.saveRequirement.isPending ? 'Salvando...' : 'Salvar necessidade'}</Button></DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-border/60 bg-muted/10 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Regras</p><p className="mt-1 text-xl font-semibold">{requirements.length}</p></div><div className="rounded-xl border border-border/60 bg-muted/10 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Demanda</p><p className="mt-1 text-xl font-semibold">{totalDemand}</p></div><div className="rounded-xl border border-border/60 bg-muted/10 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Funções</p><p className="mt-1 text-xl font-semibold">{new Set(requirements.map((item: any) => item.role_name_snapshot)).size}</p></div></div>
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Distribuição por estrutura</p><p className="text-xs text-muted-foreground">Cadastre demandas por local, prédio, andar, área ou ambiente.</p></div><Button size="sm" onClick={() => setForm(blankForm())}><Plus className="mr-2 h-4 w-4" />Nova necessidade</Button></div>
            {staffing.isLoading ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Carregando necessidades...</div> : requirements.length ? requirements.map((item: any) => (
              <div key={item.id} className="rounded-xl border border-border/60 p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{item.role_name_snapshot}</p><Badge variant="outline">{item.quantity} pessoa(s)</Badge>{item.required ? <Badge>Obrigatória</Badge> : <Badge variant="secondary">Opcional</Badge>}</div><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPinned className="h-3.5 w-3.5" />{scopeLabels[item.scope_type as PsV2StaffingScope['scopeType']]} · {getScopeName(item)}</p>{item.start_time || item.end_time ? <p className="mt-1 text-[11px] text-muted-foreground">Horário: {item.start_time || '—'} até {item.end_time || '—'} · prioridade {item.priority ?? 100}</p> : null}</div><div className="flex shrink-0 gap-1"><Button size="sm" variant="outline" onClick={() => edit(item)}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</Button><Button size="icon" variant="ghost" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => { if (window.confirm('Remover esta necessidade?')) mutations.removeRequirement.mutate(item.id); }}><Trash2 className="h-4 w-4" /></Button></div></div></div>
            )) : <div className="rounded-xl border border-dashed p-8 text-center"><Users className="mx-auto h-8 w-8 text-muted-foreground/50" /><p className="mt-3 text-sm font-medium">Nenhuma necessidade configurada.</p><p className="mt-1 text-xs text-muted-foreground">Exemplo: 2 fiscais + 1 líder em cada sala, 2 itinerantes no corredor ou 1 coordenador por andar.</p></div>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
