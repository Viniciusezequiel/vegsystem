import { useMemo, useState } from 'react';
import { MapPinned, Pencil, Plus, ShieldCheck, Sparkles, Trash2, Users } from 'lucide-react';

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

const blankForm = (): PsV2StaffingRequirementInput => ({
  scope_type: 'environment',
  scope_id: '',
  role_id: '',
  role_name_snapshot: '',
  quantity: 1,
  start_time: null,
  end_time: null,
  priority: 100,
  required: true,
  notes: '',
  active: true,
});

const normalizeText = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/\s+/g, ' ')
  .trim();

type FloorTemplate = {
  floor_id: string;
  circulation_target: string;
  room_role_id: string;
  room_quantity: number;
  leader_role_id: string;
  leader_quantity: number;
  itinerant_role_id: string;
  itinerant_quantity: number;
  subcoordinator_role_id: string;
  subcoordinator_quantity: number;
  coordinator_role_id: string;
  coordinator_quantity: number;
  include_coordinator: boolean;
  start_time: string | null;
  end_time: string | null;
};

export function PsV2StaffingDialog({ open, onOpenChange, eventId }: { open: boolean; onOpenChange: (open: boolean) => void; eventId?: string }) {
  const { data: roles = [] } = usePsRoles();
  const staffing = usePsV2EventStaffing(eventId);
  const catalog = usePsV2StaffingCatalog();
  const mutations = usePsV2StaffingMutations(eventId);
  const [form, setForm] = useState<PsV2StaffingRequirementInput | null>(null);
  const [template, setTemplate] = useState<FloorTemplate | null>(null);

  const data = catalog.data;
  const requirements = staffing.data?.requirements || [];
  const scopes = staffing.data?.scopes || {};
  const schemaReady = staffing.data?.schemaReady !== false && catalog.data?.schemaReady !== false;
  const activeRoles = roles.filter((role: any) => role.active !== false);

  const locationById = useMemo(() => new Map<string, any>((data?.locations || []).map((item: any) => [item.id, item])), [data?.locations]);
  const buildingById = useMemo(() => new Map<string, any>((data?.buildings || []).map((item: any) => [item.id, item])), [data?.buildings]);
  const floorById = useMemo(() => new Map<string, any>((data?.floors || []).map((item: any) => [item.id, item])), [data?.floors]);
  const areaById = useMemo(() => new Map<string, any>((data?.areas || []).map((item: any) => [item.id, item])), [data?.areas]);
  const roleById = useMemo(() => new Map<string, any>(roles.map((role: any) => [role.id, role])), [roles]);

  const floorLabel = (floorId: string) => {
    const floor = floorById.get(floorId);
    const building = buildingById.get(floor?.building_id);
    const location = locationById.get(building?.location_id);
    return [location?.name, building?.name, floor?.name].filter(Boolean).join(' › ') || 'Andar';
  };

  const firstCirculationTarget = (floorId: string) => {
    const corridor = (data?.areas || []).find((area: any) => area.floor_id === floorId && area.area_type === 'corridor');
    return corridor ? `area:${corridor.id}` : `floor:${floorId}`;
  };

  const findRoleId = (tokens: string[], excluded: string[] = []) => {
    const role = activeRoles.find((candidate: any) => {
      const name = normalizeText(candidate.name);
      return tokens.some((token) => name.includes(token)) && !excluded.some((token) => name.includes(token));
    });
    return role?.id || '';
  };

  const startTemplate = () => {
    const floorId = data?.floors?.[0]?.id || '';
    setForm(null);
    setTemplate({
      floor_id: floorId,
      circulation_target: firstCirculationTarget(floorId),
      room_role_id: findRoleId(['fiscal'], ['lider', 'itiner', 'sanit', 'coorden', 'subcoorden']),
      room_quantity: 2,
      leader_role_id: findRoleId(['lider']),
      leader_quantity: 1,
      itinerant_role_id: findRoleId(['itiner']),
      itinerant_quantity: 2,
      subcoordinator_role_id: findRoleId(['subcoorden']),
      subcoordinator_quantity: 1,
      coordinator_role_id: findRoleId(['coordenador'], ['subcoorden']),
      coordinator_quantity: 1,
      include_coordinator: true,
      start_time: null,
      end_time: null,
    });
  };

  const changeTemplateFloor = (floorId: string) => {
    if (!template) return;
    setTemplate({ ...template, floor_id: floorId, circulation_target: firstCirculationTarget(floorId) });
  };

  const scopeOptions = useMemo(() => {
    if (!data || !form) return [] as Array<{ id: string; label: string }>;
    const list = form.scope_type === 'location' ? data.locations : form.scope_type === 'building' ? data.buildings : form.scope_type === 'floor' ? data.floors : form.scope_type === 'area' ? data.areas : data.environments;
    return (list || []).map((item: any) => {
      if (form.scope_type === 'location') return { id: item.id, label: item.name };
      if (form.scope_type === 'building') return { id: item.id, label: `${locationById.get(item.location_id)?.name || 'Local'} › ${item.name}` };
      if (form.scope_type === 'floor') {
        const building = buildingById.get(item.building_id);
        return { id: item.id, label: `${locationById.get(building?.location_id)?.name || 'Local'} › ${building?.name || 'Prédio'} › ${item.name}` };
      }
      if (form.scope_type === 'area') {
        const floor = floorById.get(item.floor_id);
        const building = buildingById.get(floor?.building_id);
        return { id: item.id, label: `${locationById.get(building?.location_id)?.name || 'Local'} › ${floor?.name || 'Andar'} › ${item.name}` };
      }
      const floor = floorById.get(item.floor_id);
      const building = buildingById.get(floor?.building_id);
      const area = areaById.get(item.area_id);
      return { id: item.id, label: `${locationById.get(building?.location_id)?.name || 'Local'} › ${floor?.name || 'Andar'} › ${area ? `${area.name} › ` : ''}${item.name}` };
    });
  }, [data, form, locationById, buildingById, floorById, areaById]);

  const getScopeName = (item: any) => {
    const id = item[`${item.scope_type}_id`];
    return scopes[`${item.scope_type}:${id}`]?.name || 'Estrutura não localizada';
  };

  const edit = (item: any) => {
    setTemplate(null);
    setForm({
      id: item.id,
      scope_type: item.scope_type,
      scope_id: item[`${item.scope_type}_id`] || '',
      role_id: item.role_id || '',
      role_name_snapshot: item.role_name_snapshot || '',
      quantity: Number(item.quantity || 1),
      start_time: item.start_time || null,
      end_time: item.end_time || null,
      priority: Number(item.priority ?? 100),
      required: item.required !== false,
      notes: item.notes || '',
      active: item.active !== false,
    });
  };

  const save = async () => {
    if (!form?.scope_id || !form.role_name_snapshot || Number(form.quantity) < 1) return;
    await mutations.saveRequirement.mutateAsync(form);
    setForm(null);
  };

  const close = (next: boolean) => {
    if (!next && (mutations.saveRequirement.isPending || mutations.saveBulkRequirements.isPending)) return;
    if (!next) {
      setForm(null);
      setTemplate(null);
    }
    onOpenChange(next);
  };

  const totalDemand = requirements.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);

  const templateClassrooms = useMemo(() => {
    if (!template?.floor_id) return [] as any[];
    return (data?.environments || []).filter((environment: any) =>
      environment.floor_id === template.floor_id && environment.environment_type === 'classroom',
    );
  }, [data?.environments, template?.floor_id]);

  const templateAreas = useMemo(() => {
    if (!template?.floor_id) return [] as any[];
    return (data?.areas || []).filter((area: any) => area.floor_id === template.floor_id);
  }, [data?.areas, template?.floor_id]);

  const templateRows = useMemo(() => {
    if (!template?.floor_id) return [] as PsV2StaffingRequirementInput[];
    const rows: PsV2StaffingRequirementInput[] = [];
    const shared = { start_time: template.start_time, end_time: template.end_time, required: true, active: true };
    const role = (id: string) => roleById.get(id);

    const add = (scope_type: PsV2StaffingScope['scopeType'], scope_id: string, roleId: string, quantity: number, priority: number, notes: string) => {
      const selectedRole = role(roleId);
      if (!scope_id || !selectedRole || Number(quantity || 0) < 1) return;
      rows.push({
        scope_type,
        scope_id,
        role_id: selectedRole.id,
        role_name_snapshot: selectedRole.name,
        quantity: Number(quantity),
        priority,
        notes,
        ...shared,
      });
    };

    for (const classroom of templateClassrooms) {
      add('environment', classroom.id, template.room_role_id, template.room_quantity, 70, 'Modelo de andar · equipe base da sala');
      add('environment', classroom.id, template.leader_role_id, template.leader_quantity, 50, 'Modelo de andar · liderança da sala');
    }

    const [targetType, targetId] = template.circulation_target.split(':');
    if (targetType === 'area' || targetType === 'floor') {
      add(targetType as 'area' | 'floor', targetId, template.itinerant_role_id, template.itinerant_quantity, 40, 'Modelo de andar · circulação e apoio');
      add(targetType as 'area' | 'floor', targetId, template.subcoordinator_role_id, template.subcoordinator_quantity, 20, 'Modelo de andar · subcoordenação');
    }

    if (template.include_coordinator) {
      add('floor', template.floor_id, template.coordinator_role_id, template.coordinator_quantity, 10, 'Modelo de andar · coordenação');
    }

    return rows;
  }, [template, templateClassrooms, roleById]);

  const templateMissingRoles = useMemo(() => {
    if (!template) return [] as string[];
    const missing: string[] = [];
    if (template.room_quantity > 0 && !template.room_role_id) missing.push('Fiscal de sala');
    if (template.leader_quantity > 0 && !template.leader_role_id) missing.push('Líder de sala');
    if (template.itinerant_quantity > 0 && !template.itinerant_role_id) missing.push('Itinerante');
    if (template.subcoordinator_quantity > 0 && !template.subcoordinator_role_id) missing.push('Subcoordenador');
    if (template.include_coordinator && template.coordinator_quantity > 0 && !template.coordinator_role_id) missing.push('Coordenador');
    return missing;
  }, [template]);

  const existingRequirementKeys = useMemo(() => new Set(requirements.map((item: any) => {
    const scopeId = item[`${item.scope_type}_id`];
    return `${item.scope_type}:${scopeId}:${item.role_id || normalizeText(item.role_name_snapshot)}`;
  })), [requirements]);

  const templateDuplicateRows = templateRows.filter((item) =>
    existingRequirementKeys.has(`${item.scope_type}:${item.scope_id}:${item.role_id || normalizeText(item.role_name_snapshot)}`),
  ).length;
  const templateNewRows = templateRows.length - templateDuplicateRows;
  const templateDemand = templateRows.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const roomRulesEnabled = !!template && (template.room_quantity > 0 || template.leader_quantity > 0);
  const templateHasNoRooms = roomRulesEnabled && templateClassrooms.length === 0;
  const canApplyTemplate = !!template?.floor_id
    && templateRows.length > 0
    && !templateMissingRoles.length
    && !templateHasNoRooms
    && !mutations.saveBulkRequirements.isPending;

  const applyTemplate = async () => {
    if (!canApplyTemplate) return;
    await mutations.saveBulkRequirements.mutateAsync(templateRows);
    setTemplate(null);
  };

  const roleSelect = (value: string, onChange: (value: string) => void, placeholder: string) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{activeRoles.map((role: any) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl" onInteractOutside={(event) => { if (mutations.saveRequirement.isPending || mutations.saveBulkRequirements.isPending) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>Necessidades de equipe</DialogTitle></DialogHeader>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3"><div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><p className="text-xs leading-relaxed text-muted-foreground"><strong className="text-foreground">Planejamento isolado.</strong> Estas regras ficam no V2 e apenas alimentam a proposta automática.</p></div></div>

        {!schemaReady ? (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-4 text-sm"><strong>Estrutura V2 ainda não ativada.</strong><p className="mt-1 text-xs text-muted-foreground">O cadastro ficará disponível depois da ativação segura das tabelas ps_v2_*.</p></div>
        ) : template ? (
          <div className="space-y-4 py-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><p className="text-sm font-semibold">Modelo padrão de andar</p></div><p className="mt-1 text-xs text-muted-foreground">Replica a equipe-base em todas as salas do andar e adiciona circulação e coordenação.</p></div>
              <Button variant="ghost" size="sm" onClick={() => setTemplate(null)} disabled={mutations.saveBulkRequirements.isPending}>Voltar às regras</Button>
            </div>

            <div className="grid gap-4 rounded-xl border border-border/60 bg-muted/10 p-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2"><Label>Andar *</Label><Select value={template.floor_id} onValueChange={changeTemplateFloor}><SelectTrigger><SelectValue placeholder="Selecione o andar" /></SelectTrigger><SelectContent>{(data?.floors || []).map((floor: any) => <SelectItem key={floor.id} value={floor.id}>{floorLabel(floor.id)}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Início comum</Label><Input type="time" value={template.start_time || ''} onChange={(event) => setTemplate({ ...template, start_time: event.target.value || null })} /></div>
              <div className="space-y-1.5"><Label>Fim comum</Label><Input type="time" value={template.end_time || ''} onChange={(event) => setTemplate({ ...template, end_time: event.target.value || null })} /></div>
            </div>

            <div className="rounded-xl border border-border/60 p-4">
              <div className="mb-3"><p className="text-sm font-semibold">Salas do andar</p><p className="text-xs text-muted-foreground">Encontradas {templateClassrooms.length} sala(s) cadastrada(s) como ambiente de aula.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 rounded-xl bg-muted/10 p-3"><Label>Fiscal de sala</Label>{roleSelect(template.room_role_id, (value) => setTemplate({ ...template, room_role_id: value }), 'Selecione a função')}<div className="space-y-1"><Label className="text-xs text-muted-foreground">Quantidade por sala</Label><Input type="number" min={0} value={template.room_quantity} onChange={(event) => setTemplate({ ...template, room_quantity: Math.max(0, Number(event.target.value)) })} /></div></div>
                <div className="space-y-2 rounded-xl bg-muted/10 p-3"><Label>Liderança da sala</Label>{roleSelect(template.leader_role_id, (value) => setTemplate({ ...template, leader_role_id: value }), 'Selecione a função')}<div className="space-y-1"><Label className="text-xs text-muted-foreground">Quantidade por sala</Label><Input type="number" min={0} value={template.leader_quantity} onChange={(event) => setTemplate({ ...template, leader_quantity: Math.max(0, Number(event.target.value)) })} /></div></div>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 p-4">
              <div className="mb-3"><p className="text-sm font-semibold">Circulação do andar</p><p className="text-xs text-muted-foreground">Use um corredor/área quando existir; caso contrário, a necessidade pode ficar no andar inteiro.</p></div>
              <div className="mb-4 space-y-1.5"><Label>Escopo da circulação *</Label><Select value={template.circulation_target} onValueChange={(value) => setTemplate({ ...template, circulation_target: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={`floor:${template.floor_id}`}>Andar inteiro · {floorById.get(template.floor_id)?.name || 'Andar'}</SelectItem>{templateAreas.map((area: any) => <SelectItem key={area.id} value={`area:${area.id}`}>{area.area_type === 'corridor' ? 'Corredor' : 'Área'} · {area.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 rounded-xl bg-muted/10 p-3"><Label>Itinerantes</Label>{roleSelect(template.itinerant_role_id, (value) => setTemplate({ ...template, itinerant_role_id: value }), 'Selecione a função')}<div className="space-y-1"><Label className="text-xs text-muted-foreground">Quantidade</Label><Input type="number" min={0} value={template.itinerant_quantity} onChange={(event) => setTemplate({ ...template, itinerant_quantity: Math.max(0, Number(event.target.value)) })} /></div></div>
                <div className="space-y-2 rounded-xl bg-muted/10 p-3"><Label>Subcoordenação</Label>{roleSelect(template.subcoordinator_role_id, (value) => setTemplate({ ...template, subcoordinator_role_id: value }), 'Selecione a função')}<div className="space-y-1"><Label className="text-xs text-muted-foreground">Quantidade</Label><Input type="number" min={0} value={template.subcoordinator_quantity} onChange={(event) => setTemplate({ ...template, subcoordinator_quantity: Math.max(0, Number(event.target.value)) })} /></div></div>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 p-4">
              <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold">Coordenação do andar</p><p className="text-xs text-muted-foreground">Cria uma necessidade no nível do andar.</p></div><Switch checked={template.include_coordinator} onCheckedChange={(include_coordinator) => setTemplate({ ...template, include_coordinator })} /></div>
              {template.include_coordinator ? <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]"><div className="space-y-1.5"><Label>Função</Label>{roleSelect(template.coordinator_role_id, (value) => setTemplate({ ...template, coordinator_role_id: value }), 'Selecione a função')}</div><div className="space-y-1.5"><Label>Quantidade</Label><Input type="number" min={1} value={template.coordinator_quantity} onChange={(event) => setTemplate({ ...template, coordinator_quantity: Math.max(1, Number(event.target.value)) })} /></div></div> : null}
            </div>

            <div className="grid gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-border/60 bg-muted/10 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Salas</p><p className="mt-1 text-xl font-semibold">{templateClassrooms.length}</p></div>
              <div className="rounded-xl border border-border/60 bg-muted/10 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Demanda prevista</p><p className="mt-1 text-xl font-semibold">{templateDemand}</p></div>
              <div className="rounded-xl border border-border/60 bg-muted/10 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Novas regras</p><p className="mt-1 text-xl font-semibold">{templateNewRows}</p></div>
              <div className="rounded-xl border border-border/60 bg-muted/10 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Já existentes</p><p className="mt-1 text-xl font-semibold">{templateDuplicateRows}</p></div>
            </div>

            {templateMissingRoles.length ? <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-3 text-xs"><strong>Selecione as funções faltantes:</strong> {templateMissingRoles.join(', ')}.</div> : null}
            {templateHasNoRooms ? <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-3 text-xs"><strong>Nenhuma sala de aula encontrada neste andar.</strong> Ajuste a estrutura ou coloque as quantidades de sala em zero.</div> : null}
            {templateDuplicateRows ? <p className="text-[11px] leading-relaxed text-muted-foreground">Regras iguais já existentes no mesmo escopo serão preservadas e não serão duplicadas. Depois da aplicação, você pode editar qualquer sala individualmente para criar exceções.</p> : <p className="text-[11px] leading-relaxed text-muted-foreground">Após aplicar o modelo, cada regra continua editável individualmente. Isso permite reduzir ou aumentar uma sala específica sem refazer o andar inteiro.</p>}

            <DialogFooter><Button variant="outline" onClick={() => setTemplate(null)} disabled={mutations.saveBulkRequirements.isPending}>Cancelar</Button><Button onClick={() => void applyTemplate()} disabled={!canApplyTemplate}>{mutations.saveBulkRequirements.isPending ? 'Aplicando...' : `Aplicar modelo (${templateNewRows} novas regras)`}</Button></DialogFooter>
          </div>
        ) : form ? (
          <div className="grid gap-4 py-1 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Nível da estrutura *</Label><Select value={form.scope_type} onValueChange={(value: any) => setForm({ ...form, scope_type: value, scope_id: '' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(scopeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Local específico *</Label><Select value={form.scope_id} onValueChange={(value) => setForm({ ...form, scope_id: value })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{scopeOptions.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Função *</Label><Select value={form.role_id || ''} onValueChange={(value) => { const role = roleById.get(value); setForm({ ...form, role_id: value, role_name_snapshot: role?.name || '' }); }}><SelectTrigger><SelectValue placeholder="Selecione a função" /></SelectTrigger><SelectContent>{activeRoles.map((role: any) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent></Select></div>
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">Distribuição por estrutura</p><p className="text-xs text-muted-foreground">Cadastre manualmente ou replique o padrão de um andar inteiro.</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={startTemplate}><Sparkles className="mr-2 h-4 w-4" />Aplicar modelo de andar</Button><Button size="sm" onClick={() => { setTemplate(null); setForm(blankForm()); }}><Plus className="mr-2 h-4 w-4" />Nova necessidade</Button></div></div>
            {staffing.isLoading ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Carregando necessidades...</div> : requirements.length ? requirements.map((item: any) => (
              <div key={item.id} className="rounded-xl border border-border/60 p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{item.role_name_snapshot}</p><Badge variant="outline">{item.quantity} pessoa(s)</Badge>{item.required ? <Badge>Obrigatória</Badge> : <Badge variant="secondary">Opcional</Badge>}</div><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPinned className="h-3.5 w-3.5" />{scopeLabels[item.scope_type as PsV2StaffingScope['scopeType']]} · {getScopeName(item)}</p>{item.start_time || item.end_time ? <p className="mt-1 text-[11px] text-muted-foreground">Horário: {item.start_time || '—'} até {item.end_time || '—'} · prioridade {item.priority ?? 100}</p> : <p className="mt-1 text-[11px] text-muted-foreground">Prioridade {item.priority ?? 100}</p>}</div><div className="flex shrink-0 gap-1"><Button size="sm" variant="outline" onClick={() => edit(item)}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</Button><Button size="icon" variant="ghost" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => { if (window.confirm('Remover esta necessidade?')) mutations.removeRequirement.mutate(item.id); }}><Trash2 className="h-4 w-4" /></Button></div></div></div>
            )) : <div className="rounded-xl border border-dashed p-8 text-center"><Users className="mx-auto h-8 w-8 text-muted-foreground/50" /><p className="mt-3 text-sm font-medium">Nenhuma necessidade configurada.</p><p className="mt-1 text-xs text-muted-foreground">Use o modelo de andar para criar 2 fiscais + 1 líder por sala, itinerantes, subcoordenação e coordenação em poucos cliques.</p><Button size="sm" variant="outline" className="mt-4" onClick={startTemplate}><Sparkles className="mr-2 h-4 w-4" />Montar primeiro andar</Button></div>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
