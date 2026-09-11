import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;
const missingV2 = (error: any) => error?.code === '42P01' || String(error?.message || '').includes('ps_v2_');
const check = (error: any) => { if (error) throw error; };

export type PsV2ReviewItemPatch = {
  collaborator_id?: string | null;
  score?: number;
  score_breakdown?: Record<string, unknown>;
  allocation_source?: 'automatic' | 'manual' | 'import';
  status?: 'suggested' | 'accepted' | 'rejected';
  locked?: boolean;
  notes?: string | null;
};

export function usePsV2AllocationReview(eventId?: string) {
  return useQuery({
    queryKey: ['ps-v2', 'allocation-review', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const runResult = await db
        .from('ps_v2_allocation_runs')
        .select('*')
        .eq('event_id', eventId)
        .in('status', ['draft', 'review', 'published'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (runResult.error && missingV2(runResult.error)) {
        return { schemaReady: false, run: null, items: [] };
      }
      check(runResult.error);

      const run = runResult.data || null;
      if (!run) return { schemaReady: true, run: null, items: [] };

      const itemsResult = await db
        .from('ps_v2_allocation_items')
        .select('*')
        .eq('run_id', run.id)
        .order('created_at');
      check(itemsResult.error);

      return { schemaReady: true, run, items: itemsResult.data || [] };
    },
  });
}

export function usePsV2AllocationReviewMutations(eventId?: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['ps-v2', 'allocation-review', eventId] });

  const savePlan = useMutation({
    mutationFn: async ({ plan, strategy = {}, fixedItemIds = [] }: { plan: any; strategy?: Record<string, unknown>; fixedItemIds?: string[] }) => {
      if (!eventId) throw new Error('Evento não informado.');

      const openRuns = await db.from('ps_v2_allocation_runs').select('id').eq('event_id', eventId).in('status', ['draft', 'review']);
      if (openRuns.error && missingV2(openRuns.error)) throw new Error('A estrutura V2 ainda não foi ativada no banco.');
      check(openRuns.error);

      const ids = (openRuns.data || []).map((item: any) => item.id);
      if (ids.length) {
        const cancelled = await db.from('ps_v2_allocation_runs').update({ status: 'cancelled' }).in('id', ids);
        check(cancelled.error);
      }

      const runResult = await db.from('ps_v2_allocation_runs').insert({
        event_id: eventId,
        status: 'review',
        strategy: { version: 1, one_person_per_event: true, ...strategy },
        summary: plan.summary || {},
      }).select('*').single();
      check(runResult.error);

      const run = runResult.data;
      const rows = (plan.allocations || []).map((item: any) => ({
        run_id: run.id,
        requirement_id: item.requirement_id,
        collaborator_id: item.collaborator_id || null,
        score: Number(item.score || 0),
        score_breakdown: {
          slot: item.slot,
          collaborator_name: item.collaborator_name || null,
          reasons: item.reasons || [],
          blockedReasons: item.blockedReasons || [],
        },
        allocation_source: item.allocation_source || 'automatic',
        status: item.collaborator_id ? (item.status || 'suggested') : 'rejected',
        locked: !!item.locked || fixedItemIds.includes(String(item.id || '')),
        notes: item.notes || null,
      }));

      if (rows.length) {
        const itemsResult = await db.from('ps_v2_allocation_items').insert(rows);
        check(itemsResult.error);
      }

      return run;
    },
    onSuccess: () => { refresh(); toast.success('Proposta salva para revisão.'); },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: PsV2ReviewItemPatch }) => {
      const result = await db.from('ps_v2_allocation_items').update(patch).eq('id', id).select('*').single();
      if (result.error && missingV2(result.error)) throw new Error('A estrutura V2 ainda não foi ativada no banco.');
      check(result.error);
      return result.data;
    },
    onSuccess: () => refresh(),
    onError: (error: Error) => toast.error(error.message),
  });

  const acceptAllFilled = useMutation({
    mutationFn: async ({ runId }: { runId: string }) => {
      const result = await db
        .from('ps_v2_allocation_items')
        .update({ status: 'accepted' })
        .eq('run_id', runId)
        .not('collaborator_id', 'is', null);
      check(result.error);
    },
    onSuccess: () => { refresh(); toast.success('Todas as vagas preenchidas foram aceitas.'); },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelRun = useMutation({
    mutationFn: async (runId: string) => {
      const result = await db.from('ps_v2_allocation_runs').update({ status: 'cancelled' }).eq('id', runId);
      check(result.error);
    },
    onSuccess: () => { refresh(); toast.success('Proposta cancelada.'); },
    onError: (error: Error) => toast.error(error.message),
  });

  return { savePlan, updateItem, acceptAllFilled, cancelRun };
}
