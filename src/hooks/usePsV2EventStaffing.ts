import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;
const isMissingV2Schema = (error: any) =>
  error?.code === '42P01' || String(error?.message || '').includes('ps_v2_');
const check = (error: any) => { if (error) throw error; };

const unique = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.filter(Boolean) as string[]));

const normalizeKey = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/\s+/g, ' ')
  .trim();

export type PsV2StaffingScope = {
  id: string;
  name: string;
  scopeType: 'location' | 'building' | 'floor' | 'area' | 'environment';
};

export type PsV2StaffingRequirementInput = {
  id?: string;
  scope_type: PsV2StaffingScope['scopeType'];
  scope_id: string;
  role_id?: string | null;
  role_name_snapshot: string;
  quantity: number;
  start_time?: string | null;
  end_time?: string | null;
  priority?: number;
  required?: boolean;
  notes?: string | null;
  active?: boolean;
};

const requirementKey = ({
  scopeType,
  scopeId,
  roleId,
  roleName,
}: {
  scopeType: PsV2StaffingScope['scopeType'];
  scopeId: string;
  roleId?: string | null;
  roleName?: string | null;
}) => `${scopeType}:${scopeId}:${roleId || normalizeKey(roleName)}`;

const requirementPayload = (eventId: string, input: PsV2StaffingRequirementInput) => {
  if (!input.scope_id) throw new Error('Selecione o local da necessidade.');
  if (!input.role_name_snapshot?.trim()) throw new Error('Selecione a função da necessidade.');
  if (Number(input.quantity || 0) < 1) throw new Error('A quantidade deve ser maior que zero.');

  const payload: Record<string, any> = {
    event_id: eventId,
    scope_type: input.scope_type,
    location_id: null,
    building_id: null,
    floor_id: null,
    area_id: null,
    environment_id: null,
    role_id: input.role_id || null,
    role_name_snapshot: input.role_name_snapshot.trim(),
    quantity: Math.max(1, Number(input.quantity || 1)),
    start_time: input.start_time || null,
    end_time: input.end_time || null,
    priority: Number(input.priority ?? 100),
    required: input.required !== false,
    notes: input.notes?.trim() || null,
    active: input.active !== false,
  };
  payload[`${input.scope_type}_id`] = input.scope_id;
  return payload;
};

export function usePsV2EventStaffing(eventId?: string) {
  return useQuery({
    queryKey: ['ps-v2', 'event-staffing', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const requirementsResult = await db
        .from('ps_v2_staff_requirements')
        .select('*')
        .eq('event_id', eventId)
        .eq('active', true)
        .order('priority')
        .order('created_at');

      if (requirementsResult.error && isMissingV2Schema(requirementsResult.error)) {
        return {
          schemaReady: false,
          requirements: [] as any[],
          scopes: {} as Record<string, PsV2StaffingScope>,
        };
      }
      check(requirementsResult.error);

      const requirements = requirementsResult.data || [];
      const definitions = [
        { type: 'location' as const, table: 'ps_v2_locations', ids: unique(requirements.map((item: any) => item.location_id)) },
        { type: 'building' as const, table: 'ps_v2_buildings', ids: unique(requirements.map((item: any) => item.building_id)) },
        { type: 'floor' as const, table: 'ps_v2_floors', ids: unique(requirements.map((item: any) => item.floor_id)) },
        { type: 'area' as const, table: 'ps_v2_areas', ids: unique(requirements.map((item: any) => item.area_id)) },
        { type: 'environment' as const, table: 'ps_v2_environments', ids: unique(requirements.map((item: any) => item.environment_id)) },
      ];

      const scopes: Record<string, PsV2StaffingScope> = {};
      await Promise.all(definitions.map(async (definition) => {
        if (!definition.ids.length) return;
        const result = await db.from(definition.table).select('id,name').in('id', definition.ids);
        check(result.error);
        for (const row of result.data || []) {
          scopes[`${definition.type}:${row.id}`] = { id: row.id, name: row.name, scopeType: definition.type };
        }
      }));

      return { schemaReady: true, requirements, scopes };
    },
  });
}

export function usePsV2StaffingCatalog() {
  return useQuery({
    queryKey: ['ps-v2', 'staffing-catalog'],
    queryFn: async () => {
      const [locations, buildings, floors, areas, environments] = await Promise.all([
        db.from('ps_v2_locations').select('id,name,active').eq('active', true).order('name'),
        db.from('ps_v2_buildings').select('id,name,location_id,active').eq('active', true).order('sort_order').order('name'),
        db.from('ps_v2_floors').select('id,name,building_id,active').eq('active', true).order('sort_order').order('name'),
        db.from('ps_v2_areas').select('id,name,floor_id,area_type,active').eq('active', true).order('sort_order').order('name'),
        db.from('ps_v2_environments').select('id,name,floor_id,area_id,environment_type,capacity,active').eq('active', true).order('sort_order').order('name'),
      ]);

      const firstError = [locations, buildings, floors, areas, environments].find((result: any) => result.error)?.error;
      if (firstError && isMissingV2Schema(firstError)) {
        return { schemaReady: false, locations: [], buildings: [], floors: [], areas: [], environments: [] };
      }
      check(firstError);
      return {
        schemaReady: true,
        locations: locations.data || [],
        buildings: buildings.data || [],
        floors: floors.data || [],
        areas: areas.data || [],
        environments: environments.data || [],
      };
    },
  });
}

export function usePsV2StaffingMutations(eventId?: string) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['ps-v2', 'event-staffing', eventId] });
    qc.invalidateQueries({ queryKey: ['ps-v2', 'allocation-review', eventId] });
  };

  const saveRequirement = useMutation({
    mutationFn: async (input: PsV2StaffingRequirementInput) => {
      if (!eventId) throw new Error('Evento não informado.');
      const { id } = input;
      const payload = requirementPayload(eventId, input);

      const result = id
        ? await db.from('ps_v2_staff_requirements').update(payload).eq('id', id).select('*').single()
        : await db.from('ps_v2_staff_requirements').insert(payload).select('*').single();

      if (result.error && isMissingV2Schema(result.error)) throw new Error('A estrutura V2 ainda não foi ativada no banco.');
      check(result.error);
      return result.data;
    },
    onSuccess: () => { refresh(); toast.success('Necessidade de equipe salva.'); },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveBulkRequirements = useMutation({
    mutationFn: async (inputs: PsV2StaffingRequirementInput[]) => {
      if (!eventId) throw new Error('Evento não informado.');
      if (!inputs.length) throw new Error('O modelo não gerou nenhuma necessidade.');

      const existingResult = await db
        .from('ps_v2_staff_requirements')
        .select('scope_type,location_id,building_id,floor_id,area_id,environment_id,role_id,role_name_snapshot')
        .eq('event_id', eventId);

      if (existingResult.error && isMissingV2Schema(existingResult.error)) throw new Error('A estrutura V2 ainda não foi ativada no banco.');
      check(existingResult.error);

      const existingKeys = new Set<string>((existingResult.data || []).map((row: any) => {
        const scopeId = row[`${row.scope_type}_id`];
        return requirementKey({ scopeType: row.scope_type, scopeId, roleId: row.role_id, roleName: row.role_name_snapshot });
      }));

      const payloads: Record<string, any>[] = [];
      let skipped = 0;

      for (const input of inputs) {
        const key = requirementKey({
          scopeType: input.scope_type,
          scopeId: input.scope_id,
          roleId: input.role_id,
          roleName: input.role_name_snapshot,
        });
        if (existingKeys.has(key)) {
          skipped += 1;
          continue;
        }
        existingKeys.add(key);
        payloads.push(requirementPayload(eventId, input));
      }

      if (payloads.length) {
        const result = await db.from('ps_v2_staff_requirements').insert(payloads);
        if (result.error && isMissingV2Schema(result.error)) throw new Error('A estrutura V2 ainda não foi ativada no banco.');
        check(result.error);
      }

      return { inserted: payloads.length, skipped };
    },
    onSuccess: ({ inserted, skipped }) => {
      refresh();
      if (!inserted && skipped) {
        toast.success('Este modelo já estava aplicado. Nenhuma regra foi duplicada.');
        return;
      }
      const skippedText = skipped ? ` ${skipped} regra(s) já existente(s) foram preservadas.` : '';
      toast.success(`${inserted} necessidade(s) criada(s) pelo modelo.${skippedText}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeRequirement = useMutation({
    mutationFn: async (id: string) => {
      const result = await db.from('ps_v2_staff_requirements').delete().eq('id', id).eq('event_id', eventId);
      if (result.error && isMissingV2Schema(result.error)) throw new Error('A estrutura V2 ainda não foi ativada no banco.');
      check(result.error);
    },
    onSuccess: () => { refresh(); toast.success('Necessidade removida.'); },
    onError: (error: Error) => toast.error(error.message),
  });

  return { saveRequirement, saveBulkRequirements, removeRequirement };
}
