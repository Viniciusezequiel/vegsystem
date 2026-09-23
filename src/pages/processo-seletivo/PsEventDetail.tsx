import { normalizePix, preparePixPlan, persistPixPlan } from '@/lib/psPixPlan';
import { useEffect, useMemo, useState } from 'react';
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
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PsCriteriaFields, emptyCriteria } from '@/components/processo-seletivo/PsCriteriaFields';
import { PsEventTeamImportDialog } from '@/components/processo-seletivo/PsEventTeamImportDialog';
import { PsEventCommunicationTab } from '@/components/processo-seletivo/PsEventCommunicationTab';
import { PsEventCollaboratorEditDialog } from '@/components/processo-seletivo/PsEventCollaboratorEditDialog';
import { PsEventWorkspaceNav } from '@/components/processo-seletivo/PsEventWorkspaceNav';
import { PsEventTrainingTab } from '@/components/processo-seletivo/PsEventTrainingTab';
import { PsEventPaymentsPanel } from '@/components/processo-seletivo/PsEventPaymentsPanel';
import { PsEventLabelsDialog, type LabelExportFormat, type LocationFilters } from '@/components/processo-seletivo/PsEventLabelsDialog';
import { SignaturePad } from '@/components/ui/SignaturePad';
import {
  usePsEvent, usePsEventMutations, usePsEventCollaborators, usePsEventCollaboratorMutations,
  usePsCollaborators, usePsRoles, usePsEvaluations, usePsSaveEvaluation, usePsCandidates,
  usePsCandidateMutations, usePsSelfEvaluations, usePsClearEventTeam, usePsConfirmationActions,
  usePsEventCommunications,
} from '@/hooks/useProcessoSeletivo';
import { getPsConfirmationStatusLabel, replacementAssignment } from '@/lib/psConfirmationState.mjs';
import { buildPsConfirmationNotice, getPsContactPhone } from '@/lib/psConfirmationNotice.mjs';
import { useAuth } from '@/contexts/AuthContext';
import { PS_EVENT_STATUS, PS_CLASSIFICATION_LABEL, PS_PCD_OPTIONS } from '@/lib/psConstants';
import { Plus, Trash2, Copy, Download, CheckCircle2, Upload, Star, Pencil, IdCard, FileSignature, ShieldCheck, Phone, Check, ChevronsUpDown, AlertTriangle } from 'lucide-react';
import { generatePsBadgesPdf, generatePsCandidateBadgesPdf, generatePsAttendancePdfAsync, generatePsConfirmationReportPdf } from '@/lib/psEventPdf';
import { psPresencePatch } from '@/lib/psFiscalFoundation';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import {
  uploadSignatureValue,
  cleanupUploadedSignatureIfUnreferenced,
} from '@/lib/signatureStorage';
import { buildManualEventCollaboratorRow } from '@/lib/psManualEventCollaboratorSnapshot.mjs';
import { getPsAttendanceLocation, normalizePsLocation } from '@/lib/psLocationNormalization.mjs';
import {
  downloadPsCandidateTemplate,
  readPsCandidateSpreadsheet,
} from '@/lib/psCandidateSpreadsheet';

export default function PsEventDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { data: event } = usePsEvent(id);
  const { finalize, save } = usePsEventMutations();
  const { data: allLinks = [] } = usePsEventCollaborators(id);
  const { add, update, updateState, remove, reinclude } = usePsEventCollaboratorMutations(id);
  const { data: collaborators = [] } = usePsCollaborators();
  const { data: roles = [] } = usePsRoles();
  const { data: evaluations = [] } = usePsEvaluations(id);
  const { data: selfEvaluations = [] } = usePsSelfEvaluations(id);
  const saveEval = usePsSaveEvaluation();
  const { data: candidates = [] } = usePsCandidates(id);
  const { addMany, removeAll } = usePsCandidateMutations();
  const { profile } = useAuth();
  const clearTeam = usePsClearEventTeam();
  const confirmationActions = usePsConfirmationActions(id);
  const { data: eventCommunications = [] } = usePsEventCommunications(id);

  const [addOpen, setAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('visao-geral');
  const [importOpen, setImportOpen] = useState(false);
  const [editLink, setEditLink] = useState<any>(null);
  const [searchFiscal, setSearchFiscal] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [roleValue, setRoleValue] = useState('');
  const [campusValue, setCampusValue] = useState('');
  const [pixOverrideById, setPixOverrideById] = useState<Record<string, string>>({});
  const [evalTarget, setEvalTarget] = useState<any>(null);
  const [criteria, setCriteria] = useState(emptyCriteria());
  const [comments, setComments] = useState('');
  const [replacementTarget, setReplacementTarget] = useState<any>(null);
  const [replacementFiscalId, setReplacementFiscalId] = useState('');
  const [replacementPickerOpen, setReplacementPickerOpen] = useState(false);
  const [replacementData, setReplacementData] = useState<any>(null);
  const [presenceSearch, setPresenceSearch] = useState('');
  const [presenceListOpen, setPresenceListOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);

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

  const collaboratorById = useMemo(
    () => new Map(collaborators.map((collaborator: any) => [collaborator.id, collaborator])),
    [collaborators]
  );
  const inactiveEventLinks = useMemo(
    () => allLinks.filter((link: any) => collaboratorById.get(link.collaborator_id)?.active === false),
    [allLinks, collaboratorById]
  );
  const links = useMemo(
    () => allLinks.filter((link: any) => collaboratorById.get(link.collaborator_id)?.active !== false && !link.manually_excluded),
    [allLinks, collaboratorById]
  );
  const excludedEventLinks = useMemo(
    () => allLinks.filter((link: any) => link.manually_excluded),
    [allLinks, collaboratorById]
  );
  const confirmationSummary = useMemo(
    () => links.reduce((summary: Record<string, number>, link: any) => {
      const key = link.participation_status || 'pending_confirmation';
      summary[key] = (summary[key] || 0) + 1;
      return summary;
    }, {}),
    [links]
  );

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

  const { data: sameDayAssignments = [] } = useQuery({
    queryKey: ['ps-fiscal-same-day-conflicts', event?.date, id],
    enabled: !!event?.date && !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ps_event_collaborators')
        .select('collaborator_id,event_id,participation_status,ps_events!inner(id,name,date,status)')
        .neq('event_id', id!)
        .eq('ps_events.date', event!.date)
        .in('participation_status', ['pending_confirmation', 'confirmed']);
      if (error) throw error;
      return data || [];
    },
  });

  const teamRows = useMemo(() => {
    const query = teamSearch.trim().toLocaleLowerCase('pt-BR');
    if (!query) return links;

    return links.filter((link: any) =>
      [
        link.collaborator_name,
        link.email,
        link.role_name,
        link.assigned_role,
        link.campus,
        link.unit,
        link.building,
        link.floor,
        link.room,
        link.sector,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(query)
    );
  }, [links, teamSearch]);

  const replacementNeededLinks = useMemo(
    () =>
      links
        .filter((link: any) => link.participation_status === 'declined')
        .sort((a: any, b: any) =>
          String(a.collaborator_name || '').localeCompare(
            String(b.collaborator_name || ''),
            'pt-BR'
          )
        ),
    [links]
  );

  const operationalLinks = useMemo(
    () =>
      links.filter((link: any) =>
        ['pending_confirmation', 'confirmed'].includes(
          link.participation_status
        )
      ),
    [links]
  );

  const presenceRows = useMemo(() => {
    const query = presenceSearch.trim().toLowerCase();

    return [...operationalLinks]
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
  }, [operationalLinks, presenceSearch]);

  const attendanceLocations = useMemo(() => {
    const locations = new Map<string, any>();

    for (const link of operationalLinks as any[]) {
      const { key, campus, campusLabel, building } = getPsAttendanceLocation(link);

      if (!locations.has(key)) {
        locations.set(key, {
          key,
          campus,
          campusLabel,
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

        const closure = attendanceClosures.find((item: any) =>
          getPsAttendanceLocation(item).key === location.key
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
  }, [operationalLinks, attendanceClosures]);


  const closureCoordinatorCandidates = useMemo(() => {
    return operationalLinks
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
  }, [operationalLinks]);

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
    return operationalLinks
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
  }, [operationalLinks, absenceTarget?.id]);

  const replacementCandidates = useMemo(() => {
    const currentIds = new Set(allLinks.map((link: any) => link.collaborator_id));
    const sameDayByCollaborator = new Map<string, any>();
    for (const item of sameDayAssignments as any[]) {
      if (item.collaborator_id && !sameDayByCollaborator.has(item.collaborator_id)) {
        sameDayByCollaborator.set(item.collaborator_id, item);
      }
    }

    const normalize = (value: unknown) => String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    const targetRole = normalize(replacementTarget?.role_name || replacementTarget?.assigned_role || replacementTarget?.role_value);
    const targetUnit = normalize(replacementTarget?.unit);
    const targetBuilding = normalize(replacementTarget?.building);
    const targetSchedule = normalize(replacementTarget?.work_schedule);

    return collaborators
      .filter((candidate: any) =>
        candidate.active &&
        !currentIds.has(candidate.id)
      )
      .map((candidate: any) => {
        const roles = [
          candidate.preferred_role,
          candidate.role,
          candidate.position,
        ].map(normalize).filter(Boolean);
        const candidateUnit = normalize(candidate.unit);
        const candidateInstitution = normalize(candidate.institution);
        const conflict = sameDayByCollaborator.get(candidate.id);
        let score = 0;
        const reasons: string[] = [];

        if (targetRole && roles.some((role: string) => role === targetRole || role.includes(targetRole) || targetRole.includes(role))) {
          score += 50;
          reasons.push('função compatível');
        } else if (targetRole && roles.some((role: string) => role.includes(targetRole.split(' ')[0]) || targetRole.includes(role.split(' ')[0]))) {
          score += 25;
          reasons.push('função próxima');
        }

        if (targetUnit && candidateUnit === targetUnit) {
          score += 15;
          reasons.push('mesma unidade');
        }

        if (targetBuilding && candidateInstitution && candidateInstitution.includes(targetBuilding)) {
          score += 5;
          reasons.push('instituição compatível');
        }

        const rating = Number(candidate.average_rating || 0);
        if (rating > 0) {
          score += Math.min(20, rating * 4);
          reasons.push('avaliação ' + rating.toFixed(2));
        }

        const events = Number(candidate.total_events || 0);
        if (events > 0) {
          score += Math.min(10, events / 5);
          reasons.push(events + ' atuações');
        }

        if (targetSchedule && normalize(candidate.journey) === targetSchedule) {
          score += 5;
          reasons.push('jornada compatível');
        }

        return {
          ...candidate,
          replacementScore: Math.min(100, Math.round(score)),
          replacementReasons: reasons,
          sameDayConflict: conflict || null,
        };
      })
      .sort((a: any, b: any) =>
        Number(!!a.sameDayConflict) - Number(!!b.sameDayConflict) ||
        b.replacementScore - a.replacementScore ||
        Number(b.average_rating || 0) - Number(a.average_rating || 0) ||
        String(a.full_name || '').localeCompare(String(b.full_name || ''), 'pt-BR')
      );
  }, [collaborators, links, replacementTarget, sameDayAssignments]);

  const requestConfirmation = async (link: any) => {
    try {
      const result = await confirmationActions.request.mutateAsync({
        linkId: link.id,
        // Ao solicitar manualmente o link, sempre rotacionamos o token.
        // Isso também funciona quando o hash ativo não é exposto na consulta da lista.
        rotate: true,
      });
      copy(`${publicBase}/confirmacao/${id}/${result.token}`);
    } catch { /* mutation already reports a safe error */ }
  };

  const getFilteredConfirmationReportData = (
    sourceRows: any[],
    activeFilters: string[] = [],
  ) => {
    if (!event || !sourceRows.length) return null;
    const latestEmailByLink = new Map<string, any>();
    for (const job of eventCommunications as any[]) {
      if (job.communication_type !== 'confirmation_request') continue;
      const linkId = String(job.event_collaborator_id || '');
      if (linkId && !latestEmailByLink.has(linkId)) latestEmailByLink.set(linkId, job);
    }
    const errorDelivery = new Set(['soft_bounce', 'hard_bounce', 'blocked', 'spam', 'invalid', 'error', 'unsubscribed']);
    const deliveryLabels: Record<string, string> = {
      sent: 'Enviado', delivered: 'Entregue', opened: 'Aberto', clicked: 'Clicou no link',
      soft_bounce: 'Erro temporário', hard_bounce: 'E-mail rejeitado', blocked: 'Bloqueado',
      spam: 'Marcado como spam', invalid: 'E-mail inválido', error: 'Erro no envio', unsubscribed: 'Descadastrado',
    };
    const rows = sourceRows.map((link: any) => {
      const job = latestEmailByLink.get(String(link.id));
      const delivery = String(job?.delivery_status || '');
      let emailStatus = 'Não enviado';
      if (job?.status === 'failed_missing_recipient') emailStatus = 'Sem e-mail';
      else if (job?.status === 'failed' || errorDelivery.has(delivery)) emailStatus = deliveryLabels[delivery] || 'Erro no envio';
      else if (['pending', 'waiting_provider_quota', 'processing'].includes(job?.status)) emailStatus = 'Na fila';
      else if (deliveryLabels[delivery]) emailStatus = deliveryLabels[delivery];
      else if (job?.status === 'sent') emailStatus = 'Enviado';
      const emailDate = job?.opened_at || job?.clicked_at || job?.delivered_at || job?.sent_at || job?.provider_last_event_at || job?.requested_at;
      const confirmationDate = link.confirmed_at || link.declined_at || link.confirmation_requested_at;
      return {
        ...link,
        phone: getPsContactPhone(link),
        participation_status_label: getPsConfirmationStatusLabel(link.participation_status),
        confirmation_date: confirmationDate ? new Date(confirmationDate).toLocaleString('pt-BR') : null,
        email_status_label: emailStatus,
        email_status_date: emailDate ? new Date(emailDate).toLocaleString('pt-BR') : null,
        email_recipient: job?.actual_recipient || job?.logical_recipient || link.email || null,
        email_error: job?.last_error || null,
      };
    });
    const filters = activeFilters;
    const reportEvent = {
      name: event.name,
      date: event.date ? new Date(`${event.date}T00:00:00`).toLocaleDateString('pt-BR') : null,
      location: event.location,
    };
    return { rows, filters, reportEvent };
  };

  const exportFilteredConfirmationsPdf = (rows: any[], filters: string[] = []) => {
    const report = getFilteredConfirmationReportData(rows, filters);
    if (!report) return;
    generatePsConfirmationReportPdf(report.reportEvent, report.rows, report.filters)
      .save(`confirmacoes-${String(report.reportEvent.name || 'evento').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
    toast.success(`PDF gerado com ${report.rows.length} pessoa(s) filtrada(s).`);
  };

  const exportFilteredConfirmationsExcel = (sourceRows: any[], filters: string[] = []) => {
    const report = getFilteredConfirmationReportData(sourceRows, filters);
    if (!report) return;
    const rows = report.rows.map((row: any) => ({
      'Nome': row.collaborator_name || '',
      'Status da confirmação': row.participation_status_label || '',
      'Data da confirmação/status': row.confirmation_date || '',
      'Motivo da recusa': row.decline_reason || '',
      'Cargo': row.role_name || row.assigned_role || '',
      'Horário': row.work_schedule || '',
      'Campus': row.campus || '',
      'Unidade': row.unit || '',
      'Instituição': row.institution || '',
      'Prédio': row.building || '',
      'Andar': row.floor || '',
      'Sala': row.room || '',
      'Setor': row.sector || '',
      'E-mail cadastrado': row.email || '',
      'Celular': row.phone || '',
      'Status do e-mail': row.email_status_label || '',
      'Data do status do e-mail': row.email_status_date || '',
      'Destinatário do envio': row.email_recipient || '',
      'Erro do e-mail': row.email_error || '',
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!autofilter'] = { ref: worksheet['!ref'] || `A1:S${rows.length + 1}` };
    worksheet['!cols'] = [
      { wch: 34 }, { wch: 22 }, { wch: 23 }, { wch: 34 }, { wch: 28 }, { wch: 18 },
      { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 12 },
      { wch: 24 }, { wch: 34 }, { wch: 18 }, { wch: 22 }, { wch: 23 }, { wch: 34 }, { wch: 38 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Confirmações filtradas');
    XLSX.writeFile(workbook, `confirmacoes-${String(report.reportEvent.name || 'evento').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.xlsx`);
    toast.success(`Excel gerado com ${rows.length} pessoa(s) filtrada(s).`);
  };

  const copyText = async (value: string) => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return;
      } catch {
        // Safari/iOS pode negar Clipboard API mesmo em HTTPS; usa fallback abaixo.
      }
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!copied) throw new Error('clipboard_unavailable');
  };

  const copyConfirmationMessage = async (link: any) => {
    try {
      const result = await confirmationActions.request.mutateAsync({
        linkId: link.id,
        // Mensagem + link também precisa rotacionar o token quando já existe um ativo.
        // Os links não expiram mais, então não podemos usar expires_at para decidir isso.
        rotate: true,
      });
      const confirmationUrl = `${publicBase}/confirmacao/${id}/${result.token}`;
      const notice = buildPsConfirmationNotice({
        collaboratorName: link.collaborator_name || 'fiscal',
        eventName: event?.name || 'processo seletivo',
        eventDate: event?.date ? new Date(`${event.date}T00:00:00`).toLocaleDateString('pt-BR') : undefined,
        confirmationUrl,
        expiresAt: result.expires_at ? new Date(result.expires_at).toLocaleString('pt-BR') : undefined,
      });
      await copyText(notice.text);
      toast.success(`Mensagem de ${link.collaborator_name} copiada!`);
    } catch { /* mutation already reports a safe error */ }
  };

  const copyPhone = async (link: any) => {
    const phone = getPsContactPhone(link);
    if (!phone) return;
    await copyText(phone);
    toast.success('Celular copiado!');
  };

  const openReplacement = (link: any) => {
    const bestAvailable = replacementCandidates.find((candidate: any) => !candidate.sameDayConflict);
    setReplacementTarget(link);
    setReplacementFiscalId(bestAvailable?.id || '');
    setReplacementPickerOpen(false);
    setReplacementData(replacementAssignment(link));
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
    void copyText(url).then(() => toast.success('Link copiado!')).catch(() => toast.error('Não foi possível copiar o link.'));
  };

  const rolePay = (slug?: string | null) => {
    const r: any = roles.find((x: any) => x.value === slug);
    if (!r) return 0;
    const combined = (r.combined_roles || []).reduce(
      (acc: number, s: string) => acc + Number((roles.find((x: any) => x.value === s) as any)?.pay_value || 0), 0);
    return Number(r.pay_value || 0) + combined;
  };

  const totalCost = links.filter((l: any) => !l.absent).reduce((acc: number, l: any) => acc + rolePay(l.role_value), 0);
  const eventCampusOptions = useMemo(() => {
    const values = [
      ...links.map((link: any) => link.campus),
      ...candidates.map((candidate: any) => candidate.campus),
    ]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean);

    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [links, candidates]);

  useEffect(() => {
    if (!addOpen || campusValue.trim() || eventCampusOptions.length !== 1) return;
    setCampusValue(eventCampusOptions[0]);
  }, [addOpen, campusValue, eventCampusOptions]);

  const sameDayCollaboratorIds = useMemo(
    () => new Set((sameDayAssignments || []).map((item: any) => item.collaborator_id).filter(Boolean)),
    [sameDayAssignments]
  );

  const visibleCollaborators = useMemo(() => {
    const q = searchFiscal.trim().toLowerCase();
    const selectedRole: any = roles.find((role: any) => role.value === roleValue);
    const normalize = (value: unknown) => String(value ?? '')
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .trim()
      .toLowerCase();
    const targetRole = normalize(selectedRole?.name || roleValue);

    return collaborators
      .filter((c: any) =>
        c.active &&
        !links.some((l: any) => l.collaborator_id === c.id) &&
        !sameDayCollaboratorIds.has(c.id)
      )
      .filter((c: any) =>
        !q ||
        [c.full_name, c.email, c.matricula, c.institution, c.unit, c.role, c.position, c.preferred_role]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
      .map((c: any) => {
        const preferredRole = normalize(c.preferred_role);
        const rolesText = [c.preferred_role, c.role, c.position].map(normalize).filter(Boolean);
        const exactRole = !!targetRole && rolesText.some((role: string) =>
          role === targetRole
        );
        const partialRole = !!targetRole && rolesText.some((role: string) =>
          role.includes(targetRole) || targetRole.includes(role)
        );
        const reasons: string[] = [];
        let score = 0;

        if (exactRole) {
          score += 70;
          reasons.push('função exata');
        } else if (partialRole) {
          score += 45;
          reasons.push('função próxima');
        }

        if (preferredRole && targetRole && preferredRole === targetRole) {
          score += 10;
          reasons.push('preferência cadastrada');
        }

        const targetUnit = normalize(campusValue);
        const candidateUnit = normalize(c.unit);
        if (targetUnit && candidateUnit && candidateUnit === targetUnit) {
          score += 8;
          reasons.push('mesma unidade');
        }

        const targetJourney = normalize((selectedRole as any)?.journey || (selectedRole as any)?.work_schedule);
        const candidateJourney = normalize(c.journey);
        if (targetJourney && candidateJourney && candidateJourney === targetJourney) {
          score += 5;
          reasons.push('jornada compatível');
        }

        const rating = Number(c.average_rating || 0);
        if (rating > 0) {
          score += Math.min(7, rating * 1.4);
          reasons.push(`avaliação ${rating.toFixed(1)}`);
        }

        return {
          ...c,
          roleCompatible: exactRole || partialRole,
          compatibilityScore: Math.min(100, Math.round(score)),
          compatibilityReasons: reasons,
        };
      })
      .sort((a: any, b: any) =>
        b.compatibilityScore - a.compatibilityScore ||
        Number(b.roleCompatible) - Number(a.roleCompatible) ||
        String(a.full_name || '').localeCompare(String(b.full_name || ''), 'pt-BR')
      );
  }, [collaborators, links, searchFiscal, sameDayCollaboratorIds, roles, roleValue]);

  const linkFiscals = async () => {
    if (!selected.length || !roleValue || !campusValue.trim()) return;

    const { data: activeSelected, error: activeSelectedError } = await supabase
      .from('ps_collaborators')
      .select('*')
      .in('id', selected)
      .eq('active', true);
    if (activeSelectedError) {
      toast.error('Não foi possível validar os fiscais selecionados. Tente novamente.');
      return;
    }
    const activeById = new Map((activeSelected || []).map((item: any) => [item.id, item]));
    const selectedCollaborators = selected.map((cid) => activeById.get(cid)).filter(Boolean) as any[];

    if (selectedCollaborators.length !== selected.length) {
      setSelected(selected.filter((cid) => activeById.has(cid)));
      void queryClient.invalidateQueries({ queryKey: ['ps_collaborators'] });
      toast.error('Um ou mais fiscais foram inativados e não podem ser vinculados ao evento.');
      return;
    }
    let pixPlan;
    try {
      pixPlan = preparePixPlan(selectedCollaborators, pixOverrideById);
      await persistPixPlan(pixPlan, async (collaboratorId, pix) => {
        const { data, error } = await supabase.from('ps_collaborators').update({ pix }).eq('id', collaboratorId).select('id').single();
        if (error || !data) throw new Error(error?.message || 'Não foi possível salvar o PIX.');
        void queryClient.invalidateQueries({ queryKey: ['ps_collaborators'] });
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o PIX.');
      return;
    }
    const roleObj: any = roles.find((r: any) => r.value === roleValue);
    const effectivePixById = Object.fromEntries(pixPlan.map(item => [item.collaborator.id, item.pix]));

    const rows = selectedCollaborators.map((c) => {
      const effectivePix = effectivePixById[c.id];
      return buildManualEventCollaboratorRow({
        eventId: id,
        collaboratorId: c.id,
        collaborator: { ...c, pix: effectivePix },
        roleValue,
        roleName: roleObj?.name,
        payValue: rolePay(roleValue),
        campus: campusValue.trim(),
      });
    });
    await add.mutateAsync(rows);
    setAddOpen(false);
    setSelected([]);
    setRoleValue('');
    setCampusValue('');
    setPixOverrideById({});
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
    try {
      const result = await readPsCandidateSpreadsheet(file, id!);
      if (!result.rows.length) {
        toast.error('Nenhum candidato encontrado. Use a coluna CANDIDATO ou NOME.');
        return;
      }
      if (!result.campusCount || !result.buildingCount) {
        toast.error(
          'Campus e Prédio não foram identificados. Baixe o modelo e confira os cabeçalhos da planilha.',
        );
        return;
      }
      if (result.campusCount < result.rows.length || result.buildingCount < result.rows.length) {
        toast.warning(
          `${result.rows.length - Math.min(result.campusCount, result.buildingCount)} candidato(s) têm Campus ou Prédio em branco.`,
        );
      }
      addMany.mutate(result.rows);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível ler a planilha de candidatos.',
      );
    }
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
    const rows = operationalLinks.map((l: any) => ({
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

  const matchesLabelLocation = (row: any, filters: LocationFilters) =>
    (filters.campus === 'all' || normalizePsLocation(row.campus) === filters.campus)
    && (filters.building === 'all' || normalizePsLocation(row.building, { building: true }) === filters.building);

  const labelLocationSuffix = (filters: LocationFilters) => [filters.campus, filters.building]
    .filter((value) => value !== 'all')
    .join('-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const exportBadges = async (filters: LocationFilters = { campus: 'all', building: 'all' }, format: LabelExportFormat = 'pdf') => {
    if (!links.length) { toast.error('Nenhum colaborador vinculado ao evento.'); return; }
    const filtered = links.filter((row: any) => matchesLabelLocation(row, filters));
    if (!filtered.length) { toast.error('Nenhum colaborador encontrado para o campus e prédio selecionados.'); return; }
    const locationSuffix = labelLocationSuffix(filters);
    if (format === 'word') {
      const { generatePsTeamLabelsWord, saveWordBlob } = await import('@/lib/psEventWord');
      saveWordBlob(await generatePsTeamLabelsWord(eventInfo(), filtered as any), `etiquetas-${slug}${locationSuffix ? `-${locationSuffix}` : ''}.docx`);
      return;
    }
    generatePsBadgesPdf(eventInfo(), filtered as any).save(`etiquetas-${slug}${locationSuffix ? `-${locationSuffix}` : ''}.pdf`);
  };

  const exportCandidateBadges = async (filters: LocationFilters = { campus: 'all', building: 'all' }, format: LabelExportFormat = 'pdf') => {
    if (!candidates.length) {
      toast.error('Nenhum candidato disponível para geração de etiquetas.');
      return;
    }
    const rows = candidates.filter((candidate: any) => matchesLabelLocation(candidate, filters)).map((c: any) => ({
      full_name: c.full_name,
      cpf: c.cpf,
      rg: c.rg,
      exam_type: c.exam_type,
      campus: c.campus,
      building: c.building,
      room: c.room,
      seat_number: c.seat_number || c.seat,
      registration_number: c.registration_number,
      pcd_type: c.pcd_type,
    }));
    if (!rows.length) { toast.error('Nenhum candidato encontrado para o campus e prédio selecionados.'); return; }
    const locationSuffix = labelLocationSuffix(filters);
    if (format === 'word') {
      const { generatePsCandidateLabelsWord, saveWordBlob } = await import('@/lib/psEventWord');
      saveWordBlob(await generatePsCandidateLabelsWord(eventInfo(), rows), `etiquetas-candidatos-${slug}${locationSuffix ? `-${locationSuffix}` : ''}.docx`);
      return;
    }
    generatePsCandidateBadgesPdf(eventInfo(), rows).save(`etiquetas-candidatos-${slug}${locationSuffix ? `-${locationSuffix}` : ''}.pdf`);
  };

  const exportAttendancePdf = async () => {
    if (!operationalLinks.length) {
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

    const pdfRows = operationalLinks.map((row: any) => {
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
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        orientation="vertical"
        className="ps-event-workspace"
      >
        <PsEventWorkspaceNav
          teamCount={links.length}
          candidateCount={candidates.length}
          selfEvaluationCount={selfEvaluations.length}
        />

        <div className="ps-event-workspace__content">
          <header className="ps-event-hero">
            <div className="ps-event-hero__copy">
              <p className="ps-event-hero__eyebrow">Processo Seletivo · Gestão do evento</p>
              <div className="flex flex-wrap items-center gap-2">
                <h1>{event.name}</h1>
                <Badge variant={event.status === 'em_andamento' ? 'default' : 'secondary'}>
                  {PS_EVENT_STATUS[event.status]}
                </Badge>
              </div>
              <p>
                {new Date(`${event.date}T00:00:00`).toLocaleDateString('pt-BR')} · {event.location || 'Local não informado'}
              </p>
            </div>

            <div className="ps-event-hero__actions">
              <Button variant="outline" onClick={() => setLabelsOpen(true)}><IdCard className="mr-2 h-4 w-4" />Etiquetas</Button>
              <Button asChild variant="outline"><Link to={`/admin-module/processo-seletivo/eventos/${id}/avaliadores`}><ShieldCheck className="mr-2 h-4 w-4" />Equipe de avaliação</Link></Button>
              <Button variant="outline" onClick={exportAttendancePdf}><FileSignature className="mr-2 h-4 w-4" />Presença (PDF)</Button>
              <Button variant="outline" onClick={exportPresence}><Download className="mr-2 h-4 w-4" />XLSX</Button>
              {event.status !== 'finalizado' && (
                <Button className="ps-gradient-button" onClick={() => { if (confirm('Finalizar evento?')) finalize.mutate(event.id); }}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />Finalizar
                </Button>
              )}
            </div>
          </header>

          {activeTab === 'visao-geral' && (
            <section className="ps-event-stats" aria-label="Resumo do evento">
              <Card className="ps-event-stat ps-event-stat--violet"><CardContent><p>Equipe</p><strong>{links.length}</strong><span>fiscais vinculados</span></CardContent></Card>
              <Card className="ps-event-stat ps-event-stat--green"><CardContent><p>Presentes</p><strong>{links.filter((l: any) => l.present).length}</strong><span>presenças registradas</span></CardContent></Card>
              <Card className="ps-event-stat ps-event-stat--rose"><CardContent><p>Ausentes</p><strong>{links.filter((l: any) => l.absent).length}</strong><span>ausências registradas</span></CardContent></Card>
              <Card className="ps-event-stat ps-event-stat--blue"><CardContent><p>Avaliações</p><strong>{links.filter((l: any) => l.evaluated).length}</strong><span>avaliações concluídas</span></CardContent></Card>
            </section>
          )}

          <div className="ps-event-mobile-nav">
            <Label htmlFor="ps-event-section">Área do evento</Label>
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger id="ps-event-section"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="visao-geral">Visão geral</SelectItem>
                <SelectItem value="equipe-comunicacao">Equipe e Comunicação</SelectItem>
                <SelectItem value="candidatos">Candidatos</SelectItem>
                <SelectItem value="presenca">Presença</SelectItem>
                <SelectItem value="treinamentos">Treinamentos</SelectItem>
                <SelectItem value="pagamentos">Pagamentos</SelectItem>
                <SelectItem value="avaliacoes">Avaliações</SelectItem>
                <SelectItem value="auto">Autoavaliações</SelectItem>
                <SelectItem value="configuracoes">Configurações</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="ps-event-workspace__panel">

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

          

          <TabsContent value="equipe-comunicacao" className="space-y-4 pt-4">
            <div className="grid grid-cols-4 overflow-hidden rounded-2xl border border-violet-500/15 bg-gradient-to-r from-card/75 via-card/60 to-violet-500/[0.035]">
              {[['pending_confirmation', 'Aguardando'], ['confirmed', 'Confirmados'], ['declined', 'Recusaram'], ['replaced', 'Substituídos']].map(([key, label], index) => (
                <div key={key} className={`flex h-14 items-center justify-between gap-2 px-4 ${index > 0 ? 'border-l border-violet-500/10' : ''}`}>
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-xl font-bold">{Number(confirmationSummary[key] || 0)}</span>
                </div>
              ))}
            </div>
            {replacementNeededLinks.length > 0 && (
              <Card className="rounded-2xl border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/10">
                <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">
                          {replacementNeededLinks.length} substituição{replacementNeededLinks.length === 1 ? '' : 'ões'} necessária{replacementNeededLinks.length === 1 ? '' : 's'}
                        </p>
                        <Badge variant="outline">Ação pendente</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Fiscais recusaram o evento e deixaram vagas que precisam ser preenchidas.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {replacementNeededLinks.slice(0, 4).map((link: any) => (
                          <div key={link.id} className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-background/70 px-2.5 py-1.5">
                            <span className="text-xs font-medium">{link.collaborator_name}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {[link.role_name || link.assigned_role, link.campus, link.building, link.floor, link.room]
                                .filter(Boolean)
                                .join(' · ') || 'Local não informado'}
                            </span>
                          </div>
                        ))}
                        {replacementNeededLinks.length > 4 && (
                          <Badge variant="secondary" className="font-normal">
                            +{replacementNeededLinks.length - 4} outro(s)
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="shrink-0"
                    onClick={() => openReplacement(replacementNeededLinks[0])}
                  >
                    {replacementNeededLinks.length === 1 ? 'Encontrar substituto' : 'Ver substituições'}
                  </Button>
                </CardContent>
              </Card>
            )}

            <PsEventCommunicationTab
              event={event}
              links={links as any[]}
              onRequestConfirmation={(link) => void requestConfirmation(link)}
              onCopyConfirmationMessage={(link) => void copyConfirmationMessage(link)}
              onReplace={openReplacement}
              requestingConfirmation={confirmationActions.request.isPending}
              onExportFiltered={(rows, format, filters) => {
                if (format === 'pdf') exportFilteredConfirmationsPdf(rows, filters);
                else exportFilteredConfirmationsExcel(rows, filters);
              }}
              excludedLinks={excludedEventLinks as any[]}
              onImportTeam={() => setImportOpen(true)}
              onAddTeamMember={() => setAddOpen(true)}
              onClearTeam={() => {
                if (confirm('Remover toda a equipe deste evento? Os cadastros e as avaliações dos colaboradores são mantidos.')) clearTeam.mutate(id!);
              }}
              onEditMember={(link) => setEditLink(link)}
              onRemoveMember={(link) => {
                if (confirm('Excluir ' + link.collaborator_name + ' deste evento? Ele permanecerá no histórico e não voltará automaticamente em uma nova importação.')) remove.mutate({ id: link.id });
              }}
              onReincludeMember={(link) => { reinclude.mutate(link.id); }}
              onEvaluateMember={(link) => {
                setEvalTarget(link);
                setCriteria(emptyCriteria());
              }}
              onTogglePresence={(link, field, value) => {
                void setParticipantState(link, psPresencePatch(field, value));
              }}
            />

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

          <TabsContent value="presenca" className="space-y-4 pt-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Presentes</p>
                  <p className="mt-1 text-2xl font-bold">
                    {operationalLinks.filter((l:any) => l.present && !l.absent).length}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Assinados</p>
                  <p className="mt-1 text-2xl font-bold">
                    {operationalLinks.filter((l:any) => !!l.signed_at).length}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                  <p className="mt-1 text-2xl font-bold">
                    {operationalLinks.filter((l:any) => !l.signed_at && !l.absent).length}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Ausentes</p>
                  <p className="mt-1 text-2xl font-bold">
                    {operationalLinks.filter((l:any) => !!l.absent).length}
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

                          {location.campusLabel &&
                            location.campusLabel !== location.building && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {location.campusLabel}
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
                      : `Ver fiscais (${operationalLinks.length})`}
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
              <Button variant="outline" onClick={downloadPsCandidateTemplate}>
                <Download className="mr-2 h-4 w-4" />Baixar modelo XLSX
              </Button>
              <Button variant="outline" asChild>
                <label className="cursor-pointer"><Upload className="mr-2 h-4 w-4" />Importar candidatos / atualizar dados
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void importCandidates(file);
                  }} />
                </label>
              </Button>
              <Button variant="outline" onClick={() => exportCandidateBadges()} disabled={candidates.length === 0}>
                <IdCard className="mr-2 h-4 w-4" />Gerar etiquetas (PDF)
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
                        {[c.campus, c.building, c.room && `Sala ${c.room}`, c.seat_number && `Carteira ${c.seat_number}`, c.seat && `Carteira ${c.seat}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {c.pcd_type && c.pcd_type !== 'NORMAL' && <Badge variant="secondary">{c.pcd_type}</Badge>}
                  </div>
                ))}
                {candidates.length === 0 && <p className="p-4 text-muted-foreground">Nenhum candidato disponível para geração de etiquetas.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="treinamentos" className="pt-4">
            <PsEventTrainingTab eventId={id!} roles={roles as any[]} />
          </TabsContent>

          <TabsContent value="pagamentos" className="pt-4">
            <PsEventPaymentsPanel event={event} />
          </TabsContent>
          </div>
        </div>
      </Tabs>

      <PsEventLabelsDialog
        open={labelsOpen}
        onOpenChange={setLabelsOpen}
        event={event}
        team={links}
        candidates={candidates}
        onExportTeam={exportBadges}
        onExportCandidates={exportCandidateBadges}
      />

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

                {closureTarget.campusLabel &&
                  closureTarget.campusLabel !==
                    closureTarget.building && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {closureTarget.campusLabel}
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
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            setSelected([]);
            setRoleValue('');
            setCampusValue('');
            setPixOverrideById({});
            setSearchFiscal('');
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-3xl" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="border-b px-6 py-5"><div className="flex items-start justify-between gap-3 pr-5"><div><DialogTitle className="text-lg">Vincular fiscais ao evento</DialogTitle><p className="mt-1 text-sm text-muted-foreground">Escolha a função, o campus e depois selecione um ou vários fiscais.</p></div><Badge variant="secondary" className="shrink-0">{selected.length} selecionado{selected.length === 1 ? '' : 's'}</Badge></div></DialogHeader>
          <div className="max-h-[calc(90vh-150px)] space-y-5 overflow-y-auto px-6 py-5">
            <div>
              <Label>Função *</Label>
              <Select value={roleValue} onValueChange={setRoleValue}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Selecione a função" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r: any) => <SelectItem key={r.id} value={r.value}>{r.name} — R$ {Number(r.pay_value).toFixed(2)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Campus do evento *</Label>
                {eventCampusOptions.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    {eventCampusOptions.length === 1 ? 'Preenchido automaticamente' : 'Campi já usados no evento'}
                  </span>
                )}
              </div>

              {eventCampusOptions.length > 0 ? (
                <>
                  <Select
                    value={eventCampusOptions.includes(campusValue.trim()) ? campusValue.trim() : ''}
                    onValueChange={setCampusValue}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Selecione o campus" />
                    </SelectTrigger>
                    <SelectContent>
                      {eventCampusOptions.map((campus) => (
                        <SelectItem key={campus} value={campus}>{campus}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {eventCampusOptions.length > 1 && (
                    <Input
                      value={campusValue}
                      onChange={(e) => setCampusValue(e.target.value)}
                      placeholder="Ou digite outro campus..."
                      className="h-10"
                    />
                  )}
                </>
              ) : (
                <Input
                  value={campusValue}
                  onChange={(e) => setCampusValue(e.target.value)}
                  placeholder="Ex.: Campus Fumec"
                  className="h-11"
                />
              )}

              {eventCampusOptions.length === 1 && (
                <p className="text-xs text-muted-foreground">
                  O sistema encontrou apenas um campus já utilizado neste evento e o preencheu para você.
                </p>
              )}
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Selecionar fiscais</p>
                  <p className="text-xs text-muted-foreground">Somente fiscais ativos, livres no dia e ainda não vinculados a este evento.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="w-fit">{visibleCollaborators.length} disponíveis</Badge>
                  {selected.length > 0 && <Badge className="w-fit">{selected.length} selecionado(s)</Badge>}
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input
                value={searchFiscal}
                onChange={(e) => setSearchFiscal(e.target.value)}
                placeholder="Buscar nome, e-mail, matrícula, instituição ou unidade..."
              />{visibleCollaborators.length > 0 && (<Button type="button" variant="outline" className="h-10 shrink-0" onClick={() => { const ids = visibleCollaborators.map((c: any) => c.id); const allSelected = ids.every((cid: string) => selected.includes(cid)); setSelected(allSelected ? selected.filter((cid) => !ids.includes(cid)) : Array.from(new Set([...selected, ...ids]))); }}>{visibleCollaborators.every((c: any) => selected.includes(c.id)) ? 'Desmarcar todos' : 'Selecionar todos'}</Button>)}</div></div>{selected.length > 0 && (<div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3"><div className="flex items-center justify-between gap-2"><div><p className="text-sm font-semibold">Fiscais selecionados</p><p className="text-xs text-muted-foreground">Clique no nome para remover da seleção.</p></div><Button type="button" variant="ghost" size="sm" onClick={() => setSelected([])}>Limpar</Button></div><div className="mt-2 flex flex-wrap gap-1.5">{selected.map((cid) => { const person = collaborators.find((c: any) => c.id === cid) as any; return person ? (<button key={cid} type="button" onClick={() => setSelected(selected.filter((x) => x !== cid))} className="rounded-full border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted">{person.full_name}</button>) : null; })}</div></div>)}<div className="max-h-[42vh] space-y-2 overflow-y-auto overflow-x-hidden rounded-xl border p-2">
              {visibleCollaborators.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">Nenhum fiscal encontrado.</p>
              ) : visibleCollaborators.map((c: any) => {
                const emailText = c.email ? String(c.email).trim() : '';
                const matriculaText = c.matricula ? `Matrícula ${String(c.matricula).trim()}` : '';
                const institutionText = c.institution ? String(c.institution).trim() : '';
                const unitText = c.unit ? String(c.unit).trim() : '';
                const collaboratorPix = typeof c?.pix === 'string' ? c.pix : '';
                const resolvedPix = (pixOverrideById[c.id] ?? collaboratorPix ?? '').trim();

                return (
                  <div key={c.id} className="space-y-2 rounded-xl border bg-background p-2 transition hover:border-primary/40">
                    <Button
                      type="button"
                      variant={selected.includes(c.id) ? 'default' : 'ghost'}
                      className="w-full h-auto min-h-0 justify-start whitespace-normal overflow-hidden px-3 py-2"
                      onClick={() => setSelected(selected.includes(c.id) ? selected.filter((x) => x !== c.id) : [...selected, c.id])}
                    >
                      <span className="w-full min-w-0 flex flex-col items-start text-left">
                        <span className="flex w-full items-center justify-between gap-2">
                          <span className="max-w-full font-medium break-words whitespace-normal text-left">{c.full_name || 'Sem nome'}</span>
                          {c.compatibilityScore > 0 && (
                            <Badge variant={c.compatibilityScore >= 70 ? 'default' : 'secondary'} className="shrink-0 text-[10px]">
                              <Check className="mr-1 h-3 w-3" />{c.compatibilityScore}% encaixe
                            </Badge>
                          )}
                        </span>

                        {(emailText || matriculaText) && (
                          <span className="max-w-full text-left text-xs text-muted-foreground whitespace-normal break-words">
                            {emailText && <span className="break-all">{emailText}</span>}
                            {(emailText && matriculaText) && <span> · </span>}
                            {matriculaText && <span>{matriculaText}</span>}
                          </span>
                        )}

                        {(institutionText || unitText) && (
                          <span className="max-w-full text-left text-xs text-muted-foreground whitespace-normal break-words">
                            {institutionText}
                            {(institutionText && unitText) && <span> · </span>}
                            {unitText && <span>Unidade de trabalho: {unitText}</span>}
                          </span>
                        )}
                        {c.compatibilityReasons?.length > 0 && (
                          <span className="max-w-full text-left text-[11px] text-primary/80 whitespace-normal break-words">
                            {c.compatibilityReasons.join(' · ')}
                          </span>
                        )}
                      </span>
                    </Button>

                    {selected.includes(c.id) && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">PIX</Label>
                          <Badge variant={resolvedPix ? 'default' : 'secondary'} className="text-[10px]">
                            {resolvedPix ? 'PIX cadastrado' : 'Sem PIX'}
                          </Badge>
                        </div>
                        <Input
                          value={resolvedPix}
                          onChange={(event) => setPixOverrideById((prev) => ({ ...prev, [c.id]: event.target.value }))}
                          placeholder={collaboratorPix ? 'PIX do fiscal' : 'Informe PIX para vincular'}
                          className={resolvedPix ? '' : 'border-destructive/60'}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter className="border-t bg-background px-6 py-4">
            <Button variant="outline" onClick={() => {
              setAddOpen(false);
              setSelected([]);
              setRoleValue('');
              setCampusValue('');
              setPixOverrideById({});
            }}>Cancelar</Button>
            <Button
              onClick={linkFiscals}
              disabled={!selected.length || !roleValue || !campusValue.trim() || selected.some((cid) => {
                const selectedCollaborator = collaborators.find((c: any) => c.id === cid) as any;
                const collaboratorPix = typeof selectedCollaborator?.pix === 'string' ? selectedCollaborator.pix : '';
                return !(pixOverrideById[cid] ?? collaboratorPix).trim();
              })}
            >
              Vincular {selected.length || ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Avaliar */}

      <Dialog open={!!replacementTarget} onOpenChange={(open) => { if (!open) { setReplacementTarget(null); setReplacementPickerOpen(false); } }}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>Substituir {replacementTarget?.collaborator_name}</DialogTitle></DialogHeader>
          {replacementData && <div className="space-y-3">
            <div className="rounded-xl border border-primary/15 bg-primary/[0.035] p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Sugestão automática</p>
                  <p className="text-xs text-muted-foreground">Fiscais ativos, sem outro vínculo no mesmo dia e com maior compatibilidade.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {replacementCandidates.filter((candidate: any) => !candidate.sameDayConflict).length} disponíveis
                  </Badge>
                  {replacementCandidates.filter((candidate: any) => !!candidate.sameDayConflict).length > 0 && (
                    <Badge variant="outline">
                      {replacementCandidates.filter((candidate: any) => !!candidate.sameDayConflict).length} com conflito
                    </Badge>
                  )}
                </div>
              </div>
              <div className="mt-3 grid gap-2">
                {replacementCandidates.filter((candidate: any) => !candidate.sameDayConflict).slice(0, 5).map((candidate: any) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => {
                      if (candidate.sameDayConflict) return;
                      setReplacementFiscalId(candidate.id);
                    }}
                    className={`flex items-start justify-between gap-3 rounded-xl border p-3 text-left transition hover:bg-muted/60 ${replacementFiscalId === candidate.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/60 bg-background/60'}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{candidate.full_name}</span>
                        {candidate.id === replacementCandidates.find((item: any) => !item.sameDayConflict)?.id ? (
                          <Badge variant="default" className="shrink-0 text-[10px]">Sugestão principal</Badge>
                        ) : candidate.replacementScore >= 70 ? (
                          <Badge variant="secondary" className="shrink-0 text-[10px]">Boa compatibilidade</Badge>
                        ) : null}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {[candidate.institution, candidate.unit, candidate.email].filter(Boolean).join(' · ') || 'Sem informações complementares'}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {(candidate.replacementReasons || []).slice(0, 3).map((reason: string) => (
                          <Badge key={reason} variant="outline" className="text-[10px] font-normal">{reason}</Badge>
                        ))}
                      </span>
                    </span>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="outline">{candidate.replacementScore}%</Badge>
                      {candidate.average_rating && <span className="text-[10px] text-muted-foreground">Nota {Number(candidate.average_rating).toFixed(2)}</span>}
                    </div>
                  </button>
                ))}
                {!replacementCandidates.some((candidate: any) => !candidate.sameDayConflict) && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    Nenhum fiscal disponível foi encontrado sem conflito de data.
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Novo fiscal ativo</Label>
              <Popover open={replacementPickerOpen} onOpenChange={setReplacementPickerOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" role="combobox" aria-expanded={replacementPickerOpen} className="h-auto min-h-10 w-full justify-between py-2 text-left font-normal">
                    <span className="min-w-0 truncate">
                      {replacementFiscalId
                        ? (replacementCandidates as any[]).find((candidate: any) => candidate.id === replacementFiscalId)?.full_name
                        : 'Pesquisar e selecionar um fiscal ativo...'}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar por nome, e-mail, função, instituição ou unidade..." />
                    <CommandList className="max-h-80">
                      <CommandEmpty>Nenhum fiscal ativo encontrado.</CommandEmpty>
                      <CommandGroup>
                        {replacementCandidates.slice(0, 10).map((candidate: any) => (
                          <CommandItem
                            key={candidate.id}
                            value={[candidate.full_name, candidate.email, candidate.institution, candidate.unit, candidate.sector].filter(Boolean).join(' ')}
                            disabled={!!candidate.sameDayConflict}
                            onSelect={() => {
                              if (candidate.sameDayConflict) return;
                              setReplacementFiscalId(candidate.id);
                              setReplacementPickerOpen(false);
                            }}
                            className="items-start gap-2 py-2"
                          >
                            <Check className={`mt-0.5 h-4 w-4 shrink-0 ${replacementFiscalId === candidate.id ? 'opacity-100' : 'opacity-0'}`} />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{candidate.full_name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {[candidate.email, candidate.institution || candidate.unit, candidate.sector].filter(Boolean).join(' · ') || 'Sem informações complementares'}
                              </span>
                              <span className={`mt-1 block text-[10px] ${candidate.sameDayConflict ? 'text-destructive' : 'text-primary'}`}>
                                {candidate.sameDayConflict
                                  ? `Conflito em ${candidate.sameDayConflict.ps_events?.name || 'outro evento'}`
                                  : `${candidate.replacementScore}% compatível · ${(candidate.replacementReasons || []).slice(0, 2).join(' · ')}`}
                              </span>
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
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

      <PsEventCollaboratorEditDialog
        eventId={id!}
        link={editLink}
        roles={roles as any[]}
        open={!!editLink}
        onOpenChange={(open) => !open && setEditLink(null)}
      />
    </MainLayout>
  );
}
