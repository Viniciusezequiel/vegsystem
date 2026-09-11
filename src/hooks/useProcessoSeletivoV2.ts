import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;
const missing = (error: any) => error?.code === '42P01' || String(error?.message || '').includes('ps_v2_');
const check = (error: any) => { if (error) throw error; };

export function usePsV2Locations() {
  return useQuery({
    queryKey: ['ps-v2', 'locations'],
    queryFn: async () => {
      const result = await db.from('ps_v2_locations').select('*').order('name');
      if (result.error && missing(result.error)) return { locations: [], schemaReady: false };
      check(result.error);
      return { locations: result.data || [], schemaReady: true };
    },
  });
}

export function usePsV2LegacyStructure() {
  return useQuery({
    queryKey: ['ps-v2', 'legacy-structure'],
    queryFn: async () => {
      const [campuses, floors] = await Promise.all([
        supabase.from('ps_campuses').select('*').order('name'),
        supabase.from('ps_campus_floors').select('*').order('name'),
      ]);
      check(campuses.error); check(floors.error);
      return { campuses: campuses.data || [], floors: floors.data || [] };
    },
  });
}

export function usePsV2LocationStructure(locationId?: string | null) {
  return useQuery({
    queryKey: ['ps-v2', 'structure', locationId],
    enabled: !!locationId,
    queryFn: async () => {
      const b = await db.from('ps_v2_buildings').select('*').eq('location_id', locationId).order('sort_order').order('name');
      if (b.error && missing(b.error)) return { buildings: [], floors: [], areas: [], environments: [], schemaReady: false };
      check(b.error);
      const buildings = b.data || [];
      const buildingIds = buildings.map((item: any) => item.id);
      if (!buildingIds.length) return { buildings, floors: [], areas: [], environments: [], schemaReady: true };
      const f = await db.from('ps_v2_floors').select('*').in('building_id', buildingIds).order('sort_order').order('name');
      check(f.error);
      const floors = f.data || [];
      const floorIds = floors.map((item: any) => item.id);
      if (!floorIds.length) return { buildings, floors, areas: [], environments: [], schemaReady: true };
      const [a, e] = await Promise.all([
        db.from('ps_v2_areas').select('*').in('floor_id', floorIds).order('sort_order').order('name'),
        db.from('ps_v2_environments').select('*').in('floor_id', floorIds).order('sort_order').order('name'),
      ]);
      check(a.error); check(e.error);
      return { buildings, floors, areas: a.data || [], environments: e.data || [], schemaReady: true };
    },
  });
}

export function usePsV2StructureMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['ps-v2'] });
  const saveLocation = useMutation({
    mutationFn: async (payload: any) => {
      const { id, ...values } = payload;
      const result = id ? await db.from('ps_v2_locations').update(values).eq('id', id).select('*').single() : await db.from('ps_v2_locations').insert(values).select('*').single();
      if (result.error && missing(result.error)) throw new Error('A estrutura V2 ainda não foi ativada no banco.');
      check(result.error); return result.data;
    },
    onSuccess: () => { refresh(); toast.success('Local salvo.'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const saveNode = useMutation({
    mutationFn: async ({ table, payload }: { table: string; payload: any }) => {
      const { id, ...values } = payload;
      const result = id ? await db.from(table).update(values).eq('id', id).select('*').single() : await db.from(table).insert(values).select('*').single();
      check(result.error); return result.data;
    },
    onSuccess: () => { refresh(); toast.success('Estrutura salva.'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const removeNode = useMutation({
    mutationFn: async ({ table, id }: { table: string; id: string }) => { const result = await db.from(table).delete().eq('id', id); check(result.error); },
    onSuccess: () => { refresh(); toast.success('Item removido.'); },
    onError: (error: Error) => toast.error(error.message),
  });
  return { saveLocation, saveNode, removeNode };
}
