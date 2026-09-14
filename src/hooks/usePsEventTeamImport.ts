import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  classifyEvaluatorRole,
  findPossibleNameMatch,
  normalizeCpf,
  planPsFiscalReconciliation,
  type PsFiscalDecision,
  type PsNameMatchCandidate,
} from '@/lib/psFiscalFoundation';

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

export type PsNameMatchSuggestion = {
  rowIndex: number;
  sheetName: string;
  matchedCollaboratorId: string;
  matchedName: string;
  role: 'coordinator' | 'subcoordinator';
  exact: boolean;
};

export type PsTeamImportPreview = {
  decisions: PsFiscalDecision[];
  found: number;
  newCount: number;
  alreadyLinked: number;
  inconsistent: number;
  ignored: number;
  nameMatches: PsNameMatchSuggestion[];
};

async function loadPsImportContext(eventId: string) {
  const [{ data: existing, error: existingError }, { data: links, error: linksError }] = await Promise.all([
    supabase.from('ps_collaborators').select('id,full_name,cpf,email,email_normalized,matricula,institution'),
    supabase.from('ps_event_collaborators').select('collaborator_id').eq('event_id', eventId),
  ]);
  if (existingError) throw existingError;
  if (linksError) throw linksError;
  return {
    existing: existing || [],
    linked: new Set((links || []).map((item: any) => item.collaborator_id).filter(Boolean)),
  };
}

export async function previewPsEventTeamImport(eventId: string, rows: PsTeamImportRow[]): Promise<PsTeamImportPreview> {
  const { existing, linked } = await loadPsImportContext(eventId);
  const decisions = planPsFiscalReconciliation(existing, rows);
  let found = 0;
  let newCount = 0;
  let alreadyLinked = 0;
  let inconsistent = 0;
  let ignored = 0;
  const nameMatches: PsNameMatchSuggestion[] = [];

  for (const decision of decisions) {
    if (decision.status === 'ambiguous' || decision.status === 'inconsistent') inconsistent += 1;
    else if (decision.status === 'new') newCount += 1;
    else if (decision.collaboratorId.startsWith('__new_fiscal_')) ignored += 1;
    else if (linked.has(decision.collaboratorId)) alreadyLinked += 1;
    else found += 1;

    if (decision.status === 'new' || decision.status === 'inconsistent') {
      const row = rows[decision.rowIndex];
      const role = classifyEvaluatorRole(row.assigned_role || row.role_name);
      if (role) {
        const candidate: PsNameMatchCandidate | null = findPossibleNameMatch(row.full_name, existing);
        if (candidate) {
          nameMatches.push({
            rowIndex: decision.rowIndex,
            sheetName: row.full_name.trim(),
            matchedCollaboratorId: candidate.collaboratorId,
            matchedName: candidate.name,
            role,
            exact: candidate.exact,
          });
        }
      }
    }
  }

  return { decisions, found, newCount, alreadyLinked, inconsistent, ignored, nameMatches };
}

export function usePsImportEventTeam() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, rows, nameOverrides = {} }: {
      eventId: string;
      rows: PsTeamImportRow[];
      nameOverrides?: Record<number, string>;
    }) => {
      const { existing } = await loadPsImportContext(eventId);
      const decisions = planPsFiscalReconciliation(existing, rows);
      const unsafe = decisions.find((decision) =>
        (decision.status === 'ambiguous' || decision.status === 'inconsistent') && !nameOverrides[decision.rowIndex]);
      if (unsafe) {
        throw new Error(`Importação interrompida na linha ${unsafe.rowIndex + 2}: os identificadores estão ausentes, duplicados ou apontam para cadastros diferentes.`);
      }

      const temporaryIds = new Map<string, string>();
      let created = 0;
      let nameAdjustments = 0;
      const resolved: { row: PsTeamImportRow; collaboratorId: string }[] = [];

      for (const decision of decisions) {
        const row = rows[decision.rowIndex];
        let id: string;
        const override = nameOverrides[decision.rowIndex];

        if (override) {
          id = override;
          nameAdjustments += 1;
        } else if (decision.status === 'new') {
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

          if (error) {
            const isCpfCollision = String((error as any).message || '').includes('ps_collaborators_cpf_unique');
            if (isCpfCollision && normalizeCpf(row.cpf)) {
              throw new Error(`O CPF da linha ${decision.rowIndex + 2} já existe no banco. Reabra a importação para que o cadastro seja conciliado pelo CPF.`);
            }
            throw error;
          }

          id = data.id;
          created += 1;
          temporaryIds.set(decision.temporaryId!, id);
        } else if (decision.status === 'matched') {
          id = temporaryIds.get(decision.collaboratorId) || decision.collaboratorId;
        } else {
          throw new Error(`Importação interrompida na linha ${decision.rowIndex + 2}: identidade não resolvida.`);
        }

        resolved.push({ row, collaboratorId: id });
      }

      const importTag = `import-${Date.now()}`;
      const scheduled = new Set<string>();
      const toInsert = resolved
        .filter((item) => {
          if (scheduled.has(item.collaboratorId)) return false;
          scheduled.add(item.collaboratorId);
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

      const existingLinks = await supabase
        .from('ps_event_collaborators')
        .select('id,collaborator_id,event_id,role_name,assigned_role,sector,unit,institution,building,floor,room,work_schedule,email,phone,mobile,pay_value,deposit_info,pix')
        .eq('event_id', eventId);
      if (existingLinks.error) throw existingLinks.error;

      const linkByCollaborator = new Map((existingLinks.data || []).map((item: any) => [item.collaborator_id, item]));
      const toCreate = toInsert.filter((item) => !linkByCollaborator.has(item.collaborator_id));
      const toUpdate = resolved
        .filter((item) => linkByCollaborator.has(item.collaboratorId))
        .map(({ row, collaboratorId }) => {
          const current: any = linkByCollaborator.get(collaboratorId);
          const patch: Record<string, any> = {};
          const fields: [string, any][] = [
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
            ['pay_value', Number(row.pay_value || 0)],
            ['deposit_info', row.deposit_info || null],
            ['pix', row.pix || null],
          ];
          for (const [key, value] of fields) {
            if (current[key] !== value) patch[key] = value;
          }
          if (!Object.keys(patch).length) return null;
          patch.updated_at = new Date().toISOString();
          return { id: current.id, patch };
        })
        .filter(Boolean) as { id: string; patch: Record<string, any> }[];

      for (const item of toUpdate) {
        const { error } = await supabase.from('ps_event_collaborators').update(item.patch).eq('id', item.id);
        if (error) throw error;
      }

      if (toCreate.length) {
        const { error } = await supabase.from('ps_event_collaborators').insert(toCreate);
        if (error) throw error;
      }

      const collaboratorIds = [...new Set(resolved.map((item) => item.collaboratorId))];
      const { data: persistedLinks, error: persistedLinksError } = await supabase
        .from('ps_event_collaborators')
        .select('id,collaborator_id')
        .eq('event_id', eventId)
        .in('collaborator_id', collaboratorIds);
      if (persistedLinksError) throw persistedLinksError;

      const { data: evaluatorSync, error: evaluatorSyncError } = await (supabase as any).rpc('ps_admin_sync_imported_evaluators', {
        p_event_id: eventId,
        p_event_collaborator_ids: (persistedLinks || []).map((item: any) => item.id),
      });
      if (evaluatorSyncError) throw evaluatorSyncError;

      return {
        created,
        linked: toCreate.length,
        skipped: resolved.length - toCreate.length,
        updated: toUpdate.length,
        importTag,
        evaluatorSync: evaluatorSync?.[0] || null,
        nameAdjustments,
      };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['ps_event_collaborators'] });
      qc.invalidateQueries({ queryKey: ['ps_collaborators'] });
      const sync = result.evaluatorSync;
      const evaluatorMessage = sync
        ? ` ${sync.coordenadores_identificados} coordenadores, ${sync.subcoordenadores_identificados} subcoordenadores, ${sync.contas_criadas} contas criadas, ${sync.contas_sincronizadas} sincronizadas, ${sync.escopos_criados} escopos criados e ${sync.escopos_local_incompleto} pendentes.`
        : '';
      const nameAdjustmentMessage = result.nameAdjustments
        ? ` ${result.nameAdjustments} nome(s) de avaliador ajustado(s) manualmente.`
        : '';
      toast.success(`${result.linked} vinculados ao evento (${result.created} novos colaboradores, ${result.skipped} já estavam no evento, ${result.updated} atualizados).${evaluatorMessage}${nameAdjustmentMessage}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
