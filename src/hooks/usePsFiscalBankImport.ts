import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import {
  dedupeFiscalRows,
  normalizeFiscalCpf,
  normalizeFiscalEmail,
  normalizeFiscalImportNote,
  normalizeFiscalInstitution,
  normalizeFiscalMatricula,
} from '@/lib/psFiscalBank.mjs';

export function usePsImportFiscalBank() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (rows: any[]) => {
      const clean = dedupeFiscalRows(rows.map((row) => ({
        full_name: String(row.full_name || row.nome || '').replace(/\s+/g, ' ').trim(),
        cpf: normalizeFiscalCpf(row.cpf || row['CPF']) || null,
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

      const existing = await supabase.from('ps_collaborators').select([
        'id', 'full_name', 'cpf', 'email', 'email_normalized', 'phone',
        'matricula', 'matricula_normalized', 'institution', 'institution_normalized',
        'sector', 'unit', 'role', 'notes', 'imported_selection_count',
        'imported_participation_count', 'active',
      ].join(','));
      if (existing.error) throw existing.error;

      const records = (existing.data || []) as any[];
      const byEmail = new Map(records.filter((record) => record.email_normalized).map((record) => [record.email_normalized, record]));
      const byMatriculaInstitution = new Map(records
        .filter((record) => record.matricula_normalized && record.institution_normalized)
        .map((record) => [`${record.matricula_normalized}|${record.institution_normalized}`, record]));
      const cpfOwners = new Map(records
        .map((record) => [normalizeFiscalCpf(record.cpf), record] as const)
        .filter(([cpf]) => Boolean(cpf)));

      const prepared: any[] = [];
      let updated = 0;
      let cpfUpdated = 0;
      let cpfRows = 0;

      for (const row of clean) {
        const emailKey = normalizeFiscalEmail(row.email);
        const matriculaKey = normalizeFiscalMatricula(row.matricula);
        const institutionKey = normalizeFiscalInstitution(row.institution);
        const importedCpf = normalizeFiscalCpf(row.cpf);
        let current: any = null;

        if (emailKey && byEmail.has(emailKey)) current = byEmail.get(emailKey);
        else if (matriculaKey && institutionKey && byMatriculaInstitution.has(`${matriculaKey}|${institutionKey}`)) {
          current = byMatriculaInstitution.get(`${matriculaKey}|${institutionKey}`);
        }

        if (importedCpf) {
          cpfRows += 1;
          const owner = cpfOwners.get(importedCpf);
          if (owner && owner.id !== current?.id) {
            throw new Error(`O CPF informado para ${row.full_name || 'um fiscal'} já está vinculado a outro cadastro. Revise a planilha antes de continuar.`);
          }
        }

        const payload = {
          full_name: String(row.full_name || '').replace(/\s+/g, ' ').trim(),
          cpf: importedCpf || null,
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

        if (current) {
          if (importedCpf && normalizeFiscalCpf(current.cpf) !== importedCpf) {
            const { error } = await supabase
              .from('ps_collaborators')
              .update({ cpf: importedCpf })
              .eq('id', current.id);
            if (error) throw error;
            updated += 1;
            cpfUpdated += 1;
          }
          continue;
        }

        prepared.push(payload);
      }

      if (prepared.length) {
        const { error } = await supabase.from('ps_collaborators').insert(prepared);
        if (error) throw error;
      }

      let eventCpfSynced = 0;
      if (cpfRows > 0) {
        const { data, error } = await (supabase as any).rpc('ps_sync_event_collaborator_cpfs');
        if (error) throw error;
        eventCpfSynced = Number(data || 0);
      }

      return {
        rowsRead: rows.length,
        inserted: prepared.length,
        updated,
        cpfUpdated,
        eventCpfSynced,
      };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['ps_collaborators'] });
      qc.invalidateQueries({ queryKey: ['ps_event_collaborators'] });
      const cpfMessage = result.cpfUpdated || result.eventCpfSynced
        ? ` ${result.cpfUpdated} CPF(s) atualizados e ${result.eventCpfSynced} vínculo(s) de evento sincronizados.`
        : '';
      toast.success(`Banco de fiscais importado com sucesso.${cpfMessage}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
