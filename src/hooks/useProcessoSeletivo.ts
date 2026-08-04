import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { psFinalScore, psClassification } from '@/lib/psConstants';

/* ---------------- Cargos ---------------- */
export function usePsRoles() {
  return useQuery({
    queryKey: ['ps_roles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ps_roles').select('*').order('order');
      if (error) throw error;
      return data;
    },
  });
}

export function usePsRoleMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['ps_roles'] });

  const save = useMutation({
    mutationFn: async (role: any) => {
      if (role.id) {
        const { error } = await supabase.from('ps_roles').update(role).eq('id', role.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ps_roles').insert(role);
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidate(); toast.success('Cargo salvo!'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ps_roles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Cargo excluído!'); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { save, remove };
}

/* ---------------- Colaboradores ---------------- */
export function usePsCollaborators() {
  return useQuery({
    queryKey: ['ps_collaborators'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ps_collaborators').select('*').order('full_name');
      if (error) throw error;
      return data;
    },
  });
}

export function usePsCollaborator(id?: string) {
  return useQuery({
    queryKey: ['ps_collaborator', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('ps_collaborators').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function usePsCollaboratorMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['ps_collaborators'] });

  const save = useMutation({
    mutationFn: async (c: any) => {
      if (c.id) {
        const { error } = await supabase.from('ps_collaborators').update(c).eq('id', c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ps_collaborators').insert(c);
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidate(); toast.success('Colaborador salvo!'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ps_collaborators').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Colaborador excluído!'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkImport = useMutation({
    mutationFn: async (rows: any[]) => {
      const { data: existing } = await supabase.from('ps_collaborators').select('full_name, cpf, matricula');
      const keys = new Set((existing || []).map((e: any) => `${(e.full_name || '').toLowerCase()}|${e.cpf || ''}|${e.matricula || ''}`));
      const toInsert = rows.filter((r) => {
        const k = `${(r.full_name || '').toLowerCase()}|${r.cpf || ''}|${r.matricula || ''}`;
        if (keys.has(k)) return false;
        keys.add(k);
        return true;
      });
      if (toInsert.length) {
        const { error } = await supabase.from('ps_collaborators').insert(toInsert);
        if (error) throw error;
      }
      return { inserted: toInsert.length, skipped: rows.length - toInsert.length };
    },
    onSuccess: (r) => { invalidate(); toast.success(`${r.inserted} importados, ${r.skipped} duplicados ignorados.`); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { save, remove, bulkImport };
}

/* ---------------- Eventos ---------------- */
export function usePsEvents() {
  return useQuery({
    queryKey: ['ps_events'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ps_events').select('*').order('date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function usePsEvent(id?: string) {
  return useQuery({
    queryKey: ['ps_event', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('ps_events').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function usePsEventMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ps_events'] });
    qc.invalidateQueries({ queryKey: ['ps_event'] });
  };

  const save = useMutation({
    mutationFn: async (ev: any) => {
      if (ev.id) {
        const { error } = await supabase.from('ps_events').update(ev).eq('id', ev.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ps_events').insert(ev);
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidate(); toast.success('Evento salvo!'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ps_events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Evento excluído!'); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Finalizar evento: recalcula total_events dos participantes
  const finalize = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.from('ps_events').update({ status: 'finalizado' }).eq('id', eventId);
      if (error) throw error;
      const { data: links } = await supabase
        .from('ps_event_collaborators')
        .select('collaborator_id')
        .eq('event_id', eventId)
        .eq('absent', false);
      const ids = Array.from(new Set((links || []).map((l: any) => l.collaborator_id).filter(Boolean)));
      for (const cid of ids) {
        const { count } = await supabase
          .from('ps_event_collaborators')
          .select('id', { count: 'exact', head: true })
          .eq('collaborator_id', cid as string)
          .eq('absent', false);
        await supabase.from('ps_collaborators').update({ total_events: count || 0 }).eq('id', cid as string);
      }
    },
    onSuccess: () => { invalidate(); toast.success('Evento finalizado e totais recalculados!'); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { save, remove, finalize };
}

/* ---------------- Vínculos fiscal x evento ---------------- */
export function usePsEventCollaborators(eventId?: string) {
  return useQuery({
    queryKey: ['ps_event_collaborators', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ps_event_collaborators')
        .select('*')
        .eq('event_id', eventId!)
        .order('collaborator_name');
      if (error) throw error;
      return data;
    },
  });
}

export function usePsEventCollaboratorMutations(eventId?: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['ps_event_collaborators'] });

  const add = useMutation({
    mutationFn: async (rows: any | any[]) => {
      const { error } = await supabase.from('ps_event_collaborators').insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Fiscal vinculado!'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...values }: any) => {
      const { error } = await supabase.from('ps_event_collaborators').update(values).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ps_event_collaborators').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Vínculo removido!'); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { add, update, remove };
}

/* ---------------- Candidatos ---------------- */
export function usePsCandidates(eventId?: string) {
  return useQuery({
    queryKey: ['ps_candidates', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.from('ps_candidates').select('*').eq('event_id', eventId!).order('full_name');
      if (error) throw error;
      return data;
    },
  });
}

export function usePsCandidateMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['ps_candidates'] });

  const addMany = useMutation({
    mutationFn: async (rows: any[]) => {
      const { error } = await supabase.from('ps_candidates').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Candidatos importados!'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAll = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.from('ps_candidates').delete().eq('event_id', eventId);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Candidatos removidos!'); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { addMany, removeAll };
}

/* ---------------- Avaliações ---------------- */
export function usePsEvaluations(eventId?: string) {
  return useQuery({
    queryKey: ['ps_evaluations', eventId || 'all'],
    queryFn: async () => {
      let q = supabase.from('ps_evaluations').select('*').order('created_at', { ascending: false });
      if (eventId) q = q.eq('event_id', eventId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

async function recalcCollaboratorAverage(collaboratorId?: string | null) {
  if (!collaboratorId) return;
  const { data } = await supabase.from('ps_evaluations').select('final_score').eq('collaborator_id', collaboratorId);
  const scores = (data || []).map((d: any) => Number(d.final_score)).filter((n) => n > 0);
  const avg = scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : 0;
  await supabase.from('ps_collaborators').update({ average_rating: avg }).eq('id', collaboratorId);
}

export function usePsSaveEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const final_score = psFinalScore(payload);
      const record = { ...payload, final_score, classification: psClassification(final_score) };
      if (record.id) {
        const { error } = await supabase.from('ps_evaluations').update(record).eq('id', record.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ps_evaluations').insert(record);
        if (error) throw error;
      }
      if (record.event_id && record.collaborator_id) {
        await supabase
          .from('ps_event_collaborators')
          .update({ evaluated: true })
          .eq('event_id', record.event_id)
          .eq('collaborator_id', record.collaborator_id);
      }
      await recalcCollaboratorAverage(record.collaborator_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ps_evaluations'] });
      qc.invalidateQueries({ queryKey: ['ps_event_collaborators'] });
      qc.invalidateQueries({ queryKey: ['ps_collaborators'] });
      toast.success('Avaliação registrada!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ---------------- Avaliação Geral ---------------- */
export function usePsGeneralEvaluations() {
  return useQuery({
    queryKey: ['ps_general_evaluations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ps_general_evaluations').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function usePsSaveGeneralEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const final_score = psFinalScore(payload);
      const record = { ...payload, final_score, classification: psClassification(final_score) };
      const { error } = await supabase.from('ps_general_evaluations').insert(record);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ps_general_evaluations'] });
      toast.success('Avaliação geral registrada!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ---------------- Autoavaliação ---------------- */
export function usePsSelfEvaluations(eventId?: string) {
  return useQuery({
    queryKey: ['ps_self_evaluations', eventId || 'all'],
    queryFn: async () => {
      let q = supabase.from('ps_self_evaluations').select('*').order('created_at', { ascending: false });
      if (eventId) q = q.eq('event_id', eventId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

/* ---------------- Banco de fiscais (formulário público) ---------------- */
export function usePsFiscalBankApplications() {
  return useQuery({
    queryKey: ['ps_fiscal_bank_applications'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ps_fiscal_bank_applications').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function usePsFiscalBankConfig() {
  return useQuery({
    queryKey: ['ps_fiscal_bank_config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ps_fiscal_bank_config').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function usePsSaveFiscalBankConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: any) => {
      if (cfg.id) {
        const { error } = await supabase.from('ps_fiscal_bank_config').update(cfg).eq('id', cfg.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ps_fiscal_bank_config').insert(cfg);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ps_fiscal_bank_config'] }); toast.success('Configuração salva!'); },
    onError: (e: Error) => toast.error(e.message),
  });
}
