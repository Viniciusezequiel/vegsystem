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
import { Plus, Trash2, Copy, Download, CheckCircle2, Upload, Star, Pencil, IdCard, FileSignature, ShieldCheck, Phone, Check, ChevronsUpDown, AlertTriangle, Search, Users, Sparkles, MapPin, BriefcaseBusiness, UserRoundCheck, ArrowRightLeft, GraduationCap, MailWarning, ArrowRight, WalletCards, ListChecks, CalendarDays, Building2, DoorOpen, Rows3, List, FilterX } from 'lucide-react';
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
  const [fiscalView, setFiscalView] = useState<'best' | 'all'>('all');
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
  const [presenceStatus, setPresenceStatus] = useState<'all' | 'pending' | 'present' | 'absent' | 'departed'>('all');
  const [presenceLocation, setPresenceLocation] = useState('all');
  const [presenceListOpen, setPresenceListOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateCampus, setCandidateCampus] = useState('all');
  const [candidateBuilding, setCandidateBuilding] = useState('all');
  const [candidateRoom, setCandidateRoom] = useState('all');
  const [candidateStatus, setCandidateStatus] = useState<'all' | 'complete' | 'missing-location' | 'pcd'>('all');
  const [candidateView, setCandidateView] = useState<'list' | 'rooms'>('list');
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalizeAcknowledged, setFinalizeAcknowledged] = useState(false);

  const [selfEvaluationSearch, setSelfEvaluationSearch] = useState('');
  const [selfEvaluationRole, setSelfEvaluationRole] = useState('all');
  const [selfEvaluationCampus, setSelfEvaluationCampus] = useState('all');
  const [selfEvaluationFocus, setSelfEvaluationFocus] = useState<'all' | 'attention' | 'low' | 'incident' | 'suggestion' | 'anonymous' | 'identified'>('all');
  const [eventSettings, setEventSettings] = useState<any>(null);
  const [savingEventSettings, setSavingEventSettings] = useState(false);

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

  useEffect(() => {
    if (!event) return;
    setEventSettings({
      name: event.name || '',
      date: event.date || '',
      location: event.location || '',
      description: event.description || '',
      coordinator_name: event.coordinator_name || '',
      notes: event.notes || '',
      self_evaluation_enabled: !!event.self_evaluation_enabled,
      hidden_from_evaluation: !!event.hidden_from_evaluation,
    });
  }, [event]);

  const saveEventSettings = async () => {
    if (!event || !eventSettings) return;

    if (!String(eventSettings.name || '').trim()) {
      toast.error('Informe o nome do evento.');
      return;
    }

    if (!eventSettings.date) {
      toast.error('Informe a data do evento.');
      return;
    }

    setSavingEventSettings(true);
    try {
      await save.mutateAsync({
        ...event,
        name: String(eventSettings.name || '').trim(),
        date: eventSettings.date,
        location: String(eventSettings.location || '').trim() || null,
        description: String(eventSettings.description || '').trim() || null,
        coordinator_name: String(eventSettings.coordinator_name || '').trim() || null,
        notes: String(eventSettings.notes || '').trim() || null,
        self_evaluation_enabled: !!eventSettings.self_evaluation_enabled,
        hidden_from_evaluation: !!eventSettings.hidden_from_evaluation,
      });
      toast.success('Configurações do evento atualizadas.');
    } finally {
      setSavingEventSettings(false);
    }
  };

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

  const { data: overviewTrainingData = { groups: [], groupRoles: [], sessions: [], choices: [], assignments: [], reselections: [] } } = useQuery({
    queryKey: ['ps-event-overview-training', id],
    enabled: !!id,
    staleTime: 30_000,
    queryFn: async () => {
      const groupsRes = await (supabase as any)
        .from('ps_event_training_groups')
        .select('id,event_id,name,required,active')
        .eq('event_id', id!);

      if (groupsRes.error) throw groupsRes.error;

      const groups = groupsRes.data || [];
      const groupIds = groups.map((group: any) => group.id);

      const [roleRes, sessionRes, choiceRes, assignmentRes, reselectionRes] = await Promise.all([
        groupIds.length
          ? (supabase as any)
              .from('ps_event_training_group_roles')
              .select('training_group_id,role_value')
              .in('training_group_id', groupIds)
          : Promise.resolve({ data: [], error: null }),
        (supabase as any)
          .from('ps_event_training_sessions')
          .select('id,training_group_id,active,cancelled_at')
          .eq('event_id', id!),
        (supabase as any)
          .from('ps_event_training_choices')
          .select('id,event_collaborator_id,training_group_id,training_session_id')
          .eq('event_id', id!),
        (supabase as any)
          .from('ps_event_collaborator_assignments')
          .select('event_collaborator_id,role_value,is_primary')
          .eq('event_id', id!),
        (supabase as any)
          .from('ps_training_reselection_requests')
          .select('event_collaborator_id,training_group_id,status')
          .eq('event_id', id!),
      ]);

      const error =
        roleRes.error ||
        sessionRes.error ||
        choiceRes.error ||
        assignmentRes.error ||
        reselectionRes.error;

      if (error) throw error;

      return {
        groups,
        groupRoles: roleRes.data || [],
        sessions: sessionRes.data || [],
        choices: choiceRes.data || [],
        assignments: assignmentRes.data || [],
        reselections: reselectionRes.data || [],
      };
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
        if (presenceLocation !== 'all' && getPsAttendanceLocation(link).key !== presenceLocation) {
          return false;
        }

        if (presenceStatus === 'pending' && (link.absent || link.signed_at || link.present)) return false;
        if (presenceStatus === 'present' && (link.absent || (!link.signed_at && !link.present))) return false;
        if (presenceStatus === 'absent' && !link.absent) return false;
        if (presenceStatus === 'departed' && !link.departed_at) return false;

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
  }, [operationalLinks, presenceSearch, presenceStatus, presenceLocation]);

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

  const presenceOverview = useMemo(() => {
    const total = operationalLinks.length;
    const present = operationalLinks.filter((link: any) => !link.absent && (!!link.signed_at || !!link.present)).length;
    const signed = operationalLinks.filter((link: any) => !!link.signed_at).length;
    const absent = operationalLinks.filter((link: any) => !!link.absent).length;
    const pending = operationalLinks.filter((link: any) => !link.absent && !link.signed_at && !link.present).length;
    const departed = operationalLinks.filter((link: any) => !!link.departed_at).length;
    const resolved = present + absent;
    const completion = total ? Math.round((resolved / total) * 100) : 0;
    const closedLocations = attendanceLocations.filter((location: any) => !!location.closure).length;

    return {
      total,
      present,
      signed,
      absent,
      pending,
      departed,
      resolved,
      completion,
      closedLocations,
      locations: attendanceLocations.length,
    };
  }, [operationalLinks, attendanceLocations]);

  const openPresenceLocation = (location: any, status: 'all' | 'pending' | 'present' | 'absent' | 'departed' = 'all') => {
    setPresenceLocation(location?.key || 'all');
    setPresenceStatus(status);
    setPresenceSearch('');
    setPresenceListOpen(true);
  };

  const clearPresenceFilters = () => {
    setPresenceSearch('');
    setPresenceStatus('all');
    setPresenceLocation('all');
  };


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

  const trainingOverview = useMemo(() => {
    const groups = (overviewTrainingData.groups || []).filter(
      (group: any) => group.active !== false && group.required !== false
    );

    if (!groups.length) {
      return {
        requiredPeople: 0,
        completedPeople: 0,
        pendingPeople: 0,
        reselectionPending: 0,
        configured: false,
      };
    }

    const groupIds = new Set(groups.map((group: any) => String(group.id)));
    const rolesByGroup = new Map<string, Set<string>>();

    for (const row of overviewTrainingData.groupRoles || []) {
      const groupId = String(row.training_group_id || '');
      if (!groupIds.has(groupId)) continue;
      const current = rolesByGroup.get(groupId) || new Set<string>();
      current.add(String(row.role_value || ''));
      rolesByGroup.set(groupId, current);
    }

    const primaryRoleByLink = new Map<string, string>();
    for (const assignment of overviewTrainingData.assignments || []) {
      const linkId = String(assignment.event_collaborator_id || '');
      const roleValue = String(assignment.role_value || '');
      if (!linkId || !roleValue || assignment.is_primary !== true) continue;
      if (!primaryRoleByLink.has(linkId)) {
        primaryRoleByLink.set(linkId, roleValue);
      }
    }

    const activeSessionIds = new Set(
      (overviewTrainingData.sessions || [])
        .filter((session: any) => session.active !== false && !session.cancelled_at)
        .map((session: any) => String(session.id))
    );

    const validChoiceKeys = new Set(
      (overviewTrainingData.choices || [])
        .filter((choice: any) => activeSessionIds.has(String(choice.training_session_id)))
        .map((choice: any) => `${choice.event_collaborator_id}|${choice.training_group_id}`)
    );

    let requiredPeople = 0;
    let completedPeople = 0;
    let pendingPeople = 0;

    for (const link of operationalLinks as any[]) {
      const primaryRoleValue =
        primaryRoleByLink.get(String(link.id)) ||
        String(link.role_value || '');

      if (!primaryRoleValue) continue;

      const requiredGroups = groups.filter((group: any) => {
        const acceptedRoles = rolesByGroup.get(String(group.id));
        return !!acceptedRoles?.has(primaryRoleValue);
      });

      if (!requiredGroups.length) continue;

      requiredPeople += 1;
      const complete = requiredGroups.every((group: any) =>
        validChoiceKeys.has(`${link.id}|${group.id}`)
      );

      if (complete) completedPeople += 1;
      else pendingPeople += 1;
    }

    const reselectionPending = (overviewTrainingData.reselections || []).filter(
      (item: any) => !['used', 'completed', 'resolved'].includes(String(item.status || '').toLowerCase())
    ).length;

    return {
      requiredPeople,
      completedPeople,
      pendingPeople,
      reselectionPending,
      configured: true,
    };
  }, [overviewTrainingData, operationalLinks]);

  const communicationOverview = useMemo(() => {
    const latestByLink = new Map<string, any>();
    for (const communication of eventCommunications as any[]) {
      const linkId = String(communication.event_collaborator_id || '');
      if (linkId && !latestByLink.has(linkId)) latestByLink.set(linkId, communication);
    }

    const errorStates = new Set([
      'failed',
      'failed_missing_recipient',
      'soft_bounce',
      'hard_bounce',
      'blocked',
      'spam',
      'invalid',
      'error',
      'unsubscribed',
    ]);

    let errors = 0;
    for (const link of operationalLinks as any[]) {
      const communication = latestByLink.get(String(link.id));
      if (!communication) continue;
      if (
        errorStates.has(String(communication.status || '').toLowerCase()) ||
        errorStates.has(String(communication.delivery_status || '').toLowerCase())
      ) {
        errors += 1;
      }
    }

    return {
      errors,
      withoutEmail: operationalLinks.filter((link: any) => !String(link.email || '').trim()).length,
    };
  }, [eventCommunications, operationalLinks]);

  const candidateOverview = useMemo(() => {
    const missingLocation = candidates.filter((candidate: any) =>
      !String(candidate.campus || '').trim() ||
      !String(candidate.building || '').trim() ||
      !String(candidate.room || '').trim()
    ).length;

    return {
      total: candidates.length,
      completeLocation: Math.max(0, candidates.length - missingLocation),
      missingLocation,
    };
  }, [candidates]);

  const candidateCampusOptions = useMemo(
    () => [...new Set(candidates.map((candidate: any) => String(candidate.campus || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [candidates]
  );

  const candidateBuildingOptions = useMemo(
    () => [...new Set(candidates
      .filter((candidate: any) => candidateCampus === 'all' || String(candidate.campus || '').trim() === candidateCampus)
      .map((candidate: any) => String(candidate.building || '').trim())
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [candidates, candidateCampus]
  );

  const candidateRoomOptions = useMemo(
    () => [...new Set(candidates
      .filter((candidate: any) =>
        (candidateCampus === 'all' || String(candidate.campus || '').trim() === candidateCampus) &&
        (candidateBuilding === 'all' || String(candidate.building || '').trim() === candidateBuilding)
      )
      .map((candidate: any) => String(candidate.room || '').trim())
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })),
    [candidates, candidateCampus, candidateBuilding]
  );

  useEffect(() => {
    if (candidateCampus !== 'all' && !candidateCampusOptions.includes(candidateCampus)) {
      setCandidateCampus('all');
    }
  }, [candidateCampus, candidateCampusOptions]);

  useEffect(() => {
    if (candidateBuilding !== 'all' && !candidateBuildingOptions.includes(candidateBuilding)) {
      setCandidateBuilding('all');
    }
  }, [candidateBuilding, candidateBuildingOptions]);

  useEffect(() => {
    if (candidateRoom !== 'all' && !candidateRoomOptions.includes(candidateRoom)) {
      setCandidateRoom('all');
    }
  }, [candidateRoom, candidateRoomOptions]);

  const filteredCandidates = useMemo(() => {
    const normalize = (value: unknown) => String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    const search = normalize(candidateSearch);

    return candidates
      .filter((candidate: any) => {
        if (candidateCampus !== 'all' && String(candidate.campus || '').trim() !== candidateCampus) return false;
        if (candidateBuilding !== 'all' && String(candidate.building || '').trim() !== candidateBuilding) return false;
        if (candidateRoom !== 'all' && String(candidate.room || '').trim() !== candidateRoom) return false;

        const missingLocation =
          !String(candidate.campus || '').trim() ||
          !String(candidate.building || '').trim() ||
          !String(candidate.room || '').trim();

        if (candidateStatus === 'complete' && missingLocation) return false;
        if (candidateStatus === 'missing-location' && !missingLocation) return false;
        if (candidateStatus === 'pcd' && (!candidate.pcd_type || candidate.pcd_type === 'NORMAL')) return false;

        if (!search) return true;

        const haystack = normalize([
          candidate.full_name,
          candidate.cpf,
          candidate.rg,
          candidate.registration_number,
          candidate.exam_type,
          candidate.campus,
          candidate.building,
          candidate.room,
          candidate.seat_number || candidate.seat,
          candidate.pcd_type,
        ].filter(Boolean).join(' '));

        return haystack.includes(search);
      })
      .sort((a: any, b: any) =>
        String(a.building || '').localeCompare(String(b.building || ''), 'pt-BR') ||
        String(a.room || '').localeCompare(String(b.room || ''), 'pt-BR', { numeric: true }) ||
        String(a.full_name || '').localeCompare(String(b.full_name || ''), 'pt-BR')
      );
  }, [candidates, candidateSearch, candidateCampus, candidateBuilding, candidateRoom, candidateStatus]);

  const candidateRoomGroups = useMemo(() => {
    const groups = new Map<string, { key: string; campus: string; building: string; room: string; candidates: any[] }>();

    for (const candidate of filteredCandidates as any[]) {
      const campus = String(candidate.campus || '').trim() || 'Campus não informado';
      const building = String(candidate.building || '').trim() || 'Prédio não informado';
      const room = String(candidate.room || '').trim() || 'Sala não informada';
      const key = `${campus}|${building}|${room}`;
      const current = groups.get(key) || { key, campus, building, room, candidates: [] };
      current.candidates.push(candidate);
      groups.set(key, current);
    }

    return [...groups.values()].sort((a, b) =>
      a.campus.localeCompare(b.campus, 'pt-BR') ||
      a.building.localeCompare(b.building, 'pt-BR') ||
      a.room.localeCompare(b.room, 'pt-BR', { numeric: true })
    );
  }, [filteredCandidates]);

  const candidateDistributionSummary = useMemo(() => {
    const campuses = new Set(candidates.map((candidate: any) => String(candidate.campus || '').trim()).filter(Boolean));
    const buildings = new Set(candidates.map((candidate: any) => String(candidate.building || '').trim()).filter(Boolean));
    const rooms = new Set(candidates
      .map((candidate: any) => [candidate.campus, candidate.building, candidate.room].map((value) => String(value || '').trim()).join('|'))
      .filter((key: string) => !key.endsWith('|')));
    const pcd = candidates.filter((candidate: any) => candidate.pcd_type && candidate.pcd_type !== 'NORMAL').length;

    return {
      campuses: campuses.size,
      buildings: buildings.size,
      rooms: rooms.size,
      pcd,
    };
  }, [candidates]);

  const clearCandidateFilters = () => {
    setCandidateSearch('');
    setCandidateCampus('all');
    setCandidateBuilding('all');
    setCandidateRoom('all');
    setCandidateStatus('all');
  };

  const paymentOverview = useMemo(() => {
    const active = operationalLinks.filter((link: any) => !link.absent);
    const withPix = active.filter((link: any) => String(link.pix || '').trim()).length;
    const payable = active.filter((link: any) => !!link.present || !!link.signed_at).length;

    return {
      active: active.length,
      withPix,
      missingPix: Math.max(0, active.length - withPix),
      payable,
    };
  }, [operationalLinks]);

  const eventPhase = useMemo(() => {
    if (event?.status === 'finalizado') return 'finalizado' as const;
    if (!event?.date) return 'preparacao' as const;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDate = new Date(`${event.date}T00:00:00`);
    const difference = Math.round((eventDate.getTime() - today.getTime()) / 86_400_000);

    if (difference > 0) return 'preparacao' as const;
    if (difference === 0) return 'operacao' as const;
    return 'pos-evento' as const;
  }, [event?.date, event?.status]);

  const daysUntilEvent = useMemo(() => {
    if (!event?.date) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDate = new Date(`${event.date}T00:00:00`);
    return Math.round((eventDate.getTime() - today.getTime()) / 86_400_000);
  }, [event?.date]);

  const attendancePendingCount = useMemo(
    () => operationalLinks.filter((link: any) => !link.absent && !link.signed_at && !link.present).length,
    [operationalLinks]
  );

  const readyToCloseLocations = useMemo(
    () => attendanceLocations.filter((location: any) => !location.closure && location.pendingCount === 0).length,
    [attendanceLocations]
  );

  const openAttendanceLocations = useMemo(
    () => attendanceLocations.filter((location: any) => !location.closure).length,
    [attendanceLocations]
  );

  const overviewActions = useMemo(() => {
    const actions: Array<{
      key: string;
      severity: 'critical' | 'warning' | 'info';
      title: string;
      description: string;
      tab: string;
      action: string;
      count?: number;
    }> = [];

    if (replacementNeededLinks.length > 0) {
      actions.push({
        key: 'replacement',
        severity: 'critical',
        title: `${replacementNeededLinks.length} vaga(s) precisam de substituição`,
        description: 'Há fiscais que recusaram e ainda deixaram vagas abertas.',
        tab: 'equipe-comunicacao',
        action: 'Resolver substituições',
        count: replacementNeededLinks.length,
      });
    }

    const pendingConfirmations = Number(confirmationSummary.pending_confirmation || 0);
    if (pendingConfirmations > 0) {
      actions.push({
        key: 'confirmation',
        severity: eventPhase === 'preparacao' ? 'warning' : 'critical',
        title: `${pendingConfirmations} fiscal(is) ainda não confirmaram`,
        description: 'Acompanhe os pendentes e reenvie a comunicação quando necessário.',
        tab: 'equipe-comunicacao',
        action: 'Ver pendentes',
        count: pendingConfirmations,
      });
    }

    if (communicationOverview.errors > 0) {
      actions.push({
        key: 'email',
        severity: 'warning',
        title: `${communicationOverview.errors} envio(s) com problema`,
        description: 'Existem e-mails recentes com falha, bloqueio ou rejeição.',
        tab: 'equipe-comunicacao',
        action: 'Revisar envios',
        count: communicationOverview.errors,
      });
    }

    if (trainingOverview.pendingPeople > 0) {
      actions.push({
        key: 'training',
        severity: 'warning',
        title: `${trainingOverview.pendingPeople} fiscal(is) sem treinamento definido`,
        description: 'Pessoas em cargos com treinamento obrigatório ainda não possuem uma data válida.',
        tab: 'treinamentos',
        action: 'Abrir treinamentos',
        count: trainingOverview.pendingPeople,
      });
    }

    if (trainingOverview.reselectionPending > 0) {
      actions.push({
        key: 'training-reselection',
        severity: 'critical',
        title: `${trainingOverview.reselectionPending} realocação(ões) de treinamento pendente(s)`,
        description: 'Há pessoas afetadas por cancelamento de data que ainda precisam escolher outra sessão.',
        tab: 'treinamentos',
        action: 'Realocar pessoas',
        count: trainingOverview.reselectionPending,
      });
    }

    if (candidateOverview.missingLocation > 0) {
      actions.push({
        key: 'candidate-location',
        severity: 'warning',
        title: `${candidateOverview.missingLocation} candidato(s) com localização incompleta`,
        description: 'Campus, prédio ou sala está ausente em parte da lista de candidatos.',
        tab: 'candidatos',
        action: 'Revisar candidatos',
        count: candidateOverview.missingLocation,
      });
    }

    if (paymentOverview.missingPix > 0) {
      actions.push({
        key: 'pix',
        severity: 'info',
        title: `${paymentOverview.missingPix} fiscal(is) sem PIX cadastrado`,
        description: 'Complete os dados antes da consolidação dos pagamentos.',
        tab: 'pagamentos',
        action: 'Revisar pagamentos',
        count: paymentOverview.missingPix,
      });
    }

    if (eventPhase === 'operacao' || eventPhase === 'pos-evento') {
      if (attendancePendingCount > 0) {
        actions.push({
          key: 'attendance',
          severity: 'critical',
          title: `${attendancePendingCount} presença(s) ainda pendente(s)`,
          description: 'Conclua assinaturas ou registre ausências antes de fechar os locais.',
          tab: 'presenca',
          action: 'Controlar presença',
          count: attendancePendingCount,
        });
      }

      if (readyToCloseLocations > 0) {
        actions.push({
          key: 'close-location',
          severity: 'warning',
          title: `${readyToCloseLocations} prédio(s)/local(is) prontos para fechamento`,
          description: 'Não existem mais presenças pendentes nesses locais.',
          tab: 'presenca',
          action: 'Fechar locais',
          count: readyToCloseLocations,
        });
      }
    }

    const priority = { critical: 0, warning: 1, info: 2 };
    return actions.sort((a, b) => priority[a.severity] - priority[b.severity]);
  }, [
    replacementNeededLinks,
    confirmationSummary.pending_confirmation,
    communicationOverview.errors,
    trainingOverview.pendingPeople,
    trainingOverview.reselectionPending,
    candidateOverview.missingLocation,
    paymentOverview.missingPix,
    eventPhase,
    attendancePendingCount,
    readyToCloseLocations,
  ]);

  const finalizationChecklist = useMemo(() => {
    type ChecklistStatus = 'critical' | 'warning' | 'ready' | 'info';

    const items: Array<{
      key: string;
      label: string;
      detail: string;
      status: ChecklistStatus;
      tab?: string;
    }> = [];

    if (daysUntilEvent !== null && daysUntilEvent > 0) {
      items.push({
        key: 'event-date',
        label: 'Data do evento',
        detail: daysUntilEvent === 1
          ? 'O evento acontece amanhã.'
          : `O evento ainda não aconteceu — faltam ${daysUntilEvent} dias.`,
        status: 'critical',
        tab: 'visao-geral',
      });
    } else {
      items.push({
        key: 'event-date',
        label: 'Data do evento',
        detail: eventPhase === 'operacao' ? 'O evento acontece hoje.' : 'A data do evento já foi alcançada.',
        status: 'ready',
      });
    }

    if (replacementNeededLinks.length > 0) {
      items.push({
        key: 'replacement',
        label: 'Substituições',
        detail: `${replacementNeededLinks.length} vaga(s) ainda precisam de substituição.`,
        status: 'critical',
        tab: 'equipe-comunicacao',
      });
    } else {
      items.push({
        key: 'replacement',
        label: 'Substituições',
        detail: 'Nenhuma vaga aberta por recusa.',
        status: 'ready',
      });
    }

    const pendingConfirmations = Number(confirmationSummary.pending_confirmation || 0);
    items.push({
      key: 'confirmations',
      label: 'Confirmações da equipe',
      detail: pendingConfirmations
        ? `${pendingConfirmations} fiscal(is) ainda estão aguardando confirmação.`
        : 'Todas as confirmações pendentes foram resolvidas.',
      status: pendingConfirmations ? 'warning' : 'ready',
      tab: pendingConfirmations ? 'equipe-comunicacao' : undefined,
    });

    if (trainingOverview.configured) {
      items.push({
        key: 'training',
        label: 'Treinamentos obrigatórios',
        detail: trainingOverview.pendingPeople
          ? `${trainingOverview.pendingPeople} fiscal(is) em cargos com treinamento obrigatório ainda estão sem data válida.`
          : trainingOverview.requiredPeople
            ? `${trainingOverview.completedPeople} de ${trainingOverview.requiredPeople} fiscal(is) com treinamento definido.`
            : 'Nenhum fiscal do evento pertence a cargo com treinamento obrigatório.',
        status: trainingOverview.pendingPeople ? 'warning' : 'ready',
        tab: trainingOverview.pendingPeople ? 'treinamentos' : undefined,
      });
    } else {
      items.push({
        key: 'training',
        label: 'Treinamentos obrigatórios',
        detail: 'Nenhum treinamento obrigatório ativo foi configurado para este evento.',
        status: 'info',
        tab: 'treinamentos',
      });
    }

    items.push({
      key: 'candidates',
      label: 'Localização dos candidatos',
      detail: candidateOverview.missingLocation
        ? `${candidateOverview.missingLocation} candidato(s) ainda estão sem campus, prédio ou sala completos.`
        : candidateOverview.total
          ? `Todos os ${candidateOverview.total} candidatos possuem localização completa.`
          : 'Nenhum candidato foi importado.',
      status: candidateOverview.missingLocation ? 'warning' : candidateOverview.total ? 'ready' : 'info',
      tab: candidateOverview.missingLocation ? 'candidatos' : undefined,
    });

    if (communicationOverview.errors > 0) {
      items.push({
        key: 'communications',
        label: 'Comunicações',
        detail: `${communicationOverview.errors} envio(s) recentes apresentam falha, bloqueio ou rejeição.`,
        status: 'warning',
        tab: 'equipe-comunicacao',
      });
    } else {
      items.push({
        key: 'communications',
        label: 'Comunicações',
        detail: 'Nenhum erro recente de entrega identificado.',
        status: 'ready',
      });
    }

    if (eventPhase === 'operacao' || eventPhase === 'pos-evento') {
      items.push({
        key: 'attendance',
        label: 'Presença',
        detail: attendancePendingCount
          ? `${attendancePendingCount} presença(s) ainda precisam ser concluídas.`
          : 'Nenhuma presença pendente.',
        status: attendancePendingCount ? 'critical' : 'ready',
        tab: attendancePendingCount ? 'presenca' : undefined,
      });

      items.push({
        key: 'closures',
        label: 'Fechamento dos locais',
        detail: openAttendanceLocations
          ? `${openAttendanceLocations} prédio(s)/local(is) ainda não foram fechados.`
          : 'Todos os locais da presença estão fechados.',
        status: openAttendanceLocations ? 'critical' : 'ready',
        tab: openAttendanceLocations ? 'presenca' : undefined,
      });
    } else {
      items.push({
        key: 'attendance',
        label: 'Presença e fechamento',
        detail: 'Esta etapa será executada no dia do evento.',
        status: 'info',
        tab: 'presenca',
      });
    }

    items.push({
      key: 'payment',
      label: 'Dados para pagamento',
      detail: paymentOverview.missingPix
        ? `${paymentOverview.missingPix} fiscal(is) ativos ainda estão sem PIX cadastrado.`
        : paymentOverview.active
          ? 'Todos os fiscais ativos possuem PIX cadastrado.'
          : 'Nenhum fiscal ativo para conferência de pagamento.',
      status: paymentOverview.missingPix ? 'warning' : paymentOverview.active ? 'ready' : 'info',
      tab: paymentOverview.missingPix ? 'pagamentos' : undefined,
    });

    return items;
  }, [
    daysUntilEvent,
    eventPhase,
    replacementNeededLinks,
    confirmationSummary.pending_confirmation,
    trainingOverview,
    candidateOverview,
    communicationOverview.errors,
    attendancePendingCount,
    openAttendanceLocations,
    paymentOverview,
  ]);

  const finalizationSummary = useMemo(() => ({
    critical: finalizationChecklist.filter((item) => item.status === 'critical').length,
    warning: finalizationChecklist.filter((item) => item.status === 'warning').length,
    ready: finalizationChecklist.filter((item) => item.status === 'ready').length,
    info: finalizationChecklist.filter((item) => item.status === 'info').length,
  }), [finalizationChecklist]);

  const preparationItems = useMemo(() => {
    const operationalTotal = Number(confirmationSummary.confirmed || 0) + Number(confirmationSummary.pending_confirmation || 0);
    const confirmed = Number(confirmationSummary.confirmed || 0);

    return [
      {
        key: 'confirmation',
        label: 'Confirmações',
        value: confirmed,
        total: operationalTotal,
        detail: operationalTotal ? `${confirmed} de ${operationalTotal} confirmados` : 'Nenhum fiscal em confirmação',
        tab: 'equipe-comunicacao',
      },
      {
        key: 'training',
        label: 'Treinamentos obrigatórios',
        value: trainingOverview.completedPeople,
        total: trainingOverview.requiredPeople,
        detail: trainingOverview.configured
          ? trainingOverview.requiredPeople
            ? `${trainingOverview.completedPeople} de ${trainingOverview.requiredPeople} definidos`
            : 'Nenhum cargo exige treinamento'
          : 'Nenhum treinamento obrigatório configurado',
        tab: 'treinamentos',
      },
      {
        key: 'candidates',
        label: 'Candidatos localizados',
        value: candidateOverview.completeLocation,
        total: candidateOverview.total,
        detail: candidateOverview.total
          ? `${candidateOverview.completeLocation} de ${candidateOverview.total} com campus, prédio e sala`
          : 'Nenhum candidato importado',
        tab: 'candidatos',
      },
      {
        key: 'payment',
        label: 'Dados para pagamento',
        value: paymentOverview.withPix,
        total: paymentOverview.active,
        detail: paymentOverview.active
          ? `${paymentOverview.withPix} de ${paymentOverview.active} com PIX`
          : 'Nenhum fiscal ativo',
        tab: 'pagamentos',
      },
    ];
  }, [
    confirmationSummary.confirmed,
    confirmationSummary.pending_confirmation,
    trainingOverview,
    candidateOverview,
    paymentOverview,
  ]);

  const selfEvaluationRows = useMemo(() => {
    const query = selfEvaluationSearch.trim().toLowerCase();

    return [...selfEvaluations]
      .filter((item: any) => {
        const values = [
          item.training_rating,
          item.organization_rating,
          item.snack_rating,
          item.partner_fiscal_rating,
        ].filter((value) => Number(value) > 0);

        const hasLowRating = values.some((value) => Number(value) <= 2);
        const hasSuggestion = !!String(item.suggestions || '').trim();
        const needsAttention = hasLowRating || !!item.had_incident;

        if (selfEvaluationFocus === 'attention' && !needsAttention) return false;
        if (selfEvaluationFocus === 'low' && !hasLowRating) return false;
        if (selfEvaluationFocus === 'incident' && !item.had_incident) return false;
        if (selfEvaluationFocus === 'suggestion' && !hasSuggestion) return false;
        if (selfEvaluationFocus === 'anonymous' && item.identified) return false;
        if (selfEvaluationFocus === 'identified' && !item.identified) return false;

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
      .sort((a: any, b: any) => {
        const aAttention =
          !!a.had_incident ||
          [a.training_rating, a.organization_rating, a.snack_rating, a.partner_fiscal_rating]
            .some((value) => Number(value) > 0 && Number(value) <= 2);
        const bAttention =
          !!b.had_incident ||
          [b.training_rating, b.organization_rating, b.snack_rating, b.partner_fiscal_rating]
            .some((value) => Number(value) > 0 && Number(value) <= 2);

        if (aAttention !== bAttention) return bAttention ? 1 : -1;

        return String(b.created_at || '').localeCompare(String(a.created_at || ''));
      });
  }, [
    selfEvaluations,
    selfEvaluationSearch,
    selfEvaluationRole,
    selfEvaluationCampus,
    selfEvaluationFocus,
  ]);

  const selfEvaluationSummary = useMemo(() => {
    const ratings: number[] = [];
    const criterionValues: Record<string, number[]> = {
      training: [],
      organization: [],
      snack: [],
      partner: [],
    };

    let incidents = 0;
    let lowRatings = 0;
    let suggestions = 0;
    let identified = 0;
    let anonymous = 0;

    for (const item of selfEvaluations as any[]) {
      const values = [
        item.training_rating,
        item.organization_rating,
        item.snack_rating,
        item.partner_fiscal_rating,
      ].filter((value) => Number(value) > 0);

      ratings.push(...values.map(Number));

      if (Number(item.training_rating) > 0) criterionValues.training.push(Number(item.training_rating));
      if (Number(item.organization_rating) > 0) criterionValues.organization.push(Number(item.organization_rating));
      if (Number(item.snack_rating) > 0) criterionValues.snack.push(Number(item.snack_rating));
      if (Number(item.partner_fiscal_rating) > 0) criterionValues.partner.push(Number(item.partner_fiscal_rating));

      if (item.had_incident) incidents += 1;
      if (String(item.suggestions || '').trim()) suggestions += 1;
      if (item.identified) identified += 1;
      else anonymous += 1;

      if (values.some((value) => Number(value) <= 2)) {
        lowRatings += 1;
      }
    }

    const average = ratings.length
      ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
      : 0;

    const averageOf = (values: number[]) =>
      values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

    const criteria = [
      { key: 'training', label: 'Treinamento', average: averageOf(criterionValues.training), responses: criterionValues.training.length },
      { key: 'organization', label: 'Organização', average: averageOf(criterionValues.organization), responses: criterionValues.organization.length },
      { key: 'snack', label: 'Lanche / alimentação', average: averageOf(criterionValues.snack), responses: criterionValues.snack.length },
      { key: 'partner', label: 'Fiscal parceiro', average: averageOf(criterionValues.partner), responses: criterionValues.partner.length },
    ];

    const ratedCriteria = criteria.filter((item) => item.responses > 0);
    const weakestCriterion = ratedCriteria.length
      ? [...ratedCriteria].sort((a, b) => a.average - b.average)[0]
      : null;
    const strongestCriterion = ratedCriteria.length
      ? [...ratedCriteria].sort((a, b) => b.average - a.average)[0]
      : null;

    return {
      total: selfEvaluations.length,
      average,
      incidents,
      lowRatings,
      suggestions,
      identified,
      anonymous,
      attention: selfEvaluations.filter((item: any) =>
        !!item.had_incident ||
        [
          item.training_rating,
          item.organization_rating,
          item.snack_rating,
          item.partner_fiscal_rating,
        ].some((value) => Number(value) > 0 && Number(value) <= 2)
      ).length,
      criteria,
      weakestCriterion,
      strongestCriterion,
    };
  }, [selfEvaluations]);

  const clearSelfEvaluationFilters = () => {
    setSelfEvaluationSearch('');
    setSelfEvaluationRole('all');
    setSelfEvaluationCampus('all');
    setSelfEvaluationFocus('all');
  };

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

  const availableReplacementCandidates = useMemo(
    () => replacementCandidates.filter((candidate: any) => !candidate.sameDayConflict),
    [replacementCandidates]
  );

  const conflictedReplacementCandidates = useMemo(
    () => replacementCandidates.filter((candidate: any) => !!candidate.sameDayConflict),
    [replacementCandidates]
  );

  const selectedReplacementCandidate = useMemo(
    () => replacementCandidates.find((candidate: any) => candidate.id === replacementFiscalId) || null,
    [replacementCandidates, replacementFiscalId]
  );

  useEffect(() => {
    if (!replacementTarget || replacementFiscalId || !availableReplacementCandidates.length) return;
    setReplacementFiscalId(availableReplacementCandidates[0].id);
  }, [replacementTarget, replacementFiscalId, availableReplacementCandidates]);

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
    setReplacementTarget(link);
    setReplacementFiscalId('');
    setReplacementPickerOpen(false);
    setReplacementData(replacementAssignment(link));
  };

  const submitReplacement = async () => {
    if (!replacementTarget || !replacementFiscalId || !selectedReplacementCandidate) return;

    if (selectedReplacementCandidate.sameDayConflict) {
      toast.error('Este fiscal já está vinculado a outro evento no mesmo dia.');
      return;
    }

    await confirmationActions.replace.mutateAsync({
      oldLinkId: replacementTarget.id,
      collaboratorId: replacementFiscalId,
      assignment: replacementData,
    });

    setReplacementTarget(null);
    setReplacementFiscalId('');
    setReplacementPickerOpen(false);
    setReplacementData(null);
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
  }, [collaborators, links, searchFiscal, sameDayCollaboratorIds, roles, roleValue, campusValue]);

  const recommendedCollaborators = useMemo(() => {
    if (!roleValue) return [];

    const roleMatches = visibleCollaborators.filter((candidate: any) => candidate.roleCompatible);
    if (roleMatches.length > 0) return roleMatches;

    return visibleCollaborators
      .filter((candidate: any) => candidate.compatibilityScore > 0)
      .slice(0, 24);
  }, [visibleCollaborators, roleValue]);

  const displayedCollaborators = useMemo(
    () => fiscalView === 'best' && roleValue ? recommendedCollaborators : visibleCollaborators,
    [fiscalView, roleValue, recommendedCollaborators, visibleCollaborators]
  );

  const bestCollaboratorId = useMemo(
    () => roleValue && recommendedCollaborators[0]?.compatibilityScore > 0
      ? recommendedCollaborators[0].id
      : null,
    [recommendedCollaborators, roleValue]
  );

  useEffect(() => {
    setFiscalView(roleValue ? 'best' : 'all');
  }, [roleValue]);

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
                <Button
                  className="ps-gradient-button"
                  onClick={() => {
                    setFinalizeAcknowledged(false);
                    setFinalizeOpen(true);
                  }}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />Finalizar
                </Button>
              )}
            </div>
          </header>

          {activeTab === 'visao-geral' && (
            <section className="ps-event-stats" aria-label="Resumo do evento">
              <Card className="ps-event-stat ps-event-stat--violet"><CardContent><p>Equipe</p><strong>{links.length}</strong><span>fiscais vinculados</span></CardContent></Card>
              <Card className="ps-event-stat ps-event-stat--green"><CardContent><p>Confirmados</p><strong>{Number(confirmationSummary.confirmed || 0)}</strong><span>{Number(confirmationSummary.pending_confirmation || 0)} aguardando resposta</span></CardContent></Card>
              <Card className="ps-event-stat ps-event-stat--blue"><CardContent><p>Candidatos</p><strong>{candidates.length}</strong><span>{candidateOverview.missingLocation ? `${candidateOverview.missingLocation} com localização pendente` : 'localização conferida'}</span></CardContent></Card>
              <Card className={`ps-event-stat ${overviewActions.some((item) => item.severity === 'critical') ? 'ps-event-stat--rose' : 'ps-event-stat--green'}`}><CardContent><p>Ações pendentes</p><strong>{overviewActions.length}</strong><span>{overviewActions.length ? 'itens que pedem atenção' : 'nenhuma ação crítica agora'}</span></CardContent></Card>
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
            <Card className="overflow-hidden rounded-2xl border-primary/20 bg-gradient-to-br from-card/80 via-card/65 to-primary/[0.045]">
              <CardContent className="p-0">
                <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      {eventPhase === 'preparacao' ? (
                        <CalendarDays className="h-5 w-5" />
                      ) : eventPhase === 'operacao' ? (
                        <Sparkles className="h-5 w-5" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold">
                          {eventPhase === 'preparacao'
                            ? 'Preparação do evento'
                            : eventPhase === 'operacao'
                              ? 'Operação do evento'
                              : eventPhase === 'finalizado'
                                ? 'Evento finalizado'
                                : 'Pós-evento'}
                        </p>
                        <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 text-primary">
                          {eventPhase === 'preparacao' && daysUntilEvent !== null
                            ? daysUntilEvent === 1
                              ? 'Falta 1 dia'
                              : `Faltam ${daysUntilEvent} dias`
                            : eventPhase === 'operacao'
                              ? 'Hoje'
                              : eventPhase === 'finalizado'
                                ? 'Encerrado'
                                : 'Conferência final'}
                        </Badge>
                      </div>
                      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                        {eventPhase === 'preparacao'
                          ? 'Resolva confirmações, treinamentos, dados de candidatos e pagamentos antes do dia do processo.'
                          : eventPhase === 'operacao'
                            ? 'Priorize presença, ausências, substituições e fechamento dos prédios.'
                            : 'Conclua presença, pagamentos, avaliações e pendências antes do encerramento administrativo.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-2.5 text-right">
                      <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Ações</p>
                      <p className="mt-0.5 text-xl font-bold leading-none">{overviewActions.length}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-2.5 text-right">
                      <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Equipe confirmada</p>
                      <p className="mt-0.5 text-xl font-bold leading-none">{Number(confirmationSummary.confirmed || 0)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ListChecks className="h-4 w-4 text-primary" />
                        Atenção agora
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Pendências calculadas automaticamente a partir dos dados do evento.
                      </p>
                    </div>
                    <Badge
                      variant={overviewActions.some((item) => item.severity === 'critical') ? 'destructive' : 'secondary'}
                      className="rounded-full"
                    >
                      {overviewActions.length} ação(ões)
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-2">
                  {overviewActions.slice(0, 6).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveTab(item.tab)}
                      className={`group flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-md ${item.severity === 'critical'
                        ? 'border-destructive/25 bg-destructive/[0.045]'
                        : item.severity === 'warning'
                          ? 'border-amber-500/20 bg-amber-500/[0.035]'
                          : 'border-primary/15 bg-primary/[0.025]'}`}
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.severity === 'critical'
                        ? 'bg-destructive/10 text-destructive'
                        : item.severity === 'warning'
                          ? 'bg-amber-500/10 text-amber-500'
                          : 'bg-primary/10 text-primary'}`}>
                        {item.key === 'email' ? (
                          <MailWarning className="h-4 w-4" />
                        ) : item.key.startsWith('training') ? (
                          <GraduationCap className="h-4 w-4" />
                        ) : item.key === 'pix' ? (
                          <WalletCards className="h-4 w-4" />
                        ) : item.key === 'candidate-location' ? (
                          <UserRoundCheck className="h-4 w-4" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">{item.title}</p>
                          {item.count !== undefined && (
                            <Badge variant="outline" className="rounded-full px-2 text-[9px]">
                              {item.count}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                          {item.description}
                        </p>
                      </div>

                      <span className="hidden shrink-0 items-center gap-1 text-[10px] font-semibold text-primary sm:flex">
                        {item.action}
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </button>
                  ))}

                  {!overviewActions.length && (
                    <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-emerald-500/20 bg-emerald-500/[0.025] p-6">
                      <div className="max-w-md text-center">
                        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <p className="mt-3 text-sm font-semibold">Nenhuma ação crítica identificada</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          Os principais pontos operacionais monitorados pelo sistema estão em ordem.
                        </p>
                      </div>
                    </div>
                  )}

                  {overviewActions.length > 6 && (
                    <p className="pt-1 text-center text-[10px] text-muted-foreground">
                      +{overviewActions.length - 6} outra(s) ação(ões) identificada(s).
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Preparação do evento</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Acompanhe a cobertura das etapas que antecedem a operação.
                  </p>
                </CardHeader>

                <CardContent className="space-y-4">
                  {preparationItems.map((item) => {
                    const percentage = item.total > 0
                      ? Math.max(0, Math.min(100, Math.round((item.value / item.total) * 100)))
                      : 100;

                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setActiveTab(item.tab)}
                        className="block w-full rounded-xl p-1 text-left transition hover:bg-muted/30"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold">{item.label}</p>
                            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{item.detail}</p>
                          </div>
                          <span className="shrink-0 text-xs font-bold tabular-nums">{percentage}%</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/60">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)]">
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Atalhos operacionais</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Vá direto para as áreas mais usadas neste evento.
                  </p>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: 'Equipe e comunicação', tab: 'equipe-comunicacao', detail: `${Number(confirmationSummary.pending_confirmation || 0)} aguardando`, icon: Users },
                    { label: 'Treinamentos', tab: 'treinamentos', detail: trainingOverview.pendingPeople ? `${trainingOverview.pendingPeople} pendente(s)` : 'sem pendências', icon: GraduationCap },
                    { label: 'Presença', tab: 'presenca', detail: eventPhase === 'preparacao' ? 'pronta para o dia' : `${attendancePendingCount} pendente(s)`, icon: CheckCircle2 },
                    { label: 'Pagamentos', tab: 'pagamentos', detail: `${paymentOverview.payable} liberado(s)`, icon: WalletCards },
                  ].map((shortcut) => {
                    const Icon = shortcut.icon;
                    return (
                      <button
                        key={shortcut.tab}
                        type="button"
                        onClick={() => setActiveTab(shortcut.tab)}
                        className="group rounded-2xl border border-border/60 bg-card/50 p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/[0.025] hover:shadow-md"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <p className="mt-3 text-xs font-semibold">{shortcut.label}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{shortcut.detail}</p>
                        <div className="mt-3 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-primary">
                          Abrir
                          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Links públicos</CardTitle>
                  <p className="text-xs text-muted-foreground">Copie os acessos usados durante o evento.</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { label: 'Avaliação de fiscais', url: `${publicBase}/avaliacao/${event.id}` },
                    { label: 'Autoavaliação', url: `${publicBase}/autoavaliacao/${event.id}` },
                    { label: 'Presença / assinatura', url: `${publicBase}/presenca/${event.id}` },
                  ].map((link) => (
                    <Button
                      key={link.url}
                      variant="outline"
                      className="w-full justify-between rounded-xl"
                      onClick={() => copy(link.url)}
                    >
                      {link.label}
                      <Copy className="h-4 w-4" />
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </div>

            {(eventPhase === 'operacao' || eventPhase === 'pos-evento') && (
              <Card className="rounded-2xl border-primary/15">
                <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Fechamento operacional</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {openAttendanceLocations
                        ? `${openAttendanceLocations} prédio(s)/local(is) ainda não foram fechados.`
                        : 'Todos os prédios/locais da presença estão fechados.'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 rounded-xl"
                    onClick={() => setActiveTab('presenca')}
                  >
                    Abrir presença
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="configuracoes" className="space-y-4 pt-4">
            {eventSettings && (
              <>
                <Card className="overflow-hidden rounded-2xl border-primary/20 bg-gradient-to-r from-card/80 via-card/70 to-primary/[0.04]">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold">Central de configurações do evento</p>
                          <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 text-primary">
                            {PS_EVENT_STATUS[event.status]}
                          </Badge>
                        </div>
                        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                          Organize os dados institucionais e as regras que realmente são persistidas pelo sistema.
                          Configurações operacionais específicas continuam sendo geridas nos respectivos módulos.
                        </p>
                      </div>

                      <Button
                        type="button"
                        className="shrink-0 rounded-xl"
                        disabled={savingEventSettings || save.isPending}
                        onClick={() => void saveEventSettings()}
                      >
                        {savingEventSettings || save.isPending ? 'Salvando...' : 'Salvar configurações'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Dados do evento</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Informações usadas nos relatórios, telas públicas e rotinas operacionais.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5 md:col-span-2">
                          <Label>Nome do evento *</Label>
                          <Input
                            value={eventSettings.name}
                            onChange={(e) => setEventSettings({ ...eventSettings, name: e.target.value })}
                            className="rounded-xl"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Data *</Label>
                          <Input
                            type="date"
                            value={eventSettings.date}
                            onChange={(e) => setEventSettings({ ...eventSettings, date: e.target.value })}
                            className="rounded-xl"
                          />
                          {eventSettings.date !== event.date && (
                            <p className="text-[10px] leading-relaxed text-amber-500">
                              Alterar a data pode afetar validações de conflito de fiscais e a fase operacional do evento.
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label>Coordenador responsável</Label>
                          <Input
                            value={eventSettings.coordinator_name}
                            onChange={(e) => setEventSettings({ ...eventSettings, coordinator_name: e.target.value })}
                            placeholder="Nome do coordenador"
                            className="rounded-xl"
                          />
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                          <Label>Local geral</Label>
                          <Input
                            value={eventSettings.location}
                            onChange={(e) => setEventSettings({ ...eventSettings, location: e.target.value })}
                            placeholder="Ex.: FUMEC - Campus principal"
                            className="rounded-xl"
                          />
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                          <Label>Descrição</Label>
                          <Textarea
                            rows={3}
                            value={eventSettings.description}
                            onChange={(e) => setEventSettings({ ...eventSettings, description: e.target.value })}
                            placeholder="Descrição institucional ou orientações gerais."
                            className="rounded-xl"
                          />
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                          <Label>Observações internas</Label>
                          <Textarea
                            rows={3}
                            value={eventSettings.notes}
                            onChange={(e) => setEventSettings({ ...eventSettings, notes: e.target.value })}
                            placeholder="Anotações administrativas que não precisam aparecer ao público."
                            className="rounded-xl"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    <Card className="rounded-2xl">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Avaliações</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          Controle o que fica disponível para os fiscais e para o fluxo de avaliação.
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 p-4">
                          <div>
                            <p className="text-sm font-medium">Permitir autoavaliação</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                              Quando ativa, o evento aparece para preenchimento da autoavaliação.
                            </p>
                          </div>
                          <Switch
                            checked={!!eventSettings.self_evaluation_enabled}
                            onCheckedChange={(checked) =>
                              setEventSettings({ ...eventSettings, self_evaluation_enabled: checked })
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 p-4">
                          <div>
                            <p className="text-sm font-medium">Ocultar da avaliação</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                              Impede que este evento apareça nos fluxos públicos de avaliação quando habilitado.
                            </p>
                          </div>
                          <Switch
                            checked={!!eventSettings.hidden_from_evaluation}
                            onCheckedChange={(checked) =>
                              setEventSettings({ ...eventSettings, hidden_from_evaluation: checked })
                            }
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Status das regras operacionais</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          Estas regras são configuradas nos módulos especializados.
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {[
                          {
                            label: 'Confirmações',
                            detail: `${Number(confirmationSummary.confirmed || 0)} confirmados · ${Number(confirmationSummary.pending_confirmation || 0)} aguardando`,
                            tab: 'equipe-comunicacao',
                            status: Number(confirmationSummary.pending_confirmation || 0) ? 'warning' : 'ready',
                          },
                          {
                            label: 'Treinamentos obrigatórios',
                            detail: trainingOverview.configured
                              ? trainingOverview.pendingPeople
                                ? `${trainingOverview.pendingPeople} pendente(s)`
                                : 'sem pendências obrigatórias'
                              : 'nenhum obrigatório configurado',
                            tab: 'treinamentos',
                            status: trainingOverview.pendingPeople ? 'warning' : 'ready',
                          },
                          {
                            label: 'Presença e fechamento',
                            detail: eventPhase === 'preparacao'
                              ? 'será executado no dia do evento'
                              : `${attendancePendingCount} pendente(s) · ${openAttendanceLocations} local(is) aberto(s)`,
                            tab: 'presenca',
                            status: eventPhase !== 'preparacao' && (attendancePendingCount || openAttendanceLocations) ? 'warning' : 'ready',
                          },
                          {
                            label: 'Pagamentos',
                            detail: paymentOverview.missingPix
                              ? `${paymentOverview.missingPix} fiscal(is) sem PIX`
                              : 'dados de PIX completos para os ativos',
                            tab: 'pagamentos',
                            status: paymentOverview.missingPix ? 'warning' : 'ready',
                          },
                        ].map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => setActiveTab(item.tab)}
                            className="group flex w-full items-center justify-between gap-3 rounded-xl border border-border/60 p-3 text-left transition hover:border-primary/20 hover:bg-primary/[0.02]"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold">{item.label}</p>
                              <p className="mt-1 truncate text-[10px] text-muted-foreground">{item.detail}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Badge
                                variant="outline"
                                className={`rounded-full text-[8px] ${item.status === 'warning' ? 'border-amber-500/25 text-amber-500' : 'border-emerald-500/20 text-emerald-500'}`}
                              >
                                {item.status === 'warning' ? 'Atenção' : 'OK'}
                              </Badge>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                            </div>
                          </button>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <Card className="rounded-2xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Links públicos do evento</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Acesse rapidamente as páginas que dependem das regras acima.
                    </p>
                  </CardHeader>
                  <CardContent className="grid gap-2 md:grid-cols-3">
                    {[
                      { label: 'Avaliação de fiscais', url: `${publicBase}/avaliacao/${event.id}` },
                      { label: 'Autoavaliação', url: `${publicBase}/autoavaliacao/${event.id}` },
                      { label: 'Presença / assinatura', url: `${publicBase}/presenca/${event.id}` },
                    ].map((link) => (
                      <Button
                        key={link.url}
                        type="button"
                        variant="outline"
                        className="justify-between rounded-xl"
                        onClick={() => copy(link.url)}
                      >
                        {link.label}
                        <Copy className="h-4 w-4" />
                      </Button>
                    ))}
                  </CardContent>
                </Card>
              </>
            )}
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
            <Card className="overflow-hidden rounded-2xl border-primary/20 bg-gradient-to-r from-card/80 via-card/70 to-primary/[0.04]">
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold">Operação de presença</p>
                      <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 text-primary">
                        {presenceOverview.completion}% concluído
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {presenceOverview.resolved} de {presenceOverview.total} fiscais já estão resolvidos como presentes ou ausentes.
                    </p>
                    <div className="mt-3 h-2 max-w-2xl overflow-hidden rounded-full bg-muted/60">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${presenceOverview.completion}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-2.5 text-right">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Locais fechados</p>
                      <p className="mt-0.5 text-xl font-bold leading-none">
                        {presenceOverview.closedLocations}/{presenceOverview.locations}
                      </p>
                    </div>
                    <div className={`rounded-2xl border px-4 py-2.5 text-right ${presenceOverview.pending ? 'border-amber-500/20 bg-amber-500/[0.04]' : 'border-emerald-500/20 bg-emerald-500/[0.04]'}`}>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Pendentes</p>
                      <p className={`mt-0.5 text-xl font-bold leading-none ${presenceOverview.pending ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {presenceOverview.pending}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => {
                  setPresenceLocation('all');
                  setPresenceStatus('present');
                  setPresenceListOpen(true);
                }}
                className="text-left"
              >
                <Card className="h-full rounded-2xl transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Presentes</p>
                    <p className="mt-1 text-2xl font-bold">{presenceOverview.present}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{presenceOverview.signed} com assinatura registrada</p>
                  </CardContent>
                </Card>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPresenceLocation('all');
                  setPresenceStatus('pending');
                  setPresenceListOpen(true);
                }}
                className="text-left"
              >
                <Card className={`h-full rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md ${presenceOverview.pending ? 'border-amber-500/25 bg-amber-500/[0.025]' : ''}`}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Pendentes</p>
                    <p className={`mt-1 text-2xl font-bold ${presenceOverview.pending ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {presenceOverview.pending}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">clique para abrir somente os pendentes</p>
                  </CardContent>
                </Card>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPresenceLocation('all');
                  setPresenceStatus('absent');
                  setPresenceListOpen(true);
                }}
                className="text-left"
              >
                <Card className="h-full rounded-2xl transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Ausentes</p>
                    <p className="mt-1 text-2xl font-bold">{presenceOverview.absent}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">ausências formalizadas</p>
                  </CardContent>
                </Card>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPresenceLocation('all');
                  setPresenceStatus('departed');
                  setPresenceListOpen(true);
                }}
                className="text-left"
              >
                <Card className="h-full rounded-2xl transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Saídas registradas</p>
                    <p className="mt-1 text-2xl font-bold">{presenceOverview.departed}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">fiscais com encerramento de jornada</p>
                  </CardContent>
                </Card>
              </button>
            </div>

            <Card className="rounded-2xl">
              <CardHeader>
                <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <CardTitle className="text-base">Fechamento por prédio / local</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Acompanhe o avanço de cada local e abra diretamente as pendências que impedem o fechamento.
                    </p>
                  </div>
                  <Badge variant="secondary" className="w-fit rounded-full">
                    {presenceOverview.closedLocations} de {presenceOverview.locations} fechado(s)
                  </Badge>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {attendanceLocations.map((location: any) => {
                    const total = location.presentCount + location.absentCount + location.pendingCount;
                    const resolved = location.presentCount + location.absentCount;
                    const percentage = total ? Math.round((resolved / total) * 100) : 0;

                    return (
                      <div
                        key={location.key}
                        className={`rounded-2xl border p-4 transition ${location.closure
                          ? 'border-emerald-500/20 bg-emerald-500/[0.025]'
                          : location.pendingCount === 0
                            ? 'border-primary/25 bg-primary/[0.025]'
                            : 'border-border/60 bg-card/40'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <MapPin className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold">{location.building}</p>
                                {location.campusLabel && location.campusLabel !== location.building && (
                                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{location.campusLabel}</p>
                                )}
                              </div>
                            </div>
                          </div>

                          {location.closure ? (
                            <Badge className="shrink-0 rounded-full">Fechado</Badge>
                          ) : location.pendingCount > 0 ? (
                            <Badge variant="outline" className="shrink-0 rounded-full border-amber-500/25 text-amber-500">
                              {location.pendingCount} pendente(s)
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="shrink-0 rounded-full text-primary">
                              Pronto para fechar
                            </Badge>
                          )}
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-2xl font-bold">{percentage}%</p>
                            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
                              {resolved} de {total} resolvidos
                            </p>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 text-center">
                            <div className="rounded-lg bg-muted/40 px-2 py-1.5">
                              <p className="text-xs font-bold">{location.presentCount}</p>
                              <p className="text-[8px] uppercase text-muted-foreground">Pres.</p>
                            </div>
                            <div className="rounded-lg bg-muted/40 px-2 py-1.5">
                              <p className="text-xs font-bold">{location.absentCount}</p>
                              <p className="text-[8px] uppercase text-muted-foreground">Aus.</p>
                            </div>
                            <div className="rounded-lg bg-muted/40 px-2 py-1.5">
                              <p className="text-xs font-bold">{location.pendingCount}</p>
                              <p className="text-[8px] uppercase text-muted-foreground">Pend.</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/60">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>

                        {location.closure ? (
                          <div className="mt-4 rounded-xl border border-emerald-500/15 bg-background/50 p-3 text-xs">
                            <p className="font-medium">Fechado por {location.closure.coordinator_name}</p>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {location.closure.signed_at ? new Date(location.closure.signed_at).toLocaleString('pt-BR') : ''}
                            </p>
                          </div>
                        ) : (
                          <div className="mt-4 flex gap-2">
                            {location.pendingCount > 0 && (
                              <Button
                                type="button"
                                variant="outline"
                                className="flex-1 rounded-xl"
                                onClick={() => openPresenceLocation(location, 'pending')}
                              >
                                Ver pendentes
                                <ArrowRight className="ml-2 h-3.5 w-3.5" />
                              </Button>
                            )}
                            {location.pendingCount === 0 && (
                              <Button
                                type="button"
                                className="flex-1 rounded-xl"
                                disabled={!closureCoordinatorCandidates.length}
                                onClick={() => openClosureDialog(location)}
                              >
                                Fechar local
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="shrink-0 rounded-xl"
                              onClick={() => openPresenceLocation(location, 'all')}
                              title="Ver fiscais deste local"
                            >
                              <Users className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {!attendanceLocations.length && (
                    <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center md:col-span-2 xl:col-span-3">
                      <MapPin className="mx-auto h-8 w-8 text-muted-foreground/40" />
                      <p className="mt-2 text-sm font-semibold">Nenhum prédio/local identificado</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base">Controle de presença</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Consulte assinaturas, ausências e saídas sem perder o contexto do prédio selecionado.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => setPresenceListOpen((open) => !open)}
                  >
                    {presenceListOpen ? 'Ocultar fiscais' : `Ver fiscais (${operationalLinks.length})`}
                  </Button>

                  <Button asChild variant="outline" className="rounded-xl">
                    <a href={`${publicBase}/presenca/${event.id}`} target="_blank" rel="noreferrer">
                      Abrir coleta de assinaturas
                    </a>
                  </Button>
                </div>
              </CardHeader>

              {presenceListOpen && (
                <CardContent className="p-0">
                  <div className="space-y-3 border-b p-4">
                    <div className="grid gap-2 xl:grid-cols-[minmax(280px,1fr)_220px_220px_auto]">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={presenceSearch}
                          onChange={(event) => setPresenceSearch(event.target.value)}
                          placeholder="Buscar por nome, cargo, prédio, andar ou sala..."
                          className="h-10 rounded-xl pl-10"
                        />
                      </div>

                      <Select value={presenceLocation} onValueChange={setPresenceLocation}>
                        <SelectTrigger className="h-10 rounded-xl">
                          <SelectValue placeholder="Local" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os locais</SelectItem>
                          {attendanceLocations.map((location: any) => (
                            <SelectItem key={location.key} value={location.key}>
                              {location.building}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={presenceStatus} onValueChange={(value: any) => setPresenceStatus(value)}>
                        <SelectTrigger className="h-10 rounded-xl">
                          <SelectValue placeholder="Situação" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as situações</SelectItem>
                          <SelectItem value="pending">Pendentes</SelectItem>
                          <SelectItem value="present">Presentes / assinados</SelectItem>
                          <SelectItem value="absent">Ausentes</SelectItem>
                          <SelectItem value="departed">Saída registrada</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        type="button"
                        variant="ghost"
                        className="h-10 rounded-xl"
                        disabled={!presenceSearch && presenceStatus === 'all' && presenceLocation === 'all'}
                        onClick={clearPresenceFilters}
                      >
                        Limpar
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
                      <span>
                        <strong className="text-foreground">{presenceRows.length}</strong> fiscal(is) na visualização
                      </span>
                      {presenceLocation !== 'all' && (
                        <span>
                          Local: <strong className="text-foreground">
                            {attendanceLocations.find((location: any) => location.key === presenceLocation)?.building || 'Selecionado'}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="max-h-[28rem] divide-y overflow-y-auto">
                    {presenceRows.map((link: any) => (
                      <div
                        key={link.id}
                        className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{link.collaborator_name}</p>
                            {link.absent ? (
                              <Badge variant="destructive">Ausente</Badge>
                            ) : link.signed_at || link.present ? (
                              <Badge>Presente</Badge>
                            ) : (
                              <Badge variant="outline" className="border-amber-500/25 text-amber-500">Pendente</Badge>
                            )}
                            {link.signed_at && <Badge variant="secondary">Assinado</Badge>}
                            {link.departed_at && <Badge variant="secondary">Saída registrada</Badge>}
                          </div>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {[
                              link.role_name || link.assigned_role,
                              link.building,
                              link.floor && `${link.floor}º andar`,
                              link.room && `Sala ${link.room}`
                            ].filter(Boolean).join(' · ') || 'Sem localização definida'}
                          </p>

                          {link.signed_at && (
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              Assinatura: {new Date(link.signed_at).toLocaleString('pt-BR')}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-2 rounded-xl border px-3 py-2">
                            <Label className="text-xs">Ausente</Label>
                            <Switch
                              checked={!!link.absent}
                              onCheckedChange={(value) => {
                                if (value) openAbsenceDialog(link);
                                else void cancelAttendanceAbsence(link);
                              }}
                            />
                          </div>

                          {link.signed_at && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl"
                              onClick={() => resetAttendanceSignature(link)}
                            >
                              Refazer assinatura
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl"
                            disabled={!link.signed_at || link.absent}
                            onClick={() =>
                              setParticipantState(link, {
                                departed_at: link.departed_at ? null : new Date().toISOString()
                              })
                            }
                          >
                            {link.departed_at ? 'Cancelar saída' : 'Registrar saída'}
                          </Button>
                        </div>
                      </div>
                    ))}

                    {!presenceRows.length && (
                      <div className="p-8 text-center">
                        <Search className="mx-auto h-8 w-8 text-muted-foreground/40" />
                        <p className="mt-2 text-sm font-semibold">Nenhum fiscal encontrado</p>
                        <p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros para continuar.</p>
                      </div>
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
              <Card className="rounded-2xl border-primary/20 bg-primary/[0.035]">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Respostas recebidas</p>
                  <p className="mt-1 text-2xl font-bold">{selfEvaluationSummary.total}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {operationalLinks.length
                      ? `${selfEvaluationSummary.total} resposta(s) para ${operationalLinks.length} fiscais ativos`
                      : 'sem equipe ativa para referência'}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Identificação</p>
                  <p className="mt-1 text-2xl font-bold">{selfEvaluationSummary.identified}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {selfEvaluationSummary.anonymous} anônima(s)
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Média geral</p>
                  <p className="mt-1 text-2xl font-bold">
                    {selfEvaluationSummary.average ? selfEvaluationSummary.average.toFixed(1) : '—'}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    média combinada dos quatro critérios
                  </p>
                </CardContent>
              </Card>

              <button
                type="button"
                className="text-left"
                onClick={() => setSelfEvaluationFocus(selfEvaluationFocus === 'attention' ? 'all' : 'attention')}
              >
                <Card className={`h-full rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md ${selfEvaluationSummary.attention
                  ? 'border-amber-500/25 bg-amber-500/[0.035]'
                  : 'border-emerald-500/20 bg-emerald-500/[0.025]'}`}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Precisam de atenção</p>
                    <p className={`mt-1 text-2xl font-bold ${selfEvaluationSummary.attention ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {selfEvaluationSummary.attention}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      ocorrência ou pelo menos uma nota 1–2
                    </p>
                  </CardContent>
                </Card>
              </button>
            </div>

            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <CardTitle className="text-base">Leitura por critério</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Veja rapidamente onde o evento foi melhor e pior percebido pelos fiscais.
                    </p>
                  </div>

                  {selfEvaluationSummary.weakestCriterion && selfEvaluationSummary.strongestCriterion && (
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="rounded-full border-amber-500/20 text-[9px] text-amber-500">
                        Menor média: {selfEvaluationSummary.weakestCriterion.label} · {selfEvaluationSummary.weakestCriterion.average.toFixed(1)}
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-emerald-500/20 text-[9px] text-emerald-500">
                        Maior média: {selfEvaluationSummary.strongestCriterion.label} · {selfEvaluationSummary.strongestCriterion.average.toFixed(1)}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {selfEvaluationSummary.criteria.map((criterion) => (
                    <div key={criterion.key} className="rounded-2xl border border-border/60 bg-muted/[0.08] p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold">{criterion.label}</p>
                        <Badge
                          variant={criterion.responses && criterion.average <= 2.5
                            ? 'destructive'
                            : criterion.responses && criterion.average >= 4
                              ? 'default'
                              : 'secondary'}
                          className="rounded-full"
                        >
                          {criterion.responses ? `★ ${criterion.average.toFixed(1)}` : '—'}
                        </Badge>
                      </div>

                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/60">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${criterion.responses ? Math.min(100, (criterion.average / 5) * 100) : 0}%` }}
                        />
                      </div>

                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {criterion.responses} avaliação(ões) deste critério
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-base">Autoavaliações recebidas</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Respostas com ocorrência ou nota baixa aparecem primeiro para facilitar a análise.
                  </p>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: 'all', label: 'Todas', count: selfEvaluationSummary.total },
                    { key: 'attention', label: 'Precisam de atenção', count: selfEvaluationSummary.attention },
                    { key: 'low', label: 'Notas 1–2', count: selfEvaluationSummary.lowRatings },
                    { key: 'incident', label: 'Ocorrências', count: selfEvaluationSummary.incidents },
                    { key: 'suggestion', label: 'Com sugestão', count: selfEvaluationSummary.suggestions },
                    { key: 'identified', label: 'Identificadas', count: selfEvaluationSummary.identified },
                    { key: 'anonymous', label: 'Anônimas', count: selfEvaluationSummary.anonymous },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSelfEvaluationFocus(item.key as typeof selfEvaluationFocus)}
                      className={`flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-[10px] font-semibold transition ${selfEvaluationFocus === item.key
                        ? 'border-primary/30 bg-primary text-primary-foreground shadow-sm'
                        : 'border-border/60 bg-background/50 text-muted-foreground hover:border-primary/20 hover:bg-primary/[0.04] hover:text-foreground'}`}
                    >
                      {item.label}
                      <span className={`rounded-full px-1.5 py-0.5 tabular-nums ${selfEvaluationFocus === item.key ? 'bg-primary-foreground/15' : 'bg-muted/70'}`}>
                        {item.count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="grid gap-2 xl:grid-cols-[minmax(280px,1fr)_220px_220px_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={selfEvaluationSearch}
                      onChange={(event) => setSelfEvaluationSearch(event.target.value)}
                      placeholder="Buscar nome, cargo, campus, ocorrência ou sugestão..."
                      className="h-10 rounded-xl pl-10"
                    />
                  </div>

                  <Select value={selfEvaluationRole} onValueChange={setSelfEvaluationRole}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os cargos</SelectItem>
                      {selfEvaluationRoleOptions.map((role: any) => (
                        <SelectItem key={role} value={role}>
                          {roles.find((item: any) => item.value === role)?.name || role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selfEvaluationCampus} onValueChange={setSelfEvaluationCampus}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Campus" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os campus</SelectItem>
                      {selfEvaluationCampusOptions.map((campus: any) => (
                        <SelectItem key={campus} value={campus}>{campus}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 rounded-xl"
                    disabled={
                      !selfEvaluationSearch &&
                      selfEvaluationRole === 'all' &&
                      selfEvaluationCampus === 'all' &&
                      selfEvaluationFocus === 'all'
                    }
                    onClick={clearSelfEvaluationFilters}
                  >
                    Limpar
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <span><strong className="text-foreground">{selfEvaluationRows.length}</strong> resposta(s) na visualização</span>
                  <span>
                    O anonimato é preservado; respostas anônimas não permitem identificar pendências individuais.
                  </span>
                </div>

                <div className="max-h-[48rem] space-y-3 overflow-y-auto pr-1">
                  {selfEvaluationRows.map((e: any) => {
                    const roleLabel =
                      roles.find((role: any) => role.value === e.role)?.name ||
                      e.role ||
                      'Cargo não informado';

                    const ratingItems = [
                      { label: 'Treinamento', value: e.training_rating, comment: e.training_comment },
                      { label: 'Organização', value: e.organization_rating, comment: e.organization_comment },
                      { label: 'Lanche / alimentação', value: e.snack_rating, comment: e.snack_comment },
                      { label: 'Fiscal parceiro', value: e.partner_fiscal_rating, comment: e.partner_fiscal_comment },
                    ];

                    const hasLowRating = ratingItems.some((item) => Number(item.value) > 0 && Number(item.value) <= 2);
                    const needsAttention = hasLowRating || !!e.had_incident;

                    return (
                      <div
                        key={e.id}
                        className={`rounded-2xl border p-4 ${needsAttention
                          ? 'border-amber-500/20 bg-amber-500/[0.025]'
                          : 'border-border/60'}`}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">
                                {e.identified ? e.respondent_name || 'Identificado sem nome' : 'Resposta anônima'}
                              </p>

                              {!e.identified && <Badge variant="outline">Anônimo</Badge>}
                              {hasLowRating && (
                                <Badge variant="outline" className="border-amber-500/25 text-amber-500">
                                  Nota baixa
                                </Badge>
                              )}
                              {e.had_incident && <Badge variant="destructive">Ocorrência</Badge>}
                            </div>

                            <p className="mt-1 text-xs text-muted-foreground">
                              {[
                                roleLabel,
                                e.campus,
                                e.floor && `${e.floor}º andar`,
                                e.room && `Sala ${e.room}`,
                              ].filter(Boolean).join(' · ')}
                            </p>
                          </div>

                          <p className="shrink-0 text-xs text-muted-foreground">
                            {e.created_at ? new Date(e.created_at).toLocaleString('pt-BR') : ''}
                          </p>
                        </div>

                        <div className="mt-4 grid gap-2 md:grid-cols-2">
                          {ratingItems.map((item) => (
                            <div key={item.label} className="rounded-xl bg-muted/30 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-medium">{item.label}</p>
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
                                  <Badge variant="outline">Não avaliado</Badge>
                                )}
                              </div>

                              {item.comment && (
                                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                  {item.comment}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>

                        {(e.had_incident || e.suggestions) && (
                          <div className="mt-3 space-y-2">
                            {e.had_incident && (
                              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                                <p className="text-xs font-semibold text-destructive">Ocorrência informada</p>
                                <p className="mt-1 text-sm">{e.incident_comment || 'Sem descrição.'}</p>
                              </div>
                            )}

                            {e.suggestions && (
                              <div className="rounded-xl border p-3">
                                <p className="text-xs font-semibold">Sugestão de melhoria</p>
                                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{e.suggestions}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {!selfEvaluationRows.length && (
                    <div className="rounded-2xl border border-dashed p-8 text-center">
                      <p className="text-sm font-semibold">
                        {selfEvaluations.length ? 'Nenhuma resposta encontrada' : 'Nenhuma autoavaliação recebida'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selfEvaluations.length
                          ? 'Ajuste os filtros para visualizar outras respostas.'
                          : 'As respostas enviadas pelos fiscais aparecerão aqui.'}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="candidatos" className="space-y-4 pt-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-2xl border-primary/20 bg-primary/[0.035]">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Candidatos</p>
                  <p className="mt-1 text-2xl font-bold">{candidates.length}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{filteredCandidates.length} na visualização atual</p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Distribuição</p>
                  <p className="mt-1 text-2xl font-bold">{candidateDistributionSummary.rooms}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {candidateDistributionSummary.buildings} prédio(s) · {candidateDistributionSummary.campuses} campus
                  </p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Atendimento especial</p>
                  <p className="mt-1 text-2xl font-bold">{candidateDistributionSummary.pcd}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">candidato(s) com indicação PCD/especial</p>
                </CardContent>
              </Card>
              <Card className={`rounded-2xl ${candidateOverview.missingLocation ? 'border-amber-500/25 bg-amber-500/[0.035]' : 'border-emerald-500/20 bg-emerald-500/[0.025]'}`}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Inconsistências</p>
                  <p className={`mt-1 text-2xl font-bold ${candidateOverview.missingLocation ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {candidateOverview.missingLocation}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {candidateOverview.missingLocation ? 'sem campus, prédio ou sala completos' : 'localizações completas'}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Central de candidatos</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Consulte a distribuição, encontre inconsistências e filtre por local de prova.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={downloadPsCandidateTemplate} className="rounded-xl">
                      <Download className="mr-2 h-4 w-4" />Modelo XLSX
                    </Button>
                    <Button variant="outline" size="sm" asChild className="rounded-xl">
                      <label className="cursor-pointer">
                        <Upload className="mr-2 h-4 w-4" />Importar / atualizar
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = '';
                            if (file) void importCandidates(file);
                          }}
                        />
                      </label>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => exportCandidateBadges({
                        campus: candidateCampus === 'all' ? 'all' : candidateCampus,
                        building: candidateBuilding === 'all' ? 'all' : candidateBuilding,
                      })}
                      disabled={candidates.length === 0}
                    >
                      <IdCard className="mr-2 h-4 w-4" />Etiquetas
                    </Button>
                    {candidates.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm('Remover todos os candidatos do evento?')) removeAll.mutate(id!);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />Limpar lista
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 xl:grid-cols-[minmax(260px,1.4fr)_repeat(4,minmax(150px,0.65fr))]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={candidateSearch}
                      onChange={(event) => setCandidateSearch(event.target.value)}
                      placeholder="Buscar nome, CPF, inscrição, sala ou carteira..."
                      className="h-10 rounded-xl pl-10"
                    />
                  </div>

                  <Select value={candidateCampus} onValueChange={(value) => {
                    setCandidateCampus(value);
                    setCandidateBuilding('all');
                    setCandidateRoom('all');
                  }}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Campus" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os campus</SelectItem>
                      {candidateCampusOptions.map((campus) => (
                        <SelectItem key={campus} value={campus}>{campus}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={candidateBuilding} onValueChange={(value) => {
                    setCandidateBuilding(value);
                    setCandidateRoom('all');
                  }}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Prédio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os prédios</SelectItem>
                      {candidateBuildingOptions.map((building) => (
                        <SelectItem key={building} value={building}>{building}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={candidateRoom} onValueChange={setCandidateRoom}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Sala" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as salas</SelectItem>
                      {candidateRoomOptions.map((room) => (
                        <SelectItem key={room} value={room}>{room}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={candidateStatus} onValueChange={(value: any) => setCandidateStatus(value)}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Situação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as situações</SelectItem>
                      <SelectItem value="complete">Localização completa</SelectItem>
                      <SelectItem value="missing-location">Localização incompleta</SelectItem>
                      <SelectItem value="pcd">Atendimento especial / PCD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      <strong className="font-semibold text-foreground">{filteredCandidates.length}</strong> resultado(s)
                    </span>
                    {(candidateSearch || candidateCampus !== 'all' || candidateBuilding !== 'all' || candidateRoom !== 'all' || candidateStatus !== 'all') && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg px-2 text-[10px]"
                        onClick={clearCandidateFilters}
                      >
                        <FilterX className="mr-1 h-3.5 w-3.5" />Limpar filtros
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center rounded-xl border border-border/70 bg-background/70 p-1">
                    <button
                      type="button"
                      onClick={() => setCandidateView('list')}
                      className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition ${candidateView === 'list'
                        ? 'bg-muted text-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted/50'}`}
                    >
                      <List className="h-3.5 w-3.5" />Lista
                    </button>
                    <button
                      type="button"
                      onClick={() => setCandidateView('rooms')}
                      className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition ${candidateView === 'rooms'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted/50'}`}
                    >
                      <Rows3 className="h-3.5 w-3.5" />Por sala
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {candidateView === 'rooms' ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {candidateRoomGroups.map((group) => {
                  const pcdCount = group.candidates.filter((candidate: any) => candidate.pcd_type && candidate.pcd_type !== 'NORMAL').length;
                  const seats = group.candidates
                    .map((candidate: any) => Number(candidate.seat_number || candidate.seat || 0))
                    .filter((value: number) => Number.isFinite(value) && value > 0);
                  const maxSeat = seats.length ? Math.max(...seats) : null;

                  return (
                    <Card key={group.key} className="overflow-hidden rounded-2xl">
                      <CardHeader className="border-b border-border/60 pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <DoorOpen className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <CardTitle className="truncate text-sm">
                                  {group.room === 'Sala não informada' ? group.room : `Sala ${group.room}`}
                                </CardTitle>
                                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                                  {group.campus} · {group.building}
                                </p>
                              </div>
                            </div>
                          </div>
                          <Badge variant="secondary" className="shrink-0 rounded-full">
                            {group.candidates.length} candidato(s)
                          </Badge>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                          {maxSeat && <span>Até carteira {maxSeat}</span>}
                          {pcdCount > 0 && <span className="font-medium text-primary">{pcdCount} atendimento(s) especial(is)</span>}
                        </div>
                      </CardHeader>

                      <CardContent className="max-h-[22rem] divide-y overflow-y-auto p-0">
                        {group.candidates.map((candidate: any) => {
                          const missingLocation =
                            !String(candidate.campus || '').trim() ||
                            !String(candidate.building || '').trim() ||
                            !String(candidate.room || '').trim();

                          return (
                            <div key={candidate.id} className="flex items-center justify-between gap-3 p-3">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold" title={candidate.full_name}>
                                  {candidate.full_name}
                                </p>
                                <p className="mt-1 truncate text-[10px] text-muted-foreground">
                                  {[
                                    candidate.registration_number && `Inscrição ${candidate.registration_number}`,
                                    (candidate.seat_number || candidate.seat) && `Carteira ${candidate.seat_number || candidate.seat}`,
                                    candidate.exam_type,
                                  ].filter(Boolean).join(' · ') || 'Sem dados complementares'}
                                </p>
                              </div>

                              <div className="flex shrink-0 items-center gap-1.5">
                                {missingLocation && <Badge variant="outline" className="border-amber-500/25 text-[9px] text-amber-500">Incompleto</Badge>}
                                {candidate.pcd_type && candidate.pcd_type !== 'NORMAL' && (
                                  <Badge variant="secondary" className="text-[9px]">{candidate.pcd_type}</Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                })}

                {!candidateRoomGroups.length && (
                  <Card className="rounded-2xl xl:col-span-2">
                    <CardContent className="p-10 text-center">
                      <Building2 className="mx-auto h-8 w-8 text-muted-foreground/40" />
                      <p className="mt-3 text-sm font-semibold">Nenhuma sala encontrada</p>
                      <p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros para visualizar a distribuição.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card className="rounded-2xl">
                <CardContent className="divide-y p-0">
                  {filteredCandidates.map((candidate: any) => {
                    const missingLocation =
                      !String(candidate.campus || '').trim() ||
                      !String(candidate.building || '').trim() ||
                      !String(candidate.room || '').trim();

                    return (
                      <div key={candidate.id} className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{candidate.full_name}</p>
                            {missingLocation && (
                              <Badge variant="outline" className="border-amber-500/25 text-[9px] text-amber-500">
                                Localização incompleta
                              </Badge>
                            )}
                            {candidate.pcd_type && candidate.pcd_type !== 'NORMAL' && (
                              <Badge variant="secondary" className="text-[9px]">{candidate.pcd_type}</Badge>
                            )}
                          </div>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {[
                              candidate.campus,
                              candidate.building,
                              candidate.room && `Sala ${candidate.room}`,
                              (candidate.seat_number || candidate.seat) && `Carteira ${candidate.seat_number || candidate.seat}`,
                            ].filter(Boolean).join(' · ') || 'Sem localização definida'}
                          </p>

                          {(candidate.registration_number || candidate.exam_type) && (
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {[
                                candidate.registration_number && `Inscrição ${candidate.registration_number}`,
                                candidate.exam_type,
                              ].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-2 text-[10px] text-muted-foreground">
                          {candidate.cpf && <span>CPF {candidate.cpf}</span>}
                        </div>
                      </div>
                    );
                  })}

                  {!filteredCandidates.length && (
                    <div className="p-10 text-center">
                      <Search className="mx-auto h-8 w-8 text-muted-foreground/40" />
                      <p className="mt-3 text-sm font-semibold">Nenhum candidato encontrado</p>
                      <p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros ou a busca.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
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

      {/* Checklist de finalização */}
      <Dialog
        open={finalizeOpen}
        onOpenChange={(open) => {
          if (finalize.isPending) return;
          setFinalizeOpen(open);
          if (!open) setFinalizeAcknowledged(false);
        }}
      >
        <DialogContent
          className="flex max-h-[88vh] w-[calc(100vw-1.5rem)] max-w-[760px] flex-col gap-0 overflow-hidden rounded-[26px] border border-border/60 bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:max-w-[760px]"
          onInteractOutside={(event) => {
            if (finalize.isPending) event.preventDefault();
          }}
        >
          <DialogHeader className="relative shrink-0 overflow-hidden border-b border-border/60 px-5 py-5 text-left sm:px-7">
            <div className="pointer-events-none absolute -right-12 -top-20 h-44 w-44 rounded-full bg-primary/15 blur-3xl" />
            <div className="relative flex items-start gap-3 pr-8">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <ListChecks className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-xl font-bold tracking-tight">
                  Conferência antes de finalizar
                </DialogTitle>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  O encerramento altera o status do evento e recalcula o histórico de participações.
                  Revise os pontos abaixo antes de continuar.
                </p>
              </div>
            </div>

            <div className="relative mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-destructive/20 bg-destructive/[0.045] p-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-destructive/80">Críticos</p>
                <p className="mt-1 text-xl font-bold text-destructive">{finalizationSummary.critical}</p>
              </div>
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-500/80">Alertas</p>
                <p className="mt-1 text-xl font-bold text-amber-500">{finalizationSummary.warning}</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-500/80">Concluídos</p>
                <p className="mt-1 text-xl font-bold text-emerald-500">{finalizationSummary.ready}</p>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-7">
            <div className="space-y-2">
              {finalizationChecklist.map((item) => (
                <div
                  key={item.key}
                  className={`flex items-start gap-3 rounded-2xl border p-3.5 ${item.status === 'critical'
                    ? 'border-destructive/20 bg-destructive/[0.035]'
                    : item.status === 'warning'
                      ? 'border-amber-500/20 bg-amber-500/[0.03]'
                      : item.status === 'ready'
                        ? 'border-emerald-500/15 bg-emerald-500/[0.025]'
                        : 'border-border/60 bg-muted/[0.025]'}`}
                >
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${item.status === 'critical'
                    ? 'bg-destructive/10 text-destructive'
                    : item.status === 'warning'
                      ? 'bg-amber-500/10 text-amber-500'
                      : item.status === 'ready'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-muted/60 text-muted-foreground'}`}>
                    {item.status === 'ready'
                      ? <CheckCircle2 className="h-4 w-4" />
                      : item.status === 'info'
                        ? <CalendarDays className="h-4 w-4" />
                        : <AlertTriangle className="h-4 w-4" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold">{item.label}</p>
                      <Badge
                        variant="outline"
                        className={`rounded-full px-2 text-[8px] uppercase tracking-wide ${item.status === 'critical'
                          ? 'border-destructive/20 text-destructive'
                          : item.status === 'warning'
                            ? 'border-amber-500/20 text-amber-500'
                            : item.status === 'ready'
                              ? 'border-emerald-500/20 text-emerald-500'
                              : 'text-muted-foreground'}`}
                      >
                        {item.status === 'critical'
                          ? 'Crítico'
                          : item.status === 'warning'
                            ? 'Atenção'
                            : item.status === 'ready'
                              ? 'Concluído'
                              : 'Informativo'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>

                  {item.tab && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 shrink-0 rounded-lg px-2 text-[10px]"
                      onClick={() => {
                        setActiveTab(item.tab!);
                        setFinalizeOpen(false);
                        setFinalizeAcknowledged(false);
                      }}
                    >
                      Revisar
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {finalizationSummary.critical > 0 && (
              <div className="mt-4 rounded-2xl border border-destructive/25 bg-destructive/[0.04] p-4">
                <div className="flex items-start gap-3">
                  <Switch
                    id="finalize-acknowledgement"
                    checked={finalizeAcknowledged}
                    onCheckedChange={setFinalizeAcknowledged}
                  />
                  <Label
                    htmlFor="finalize-acknowledgement"
                    className="cursor-pointer text-xs leading-relaxed"
                  >
                    Estou ciente das <strong>{finalizationSummary.critical} pendência(s) crítica(s)</strong> e quero finalizar o evento mesmo assim.
                  </Label>
                </div>
              </div>
            )}

            {finalizationSummary.critical === 0 && finalizationSummary.warning > 0 && (
              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/[0.035] p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Não há impedimentos críticos, mas ainda existem {finalizationSummary.warning} alerta(s) que merecem conferência.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t border-border/60 bg-background/95 px-5 py-3.5 sm:px-7">
            <div className="mr-auto hidden sm:block">
              <p className="text-xs font-medium">
                {finalizationSummary.critical
                  ? 'Existem pendências críticas'
                  : finalizationSummary.warning
                    ? 'Finalização possível com alertas'
                    : 'Checklist operacional concluído'}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                A finalização pode ser feita apenas por decisão consciente do administrador.
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              className="rounded-xl"
              disabled={finalize.isPending}
              onClick={() => {
                setFinalizeOpen(false);
                setFinalizeAcknowledged(false);
              }}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              className="min-w-44 rounded-xl shadow-lg shadow-primary/15"
              disabled={finalize.isPending || (finalizationSummary.critical > 0 && !finalizeAcknowledged)}
              onClick={async () => {
                await finalize.mutateAsync(event.id);
                setFinalizeOpen(false);
                setFinalizeAcknowledged(false);
              }}
            >
              {finalize.isPending
                ? 'Finalizando...'
                : finalizationSummary.critical > 0
                  ? 'Finalizar mesmo assim'
                  : finalizationSummary.warning > 0
                    ? 'Finalizar com alertas'
                    : 'Finalizar evento'}
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
            setFiscalView('all');
          }
        }}
      >
        <DialogContent
          className="flex h-[min(88vh,820px)] w-[calc(100vw-1.5rem)] max-w-[1180px] flex-col gap-0 overflow-hidden rounded-[26px] border border-border/60 bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:max-w-[1180px]"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="relative shrink-0 overflow-hidden border-b border-border/60 px-5 py-5 text-left sm:px-7">
            <div className="pointer-events-none absolute -right-16 -top-24 h-52 w-52 rounded-full bg-primary/15 blur-3xl" />
            <div className="pointer-events-none absolute left-1/3 top-0 h-24 w-72 -translate-y-1/2 rounded-full bg-violet-500/10 blur-3xl" />

            <div className="relative flex flex-col gap-4 pr-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                    <UserRoundCheck className="h-4.5 w-4.5" />
                  </div>
                  <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                    Alocação inteligente
                  </Badge>
                </div>

                <DialogTitle className="text-xl font-bold tracking-tight sm:text-2xl">
                  Vincular fiscais ao evento
                </DialogTitle>
                <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  Configure a atuação e escolha os fiscais. A lista é ordenada automaticamente
                  pelo melhor encaixe para o evento.
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div className="rounded-2xl border border-border/60 bg-card/70 px-4 py-2.5 text-right shadow-sm">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Selecionados
                  </p>
                  <div className="mt-0.5 flex items-center justify-end gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-xl font-bold leading-none">{selected.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="min-h-0 overflow-y-auto border-b border-border/60 bg-muted/[0.025] lg:border-b-0 lg:border-r">
              <div className="space-y-4 p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">1. Configure a atuação</p>
                    <p className="text-[11px] text-muted-foreground">Vale para todos os selecionados.</p>
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-xs font-semibold">
                      <BriefcaseBusiness className="h-3.5 w-3.5 text-primary" />
                      Função *
                    </Label>
                    <Select value={roleValue} onValueChange={setRoleValue}>
                      <SelectTrigger className="h-11 w-full rounded-xl border-border/70 bg-background/80">
                        <SelectValue placeholder="Selecione a função" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((r: any) => (
                          <SelectItem key={r.id} value={r.value}>
                            {r.name} — R$ {Number(r.pay_value).toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                      A função influencia diretamente a pontuação de compatibilidade.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="flex items-center gap-2 text-xs font-semibold">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        Campus *
                      </Label>
                      {eventCampusOptions.length > 0 && (
                        <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                          {eventCampusOptions.length === 1 ? 'já usado' : 'já usados'}
                        </span>
                      )}
                    </div>

                    {eventCampusOptions.length > 0 ? (
                      <>
                        <Select
                          value={eventCampusOptions.includes(campusValue.trim()) ? campusValue.trim() : ''}
                          onValueChange={setCampusValue}
                        >
                          <SelectTrigger className="h-11 w-full rounded-xl border-border/70 bg-background/80">
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
                            className="h-10 rounded-xl border-border/70 bg-background/80"
                          />
                        )}
                      </>
                    ) : (
                      <Input
                        value={campusValue}
                        onChange={(e) => setCampusValue(e.target.value)}
                        placeholder="Ex.: Campus Fumec"
                        className="h-11 rounded-xl border-border/70 bg-background/80"
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-border/60 bg-card/60 p-3.5">
                    <p className="text-2xl font-bold tracking-tight">{visibleCollaborators.length}</p>
                    <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Disponíveis
                    </p>
                  </div>
                  <div className="rounded-2xl border border-primary/20 bg-primary/[0.07] p-3.5">
                    <p className="text-2xl font-bold tracking-tight text-primary">{selected.length}</p>
                    <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Selecionados
                    </p>
                  </div>
                </div>

                {selected.length > 0 && (
                  <div className="rounded-2xl border border-primary/20 bg-primary/[0.035] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold">Seleção atual</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">Clique em um nome para remover.</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 rounded-lg px-2 text-[10px]"
                        onClick={() => setSelected([])}
                      >
                        Limpar
                      </Button>
                    </div>
                    <div className="mt-3 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                      {selected.map((cid) => {
                        const person = collaborators.find((c: any) => c.id === cid) as any;
                        return person ? (
                          <button
                            key={cid}
                            type="button"
                            onClick={() => setSelected(selected.filter((x) => x !== cid))}
                            className="max-w-full truncate rounded-full border border-primary/15 bg-background/80 px-2.5 py-1 text-[10px] font-medium transition hover:border-primary/30 hover:bg-primary/5"
                            title={person.full_name}
                          >
                            {person.full_name}
                          </button>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.07] to-primary/[0.03] p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                    <p className="text-xs font-semibold">Encaixe inteligente</p>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                    Função, preferência, unidade, jornada e avaliação compõem o percentual.
                    Os melhores candidatos aparecem primeiro.
                  </p>
                </div>
              </div>
            </aside>

            <section className="flex min-h-0 min-w-0 flex-col bg-background/40">
              <div className="shrink-0 border-b border-border/60 px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">2. Escolha os fiscais</p>
                        <p className="text-[11px] text-muted-foreground">
                          Ativos, livres no dia e ainda não vinculados a este evento.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center rounded-xl border border-border/70 bg-background/70 p-1">
                      <button
                        type="button"
                        disabled={!roleValue}
                        onClick={() => setFiscalView('best')}
                        className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition ${fiscalView === 'best' && roleValue
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'} disabled:cursor-not-allowed disabled:opacity-40`}
                        title={!roleValue ? 'Selecione uma função para ver os melhores encaixes' : undefined}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Melhores
                        {roleValue && (
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${fiscalView === 'best'
                            ? 'bg-primary-foreground/15 text-primary-foreground'
                            : 'bg-muted text-muted-foreground'}`}>
                            {recommendedCollaborators.length}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFiscalView('all')}
                        className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition ${fiscalView === 'all'
                          ? 'bg-muted text-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}
                      >
                        <Users className="h-3.5 w-3.5" />
                        Todos
                        <span className="rounded-full bg-background/70 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                          {visibleCollaborators.length}
                        </span>
                      </button>
                    </div>

                    {displayedCollaborators.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 shrink-0 rounded-xl border-border/70 bg-background/70"
                        onClick={() => {
                          const ids = displayedCollaborators.map((c: any) => c.id);
                          const allSelected = ids.every((cid: string) => selected.includes(cid));
                          setSelected(
                            allSelected
                              ? selected.filter((cid) => !ids.includes(cid))
                              : Array.from(new Set([...selected, ...ids]))
                          );
                        }}
                      >
                        {displayedCollaborators.every((c: any) => selected.includes(c.id))
                          ? 'Desmarcar visíveis'
                          : 'Selecionar visíveis'}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="relative mt-4">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchFiscal}
                    onChange={(e) => setSearchFiscal(e.target.value)}
                    placeholder="Buscar por nome, e-mail, matrícula, instituição ou unidade..."
                    className="h-11 rounded-xl border-border/70 bg-card/70 pl-10 pr-4 shadow-sm"
                  />
                </div>
              </div>

              <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 sm:px-6">
                {displayedCollaborators.length === 0 ? (
                  <div className="flex min-h-64 items-center justify-center rounded-3xl border border-dashed border-border/70 bg-muted/[0.025]">
                    <div className="max-w-xs text-center">
                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
                        <Search className="h-5 w-5" />
                      </div>
                      <p className="mt-3 text-sm font-semibold">
                        {fiscalView === 'best' && roleValue ? 'Nenhum encaixe recomendado encontrado' : 'Nenhum fiscal encontrado'}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {fiscalView === 'best' && roleValue
                          ? 'Não há fiscais com função compatível entre os resultados atuais.'
                          : 'Ajuste a função, o campus ou os termos da busca.'}
                      </p>
                      {fiscalView === 'best' && roleValue && visibleCollaborators.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-4 rounded-xl"
                          onClick={() => setFiscalView('all')}
                        >
                          Ver todos os fiscais
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid min-w-0 gap-3 xl:grid-cols-2">
                    {displayedCollaborators.map((c: any) => {
                      const emailText = c.email ? String(c.email).trim() : '';
                      const matriculaText = c.matricula ? String(c.matricula).trim() : '';
                      const institutionText = c.institution ? String(c.institution).trim() : '';
                      const unitText = c.unit ? String(c.unit).trim() : '';
                      const collaboratorPix = typeof c?.pix === 'string' ? c.pix : '';
                      const resolvedPix = (pixOverrideById[c.id] ?? collaboratorPix ?? '').trim();
                      const isSelected = selected.includes(c.id);
                      const isBestMatch = !!roleValue && c.id === bestCollaboratorId;
                      const isRecommended = !!roleValue && !!c.roleCompatible && c.compatibilityScore >= 45;

                      return (
                        <div
                          key={c.id}
                          className={`group relative min-w-0 overflow-hidden rounded-2xl border p-4 transition-all duration-200 ${isSelected
                            ? 'border-primary/55 bg-gradient-to-br from-primary/[0.11] to-primary/[0.03] shadow-[0_10px_32px_-18px_hsl(var(--primary))]'
                            : isBestMatch
                              ? 'border-violet-500/55 bg-gradient-to-br from-violet-500/[0.10] via-primary/[0.04] to-card/60 shadow-[0_12px_34px_-22px_hsl(var(--primary))] ring-1 ring-violet-500/10'
                              : isRecommended
                                ? 'border-primary/30 bg-primary/[0.025] hover:-translate-y-0.5 hover:border-primary/45 hover:bg-primary/[0.05] hover:shadow-lg'
                                : 'border-border/60 bg-card/55 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-card/80 hover:shadow-lg'}`}
                        >
                          {isBestMatch && !isSelected && (
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/80 to-transparent" />
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setSelected(
                                isSelected
                                  ? selected.filter((x) => x !== c.id)
                                  : [...selected, c.id]
                              )
                            }
                            className="w-full min-w-0 text-left"
                          >
                            <div className="flex min-w-0 items-start gap-3">
                              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${isSelected
                                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                : 'border-border/70 bg-muted/30 text-muted-foreground group-hover:border-primary/25 group-hover:text-primary'}`}>
                                {isSelected ? <Check className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                      <p className="min-w-0 truncate text-sm font-semibold leading-tight" title={c.full_name || 'Sem nome'}>
                                        {c.full_name || 'Sem nome'}
                                      </p>
                                      {isBestMatch ? (
                                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-violet-400">
                                          <Sparkles className="h-2.5 w-2.5" />
                                          Melhor encaixe
                                        </span>
                                      ) : isRecommended ? (
                                        <span className="shrink-0 rounded-full border border-primary/15 bg-primary/[0.07] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-primary">
                                          Recomendado
                                        </span>
                                      ) : null}
                                    </div>
                                    {matriculaText && (
                                      <p className="mt-1 text-[10px] text-muted-foreground">Matrícula {matriculaText}</p>
                                    )}
                                  </div>

                                  {c.compatibilityScore > 0 && (
                                    <div className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-right ${c.compatibilityScore >= 70
                                      ? 'border-primary/20 bg-primary/10 text-primary'
                                      : 'border-border/60 bg-muted/30 text-muted-foreground'}`}>
                                      <p className="text-sm font-bold leading-none">{c.compatibilityScore}%</p>
                                      <p className="mt-1 text-[8px] font-semibold uppercase tracking-wide">encaixe</p>
                                    </div>
                                  )}
                                </div>

                                <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                                  {emailText && <p className="truncate" title={emailText}>{emailText}</p>}
                                  {(institutionText || unitText) && (
                                    <p className="truncate" title={[institutionText, unitText].filter(Boolean).join(' · ')}>
                                      {[institutionText, unitText].filter(Boolean).join(' · ')}
                                    </p>
                                  )}
                                </div>

                                {c.compatibilityReasons?.length > 0 && (
                                  <div className="mt-2.5 flex min-w-0 flex-wrap gap-1">
                                    {c.compatibilityReasons.slice(0, 3).map((reason: string) => (
                                      <span
                                        key={reason}
                                        className="rounded-full border border-primary/10 bg-primary/[0.055] px-2 py-0.5 text-[9px] font-medium text-primary/90"
                                      >
                                        {reason}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>

                          {isSelected && (
                            <div className="mt-3 border-t border-primary/15 pt-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <Label className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                  Chave PIX
                                </Label>
                                <Badge
                                  variant={resolvedPix ? 'default' : 'secondary'}
                                  className="rounded-full px-2 text-[9px]"
                                >
                                  {resolvedPix ? 'Cadastrado' : 'Pendente'}
                                </Badge>
                              </div>
                              <Input
                                value={resolvedPix}
                                onChange={(event) =>
                                  setPixOverrideById((prev) => ({
                                    ...prev,
                                    [c.id]: event.target.value,
                                  }))
                                }
                                placeholder={collaboratorPix ? 'PIX do fiscal' : 'Informe o PIX para vincular'}
                                className="h-9 rounded-xl border-primary/15 bg-background/80"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

          <DialogFooter className="shrink-0 border-t border-border/60 bg-background/95 px-5 py-3.5 sm:px-7">
            <div className="mr-auto hidden min-w-0 sm:block">
              <p className="text-xs font-medium">
                {selected.length
                  ? `${selected.length} fiscal(is) pronto(s) para vincular`
                  : 'Selecione pelo menos um fiscal para continuar'}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Função e campus são obrigatórios.
              </p>
            </div>

            <Button
              variant="ghost"
              className="rounded-xl"
              onClick={() => {
                setAddOpen(false);
                setSelected([]);
                setRoleValue('');
                setCampusValue('');
                setPixOverrideById({});
              }}
            >
              Cancelar
            </Button>
            <Button
              className="min-w-40 rounded-xl shadow-lg shadow-primary/15"
              onClick={linkFiscals}
              disabled={!selected.length || !roleValue || !campusValue.trim() || add.isPending}
            >
              {add.isPending
                ? 'Vinculando...'
                : selected.length
                  ? `Vincular ${selected.length} fiscal(is)`
                  : 'Vincular fiscais'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Avaliar */}

      <Dialog
        open={!!replacementTarget}
        onOpenChange={(open) => {
          if (!open && !confirmationActions.replace.isPending) {
            setReplacementTarget(null);
            setReplacementFiscalId('');
            setReplacementPickerOpen(false);
            setReplacementData(null);
          }
        }}
      >
        <DialogContent
          className="flex h-[min(86vh,790px)] w-[calc(100vw-1.5rem)] max-w-[1120px] flex-col gap-0 overflow-hidden rounded-[26px] border border-border/60 bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:max-w-[1120px]"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="relative shrink-0 overflow-hidden border-b border-border/60 px-5 py-5 text-left sm:px-7">
            <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-primary/15 blur-3xl" />
            <div className="pointer-events-none absolute left-1/3 top-0 h-20 w-64 -translate-y-1/2 rounded-full bg-violet-500/10 blur-3xl" />

            <div className="relative flex flex-col gap-4 pr-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                    <ArrowRightLeft className="h-4.5 w-4.5" />
                  </div>
                  <Badge
                    variant="outline"
                    className="rounded-full border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary"
                  >
                    Substituição inteligente
                  </Badge>
                </div>

                <DialogTitle className="text-xl font-bold tracking-tight sm:text-2xl">
                  Substituir fiscal
                </DialogTitle>
                <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  A vaga de <span className="font-semibold text-foreground">{replacementTarget?.collaborator_name}</span> será
                  preservada e o sistema prioriza quem melhor se encaixa nela.
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <div className="rounded-2xl border border-border/60 bg-card/70 px-3.5 py-2.5 text-right shadow-sm">
                  <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Disponíveis</p>
                  <p className="mt-0.5 text-lg font-bold leading-none">{availableReplacementCandidates.length}</p>
                </div>
                {conflictedReplacementCandidates.length > 0 && (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-3.5 py-2.5 text-right shadow-sm">
                    <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-amber-500/80">Conflitos</p>
                    <p className="mt-0.5 text-lg font-bold leading-none text-amber-500">{conflictedReplacementCandidates.length}</p>
                  </div>
                )}
              </div>
            </div>
          </DialogHeader>

          {replacementData && (
            <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[350px_minmax(0,1fr)]">
              <aside className="min-h-0 overflow-y-auto border-b border-border/60 bg-muted/[0.025] lg:border-b-0 lg:border-r">
                <div className="space-y-4 p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                      <ArrowRightLeft className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Vaga a preencher</p>
                      <p className="text-[11px] text-muted-foreground">Dados herdados do fiscal substituído.</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-destructive/15 bg-destructive/[0.06] text-destructive">
                        <Users className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold" title={replacementTarget?.collaborator_name}>
                          {replacementTarget?.collaborator_name}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-destructive/80">
                          Recusou a participação
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 border-t border-border/60 pt-4 text-[11px]">
                      <div className="flex items-start gap-2">
                        <BriefcaseBusiness className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="text-muted-foreground">Função</span>
                        <span className="ml-auto max-w-[58%] text-right font-medium">
                          {replacementTarget?.role_name || replacementTarget?.assigned_role || 'Não informada'}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="text-muted-foreground">Local</span>
                        <span className="ml-auto max-w-[58%] text-right font-medium">
                          {[
                            replacementTarget?.building || replacementTarget?.unit,
                            replacementTarget?.floor && `${replacementTarget.floor}º andar`,
                            replacementTarget?.room && `Sala ${replacementTarget.room}`,
                          ].filter(Boolean).join(' · ') || 'Não informado'}
                        </span>
                      </div>
                      {replacementTarget?.work_schedule && (
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="text-muted-foreground">Horário</span>
                          <span className="ml-auto max-w-[58%] text-right font-medium">
                            {replacementTarget.work_schedule}
                          </span>
                        </div>
                      )}
                    </div>

                    {replacementTarget?.decline_reason && (
                      <div className="mt-4 rounded-xl border border-destructive/10 bg-destructive/[0.035] p-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-destructive/80">
                          Motivo informado
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                          {replacementTarget.decline_reason}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
                    <div className="mb-3">
                      <p className="text-xs font-semibold">Dados da nova alocação</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Ajuste somente se a vaga também mudou.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1.5">
                          <Label className="text-[10px]">Cargo</Label>
                          <Input
                            value={replacementData.role_name || ''}
                            onChange={(event) => setReplacementData({ ...replacementData, role_name: event.target.value })}
                            className="h-9 rounded-xl bg-background/80 text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px]">Horário</Label>
                          <Input
                            value={replacementData.work_schedule || ''}
                            onChange={(event) => setReplacementData({ ...replacementData, work_schedule: event.target.value })}
                            className="h-9 rounded-xl bg-background/80 text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1.5">
                          <Label className="text-[10px]">Unidade</Label>
                          <Input
                            value={replacementData.unit || ''}
                            onChange={(event) => setReplacementData({ ...replacementData, unit: event.target.value })}
                            className="h-9 rounded-xl bg-background/80 text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px]">Prédio</Label>
                          <Input
                            value={replacementData.building || ''}
                            onChange={(event) => setReplacementData({ ...replacementData, building: event.target.value })}
                            className="h-9 rounded-xl bg-background/80 text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1.5">
                          <Label className="text-[10px]">Andar</Label>
                          <Input
                            value={replacementData.floor || ''}
                            onChange={(event) => setReplacementData({ ...replacementData, floor: event.target.value })}
                            className="h-9 rounded-xl bg-background/80 text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px]">Sala</Label>
                          <Input
                            value={replacementData.room || ''}
                            onChange={(event) => setReplacementData({ ...replacementData, room: event.target.value })}
                            className="h-9 rounded-xl bg-background/80 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>

              <section className="flex min-h-0 min-w-0 flex-col bg-background/40">
                <div className="shrink-0 border-b border-border/60 px-5 py-4 sm:px-6">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Escolha o substituto</p>
                        <p className="text-[11px] text-muted-foreground">
                          Ranking por compatibilidade com a vaga atual.
                        </p>
                      </div>
                    </div>

                    <Popover open={replacementPickerOpen} onOpenChange={setReplacementPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={replacementPickerOpen}
                          className="h-9 min-w-48 justify-between rounded-xl border-border/70 bg-background/70 text-xs font-medium"
                        >
                          <span className="truncate">
                            {selectedReplacementCandidate?.full_name || 'Pesquisar outro fiscal'}
                          </span>
                          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>

                      <PopoverContent align="end" className="w-[min(460px,calc(100vw-2rem))] p-0">
                        <Command>
                          <CommandInput placeholder="Buscar por nome, e-mail, instituição ou unidade..." />
                          <CommandList className="max-h-80">
                            <CommandEmpty>Nenhum fiscal encontrado.</CommandEmpty>
                            <CommandGroup>
                              {replacementCandidates.map((candidate: any) => (
                                <CommandItem
                                  key={candidate.id}
                                  value={[
                                    candidate.full_name,
                                    candidate.email,
                                    candidate.institution,
                                    candidate.unit,
                                    candidate.sector,
                                    candidate.preferred_role,
                                    candidate.role,
                                  ].filter(Boolean).join(' ')}
                                  disabled={!!candidate.sameDayConflict}
                                  onSelect={() => {
                                    if (candidate.sameDayConflict) return;
                                    setReplacementFiscalId(candidate.id);
                                    setReplacementPickerOpen(false);
                                  }}
                                  className="items-start gap-2 py-2.5"
                                >
                                  <Check className={`mt-0.5 h-4 w-4 shrink-0 ${replacementFiscalId === candidate.id ? 'opacity-100' : 'opacity-0'}`} />
                                  <span className="min-w-0 flex-1">
                                    <span className="flex items-center justify-between gap-2">
                                      <span className="truncate font-medium">{candidate.full_name}</span>
                                      <span className={`shrink-0 text-[10px] font-bold ${candidate.sameDayConflict ? 'text-amber-500' : 'text-primary'}`}>
                                        {candidate.sameDayConflict ? 'Conflito' : `${candidate.replacementScore}%`}
                                      </span>
                                    </span>
                                    <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                                      {[candidate.email, candidate.institution || candidate.unit].filter(Boolean).join(' · ') || 'Sem informações complementares'}
                                    </span>
                                    <span className={`mt-1 block text-[9px] ${candidate.sameDayConflict ? 'text-amber-500' : 'text-primary/80'}`}>
                                      {candidate.sameDayConflict
                                        ? `Já vinculado a ${candidate.sameDayConflict.ps_events?.name || 'outro evento'} no mesmo dia`
                                        : (candidate.replacementReasons || []).slice(0, 3).join(' · ') || 'Disponível para substituição'}
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

                  {selectedReplacementCandidate && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/[0.035] px-3 py-2 text-[10px]">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-muted-foreground">Selecionado:</span>
                      <span className="truncate font-semibold">{selectedReplacementCandidate.full_name}</span>
                      <Badge variant="outline" className="ml-auto shrink-0 rounded-full border-primary/15 px-2 text-[9px] text-primary">
                        {selectedReplacementCandidate.replacementScore}% encaixe
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 sm:px-6">
                  {availableReplacementCandidates.length === 0 ? (
                    <div className="flex min-h-64 items-center justify-center rounded-3xl border border-dashed border-amber-500/25 bg-amber-500/[0.035]">
                      <div className="max-w-sm text-center">
                        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                        <p className="mt-3 text-sm font-semibold">Nenhum substituto livre neste dia</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          Os fiscais encontrados já possuem vínculo com outro evento na mesma data.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid min-w-0 gap-3 xl:grid-cols-2">
                      {availableReplacementCandidates.slice(0, 8).map((candidate: any, index: number) => {
                        const isSelected = replacementFiscalId === candidate.id;
                        const isBest = index === 0;

                        return (
                          <button
                            key={candidate.id}
                            type="button"
                            onClick={() => setReplacementFiscalId(candidate.id)}
                            className={`group relative min-w-0 overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 ${isSelected
                              ? 'border-primary/55 bg-gradient-to-br from-primary/[0.11] to-primary/[0.03] shadow-[0_10px_32px_-18px_hsl(var(--primary))]'
                              : isBest
                                ? 'border-violet-500/45 bg-gradient-to-br from-violet-500/[0.08] via-primary/[0.025] to-card/60 ring-1 ring-violet-500/10'
                                : 'border-border/60 bg-card/55 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/80 hover:shadow-lg'}`}
                          >
                            {isBest && !isSelected && (
                              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/80 to-transparent" />
                            )}

                            <div className="flex min-w-0 items-start gap-3">
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${isSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border/70 bg-muted/30 text-muted-foreground'}`}>
                                {isSelected ? <Check className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                      <p className="min-w-0 truncate text-sm font-semibold" title={candidate.full_name}>
                                        {candidate.full_name}
                                      </p>
                                      {isBest ? (
                                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-violet-400">
                                          <Sparkles className="h-2.5 w-2.5" />
                                          Melhor encaixe
                                        </span>
                                      ) : candidate.replacementScore >= 70 ? (
                                        <span className="shrink-0 rounded-full border border-primary/15 bg-primary/[0.07] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-primary">
                                          Recomendado
                                        </span>
                                      ) : null}
                                    </div>

                                    <p className="mt-1 truncate text-[10px] text-muted-foreground">
                                      {[candidate.institution, candidate.unit, candidate.email].filter(Boolean).join(' · ') || 'Sem informações complementares'}
                                    </p>
                                  </div>

                                  <div className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-right ${candidate.replacementScore >= 70
                                    ? 'border-primary/20 bg-primary/10 text-primary'
                                    : 'border-border/60 bg-muted/30 text-muted-foreground'}`}>
                                    <p className="text-sm font-bold leading-none">{candidate.replacementScore}%</p>
                                    <p className="mt-1 text-[8px] font-semibold uppercase tracking-wide">encaixe</p>
                                  </div>
                                </div>

                                <div className="mt-2.5 flex flex-wrap gap-1">
                                  {(candidate.replacementReasons || []).slice(0, 3).map((reason: string) => (
                                    <span
                                      key={reason}
                                      className="rounded-full border border-primary/10 bg-primary/[0.05] px-2 py-0.5 text-[9px] font-medium text-primary/90"
                                    >
                                      {reason}
                                    </span>
                                  ))}
                                </div>

                                <div className="mt-2.5 flex items-center gap-3 text-[9px] text-muted-foreground">
                                  {Number(candidate.average_rating || 0) > 0 && (
                                    <span>Nota {Number(candidate.average_rating).toFixed(2)}</span>
                                  )}
                                  {Number(candidate.total_events || 0) > 0 && (
                                    <span>{Number(candidate.total_events)} atuações</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {availableReplacementCandidates.length > 8 && (
                    <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-muted/[0.02] p-3 text-center">
                      <p className="text-[10px] text-muted-foreground">
                        Mostrando os 8 melhores de {availableReplacementCandidates.length} disponíveis.
                        Use <span className="font-semibold text-foreground">Pesquisar outro fiscal</span> para consultar a lista completa.
                      </p>
                    </div>
                  )}

                  {conflictedReplacementCandidates.length > 0 && (
                    <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-500/15 bg-amber-500/[0.035] p-3">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <p className="text-[10px] leading-relaxed text-muted-foreground">
                        {conflictedReplacementCandidates.length} fiscal(is) foram retirados do ranking por já possuírem vínculo em outro evento na mesma data.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          <DialogFooter className="shrink-0 border-t border-border/60 bg-background/95 px-5 py-3.5 sm:px-7">
            <div className="mr-auto hidden min-w-0 sm:block">
              <p className="text-xs font-medium">
                {selectedReplacementCandidate
                  ? `${selectedReplacementCandidate.full_name} será vinculado(a) à vaga`
                  : 'Selecione um substituto para continuar'}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                A substituição mantém os dados da vaga e registra o histórico da troca.
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              className="rounded-xl"
              disabled={confirmationActions.replace.isPending}
              onClick={() => {
                setReplacementTarget(null);
                setReplacementFiscalId('');
                setReplacementPickerOpen(false);
                setReplacementData(null);
              }}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              className="min-w-44 rounded-xl shadow-lg shadow-primary/15"
              onClick={submitReplacement}
              disabled={!replacementFiscalId || !selectedReplacementCandidate || confirmationActions.replace.isPending}
            >
              {confirmationActions.replace.isPending ? 'Substituindo...' : 'Confirmar substituição'}
            </Button>
          </DialogFooter>
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
