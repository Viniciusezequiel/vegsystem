import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;
const missingV2Schema = (error: any) =>
  error?.code === '42P01' || String(error?.message || '').includes('ps_v2_role_eligibility');
const check = (error: any) => { if (error) throw error; };

export type PsV2EligibilityRuleInput = {
  id?: string;
  event_role_id: string;
  decision: 'allow' | 'deny' | 'prefer';
  collaborator_field: 'role' | 'position' | 'sector' | 'unit' | 'preferred_role' | 'any';
  match_operator: 'equals' | 'contains' | 'starts_with' | 'any';
  match_value?: string | null;
  min_participations?: number | null;
  min_rating?: number | null;
  weight?: number;
  notes?: string | null;
  active?: boolean;
};

export function usePsV2Eligibility() {
  return useQuery({
    queryKey: ['ps-v2', 'eligibility'],
    queryFn: async () => {
      const result = await db
        .from('ps_v2_role_eligibility')
        .select('*')
        .order('event_role_id')
        .order('decision')
        .order('created_at');

      if (result.error && missingV2Schema(result.error)) {
        return { schemaReady: false, rules: [] as any[] };
      }
      check(result.error);
      return { schemaReady: true, rules: result.data || [] };
    },
  });
}

export function usePsV2EligibilityMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['ps-v2', 'eligibility'] });

  const save = useMutation({
    mutationFn: async (input: PsV2EligibilityRuleInput) => {
      const { id, ...payload } = input;
      const cleanPayload = {
        ...payload,
        match_value: payload.match_operator === 'any' ? null : payload.match_value?.trim() || null,
        min_participations: payload.min_participations == null ? null : Math.max(0, Number(payload.min_participations)),
        min_rating: payload.min_rating == null ? null : Math.max(0, Number(payload.min_rating)),
        weight: Number(payload.weight || 0),
        notes: payload.notes?.trim() || null,
        active: payload.active !== false,
      };

      const result = id
        ? await db.from('ps_v2_role_eligibility').update(cleanPayload).eq('id', id).select('*').single()
        : await db.from('ps_v2_role_eligibility').insert(cleanPayload).select('*').single();

      if (result.error && missingV2Schema(result.error)) {
        throw new Error('A estrutura V2 ainda não foi ativada no banco.');
      }
      check(result.error);
      return result.data;
    },
    onSuccess: () => {
      refresh();
      toast.success('Regra de elegibilidade salva.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const result = await db.from('ps_v2_role_eligibility').delete().eq('id', id);
      if (result.error && missingV2Schema(result.error)) {
        throw new Error('A estrutura V2 ainda não foi ativada no banco.');
      }
      check(result.error);
    },
    onSuccess: () => {
      refresh();
      toast.success('Regra removida.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const result = await db.from('ps_v2_role_eligibility').update({ active }).eq('id', id);
      check(result.error);
    },
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  return { save, remove, toggle };
}
