import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { psFinalScore, psClassification } from '@/lib/psConstants';
import { planPsFiscalReconciliation, type PsFiscalDecision } from '@/lib/psFiscalFoundation';
import { normalizeFiscalEmail, normalizeFiscalInstitution, normalizeFiscalMatricula, dedupeFiscalRows, normalizeFiscalImportNote } from '@/lib/psFiscalBank.mjs';

const PS_EVENT_COLLABORATOR_LIST_SELECT = [
  'id', 'event_id', 'collaborator_id', 'collaborator_name', 'role_value', 'role_name',
  'assigned_role', 'sector', 'unit', 'institution', 'building', 'floor', 'room', 'work_schedule',
  'campus', 'cpf', 'identity_doc', 'email', 'phone', 'mobile', 'pay_value',
  'deposit_info', 'pix', 'import_tag', 'present', 'absent', 'evaluated', 'signed_at',
  'departed_at', 'signature_ip', 'notes', 'created_at', 'updated_at',
  'participation_status', 'confirmation_requested_at', 'confirmed_at', 'declined_at',
  'decline_reason', 'replacement_for_event_collaborator_id', 'original_event_collaborator_id',
  'public_confirmation_token_expires_at', 'public_confirmation_token_revoked_at',
].join(',');

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
      const { data, error } = await supabase.from('ps_collaborators').select([
        'id', 'full_name', 'cpf', 'matricula', 'email', 'email_normalized', 'phone', 'mobile',
        'role', 'unit', 'sector', 'position', 'journey', 'pcd', 'city', 'state', 'pix',
        'total_events', 'average_rating', 'identity_doc', 'institution', 'preferred_role',
        'notes', 'imported_selection_count', 'imported_participation_count', 'active',
        'created_at', 'updated_at',
      ].join(',')).order('full_name');
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
      const { id, email_normalized, matricula_normalized, institution_normalized, ...values } = c;
      const record = { ...values };
      if ('email' in values) record.email = values.email?.trim() || null;
      if ('matricula' in values) record.matricula = values.matricula?.trim() || null;
      if ('institution' in values) record.institution = values.institution?.trim().replace(/\s+/g, ' ') || null;
      if (id) {
        const { error } = await supabase.from('ps_collaborators').update(record).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ps_collaborators').insert(record);
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

  return { save, remove };
}

export function usePsCollaboratorParticipations() {
  return useQuery({
    queryKey: ['ps_collaborator_participations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ps_event_collaborators')
        .select('id,collaborator_id,event_id,role_name,assigned_role,present,absent,created_at,ps_events(name,date)')
        .not('collaborator_id', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function usePsImportFiscalBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: any[]) => {
      const clean = dedupeFiscalRows(rows.map((row) => ({
        full_name: String(row.full_name || row.nome || '').replace(/\s+/g, ' ').trim(),
        email: normalizeFiscalEmail(row.email || row['E-MAIL'] || row['E-mail'] || row.email_institucional),
        matricula: normalizeFiscalMatricula(row.matricula || row['MATRICULA'] || row['Matrícula'] || row.matricula_institucional),
        institution: normalizeFiscalInstitution(row.institution || row['INSTITUICAO'] || row['Instituição'] || row.instituto),
        phone: String(row.phone || row.telefone || row.celular || '').trim() || null,
        role: String(row.role || row.role_name || row.cargo || row['CARGO'] || '').trim() || null,
        unit: String(row.unit || row.unidade || row['UNIDADE'] || '').trim() || null,
        sector: String(row.sector || row.setor || row['SETOR'] || '').trim() || null,
        notes: normalizeFiscalImportNote(String(row.notes || row.observacao || row['OBSERVAÇÃO'] || '').trim()) || null,
        imported_selection_count: Number(String(row.imported_selection_count ?? row.historical_selection_count ?? row['Nº DE SELEÇÕES'] ?? row['N DE SELECOES'] ?? '').replace(/[^0-9]/g, '')) || 0,
        imported_participation_count: Number(String(row.imported_participation_count ?? row.historical_participation_count ?? row['PARTICIPAÇÕES EM PROCESSOS SELETIVOS'] ?? row['PARTICIPACOES EM PROCESSOS SELETIVOS'] ?? '').replace(/[^0-9]/g, '')) || 0,
      })).filter(Boolean));

      const existing = await supabase.from('ps_collaborators').select('id,email,email_normalized,matricula,matricula_normalized,institution,institution_normalized');
      if (existing.error) throw existing.error;

      const byEmail = new Map((existing.data || []).filter((r: any) => r.email_normalized).map((r: any) => [r.email_normalized, r]));
      const byMatriculaInstitution = new Map((existing.data || []).filter((r: any) => r.matricula_normalized && r.institution_normalized).map((r: any) => [`${r.matricula_normalized}|${r.institution_normalized}`, r]));

      const prepared = [] as any[];
      for (const row of clean) {
        const emailKey = normalizeFiscalEmail(row.email);
        const matriculaKey = normalizeFiscalMatricula(row.matricula);
        const institutionKey = normalizeFiscalInstitution(row.institution);
        let collaboratorId: string | null = null;

        if (emailKey && byEmail.has(emailKey)) collaboratorId = byEmail.get(emailKey).id;
        else if (matriculaKey && institutionKey && byMatriculaInstitution.has(`${matriculaKey}|${institutionKey}`)) {
          collaboratorId = byMatriculaInstitution.get(`${matriculaKey}|${institutionKey}`).id;
        }

        const payload = {
          full_name: String(row.full_name || '').replace(/\s+/g, ' ').trim(),
          email: row.email || null,
          phone: row.phone || null,
          matricula: row.matricula || null,
          institution: row.institution || null,
          sector: row.sector || null,
          unit: row.unit || null,
          role: row.role || null,
          notes: row.notes || null,
          imported_selection_count: Number(row.imported_selection_count) || 0,
          imported_participation_count: Number(row.imported_participation_count) || 0,
          active: true,
        };

        if (collaboratorId) {
          const current = byEmail.get(emailKey) || byMatriculaInstitution.get(`${matriculaKey}|${institutionKey}`);
          const updates: Record<string, any> = {};
          for (const [field, value] of Object.entries(payload)) {
            if (value && current[field] !== value) updates[field] = value;
          }
          if (Object.keys(updates).length) {
            const { error } = await supabase.from('ps_collaborators').update(updates).eq('id', collaboratorId);
            if (error) throw error;
          }
          continue;
        }

        prepared.push(payload);
      }

      if (prepared.length) {
        const { error } = await supabase.from('ps_collaborators').insert(prepared);
        if (error) throw error;
      }

      return { rowsRead: rows.length, inserted: prepared.length, updated: Math.max(0, clean.length - prepared.length) };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ps_collaborators'] });
      toast.success('Banco de fiscais importado com sucesso.');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePsEventCollaborationStatus(eventId?: string) {
  return useQuery({
    queryKey: ['ps_event_collaboration_status', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ps_event_collaborators')
        .select('*')
        .eq('event_id', eventId!)
        .order('collaborator_name');
      if (error) throw error;
      return data || [];
    },
  });
}

export function usePsEventCommunications(eventId?: string) {
  return useQuery({
    queryKey: ['ps_event_communications', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.from('ps_event_communications').select('*').eq('event_id', eventId!).order('requested_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function usePsSendEventCommunication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, eventCollaboratorIds, template, channel = 'in_app' }: { eventId: string; eventCollaboratorIds: string[]; template: string; channel?: string;}) => {
      if (!eventCollaboratorIds.length) throw new Error('Selecione ao menos um fiscal.');
      const rows = eventCollaboratorIds.map((eventCollaboratorId) => ({
        event_id: eventId,
        event_collaborator_id: eventCollaboratorId,
        tipo: 'confirmation_request',
        canal: channel,
        status: 'pending',
        mensagem: template,
        requested_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('ps_event_communications').insert(rows as any);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: () => {
      toast.success('Comunicação registrada para envio.');
      qc.invalidateQueries({ queryKey: ['ps_event_communications'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePsUpdateEventCollaboratorParticipation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, declineReason, requestedAt }: { id: string; status: string; declineReason?: string | null; requestedAt?: string | null;}) => {
      const payload: Record<string, any> = {
        participation_status: status,
        confirmation_requested_at: requestedAt || null,
      };
      if (status === 'confirmed') payload.confirmed_at = new Date().toISOString();
      if (status === 'declined') {
        payload.declined_at = new Date().toISOString();
        payload.decline_reason = declineReason || null;
      }
      if (status === 'replaced') {
        payload.confirmed_at = null;
        payload.declined_at = null;
      }
      const { error } = await supabase.from('ps_event_collaborators').update(payload).eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ps_event_collaborators'] });
      toast.success('Status de participação atualizado.');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePsEventConfirmationSummary(eventId?: string) {
  return useQuery({
    queryKey: ['ps_event_confirmation_summary', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ps_event_collaborator_confirmation_summary', { p_event_id: eventId });
      if (error) throw error;
      return (data || []).reduce((acc: Record<string, number>, row: any) => {
        acc[row.status] = Number(row.total || 0);
        return acc;
      }, {});
    },
  });
}

export function usePsConfirmationActions(eventId?: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ps_event_collaborators', eventId] });
    qc.invalidateQueries({ queryKey: ['ps_event_confirmation_summary', eventId] });
  };
  const request = useMutation({
    mutationFn: async ({ linkId, rotate = false }: { linkId: string; rotate?: boolean }) => {
      const { data, error } = await (supabase as any).rpc('ps_request_event_collaborator_confirmation', {
        p_link_id: linkId, p_rotate: rotate,
      });
      if (error) throw error;
      const result = data?.[0];
      if (!result?.token) throw new Error('Token de confirmação não foi gerado.');
      return result as { token: string; expires_at: string };
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const replace = useMutation({
    mutationFn: async ({ oldLinkId, collaboratorId, assignment }: { oldLinkId: string; collaboratorId: string; assignment: Record<string, unknown> }) => {
      const { data, error } = await (supabase as any).rpc('ps_replace_event_collaborator', {
        p_old_link_id: oldLinkId, p_new_collaborator_id: collaboratorId, p_assignment: assignment,
      });
      if (error) throw error;
      if (!data?.[0]?.new_link_id) throw new Error('A substituição não foi confirmada.');
      return data[0];
    },
    onSuccess: () => { invalidate(); toast.success('Fiscal substituído; novo vínculo aguarda confirmação.'); },
    onError: (e: Error) => toast.error(e.message),
  });
  return { request, replace };
}

/* ---------------- Eventos ---------------- */
export function usePsEvents() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['ps_events'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ps_events').select('*').order('date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase.channel(`ps-events-sync-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ps_events' }, () => {
        queryClient.invalidateQueries({ queryKey: ['ps_events'] });
        queryClient.invalidateQueries({ queryKey: ['ps_event'] });
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

export function usePsEvent(id?: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['ps_event', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('ps_events').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`ps-event-${id}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ps_events', filter: `id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['ps_event', id] });
        queryClient.invalidateQueries({ queryKey: ['ps_events'] });
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [id, queryClient]);

  return query;
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
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['ps_event_collaborators', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ps_event_collaborators')
        .select(PS_EVENT_COLLABORATOR_LIST_SELECT)
        .eq('event_id', eventId!)
        .order('collaborator_name');
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase.channel(`ps-event-${eventId}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ps_event_collaborators', filter: `event_id=eq.${eventId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['ps_event_collaborators', eventId] });
          queryClient.invalidateQueries({ queryKey: ['ps_event_confirmation_summary', eventId] });
        })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [eventId, queryClient]);
  return query;
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

  const updateState = useMutation({
    mutationFn: async ({ id, updated_at, present, absent, departed_at = null }: any) => {
      const { data, error } = await supabase.rpc('ps_set_event_participant_state', {
        p_link_id: id, p_expected_updated_at: updated_at, p_present: present,
        p_absent: absent, p_departed_at: departed_at,
      });
      if (error) throw error;
      if (!data?.[0]?.success) throw new Error('O participante foi alterado em outro dispositivo. Estado atualizado; tente novamente.');
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => { invalidate(); toast.error(e.message); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ps_event_collaborators').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Vínculo removido!'); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { add, update, updateState, remove };
}

/* ---------------- Importação da equipe do evento (planilha oficial) ---------------- */
export type PsTeamImportRow = {
  full_name: string;
  identity_doc?: string | null;
  cpf?: string | null;
  matricula?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  unit?: string | null;
  sector?: string | null;
  institution?: string | null;
  role_name?: string | null;
  assigned_role?: string | null;
  building?: string | null;
  floor?: string | null;
  room?: string | null;
  work_schedule?: string | null;
  pay_value?: number;
  deposit_info?: string | null;
  pix?: string | null;
};

export type PsTeamImportPreview = {
  decisions: PsFiscalDecision[];
  found: number;
  newCount: number;
  alreadyLinked: number;
  inconsistent: number;
  ignored: number;
};

async function loadPsImportContext(eventId: string) {
  const [{ data: existing, error: existingError }, { data: links, error: linksError }] = await Promise.all([
    supabase.from('ps_collaborators').select('id,email,email_normalized,matricula,institution'),
    supabase.from('ps_event_collaborators').select('collaborator_id').eq('event_id', eventId),
  ]);
  if (existingError) throw existingError;
  if (linksError) throw linksError;
  return { existing: existing || [], linked: new Set((links || []).map((item: any) => item.collaborator_id).filter(Boolean)) };
}

export async function previewPsEventTeamImport(eventId: string, rows: PsTeamImportRow[]): Promise<PsTeamImportPreview> {
  const { existing, linked } = await loadPsImportContext(eventId);
  const decisions = planPsFiscalReconciliation(existing, rows);
  let found = 0, newCount = 0, alreadyLinked = 0, inconsistent = 0, ignored = 0;
  for (const decision of decisions) {
    if (decision.status === 'ambiguous' || decision.status === 'inconsistent') inconsistent += 1;
    else if (decision.status === 'new') newCount += 1;
    else if (decision.collaboratorId.startsWith('__new_fiscal_')) ignored += 1;
    else if (linked.has(decision.collaboratorId)) alreadyLinked += 1;
    else found += 1;
  }
  return { decisions, found, newCount, alreadyLinked, inconsistent, ignored };
}

export function usePsImportEventTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, rows }: { eventId: string; rows: PsTeamImportRow[] }) => {
      const { existing, linked } = await loadPsImportContext(eventId);
      const decisions = planPsFiscalReconciliation(existing, rows);
      const unsafe = decisions.find(decision => decision.status === 'ambiguous' || decision.status === 'inconsistent');
      if (unsafe) throw new Error(`Importação interrompida na linha ${unsafe.rowIndex + 2}: identidade ausente ou ambígua.`);

      const temporaryIds = new Map<string, string>();
      let created = 0;
      const resolved: { row: PsTeamImportRow; collaboratorId: string }[] = [];
      for (const decision of decisions) {
        const row = rows[decision.rowIndex];
        let id: string;
        if (decision.status === 'new') {
          const { data, error } = await supabase
            .from('ps_collaborators')
            .insert({
              full_name: row.full_name.trim(),
              cpf: row.cpf || null,
              matricula: row.matricula?.trim() || null,
              identity_doc: row.identity_doc || null,
              email: row.email || null,
              phone: row.phone || row.mobile || null,
              mobile: row.mobile || null,
              unit: row.unit || null,
              sector: row.sector || null,
              institution: row.institution || null,
              pix: row.pix || null,
              active: true,
            })
            .select('id')
            .single();
          if (error) throw error;
          id = data.id;
          created += 1;
          temporaryIds.set(decision.temporaryId!, id);
        } else {
          id = temporaryIds.get(decision.collaboratorId) || decision.collaboratorId;
        }
        resolved.push({ row, collaboratorId: id });
      }

      const importTag = `import-${Date.now()}`;
      const scheduled = new Set<string>();
      const toInsert = resolved
        .filter((r) => {
          if (linked.has(r.collaboratorId) || scheduled.has(r.collaboratorId)) return false;
          scheduled.add(r.collaboratorId);
          return true;
        })
        .map(({ row, collaboratorId }) => ({
          event_id: eventId,
          collaborator_id: collaboratorId,
          collaborator_name: row.full_name.trim(),
          role_name: row.role_name || row.assigned_role || null,
          assigned_role: row.assigned_role || row.role_name || null,
          sector: row.sector || null,
          unit: row.unit || null,
          institution: row.institution || null,
          building: row.building || null,
          floor: row.floor || null,
          room: row.room || null,
          work_schedule: row.work_schedule || null,
          cpf: row.cpf || null,
          identity_doc: row.identity_doc || null,
          email: row.email || null,
          phone: row.phone || null,
          mobile: row.mobile || null,
          pay_value: Number(row.pay_value || 0),
          deposit_info: row.deposit_info || null,
          pix: row.pix || null,
          import_tag: importTag,
        }));

      const existingLinks = await supabase.from('ps_event_collaborators').select('id,collaborator_id,event_id,role_name,unit,building,floor,room,work_schedule,assigned_role').eq('event_id', eventId);
      if (existingLinks.error) throw existingLinks.error;
      const linkByCollaborator = new Map((existingLinks.data || []).map((item: any) => [item.collaborator_id, item]));
      const toUpdate = resolved
        .filter((r) => linkByCollaborator.has(r.collaboratorId))
        .map(({ row, collaboratorId }) => {
          const current = linkByCollaborator.get(collaboratorId);
          const patch: Record<string, any> = {};
          const fields = [
            ['role_name', row.role_name || row.assigned_role || null],
            ['assigned_role', row.assigned_role || row.role_name || null],
            ['unit', row.unit || null],
            ['building', row.building || null],
            ['floor', row.floor || null],
            ['room', row.room || null],
            ['work_schedule', row.work_schedule || null],
            ['sector', row.sector || null],
            ['institution', row.institution || null],
            ['email', row.email || null],
            ['phone', row.phone || null],
            ['mobile', row.mobile || null],
          ];
          for (const [key, value] of fields) {
            if (current[key] !== value) patch[key] = value;
          }
          if (Object.keys(patch).length) {
            patch.updated_at = new Date().toISOString();
            return { id: current.id, patch };
          }
          return null;
        })
        .filter(Boolean);

      for (const item of toUpdate) {
        const { error } = await supabase.from('ps_event_collaborators').update(item.patch).eq('id', item.id);
        if (error) throw error;
      }

      if (toInsert.length) {
        const { error } = await supabase.from('ps_event_collaborators').insert(toInsert);
        if (error) throw error;
      }

      const { data: persistedLinks, error: persistedLinksError } = await supabase
        .from('ps_event_collaborators')
        .select('id,collaborator_id')
        .eq('event_id', eventId)
        .in('collaborator_id', resolved.map((item) => item.collaboratorId));
      if (persistedLinksError) throw persistedLinksError;
      const { data: evaluatorSync, error: evaluatorSyncError } = await (supabase as any).rpc('ps_sync_imported_evaluators', {
        p_event_id: eventId,
        p_event_collaborator_ids: (persistedLinks || []).map((item: any) => item.id),
      });
      if (evaluatorSyncError) throw evaluatorSyncError;

      return {
        created,
        linked: toInsert.length,
        skipped: resolved.length - toInsert.length,
        updated: toUpdate.length,
        importTag,
        evaluatorSync: evaluatorSync?.[0] || null,
      };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['ps_event_collaborators'] });
      qc.invalidateQueries({ queryKey: ['ps_collaborators'] });
      const sync = r.evaluatorSync;
      const evaluatorMessage = sync
        ? ` ${sync.coordenadores_identificados} coordenadores, ${sync.subcoordenadores_identificados} subcoordenadores, ${sync.contas_criadas} contas criadas, ${sync.contas_sincronizadas} sincronizadas, ${sync.escopos_criados} escopos criados e ${sync.escopos_local_incompleto} pendentes.`
        : '';
      toast.success(`${r.linked} vinculados ao evento (${r.created} novos colaboradores, ${r.skipped} já estavam no evento).${evaluatorMessage}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePsClearEventTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.from('ps_event_collaborators').delete().eq('event_id', eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ps_event_collaborators'] });
      toast.success('Equipe do evento removida!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ---------------- Candidatos ---------------- */
export function usePsCandidates(eventId?: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['ps_candidates', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.from('ps_candidates').select('*').eq('event_id', eventId!).order('full_name');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!eventId) return;
    const channel = supabase.channel(`ps-candidates-${eventId}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ps_candidates', filter: `event_id=eq.${eventId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['ps_candidates', eventId] });
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [eventId, queryClient]);

  return query;
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
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['ps_evaluations', eventId || 'all'],
    queryFn: async () => {
      let q = supabase.from('ps_evaluations').select('*').order('created_at', { ascending: false });
      if (eventId) q = q.eq('event_id', eventId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    const channel = supabase.channel(`ps-evaluations-${eventId || 'all'}-${crypto.randomUUID()}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'ps_evaluations',
        ...(eventId ? { filter: `event_id=eq.${eventId}` } : {}),
      }, () => queryClient.invalidateQueries({ queryKey: ['ps_evaluations', eventId || 'all'] }))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [eventId, queryClient]);
  return query;
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
      const { id, ...values } = payload;
      const record = { ...values, final_score, classification: psClassification(final_score) };
      if (id) {
        const { error } = await supabase.from('ps_evaluations').update(record).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ps_evaluations').insert(record);
        if (error?.code === '23505') throw new Error('Este fiscal já possui avaliação neste evento. Edite a avaliação existente.');
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
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['ps_self_evaluations', eventId || 'all'],
    queryFn: async () => {
      let q = supabase.from('ps_self_evaluations').select('*').order('created_at', { ascending: false });
      if (eventId) q = q.eq('event_id', eventId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase.channel(`ps-self-evaluations-${eventId || 'all'}-${crypto.randomUUID()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ps_self_evaluations',
        ...(eventId ? { filter: `event_id=eq.${eventId}` } : {}),
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['ps_self_evaluations', eventId || 'all'] });
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [eventId, queryClient]);

  return query;
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
