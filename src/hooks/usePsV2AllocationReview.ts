import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;
const missingV2 = (error: any) => error?.code === '42P01' || String(error?.message || '').includes('ps_v2_');
const missingPublishRpc = (error: any) => error?.code === 'PGRST202' || String(error?.message || '').includes('ps_v2_publish_allocation_run');
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

export type PsV2PublishResult = {
  allocation_run_id: string;
  target_event_id: string;
  inserted_count: number;
  existing_count: number;
  accepted_count: number;
  already_published: boolean;
  published_at: string | null;
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

  const publishRun = useMutation({
    mutationFn: async ({ runId }: { runId: string }): Promise<PsV2PublishResult> => {
      if (!eventId) throw new Error('Evento não informado.');
      if (!runId) throw new Error('Proposta de alocação não informada.');

      const result = await db.rpc('ps_v2_publish_allocation_run', {
        p_event_id: eventId,
        p_run_id: runId,
      });

      if (result.error && missingPublishRpc(result.error)) {
        throw new Error('A publicação da equipe V2 ainda não foi ativada no banco.');
      }
      check(result.error);

      const published = result.data?.[0] as PsV2PublishResult | undefined;
      if (!published) throw new Error('A publicação não retornou confirmação do banco.');
      return published;
    },
    onSuccess: (result) => {
      refresh();
      qc.invalidateQueries({ queryKey: ['ps_event_collaborators', eventId] });
      qc.invalidateQueries({ queryKey: ['ps_event_collaboration_status', eventId] });
      qc.invalidateQueries({ queryKey: ['ps_event_confirmation_summary', eventId] });

      if (result.already_published) {
        toast.success('Esta proposta já estava publicada. Nenhum vínculo foi duplicado.');
        return;
      }

      const preserved = result.existing_count > 0
        ? ` ${result.existing_count} vínculo(s) já existente(s) foram preservados.`
        : '';
      toast.success(`${result.inserted_count} integrante(s) publicado(s) na equipe oficial.${preserved}`);
    },
    onError: (error: Error) => {
      const messages: Record<string, string> = {
        ps_v2_publish_admin_required: 'Somente administradores podem publicar a equipe.',
        ps_v2_allocation_run_not_found: 'A proposta de alocação não foi encontrada.',
        ps_v2_allocation_run_event_mismatch: 'A proposta não pertence a este evento.',
        ps_v2_allocation_run_not_in_review: 'Somente propostas em revisão podem ser publicadas.',
        ps_v2_allocation_review_incomplete: 'Revise todas as sugestões antes de publicar a equipe.',
        ps_v2_accepted_item_without_collaborator: 'Existe uma vaga aceita sem colaborador definido.',
        ps_v2_no_accepted_allocations: 'Aceite pelo menos uma alocação antes de publicar.',
        ps_v2_duplicate_collaborator_in_accepted_allocations: 'A mesma pessoa está aceita em mais de uma vaga. Ajuste a proposta antes de publicar.',
        ps_v2_requirement_event_mismatch: 'A proposta contém uma necessidade vinculada a outro evento.',
      };
      const key = Object.keys(messages).find((candidate) => error.message.includes(candidate));
      toast.error(key ? messages[key] : error.message);
    },
  });

  const cancelRun = useMutation({
    mutationFn: async (runId: string) => {
      const result = await db.from('ps_v2_allocation_runs').update({ status: 'cancelled' }).eq('id', runId);
      check(result.error);
    },
    onSuccess: () => { refresh(); toast.success('Proposta cancelada.'); },
    onError: (error: Error) => toast.error(error.message),
  });

  return { savePlan, updateItem, acceptAllFilled, publishRun, cancelRun };
}
