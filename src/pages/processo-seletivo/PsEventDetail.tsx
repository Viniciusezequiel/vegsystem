import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PsCriteriaFields, emptyCriteria } from '@/components/processo-seletivo/PsCriteriaFields';
import { PsEventTeamImportDialog } from '@/components/processo-seletivo/PsEventTeamImportDialog';
import { PsEventCommunicationTab } from '@/components/processo-seletivo/PsEventCommunicationTab';
import { SignaturePad } from '@/components/ui/SignaturePad';
import {
  usePsEvent, usePsEventMutations, usePsEventCollaborators, usePsEventCollaboratorMutations,
  usePsCollaborators, usePsRoles, usePsEvaluations, usePsSaveEvaluation, usePsCandidates,
  usePsCandidateMutations, usePsSelfEvaluations, usePsClearEventTeam, usePsEventConfirmationSummary, usePsConfirmationActions,
} from '@/hooks/useProcessoSeletivo';
import { getPsConfirmationStatusLabel, replacementAssignment } from '@/lib/psConfirmationState.mjs';
import { useAuth } from '@/contexts/AuthContext';
import { PS_EVENT_STATUS, PS_CLASSIFICATION_LABEL, PS_PCD_OPTIONS } from '@/lib/psConstants';
import { ArrowLeft, Plus, Trash2, Copy, Download, CheckCircle2, Upload, Star, Pencil, IdCard, FileSignature, ShieldCheck } from 'lucide-react';
import { generatePsBadgesPdf, generatePsCandidateBadgesPdf, generatePsAttendancePdfAsync } from '@/lib/psEventPdf';
import { psPresencePatch } from '@/lib/psFiscalFoundation';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import {
  uploadSignatureValue,
  cleanupUploadedSignatureIfUnreferenced,
} from '@/lib/signatureStorage';

export default function PsEventDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { data: event } = usePsEvent(id);
  const { finalize, save } = usePsEventMutations();
  const { data: links = [] } = usePsEventCollaborators(id);
  const { add, update, updateState, remove } = usePsEventCollaboratorMutations(id);
  const { data: collaborators = [] } = usePsCollaborators();
  const { data: roles = [] } = usePsRoles();
  const { data: evaluations = [] } = usePsEvaluations(id);
  const { data: selfEvaluations = [] } = usePsSelfEvaluations(id);
  const saveEval = usePsSaveEvaluation();
  const { data: candidates = [] } = usePsCandidates(id);
  const { addMany, removeAll } = usePsCandidateMutations();
  const { profile } = useAuth();
  const clearTeam = usePsClearEventTeam();
  const { data: confirmationSummary = {} } = usePsEventConfirmationSummary(id);
  const confirmationActions = usePsConfirmationActions(id);

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editLink, setEditLink] = useState<any>(null);
  const [searchFiscal, setSearchFiscal] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [roleValue, setRoleValue] = useState('');
  const [evalTarget, setEvalTarget] = useState<any>(null);
  const [criteria, setCriteria] = useState(emptyCriteria());
  const [comments, setComments] = useState('');
  const [confirmationSearch, setConfirmationSearch] = useState('');
  const [confirmationStatus, setConfirmationStatus] = useState('all');
  const [confirmationRole, setConfirmationRole] = useState('all');
  const [confirmationUnit, setConfirmationUnit] = useState('all');
  const [replacementTarget, setReplacementTarget] = useState<any>(null);
  const [replacementFiscalId, setReplacementFiscalId] = useState('');
  const [replacementData, setReplacementData] = useState<any>(null);
  const [presenceSearch, setPresenceSearch] = useState('');
  const [presenceListOpen, setPresenceListOpen] = useState(false);

  const [selfEvaluationSearch, setSelfEvaluationSearch] = useState('');
  const [selfEvaluationRole, setSelfEvaluationRole] = useState('all');
  const [selfEvaluationCampus, setSelfEvaluationCampus] = useState('all');

  const [absenceTarget, setAbsenceTarget] = useState<any>(null);
  const [absenceResponsibleId, setAbsenceResponsibleId] = useState('');
  const [absenceReason, setAbsenceReason] = useState('');
  const [absenceSignature, setAbsenceSignature] = useState<string | null>(null);
  const [absenceSaving, setAbsenceSaving] = useState(false);

  const [closureTarget, setClosureTarget] = useState<any>(null);
  const [closureCoordinatorId, setClosureCoordinatorId] = useState('');
  const [closureSignature, setClosureSignature] = useState<string | null>(null);
  const [closureSaving, setClosureSaving] = useState(false);

  const publicBase = `${window.location.origin}/ps`;

  const { data: attendanceClosures = [] } = useQuery({
    queryKey: ['ps-attendance-closures', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ps_attendance_closures')
        .select(
          'id, event_id, campus, building, coordinator_event_collaborator_id, coordinator_name, present_count, absent_count, pending_count, role_adjustments_count, pix_adjustments_count, signed_at'
        )
        .eq('event_id', id!)
        .order('building');

      if (error) throw error;

      return data || [];
    },
  });

  const { data: confirmationHistory = [] } = useQuery({
    queryKey: ['ps-confirmation-history', id],
    enabled: !!id,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ps_confirmation_history')
        .select(
          'id, event_id, event_collaborator_id, previous_status, new_status, decline_reason, replacement_event_collaborator_id, source, actor_name, collaborator_name_snapshot, role_name_snapshot, campus_snapshot, unit_snapshot, building_snapshot, floor_snapshot, room_snapshot, replacement_collaborator_name_snapshot, created_at'
        )
        .eq('event_id', id!)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    },
  });

  const confirmationRows = useMemo(() => {
    const query = confirmationSearch.trim().toLowerCase();
    return links.filter((link: any) => (confirmationStatus === 'all' || link.participation_status === confirmationStatus)
      && (confirmationRole === 'all' || (link.role_name || link.assigned_role || 'Sem função') === confirmationRole)
      && (confirmationUnit === 'all' || (link.unit || 'Sem unidade') === confirmationUnit)
      && (!query || [link.collaborator_name, link.role_name, link.assigned_role, link.unit, link.room].filter(Boolean).join(' ').toLowerCase().includes(query)));
  }, [links, confirmationSearch, confirmationStatus, confirmationRole, confirmationUnit]);

  const presenceRows = useMemo(() => {
    const query = presenceSearch.trim().toLowerCase();

    return [...links]
      .filter((link: any) => {
        if (!query) return true;

        return [
          link.collaborator_name,
          link.role_name,
          link.assigned_role,
          link.building,
          link.floor,
          link.room,
          link.unit,
          link.sector,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort((a: any, b: any) =>
        String(a.collaborator_name || '').localeCompare(
          String(b.collaborator_name || ''),
          'pt-BR'
        )
      );
  }, [links, presenceSearch]);

  const attendanceLocations = useMemo(() => {
    const locations = new Map<string, any>();

    for (const link of links as any[]) {
      const campus = String(link.campus || '').trim();

      const building = String(
        link.building ||
        link.unit ||
        link.campus ||
        'Sem prédio'
      ).trim();

      const key = `${campus}|||${building}`;

      if (!locations.has(key)) {
        locations.set(key, {
          key,
          campus,
          building,
          links: [],
        });
      }

      locations.get(key).links.push(link);
    }

    return [...locations.values()]
      .map((location: any) => {
        const rows = location.links;

        const presentCount = rows.filter(
          (row: any) =>
            !row.absent &&
            (!!row.signed_at || !!row.present)
        ).length;

        const absentCount = rows.filter(
          (row: any) => !!row.absent
        ).length;

        const pendingCount = rows.filter(
          (row: any) =>
            !row.absent &&
            !row.signed_at &&
            !row.present
        ).length;

        const closure = attendanceClosures.find(
          (item: any) =>
            String(item.campus || '').trim() === location.campus &&
            String(item.building || '').trim() === location.building
        );

        return {
          ...location,
          presentCount,
          absentCount,
          pendingCount,
          closure,
        };
      })
      .sort((a: any, b: any) =>
        String(a.building).localeCompare(
          String(b.building),
          'pt-BR'
        )
      );
  }, [links, attendanceClosures]);


  const closureCoordinatorCandidates = useMemo(() => {
    return links
      .filter((link: any) => {
        const role = String(
          link.role_name ||
          link.assigned_role ||
          link.role_value ||
          ''
        ).toLowerCase();

        return (
          role.includes('coord') &&
          !role.includes('sub') &&
          !link.absent
        );
      })
      .sort((a: any, b: any) =>
        String(a.collaborator_name || '').localeCompare(
          String(b.collaborator_name || ''),
          'pt-BR'
        )
      );
  }, [links]);

  const selfEvaluationRows = useMemo(() => {
    const query = selfEvaluationSearch.trim().toLowerCase();

    return [...selfEvaluations]
      .filter((item: any) => {
        const matchesSearch =
          !query ||
          [
            item.respondent_name,
            item.role,
            item.campus,
            item.floor,
            item.room,
            item.suggestions,
            item.incident_comment,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(query);

        const matchesRole =
          selfEvaluationRole === 'all' ||
          item.role === selfEvaluationRole;

        const matchesCampus =
          selfEvaluationCampus === 'all' ||
          item.campus === selfEvaluationCampus;

        return matchesSearch && matchesRole && matchesCampus;
      })
      .sort((a: any, b: any) =>
        String(b.created_at || '').localeCompare(
          String(a.created_at || '')
        )
      );
  }, [
    selfEvaluations,
    selfEvaluationSearch,
    selfEvaluationRole,
    selfEvaluationCampus,
  ]);

  const selfEvaluationSummary = useMemo(() => {
    const ratings: number[] = [];
    let incidents = 0;
    let lowRatings = 0;

    for (const item of selfEvaluations as any[]) {
      const values = [
        item.training_rating,
        item.organization_rating,
        item.snack_rating,
        item.partner_fiscal_rating,
      ].filter((value) => Number(value) > 0);

      ratings.push(...values.map(Number));

      if (item.had_incident) incidents += 1;

      if (values.some((value) => Number(value) <= 2)) {
        lowRatings += 1;
      }
    }

    const average = ratings.length
      ? ratings.reduce((sum, value) => sum + value, 0) /
        ratings.length
      : 0;

    return {
      total: selfEvaluations.length,
      average,
      incidents,
      lowRatings,
    };
  }, [selfEvaluations]);

  const selfEvaluationRoleOptions = useMemo(
    () =>
      [...new Set(
        selfEvaluations
          .map((item: any) => item.role)
          .filter(Boolean)
      )].sort((a: any, b: any) =>
        String(a).localeCompare(String(b), 'pt-BR')
      ),
    [selfEvaluations]
  );

  const selfEvaluationCampusOptions = useMemo(
    () =>
      [...new Set(
        selfEvaluations
          .map((item: any) => item.campus)
          .filter(Boolean)
      )].sort((a: any, b: any) =>
        String(a).localeCompare(String(b), 'pt-BR')
      ),
    [selfEvaluations]
  );

  const absenceResponsibleCandidates = useMemo(() => {
    return links
      .filter((link: any) => {
        const role = String(
          link.role_name ||
          link.assigned_role ||
          link.role_value ||
          ''
        ).toLowerCase();

        return (
          role.includes('coord') &&
          !link.absent &&
          link.id !== absenceTarget?.id
        );
      })
      .sort((a: any, b: any) =>
        String(a.collaborator_name || '').localeCompare(
          String(b.collaborator_name || ''),
          'pt-BR'
        )
      );
  }, [links, absenceTarget?.id]);

  const replacementCandidates = useMemo(() => {
    const currentIds = new Set(links.map((link: any) => link.collaborator_id));
    return collaborators.filter((candidate: any) => candidate.active && !currentIds.has(candidate.id));
  }, [collaborators, links]);

  const requestConfirmation = async (link: any) => {
    try {
      const result = await confirmationActions.request.mutateAsync({
        linkId: link.id,
        rotate: !!link.public_confirmation_token_expires_at,
      });
      copy(`${publicBase}/confirmacao/${id}/${result.token}`);
    } catch { /* mutation already reports a safe error */ }
  };

  const openReplacement = (link: any) => {
    setReplacementTarget(link); setReplacementFiscalId(''); setReplacementData(replacementAssignment(link));
  };

  const submitReplacement = async () => {
    if (!replacementTarget || !replacementFiscalId) return;
    await confirmationActions.replace.mutateAsync({ oldLinkId: replacementTarget.id, collaboratorId: replacementFiscalId, assignment: replacementData });
    setReplacementTarget(null); setReplacementFiscalId(''); setReplacementData(null);
  };

  const setParticipantState = (link: any, patch: Partial<{ present: boolean; absent: boolean; departed_at: string | null }>) => {
    updateState.mutate({
      id: link.id,
      updated_at: link.updated_at,
      present: patch.present ?? link.present,
      absent: patch.absent ?? link.absent,
      departed_at: patch.departed_at === undefined ? link.departed_at : patch.departed_at,
    });
  };

  const copy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const rolePay = (slug?: string | null) => {
    const r: any = roles.find((x: any) => x.value === slug);
    if (!r) return 0;
    const combined = (r.combined_roles || []).reduce(
      (acc: number, s: string) => acc + Number((roles.find((x: any) => x.value === s) as any)?.pay_value || 0), 0);
    return Number(r.pay_value || 0) + combined;
  };

  const totalCost = links.filter((l: any) => !l.absent).reduce((acc: number, l: any) => acc + rolePay(l.role_value), 0);
  const visibleCollaborators = useMemo(() => {
    const q = searchFiscal.trim().toLowerCase();
    return collaborators
      .filter((c: any) => c.active && !links.some((l: any) => l.collaborator_id === c.id))
      .filter((c: any) => !q || [c.full_name, c.email, c.matricula, c.institution, c.unit, c.role].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [collaborators, links, searchFiscal]);

  const linkFiscals = async () => {
    if (!selected.length || !roleValue) return;
    const roleObj: any = roles.find((r: any) => r.value === roleValue);
    const rows = selected.map((cid) => {
      const c: any = collaborators.find((x: any) => x.id === cid);
      return {
        event_id: id,
        collaborator_id: cid,
        collaborator_name: c?.full_name,
        role_value: roleValue,
        role_name: roleObj?.name,
        pay_value: rolePay(roleValue),
      };
    });
    await add.mutateAsync(rows);
    setAddOpen(false);
    setSelected([]);
    setRoleValue('');
  };

  const submitEvaluation = async () => {
    await saveEval.mutateAsync({
      event_id: id,
      collaborator_id: evalTarget.collaborator_id,
      collaborator_name: evalTarget.collaborator_name,
      assigned_role: evalTarget.role_value || evalTarget.assigned_role || evalTarget.role_name || '',
      evaluator_name: profile?.full_name || 'Sistema',
      observations: comments.trim() || null,
      ...criteria,
    });
    setEvalTarget(null);
    setCriteria(emptyCriteria());
    setComments('');
  };

  const importCandidates = async (file: File) => {
    const wb = XLSX.read(await file.arrayBuffer());
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    const pick = (r: any, keys: string[]) => {
      for (const k of keys) {
        const found = Object.keys(r).find((c) => c.trim().toUpperCase() === k.toUpperCase());
        if (found && String(r[found]).trim()) return String(r[found]).trim();
      }
      return '';
    };
    const mapped = rows.map((r) => ({
      event_id: id,
      process_name: pick(r, ['PROCESSO SELETIVO', 'PROCESSO']) || null,
      registration_number: pick(r, ['INSCRIÇÃO', 'INSCRICAO', 'Inscrição']) || null,
      full_name: pick(r, ['CANDIDATO', 'NOME', 'Nome']),
      phone: pick(r, ['CELULAR', 'TELEFONE']) || null,
      email: pick(r, ['E-MAIL', 'EMAIL']) || null,
      rg: pick(r, ['IDENTIDADE', 'RG']) || null,
      cpf: pick(r, ['CPF', 'DOCUMENTO']) || null,
      exam_type: pick(r, ['TIPO DE PROVA', 'TIPO']) || null,
      campus: pick(r, ['LOCAL DE PROVA', 'CAMPUS', 'LOCAL']) || null,
      room: pick(r, ['SALA']) || null,
      barcode: pick(r, ['CÓD DE BARRAS', 'COD DE BARRAS', 'CODIGO DE BARRAS']) || null,
      seat_number: pick(r, ['CARTEIRA', 'ASSENTO']) || null,
    })).filter((r) => r.full_name);
    if (mapped.length) addMany.mutate(mapped);
  };


  const openClosureDialog = (location: any) => {
    if (location.closure) {
      toast.info('Este prédio/local já foi fechado.');
      return;
    }

    if (location.pendingCount > 0) {
      toast.error(
        `Ainda existem ${location.pendingCount} fiscal(is) pendente(s) neste prédio/local.`
      );
      return;
    }

    setClosureTarget(location);
    setClosureCoordinatorId('');
    setClosureSignature(null);
  };

  const closeClosureDialog = () => {
    if (closureSaving) return;

    setClosureTarget(null);
    setClosureCoordinatorId('');
    setClosureSignature(null);
  };

  const submitAttendanceClosure = async () => {
    if (!closureTarget || !id) return;

    if (!closureCoordinatorId) {
      toast.error('Selecione o coordenador responsável.');
      return;
    }

    if (!closureSignature) {
      toast.error('O coordenador precisa assinar o fechamento.');
      return;
    }

    setClosureSaving(true);

    let uploadedLocator: string | null = null;

    try {
      uploadedLocator = await uploadSignatureValue(
        'process-selection',
        closureSignature
      );

      if (!uploadedLocator) {
        throw new Error(
          'Não foi possível armazenar a assinatura do fechamento.'
        );
      }

      const { data, error } = await (supabase as any).rpc(
        'ps_admin_close_attendance_building',
        {
          p_event_id: id,
          p_campus: closureTarget.campus || null,
          p_building: closureTarget.building,
          p_coordinator_event_collaborator_id:
            closureCoordinatorId,
          p_signature: uploadedLocator,
        }
      );

      if (error) throw error;

      const result = data?.[0];

      if (!result?.success) {
        throw new Error(
          result?.message ||
          'Não foi possível realizar o fechamento.'
        );
      }

      const building = closureTarget.building;

      setClosureTarget(null);
      setClosureCoordinatorId('');
      setClosureSignature(null);

      await queryClient.invalidateQueries({
        queryKey: ['ps-attendance-closures', id],
      });

      toast.success(
        `Fechamento de ${building} registrado com sucesso.`
      );
    } catch (error) {
      if (uploadedLocator) {
        try {
          await cleanupUploadedSignatureIfUnreferenced(
            'process-selection',
            uploadedLocator
          );
        } catch {
          // não bloqueia o fluxo principal
        }
      }

      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível registrar o fechamento.'
      );
    } finally {
      setClosureSaving(false);
    }
  };


  const closeAbsenceDialog = () => {
    setAbsenceTarget(null);
    setAbsenceResponsibleId('');
    setAbsenceReason('');
    setAbsenceSignature(null);
  };

  const openAbsenceDialog = (link: any) => {
    if (link.signed_at) {
      toast.error(
        'Este fiscal já assinou. Use "Refazer assinatura" antes de registrar ausência.'
      );
      return;
    }

    setAbsenceTarget(link);
    setAbsenceResponsibleId('');
    setAbsenceReason('');
    setAbsenceSignature(null);
  };

  const submitAttendanceAbsence = async () => {
    if (!absenceTarget) return;

    if (!absenceResponsibleId) {
      toast.error('Selecione o responsável pela ausência.');
      return;
    }

    if (!absenceReason.trim()) {
      toast.error('Informe o motivo ou observação da ausência.');
      return;
    }

    if (!absenceSignature) {
      toast.error('O responsável precisa assinar para confirmar a ausência.');
      return;
    }

    setAbsenceSaving(true);
    let uploadedLocator: string | null = null;

    try {
      uploadedLocator = await uploadSignatureValue(
        'process-selection',
        absenceSignature
      );

      if (!uploadedLocator) {
        throw new Error('Não foi possível armazenar a assinatura.');
      }

      const { data, error } = await (supabase as any).rpc(
        'ps_admin_register_attendance_absence',
        {
          p_event_collaborator_id: absenceTarget.id,
          p_responsible_event_collaborator_id: absenceResponsibleId,
          p_reason: absenceReason.trim(),
          p_signature: uploadedLocator,
        }
      );

      if (error) throw error;

      const result = data?.[0];

      if (!result?.success) {
        throw new Error(
          result?.message || 'Não foi possível registrar a ausência.'
        );
      }

      const fiscalName = absenceTarget.collaborator_name;

      closeAbsenceDialog();

      toast.success(
        `Ausência de ${fiscalName} registrada com sucesso.`
      );
    } catch (error) {
      if (uploadedLocator) {
        try {
          await cleanupUploadedSignatureIfUnreferenced(
            'process-selection',
            uploadedLocator
          );
        } catch {
          // A ausência não deve falhar por causa da limpeza do arquivo.
        }
      }

      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível registrar a ausência.'
      );
    } finally {
      setAbsenceSaving(false);
    }
  };

  const cancelAttendanceAbsence = async (link: any) => {
    const confirmed = window.confirm(
      `Cancelar a ausência de ${link.collaborator_name}?\n\n` +
      'O fiscal voltará para a lista de pendentes.'
    );

    if (!confirmed) return;

    try {
      const { data, error } = await (supabase as any).rpc(
        'ps_admin_cancel_attendance_absence',
        {
          p_event_collaborator_id: link.id,
        }
      );

      if (error) throw error;

      if (!data) {
        throw new Error('Não foi possível cancelar a ausência.');
      }

      toast.success(
        `${link.collaborator_name} voltou para a lista de pendentes.`
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível cancelar a ausência.'
      );
    }
  };

  const resetAttendanceSignature = async (link: any) => {
    if (!link?.signed_at) return;

    const confirmed = window.confirm(
      `Refazer a assinatura de ${link.collaborator_name}?\n\n` +
      'A assinatura atual será apagada e o fiscal voltará para a lista de pendentes.'
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('ps_event_collaborators')
        .update({
          signature_url: null,
          signature_ip: null,
          signed_at: null,
          present: false,
          absent: false,
          departed_at: null,
        })
        .eq('id', link.id);

      if (error) throw error;

      toast.success(
        `${link.collaborator_name} está liberado para assinar novamente.`
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível apagar a assinatura.'
      );
    }
  };

  const exportPresence = () => {
    const rows = links.map((l: any) => ({
      Nome: l.collaborator_name,
      Função: l.role_name,
      Sala: l.room || '',
      Presente: l.present ? 'Sim' : 'Não',
      Ausente: l.absent ? 'Sim' : 'Não',
      Assinado: l.signed_at ? 'Sim' : 'Não',
      Saída: l.departed_at ? new Date(l.departed_at).toLocaleString('pt-BR') : '',
      'Valor R$': Number(l.pay_value || 0).toFixed(2),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Presenças');
    XLSX.writeFile(wb, `presencas-${event?.name || 'evento'}.xlsx`);
  };

  const slug = (event?.name || 'evento').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const eventInfo = () => ({
    name: event?.name || '',
    date: event?.date ? new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR') : '',
    location: event?.location || '',
  });

  const exportBadges = () => {
    if (!links.length) { toast.error('Nenhum colaborador vinculado ao evento.'); return; }
    generatePsBadgesPdf(eventInfo(), links as any).save(`etiquetas-${slug}.pdf`);
  };

  const exportCandidateBadges = () => {
    if (!candidates.length) {
      toast.error('Nenhum candidato disponível para geração de etiquetas.');
      return;
    }
    const rows = candidates.map((c: any) => ({
      full_name: c.full_name,
      cpf: c.cpf,
      campus: c.campus,
      room: c.room,
      seat_number: c.seat_number || c.seat,
      registration_number: c.registration_number,
      pcd_type: c.pcd_type,
    }));
    generatePsCandidateBadgesPdf(eventInfo(), rows).save(`etiquetas-candidatos-${slug}.pdf`);
  };

  const exportAttendancePdf = async () => {
    if (!links.length) {
      toast.error('Nenhum colaborador vinculado ao evento.');
      return;
    }

    const { data: attendanceRows, error } = await supabase
      .from('ps_event_collaborators')
      .select(
        'id, signature_url, attendance_pix_snapshot, attendance_role_snapshot'
      )
      .eq('event_id', id!);

    if (error) {
      toast.error('Não foi possível carregar os dados da presença para o PDF.');
      return;
    }

    const { data: adjustments, error: adjustmentError } = await supabase
      .from('ps_event_collaborator_adjustments')
      .select(
        'event_collaborator_id, adjustment_type, old_value, new_value, justification, created_at'
      )
      .eq('event_id', id!)
      .eq('source', 'attendance')
      .order('created_at', { ascending: true });

    if (adjustmentError) {
      toast.error('Não foi possível carregar as alterações da presença.');
      return;
    }

    const { data: absences, error: absenceError } = await supabase
      .from('ps_attendance_absences')
      .select(
        'event_collaborator_id, responsible_name, reason, signature_url, created_at'
      )
      .eq('event_id', id!);

    if (absenceError) {
      toast.error('Não foi possível carregar os registros de ausência.');
      return;
    }

    const { data: closures, error: closureError } = await supabase
      .from('ps_attendance_closures')
      .select(
        'campus, building, coordinator_name, signature_url, signed_at, present_count, absent_count, pending_count, role_adjustments_count, pix_adjustments_count'
      )
      .eq('event_id', id!)
      .order('building', { ascending: true });

    if (closureError) {
      toast.error('Não foi possível carregar os fechamentos da presença.');
      return;
    }

    const absenceById = new Map(
      (absences || []).map((absence: any) => [
        absence.event_collaborator_id,
        absence,
      ])
    );

    const attendanceById = new Map(
      (attendanceRows || []).map((row: any) => [row.id, row])
    );

    const adjustmentsById = new Map<string, any[]>();

    for (const adjustment of adjustments || []) {
      const current =
        adjustmentsById.get(adjustment.event_collaborator_id) || [];

      current.push(adjustment);
      adjustmentsById.set(
        adjustment.event_collaborator_id,
        current
      );
    }

    const pdfRows = links.map((row: any) => {
      const attendance: any = attendanceById.get(row.id);
      const absence: any = absenceById.get(row.id);
      const rowAdjustments = adjustmentsById.get(row.id) || [];

      const roleSnapshot = attendance?.attendance_role_snapshot;

      const confirmedRole = roleSnapshot
        ? roles.find((role: any) => role.value === roleSnapshot)?.name ||
          row.role_name ||
          row.assigned_role
        : row.role_name || row.assigned_role;

      const observations: string[] = [];

      if (row.notes?.trim()) {
        observations.push(row.notes.trim());
      }

      if (row.absent) {
        if (absence) {
          observations.push(
            [
              'AUSENTE',
              absence.responsible_name
                ? `Responsável: ${absence.responsible_name}`
                : null,
              absence.reason?.trim() || null,
            ]
              .filter(Boolean)
              .join(' — ')
          );
        } else {
          observations.push('AUSENTE');
        }
      }

      for (const adjustment of rowAdjustments) {
        if (adjustment.adjustment_type === 'role') {
          observations.push(
            `Cargo alterado: ${adjustment.old_value || '-'} → ${adjustment.new_value}` +
            (adjustment.justification
              ? ` — ${adjustment.justification}`
              : '')
          );
        }

        if (adjustment.adjustment_type === 'pix') {
          observations.push(
            `PIX alterado` +
            (adjustment.justification
              ? ` — ${adjustment.justification}`
              : '')
          );
        }
      }

      return {
        ...row,
        role_name: confirmedRole,
        pix:
          attendance?.attendance_pix_snapshot?.trim() ||
          row.pix ||
          null,
        signature_url:
          row.absent && absence?.signature_url
            ? absence.signature_url
            : attendance?.signature_url ?? null,
        notes: observations.join(' | '),
      };
    });

    const pdf = await generatePsAttendancePdfAsync(
      eventInfo(),
      pdfRows as any,
      (closures || []) as any
    );

    pdf.save(`lista-presenca-${slug}.pdf`);
  };

  if (!event) {
    return <MainLayout><p className="text-muted-foreground">Carregando evento...</p></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="rounded-2xl border bg-background/80 p-4 backdrop-blur-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <Button asChild variant="ghost" size="icon"><Link to="/admin-module/processo-seletivo/eventos"><ArrowLeft className="h-4 w-4" /></Link></Button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold sm:text-2xl">{event.name}</h1>
                  <Badge variant={event.status === 'em_andamento' ? 'default' : 'secondary'}>{PS_EVENT_STATUS[event.status]}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR')} · {event.location || 'Local não informado'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportBadges}><IdCard className="mr-2 h-4 w-4" />Etiquetas</Button>
              <Button asChild variant="outline"><Link to={`/admin-module/processo-seletivo/eventos/${id}/avaliadores`}><ShieldCheck className="mr-2 h-4 w-4" />Equipe de avaliação</Link></Button>
              <Button variant="outline" onClick={exportAttendancePdf}><FileSignature className="mr-2 h-4 w-4" />Presença (PDF)</Button>
              <Button variant="outline" onClick={exportPresence}><Download className="mr-2 h-4 w-4" />XLSX</Button>
              {event.status !== 'finalizado' && (
                <Button onClick={() => { if (confirm('Finalizar evento?')) finalize.mutate(event.id); }}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />Finalizar
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-2xl"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Equipe</p><p className="mt-1 text-2xl font-bold">{links.length}</p></CardContent></Card>
          <Card className="rounded-2xl"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Presentes</p><p className="mt-1 text-2xl font-bold">{links.filter((l: any) => l.present).length}</p></CardContent></Card>
          <Card className="rounded-2xl"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Ausentes</p><p className="mt-1 text-2xl font-bold">{links.filter((l: any) => l.absent).length}</p></CardContent></Card>
          <Card className="rounded-2xl"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Avaliações</p><p className="mt-1 text-2xl font-bold">{links.filter((l: any) => l.evaluated).length}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="visao-geral">
          <TabsList className="flex-wrap">
            <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
            <TabsTrigger value="fiscais">Equipe</TabsTrigger>
            <TabsTrigger value="confirmacoes">Confirmações</TabsTrigger>
            <TabsTrigger value="comunicacao">Comunicação</TabsTrigger>
            <TabsTrigger value="candidatos">Candidatos</TabsTrigger>
            <TabsTrigger value="presenca">Presença</TabsTrigger>
            <TabsTrigger value="avaliacoes">Avaliações</TabsTrigger>
            <TabsTrigger value="auto">
              Autoavaliações
              {selfEvaluations.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 px-1.5 py-0 text-[10px]"
                >
                  {selfEvaluations.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="space-y-4 pt-4">
            <Card className="rounded-2xl">
              <CardHeader><CardTitle className="text-base">Links públicos</CardTitle></CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-3">
                {[
                  { label: 'Avaliação de fiscais', url: `${publicBase}/avaliacao/${event.id}` },
                  { label: 'Autoavaliação', url: `${publicBase}/autoavaliacao/${event.id}` },
                  { label: 'Lista de presença/assinatura', url: `${publicBase}/presenca/${event.id}` },
                ].map((l) => (
                  <Button key={l.url} variant="outline" className="justify-between" onClick={() => copy(l.url)}>
                    {l.label} <Copy className="h-4 w-4" />
                  </Button>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="configuracoes" className="space-y-4 pt-4">
            <Card className="rounded-2xl">
              <CardHeader><CardTitle className="text-base">Autoavaliação</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Permitir autoavaliação deste evento</p>
                    <p className="text-sm text-muted-foreground">Quando habilitada, este evento ficará disponível para os fiscais realizarem a autoavaliação.</p>
                  </div>
                  <Switch
                    checked={!!event.self_evaluation_enabled}
                    onCheckedChange={async (checked) => {
                      await save.mutateAsync({ ...event, self_evaluation_enabled: checked });
                    }}
                  />
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                  {event.self_evaluation_enabled ? 'Status: Aberta' : 'Status: Fechada'}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fiscais" className="space-y-3 pt-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setImportOpen(true)}><Upload className="mr-2 h-4 w-4" />Importar planilha</Button>
              <Button variant="outline" onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" />Vincular manualmente</Button>
              {links.length > 0 && (
                <Button variant="outline" onClick={() => { if (confirm('Remover toda a equipe deste evento? Os cadastros e as avaliações dos colaboradores são mantidos.')) clearTeam.mutate(id!); }}>
                  <Trash2 className="mr-2 h-4 w-4" />Limpar equipe
                </Button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {links.map((l: any) => (
                <Card key={l.id} className="rounded-2xl">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{l.collaborator_name}</CardTitle>
                      <div className="flex flex-wrap justify-end gap-1">
                        {l.signed_at && <Badge>Assinado</Badge>}
                        {l.departed_at && <Badge variant="outline">Saiu</Badge>}
                        {l.evaluated && <Badge variant="secondary">Avaliado</Badge>}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[l.role_name, `R$ ${Number(l.pay_value || 0).toFixed(2)}`, l.building, l.floor, l.room && `Sala ${l.room}`]
                        .filter(Boolean).join(' · ')}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between"><Label className="text-xs">Presente</Label>
                      <Switch checked={!!l.present} onCheckedChange={(v) => setParticipantState(l, psPresencePatch('present', v))} /></div>
                    <div className="flex items-center justify-between"><Label className="text-xs">Ausente</Label>
                      <Switch checked={!!l.absent} onCheckedChange={(v) => setParticipantState(l, psPresencePatch('absent', v))} /></div>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => setParticipantState(l, {
                      departed_at: l.departed_at ? null : new Date().toISOString(),
                    })} disabled={updateState.isPending}>
                      {l.departed_at ? 'Cancelar saída' : 'Registrar saída'}
                    </Button>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => { setEvalTarget(l); setCriteria(emptyCriteria()); }}>
                        <Star className="mr-1 h-4 w-4" />Avaliar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditLink(l)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => { if (confirm('Remover vínculo?')) remove.mutate(l.id); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {links.length === 0 && <p className="text-muted-foreground">Nenhum fiscal vinculado.</p>}
            </div>
          </TabsContent>

          <TabsContent value="confirmacoes" className="space-y-4 pt-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[['pending_confirmation', 'Aguardando confirmação'], ['confirmed', 'Confirmados'], ['declined', 'Recusaram'], ['replaced', 'Substituídos']].map(([key, label]) => (
                <Card key={key} className="rounded-2xl">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-2 text-2xl font-bold">{Number(confirmationSummary[key] || 0)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <Input value={confirmationSearch} onChange={(e) => setConfirmationSearch(e.target.value)} placeholder="Buscar por nome, cargo, unidade ou sala" />
              <Select value={confirmationStatus} onValueChange={setConfirmationStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="all">Todos os status</SelectItem><SelectItem value="pending_confirmation">Aguardando</SelectItem><SelectItem value="confirmed">Confirmados</SelectItem><SelectItem value="declined">Recusaram</SelectItem><SelectItem value="replaced">Substituídos</SelectItem>
              </SelectContent></Select>
              <Select value={confirmationRole} onValueChange={setConfirmationRole}><SelectTrigger><SelectValue placeholder="Cargo" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os cargos</SelectItem>
                {[...new Set(links.map((link: any) => link.role_name || link.assigned_role || 'Sem função'))].map((role: any) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
              </SelectContent></Select>
              <Select value={confirmationUnit} onValueChange={setConfirmationUnit}><SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as unidades</SelectItem>
                {[...new Set(links.map((link: any) => link.unit || 'Sem unidade'))].map((unit: any) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
              </SelectContent></Select>
            </div>
            <Card className="rounded-2xl">
              <CardContent className="p-0">
                <div className="divide-y">
                  {confirmationRows.map((l: any) => (
                    <div key={l.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{l.collaborator_name}</p>
                        <p className="text-xs text-muted-foreground">{l.role_name || l.assigned_role || 'Sem função'} · {l.unit || 'Unidade não informada'} · {l.room || 'Sala não informada'}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant={l.participation_status === 'confirmed' ? 'default' : l.participation_status === 'declined' ? 'destructive' : l.participation_status === 'replaced' ? 'secondary' : 'outline'}>
                          {getPsConfirmationStatusLabel(l.participation_status)}
                        </Badge>
                        <span>{l.confirmation_requested_at ? new Date(l.confirmation_requested_at).toLocaleDateString('pt-BR') : '—'}</span>
                        <span>{l.confirmed_at ? new Date(l.confirmed_at).toLocaleDateString('pt-BR') : '—'}</span>
                        {l.participation_status !== 'replaced' && <Button size="sm" variant="outline" onClick={() => requestConfirmation(l)} disabled={confirmationActions.request.isPending}>Gerar link</Button>}
                        {l.participation_status !== 'replaced' && <Button size="sm" variant="outline" onClick={() => openReplacement(l)}>Substituir fiscal</Button>}
                      </div>
                    </div>
                  ))}
                  {confirmationRows.length === 0 && <p className="p-4 text-muted-foreground">Nenhum vínculo corresponde aos filtros.</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      Histórico de confirmações
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Registro permanente de confirmações, recusas e substituições.
                    </p>
                  </div>

                  <Badge variant="secondary">
                    {confirmationHistory.length} registro(s)
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="max-h-[30rem] divide-y overflow-y-auto">
                  {confirmationHistory.map((history: any) => {
                    const name =
                      history.collaborator_name_snapshot ||
                      history.actor_name ||
                      'Fiscal removido';

                    const roleValue =
                      history.role_name_snapshot || '';

                    const roleLabel =
                      roles.find(
                        (role: any) =>
                          role.value === roleValue
                      )?.name ||
                      roleValue ||
                      'Cargo não informado';

                    const replacementName =
                      history.replacement_collaborator_name_snapshot ||
                      links.find(
                        (link: any) =>
                          link.id ===
                          history.replacement_event_collaborator_id
                      )?.collaborator_name ||
                      null;

                    return (
                      <div
                        key={history.id}
                        className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">
                              {name}
                            </p>

                            <Badge
                              variant={
                                history.new_status === 'confirmed'
                                  ? 'default'
                                  : history.new_status === 'declined'
                                    ? 'destructive'
                                    : history.new_status === 'replaced'
                                      ? 'secondary'
                                      : 'outline'
                              }
                            >
                              {getPsConfirmationStatusLabel(
                                history.new_status
                              )}
                            </Badge>
                          </div>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {[
                              roleLabel,
                              history.campus_snapshot,
                              history.unit_snapshot,
                              history.building_snapshot,
                              history.floor_snapshot &&
                                `Andar ${history.floor_snapshot}`,
                              history.room_snapshot &&
                                `Sala ${history.room_snapshot}`,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>

                          {history.previous_status && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {getPsConfirmationStatusLabel(
                                history.previous_status
                              )}
                              {' → '}
                              {getPsConfirmationStatusLabel(
                                history.new_status
                              )}
                            </p>
                          )}

                          {history.decline_reason && (
                            <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                              <p className="text-xs font-semibold text-destructive">
                                Motivo da recusa
                              </p>
                              <p className="mt-1 text-sm">
                                {history.decline_reason}
                              </p>
                            </div>
                          )}

                          {history.new_status === 'replaced' && (
                            <div className="mt-3 rounded-lg border bg-muted/30 p-3">
                              <p className="text-xs font-semibold">
                                Substituição
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {replacementName
                                  ? `Substituído por ${replacementName}`
                                  : 'Fiscal substituto registrado.'}
                              </p>
                            </div>
                          )}
                        </div>

                        <p className="shrink-0 text-xs text-muted-foreground">
                          {history.created_at
                            ? new Date(
                                history.created_at
                              ).toLocaleString('pt-BR')
                            : ''}
                        </p>
                      </div>
                    );
                  })}

                  {!confirmationHistory.length && (
                    <div className="p-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        Nenhum histórico de confirmação registrado ainda.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comunicacao" className="pt-4">
            <PsEventCommunicationTab event={event} links={links as any[]} />
          </TabsContent>

          <TabsContent value="presenca" className="space-y-4 pt-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Presentes</p>
                  <p className="mt-1 text-2xl font-bold">
                    {links.filter((l:any) => l.present && !l.absent).length}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Assinados</p>
                  <p className="mt-1 text-2xl font-bold">
                    {links.filter((l:any) => !!l.signed_at).length}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                  <p className="mt-1 text-2xl font-bold">
                    {links.filter((l:any) => !l.signed_at && !l.absent).length}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Ausentes</p>
                  <p className="mt-1 text-2xl font-bold">
                    {links.filter((l:any) => !!l.absent).length}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">
                  Fechamento por prédio / local
                </CardTitle>

                <p className="text-xs text-muted-foreground">
                  O fechamento é liberado somente quando não houver fiscais pendentes.
                </p>
              </CardHeader>

              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {attendanceLocations.map((location: any) => (
                    <div
                      key={location.key}
                      className="rounded-xl border p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">
                            {location.building}
                          </p>

                          {location.campus &&
                            location.campus !== location.building && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {location.campus}
                              </p>
                            )}
                        </div>

                        {location.closure ? (
                          <Badge>
                            Fechado
                          </Badge>
                        ) : location.pendingCount > 0 ? (
                          <Badge variant="outline">
                            {location.pendingCount} pendente(s)
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            Pronto para fechar
                          </Badge>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-muted/40 p-2">
                          <p className="text-lg font-bold">
                            {location.presentCount}
                          </p>
                          <p className="text-[10px] uppercase text-muted-foreground">
                            Presentes
                          </p>
                        </div>

                        <div className="rounded-lg bg-muted/40 p-2">
                          <p className="text-lg font-bold">
                            {location.absentCount}
                          </p>
                          <p className="text-[10px] uppercase text-muted-foreground">
                            Ausentes
                          </p>
                        </div>

                        <div className="rounded-lg bg-muted/40 p-2">
                          <p className="text-lg font-bold">
                            {location.pendingCount}
                          </p>
                          <p className="text-[10px] uppercase text-muted-foreground">
                            Pendentes
                          </p>
                        </div>
                      </div>

                      {location.closure ? (
                        <div className="mt-4 rounded-lg border bg-muted/20 p-3 text-xs">
                          <p className="font-medium">
                            Fechado por {location.closure.coordinator_name}
                          </p>

                          <p className="mt-1 text-muted-foreground">
                            {location.closure.signed_at
                              ? new Date(
                                  location.closure.signed_at
                                ).toLocaleString('pt-BR')
                              : ''}
                          </p>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          className="mt-4 w-full"
                          variant={
                            location.pendingCount === 0
                              ? 'default'
                              : 'outline'
                          }
                          disabled={
                            location.pendingCount > 0 ||
                            !closureCoordinatorCandidates.length
                          }
                          onClick={() =>
                            openClosureDialog(location)
                          }
                        >
                          Fechar prédio / local
                        </Button>
                      )}
                    </div>
                  ))}

                  {!attendanceLocations.length && (
                    <p className="text-sm text-muted-foreground">
                      Nenhum prédio/local identificado.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Controle de presença</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Acompanhe assinaturas, ausências e saídas em tempo real.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPresenceListOpen((open) => !open)}
                  >
                    {presenceListOpen
                      ? 'Ocultar fiscais'
                      : `Ver fiscais (${links.length})`}
                  </Button>

                  <Button asChild variant="outline">
                    <a
                      href={`${publicBase}/presenca/${event.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir coleta de assinaturas
                    </a>
                  </Button>
                </div>
              </CardHeader>

              {presenceListOpen && (
              <CardContent className="p-0">
                <div className="border-b p-4">
                  <Input
                    value={presenceSearch}
                    onChange={(event) => setPresenceSearch(event.target.value)}
                    placeholder="Buscar por nome, cargo, prédio, andar ou sala..."
                  />
                </div>

                <div className="max-h-[22rem] divide-y overflow-y-auto">
                  {presenceRows.map((l:any) => (
                      <div
                        key={l.id}
                        className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{l.collaborator_name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[
                              l.role_name || l.assigned_role,
                              l.building,
                              l.floor,
                              l.room && `Sala ${l.room}`
                            ].filter(Boolean).join(' · ') || 'Sem localização definida'}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {l.absent ? (
                            <Badge variant="destructive">Ausente</Badge>
                          ) : l.signed_at ? (
                            <Badge>Assinado</Badge>
                          ) : (
                            <Badge variant="outline">Pendente</Badge>
                          )}

                          {l.departed_at && (
                            <Badge variant="secondary">Saída registrada</Badge>
                          )}

                          <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                            <Label className="text-xs">Ausente</Label>
                            <Switch
                              checked={!!l.absent}
                              onCheckedChange={(value) => {
                                if (value) {
                                  openAbsenceDialog(l);
                                } else {
                                  void cancelAttendanceAbsence(l);
                                }
                              }}
                            />
                          </div>

                          {l.signed_at && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resetAttendanceSignature(l)}
                            >
                              Refazer assinatura
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!l.signed_at || l.absent}
                            onClick={() =>
                              setParticipantState(l, {
                                departed_at: l.departed_at
                                  ? null
                                  : new Date().toISOString()
                              })
                            }
                          >
                            {l.departed_at ? 'Cancelar saída' : 'Registrar saída'}
                          </Button>
                        </div>
                      </div>
                    ))}

                  {!presenceRows.length && (
                    <p className="p-6 text-center text-sm text-muted-foreground">
                      {presenceSearch
                        ? 'Nenhum fiscal encontrado.'
                        : 'Nenhum fiscal vinculado ao evento.'}
                    </p>
                  )}
                </div>
              </CardContent>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="avaliacoes" className="pt-4">
            <Card className="rounded-2xl">
              <CardContent className="divide-y p-0">
                {evaluations.map((e: any) => (
                  <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div>
                      <p className="font-medium">{e.collaborator_name}</p>
                      <p className="text-xs text-muted-foreground">{e.assigned_role || '-'} · por {e.evaluator_name || 'anônimo'}</p>
                      {e.observations && <p className="mt-1 text-sm text-muted-foreground">{e.observations}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{PS_CLASSIFICATION_LABEL[e.classification] || e.classification}</Badge>
                      <Badge>{Number(e.final_score).toFixed(2)}</Badge>
                    </div>
                  </div>
                ))}
                {evaluations.length === 0 && <p className="p-4 text-muted-foreground">Nenhuma avaliação registrada.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="auto" className="space-y-4 pt-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Respostas
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {selfEvaluationSummary.total}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Média geral
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {selfEvaluationSummary.average
                      ? selfEvaluationSummary.average.toFixed(1)
                      : '—'}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Ocorrências
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {selfEvaluationSummary.incidents}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Respostas com nota 1–2
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {selfEvaluationSummary.lowRatings}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl">
              <CardHeader>
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-base">
                    Autoavaliações recebidas
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Feedback enviado pelos fiscais deste evento.
                  </p>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-2 lg:grid-cols-3">
                  <Input
                    value={selfEvaluationSearch}
                    onChange={(event) =>
                      setSelfEvaluationSearch(event.target.value)
                    }
                    placeholder="Buscar por nome, cargo, Campus..."
                  />

                  <Select
                    value={selfEvaluationRole}
                    onValueChange={setSelfEvaluationRole}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Cargo" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="all">
                        Todos os cargos
                      </SelectItem>

                      {selfEvaluationRoleOptions.map((role: any) => (
                        <SelectItem key={role} value={role}>
                          {roles.find(
                            (item: any) => item.value === role
                          )?.name || role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={selfEvaluationCampus}
                    onValueChange={setSelfEvaluationCampus}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Campus" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="all">
                        Todos os Campus
                      </SelectItem>

                      {selfEvaluationCampusOptions.map(
                        (campus: any) => (
                          <SelectItem
                            key={campus}
                            value={campus}
                          >
                            {campus}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="max-h-[44rem] space-y-3 overflow-y-auto pr-1">
                  {selfEvaluationRows.map((e: any) => {
                    const roleLabel =
                      roles.find(
                        (role: any) => role.value === e.role
                      )?.name || e.role || 'Cargo não informado';

                    const ratingItems = [
                      {
                        label: 'Treinamento',
                        value: e.training_rating,
                        comment: e.training_comment,
                      },
                      {
                        label: 'Organização',
                        value: e.organization_rating,
                        comment: e.organization_comment,
                      },
                      {
                        label: 'Lanche / alimentação',
                        value: e.snack_rating,
                        comment: e.snack_comment,
                      },
                      {
                        label: 'Fiscal parceiro',
                        value: e.partner_fiscal_rating,
                        comment: e.partner_fiscal_comment,
                      },
                    ];

                    return (
                      <div
                        key={e.id}
                        className="rounded-xl border p-4"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">
                                {e.identified
                                  ? e.respondent_name ||
                                    'Identificado sem nome'
                                  : 'Resposta anônima'}
                              </p>

                              {!e.identified && (
                                <Badge variant="outline">
                                  Anônimo
                                </Badge>
                              )}

                              {e.had_incident && (
                                <Badge variant="destructive">
                                  Ocorrência
                                </Badge>
                              )}
                            </div>

                            <p className="mt-1 text-xs text-muted-foreground">
                              {[
                                roleLabel,
                                e.campus,
                                e.floor &&
                                  `${e.floor}º andar`,
                                e.room &&
                                  `Sala ${e.room}`,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>

                          <p className="shrink-0 text-xs text-muted-foreground">
                            {e.created_at
                              ? new Date(
                                  e.created_at
                                ).toLocaleString('pt-BR')
                              : ''}
                          </p>
                        </div>

                        <div className="mt-4 grid gap-2 md:grid-cols-2">
                          {ratingItems.map((item) => (
                            <div
                              key={item.label}
                              className="rounded-lg bg-muted/30 p-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-medium">
                                  {item.label}
                                </p>

                                {item.value ? (
                                  <Badge
                                    variant={
                                      Number(item.value) <= 2
                                        ? 'destructive'
                                        : Number(item.value) >= 4
                                          ? 'default'
                                          : 'secondary'
                                    }
                                  >
                                    ★ {item.value}/5
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">
                                    Não avaliado
                                  </Badge>
                                )}
                              </div>

                              {item.comment && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {item.comment}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>

                        {(e.had_incident ||
                          e.suggestions) && (
                          <div className="mt-3 space-y-2">
                            {e.had_incident && (
                              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                                <p className="text-xs font-semibold text-destructive">
                                  Ocorrência informada
                                </p>
                                <p className="mt-1 text-sm">
                                  {e.incident_comment ||
                                    'Sem descrição.'}
                                </p>
                              </div>
                            )}

                            {e.suggestions && (
                              <div className="rounded-lg border p-3">
                                <p className="text-xs font-semibold">
                                  Sugestão de melhoria
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {e.suggestions}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {!selfEvaluationRows.length && (
                    <div className="rounded-xl border border-dashed p-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        {selfEvaluations.length
                          ? 'Nenhuma autoavaliação corresponde aos filtros.'
                          : 'Nenhuma autoavaliação recebida neste evento.'}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="candidatos" className="space-y-3 pt-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <label className="cursor-pointer"><Upload className="mr-2 h-4 w-4" />Importar candidatos
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCandidates(e.target.files[0])} />
                </label>
              </Button>
              <Button variant="outline" onClick={exportCandidateBadges} disabled={candidates.length === 0}>
                <IdCard className="mr-2 h-4 w-4" />Etiquetas
              </Button>
              {candidates.length > 0 && (
                <Button variant="outline" onClick={() => { if (confirm('Remover todos os candidatos do evento?')) removeAll.mutate(id!); }}>
                  <Trash2 className="mr-2 h-4 w-4" />Limpar lista
                </Button>
              )}
            </div>
            <Card className="rounded-2xl">
              <CardContent className="divide-y p-0">
                {candidates.map((c: any) => (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <div>
                      <p className="font-medium">{c.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[c.campus, c.room && `Sala ${c.room}`, c.seat_number && `Carteira ${c.seat_number}`, c.seat && `Carteira ${c.seat}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {c.pcd_type && c.pcd_type !== 'NORMAL' && <Badge variant="secondary">{c.pcd_type}</Badge>}
                  </div>
                ))}
                {candidates.length === 0 && <p className="p-4 text-muted-foreground">Nenhum candidato disponível para geração de etiquetas.</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Fechamento de presença por prédio */}
      <Dialog
        open={!!closureTarget}
        onOpenChange={(open) => {
          if (!open) closeClosureDialog();
        }}
      >
        <DialogContent
          className="max-w-xl"
          onInteractOutside={(event) => {
            if (closureSaving) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              Fechar presença do prédio / local
            </DialogTitle>
          </DialogHeader>

          {closureTarget && (
            <div className="space-y-5">
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-lg font-semibold">
                  {closureTarget.building}
                </p>

                {closureTarget.campus &&
                  closureTarget.campus !==
                    closureTarget.building && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {closureTarget.campus}
                    </p>
                  )}

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="font-bold">
                      {closureTarget.presentCount}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Presentes
                    </p>
                  </div>

                  <div>
                    <p className="font-bold">
                      {closureTarget.absentCount}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ausentes
                    </p>
                  </div>

                  <div>
                    <p className="font-bold">
                      {closureTarget.pendingCount}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Pendentes
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Coordenador responsável *</Label>

                <Select
                  value={closureCoordinatorId}
                  onValueChange={setClosureCoordinatorId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o coordenador" />
                  </SelectTrigger>

                  <SelectContent>
                    {closureCoordinatorCandidates.map(
                      (coordinator: any) => (
                        <SelectItem
                          key={coordinator.id}
                          value={coordinator.id}
                        >
                          {coordinator.collaborator_name}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>

                {!closureCoordinatorCandidates.length && (
                  <p className="text-xs text-destructive">
                    Nenhum Coordenador disponível neste evento.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Ao assinar, o coordenador confirma que todos os fiscais deste prédio/local foram conferidos como presentes ou ausentes.
              </div>

              <div className="space-y-2">
                <Label>Assinatura do Coordenador *</Label>

                <SignaturePad
                  onSignatureChange={setClosureSignature}
                  height={180}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={closureSaving}
              onClick={closeClosureDialog}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              disabled={
                closureSaving ||
                !closureCoordinatorId ||
                !closureSignature
              }
              onClick={submitAttendanceClosure}
            >
              {closureSaving
                ? 'Fechando...'
                : 'Confirmar fechamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vincular fiscais */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>Vincular fiscais</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Função *</Label>
              <Select value={roleValue} onValueChange={setRoleValue}>
                <SelectTrigger><SelectValue placeholder="Selecione a função" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r: any) => <SelectItem key={r.id} value={r.value}>{r.name} — R$ {Number(r.pay_value).toFixed(2)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Input
                value={searchFiscal}
                onChange={(e) => setSearchFiscal(e.target.value)}
                placeholder="Buscar fiscal..."
              />
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">
              {visibleCollaborators.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">Nenhum fiscal encontrado.</p>
              ) : visibleCollaborators.map((c: any) => (
                <Button
                  key={c.id}
                  type="button"
                  variant={selected.includes(c.id) ? 'default' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setSelected(selected.includes(c.id) ? selected.filter((x) => x !== c.id) : [...selected, c.id])}
                >
                  {c.full_name}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={linkFiscals} disabled={!selected.length || !roleValue}>Vincular {selected.length || ''}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Avaliar */}

      <Dialog open={!!replacementTarget} onOpenChange={(open) => !open && setReplacementTarget(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>Substituir {replacementTarget?.collaborator_name}</DialogTitle></DialogHeader>
          {replacementData && <div className="space-y-3">
            <div><Label>Novo fiscal ativo</Label><Select value={replacementFiscalId} onValueChange={setReplacementFiscalId}><SelectTrigger><SelectValue placeholder="Buscar por nome, e-mail, instituição ou setor" /></SelectTrigger><SelectContent>
              {replacementCandidates.map((candidate: any) => <SelectItem key={candidate.id} value={candidate.id}>{candidate.full_name} · {[candidate.email, candidate.institution, candidate.sector].filter(Boolean).join(' · ')}</SelectItem>)}
            </SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Cargo</Label><Input value={replacementData.role_name || ''} onChange={(e) => setReplacementData({ ...replacementData, role_name: e.target.value })} /></div><div><Label>Horário</Label><Input value={replacementData.work_schedule || ''} onChange={(e) => setReplacementData({ ...replacementData, work_schedule: e.target.value })} /></div></div>
            <div className="grid grid-cols-3 gap-3"><div><Label>Unidade</Label><Input value={replacementData.unit || ''} onChange={(e) => setReplacementData({ ...replacementData, unit: e.target.value })} /></div><div><Label>Andar</Label><Input value={replacementData.floor || ''} onChange={(e) => setReplacementData({ ...replacementData, floor: e.target.value })} /></div><div><Label>Sala</Label><Input value={replacementData.room || ''} onChange={(e) => setReplacementData({ ...replacementData, room: e.target.value })} /></div></div>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setReplacementTarget(null)}>Cancelar</Button><Button onClick={submitReplacement} disabled={!replacementFiscalId || confirmationActions.replace.isPending}>Confirmar substituição</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!evalTarget} onOpenChange={(o) => !o && setEvalTarget(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>Avaliar {evalTarget?.collaborator_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <PsCriteriaFields values={criteria} onChange={setCriteria} />
            <div><Label>Comentários</Label><Textarea value={comments} onChange={(e) => setComments(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEvalTarget(null)}>Cancelar</Button>
            <Button onClick={submitEvaluation} disabled={saveEval.isPending}>Salvar avaliação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Importar planilha da equipe */}
      <PsEventTeamImportDialog eventId={id!} open={importOpen} onOpenChange={setImportOpen} />

      {/* Registro formal de ausência */}
      <Dialog
        open={!!absenceTarget}
        onOpenChange={(open) => {
          if (!open && !absenceSaving) {
            closeAbsenceDialog();
          }
        }}
      >
        <DialogContent
          className="max-w-2xl"
          onInteractOutside={(event) => {
            if (absenceSaving) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Registrar ausência</DialogTitle>
          </DialogHeader>

          {absenceTarget && (
            <div className="space-y-5">
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="font-semibold">
                  {absenceTarget.collaborator_name}
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  {[
                    absenceTarget.role_name ||
                      absenceTarget.assigned_role ||
                      absenceTarget.role_value,
                    absenceTarget.building,
                    absenceTarget.floor &&
                      `${absenceTarget.floor}º`,
                    absenceTarget.room &&
                      `Sala ${absenceTarget.room}`,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Sem localização definida'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Responsável pelo registro *</Label>

                <Select
                  value={absenceResponsibleId}
                  onValueChange={setAbsenceResponsibleId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione coordenador ou subcoordenador" />
                  </SelectTrigger>

                  <SelectContent>
                    {absenceResponsibleCandidates.map((responsible: any) => (
                      <SelectItem
                        key={responsible.id}
                        value={responsible.id}
                      >
                        {responsible.collaborator_name} ·{' '}
                        {responsible.role_name ||
                          responsible.assigned_role ||
                          'Coordenação'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {!absenceResponsibleCandidates.length && (
                  <p className="text-xs text-destructive">
                    Nenhum coordenador ou subcoordenador disponível neste evento.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Motivo / observação *</Label>

                <Textarea
                  value={absenceReason}
                  onChange={(event) =>
                    setAbsenceReason(event.target.value)
                  }
                  placeholder="Ex.: não compareceu ao evento, informou indisponibilidade..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Assinatura do responsável *</Label>

                <SignaturePad
                  onSignatureChange={setAbsenceSignature}
                  height={180}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={absenceSaving}
              onClick={closeAbsenceDialog}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              disabled={
                absenceSaving ||
                !absenceResponsibleId ||
                !absenceReason.trim() ||
                !absenceSignature
              }
              onClick={submitAttendanceAbsence}
            >
              {absenceSaving
                ? 'Registrando ausência...'
                : 'Confirmar ausência'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar item importado */}
      <Dialog open={!!editLink} onOpenChange={(o) => !o && setEditLink(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>Editar dados no evento</DialogTitle></DialogHeader>
          {editLink && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={editLink.collaborator_name || ''} onChange={(e) => setEditLink({ ...editLink, collaborator_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Função</Label><Input value={editLink.role_name || ''} onChange={(e) => setEditLink({ ...editLink, role_name: e.target.value })} /></div>
                <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={editLink.pay_value ?? 0} onChange={(e) => setEditLink({ ...editLink, pay_value: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Prédio</Label><Input value={editLink.building || ''} onChange={(e) => setEditLink({ ...editLink, building: e.target.value })} /></div>
                <div><Label>Andar</Label><Input value={editLink.floor || ''} onChange={(e) => setEditLink({ ...editLink, floor: e.target.value })} /></div>
                <div><Label>Sala</Label><Input value={editLink.room || ''} onChange={(e) => setEditLink({ ...editLink, room: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Setor</Label><Input value={editLink.sector || ''} onChange={(e) => setEditLink({ ...editLink, sector: e.target.value })} /></div>
                <div><Label>Unidade</Label><Input value={editLink.unit || ''} onChange={(e) => setEditLink({ ...editLink, unit: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>E-mail</Label><Input value={editLink.email || ''} onChange={(e) => setEditLink({ ...editLink, email: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={editLink.phone || ''} onChange={(e) => setEditLink({ ...editLink, phone: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>PIX</Label><Input value={editLink.pix || ''} onChange={(e) => setEditLink({ ...editLink, pix: e.target.value })} /></div>
                <div><Label>Depósito</Label><Input value={editLink.deposit_info || ''} onChange={(e) => setEditLink({ ...editLink, deposit_info: e.target.value })} /></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLink(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                update.mutate({
                  id: editLink.id,
                  collaborator_name: editLink.collaborator_name,
                  role_name: editLink.role_name,
                  pay_value: Number(editLink.pay_value) || 0,
                  building: editLink.building || null,
                  floor: editLink.floor || null,
                  room: editLink.room || null,
                  sector: editLink.sector || null,
                  unit: editLink.unit || null,
                  email: editLink.email || null,
                  phone: editLink.phone || null,
                  pix: editLink.pix || null,
                  deposit_info: editLink.deposit_info || null,
                });
                setEditLink(null);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
