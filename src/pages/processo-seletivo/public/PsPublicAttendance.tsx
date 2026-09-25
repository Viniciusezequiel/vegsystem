import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SignaturePad } from '@/components/ui/SignaturePad';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PenLine, Search, ArrowLeft, ShieldCheck, Users, UserCheck, CheckCircle2, Clock3, UserX, MapPin, Building2, FilterX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  getPublicProcessSelectionAttendanceDetails,
  submitPublicProcessSelectionSignature,
  submitPublicProcessSelectionAbsence,
} from '@/lib/signatureStorage';

function AttendanceKpi({
  label,
  value,
  helper,
  icon,
  tone = 'default',
}: {
  label: string;
  value: number;
  helper?: string;
  icon: ReactNode;
  tone?: 'default' | 'warning' | 'success' | 'danger';
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${tone === 'warning'
        ? 'border-amber-500/20 bg-amber-500/[0.035]'
        : tone === 'success'
          ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
          : tone === 'danger'
            ? 'border-destructive/20 bg-destructive/[0.025]'
            : 'border-border/60 bg-background/30'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
          {helper && <p className="mt-1 text-[9px] text-muted-foreground">{helper}</p>}
        </div>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone === 'warning'
            ? 'bg-amber-500/10 text-amber-500'
            : tone === 'success'
              ? 'bg-emerald-500/10 text-emerald-500'
              : tone === 'danger'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-primary/10 text-primary'}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function PsPublicAttendance() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { eventId: routeEventId, eventCollaboratorId: routeSelectedId } = useParams();

  const { data: events = [] } = useQuery({
    queryKey: ['ps_public_events', 'attendance'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        'ps_public_list_events',
        { p_surface: 'attendance' }
      );

      if (error) throw error;
      return data || [];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['ps_public_roles'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        'ps_public_list_roles'
      );

      if (error) throw error;
      return data || [];
    },
  });

  const [eventId, setEventId] = useState(routeEventId || '');
  const [selectedId, setSelectedId] = useState(routeSelectedId || '');
  const [search, setSearch] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [showSigned, setShowSigned] = useState(false);
  const [showAbsent, setShowAbsent] = useState(false);
  const [confirmationFilter, setConfirmationFilter] = useState('all');
  const [buildingFilter, setBuildingFilter] = useState('all');

  const [attendanceCpf, setAttendanceCpf] = useState('');
  const [detailsAccepted, setDetailsAccepted] = useState(false);
  const [correctionMode, setCorrectionMode] = useState(false);
  const [absenceTarget, setAbsenceTarget] = useState<any>(null);
  const [absenceResponsibleId, setAbsenceResponsibleId] = useState('');
  const [absenceResponsibleCpf, setAbsenceResponsibleCpf] = useState('');
  const [absenceReason, setAbsenceReason] = useState('');
  const [absenceSignature, setAbsenceSignature] = useState<string | null>(null);
  const [absenceSaving, setAbsenceSaving] = useState(false);
  const [roleChanged, setRoleChanged] = useState(false);
  const [pixChanged, setPixChanged] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [newPix, setNewPix] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [confirmingDetails, setConfirmingDetails] = useState(false);

  useEffect(() => {
    if (routeEventId) setEventId(routeEventId);
  }, [routeEventId]);

  useEffect(() => {
    if (routeSelectedId) setSelectedId(routeSelectedId);
    else if (!routeSelectedId && selectedId) setSelectedId('');
  }, [routeSelectedId, selectedId]);

  const { data: links = [], isLoading, error, refetch } = useQuery({
    queryKey: ['ps_public_roster', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('ps_public_attendance_roster', {
        p_event_id: eventId,
        p_search: '',
      });
      if (error) throw error;
      return data || [];
    },
  });

  const buildingOptions = useMemo(
    () => [...new Set(
      links
        .map((link: any) => String(link.building || '').trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })),
    [links]
  );

  const filtered = useMemo(() => {
    const term = search
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    return links.filter((l: any) => {
      if (
        confirmationFilter !== 'all' &&
        String(l.participation_status || '') !== confirmationFilter
      ) return false;

      if (
        buildingFilter !== 'all' &&
        String(l.building || '') !== buildingFilter
      ) return false;

      if (!term) return true;

      const haystack = [
        l.collaborator_name,
        l.role_name,
        l.assigned_role,
        l.sector,
        l.unit,
        l.campus,
        l.building,
        l.floor,
        l.room,
      ]
        .filter(Boolean)
        .join(' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [links, search, confirmationFilter, buildingFilter]);

  const visibleLinks = useMemo(() => {
    return filtered
      .filter((item: any) => {
        if (showAbsent) return !!item.absent;
        if (showSigned) return !!item.signed_at && !item.absent;

        return (
          !item.signed_at &&
          !item.absent &&
          !pendingIds.has(item.id)
        );
      })
      .sort((a: any, b: any) =>
        String(a.collaborator_name || '').localeCompare(
          String(b.collaborator_name || ''),
          'pt-BR'
        )
      );
  }, [filtered, pendingIds, showSigned, showAbsent]);

  const confirmedCount = links.filter(
    (l: any) => l.participation_status === 'confirmed'
  ).length;

  const confirmationPendingCount = links.filter(
    (l: any) => l.participation_status === 'pending_confirmation'
  ).length;

  const signedCount = links.filter(
    (l: any) => !!l.signed_at && !l.absent
  ).length;

  const absentCount = links.filter(
    (l: any) => !!l.absent
  ).length;

  const savingCount = pendingIds.size;

  const pendingCount = links.filter(
    (l: any) =>
      !l.signed_at &&
      !l.absent &&
      !pendingIds.has(l.id)
  ).length;

  const absenceResponsibleCandidates = useMemo(() => {
    return links
      .filter((link: any) => {
        const role = String(
          link.role_name ||
          link.assigned_role ||
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

  const currentSelectedId = routeSelectedId || selectedId;
  const selected = links.find((l: any) => l.id === currentSelectedId) ?? null;

  const attendanceCpfDigits =
    attendanceCpf.replace(/\D/g, '');

  const absenceResponsibleCpfDigits =
    absenceResponsibleCpf.replace(/\D/g, '');

  const {
    data: attendanceDetails,
    isLoading: attendanceDetailsLoading,
    error: attendanceDetailsError,
    refetch: refetchAttendanceDetails,
  } = useQuery({
    queryKey: ['ps_public_attendance_details', currentSelectedId],
    enabled: !!currentSelectedId,
    retry: false,
    queryFn: async () =>
      getPublicProcessSelectionAttendanceDetails(currentSelectedId),
  });

  useEffect(() => {
    setAttendanceCpf('');
    setDetailsAccepted(false);
    setCorrectionMode(false);
    setRoleChanged(false);
    setPixChanged(false);
    setNewPix('');
    setAdjustmentReason('');
    setSelectedRole('');
  }, [currentSelectedId]);

  useEffect(() => {
    if (attendanceDetails?.role_value) {
      setSelectedRole(String(attendanceDetails.role_value));
    }
  }, [attendanceDetails?.role_value, currentSelectedId]);

  useEffect(() => {
    if (!eventId) return;
    const channel = supabase.channel(`ps:event:${eventId}`)
      .on('broadcast', { event: 'roster_changed' }, (payload) => {
        const payloadEventId = payload?.payload?.event_id;
        if (payloadEventId && payloadEventId !== eventId) return;
        queryClient.invalidateQueries({ queryKey: ['ps_public_roster', eventId] });
        void refetch();
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [eventId, queryClient, refetch]);

  useEffect(() => {
    if (!routeSelectedId && !selectedId) return;
    const validSelected = links.some((l: any) => l.id === currentSelectedId);
    if (!validSelected && eventId) {
      setSelectedId('');
      navigate(`/ps/presenca/${eventId}`, { replace: true });
    }
  }, [currentSelectedId, eventId, links, navigate, routeSelectedId, selectedId]);

  useEffect(() => {
    if (!selected || !currentSelectedId) return;

    // Se foi este dispositivo que acabou de enviar a assinatura,
    // o realtime pode atualizar signed_at antes da troca de rota.
    // Nesse caso não exibimos o alerta de outro dispositivo.
    if (selected.signed_at && pendingIds.has(selected.id)) return;

    if (selected.signed_at) {
      setSignature(null);
      setSaving(false);
      toast.error('Esta presença já foi registrada em outro dispositivo.');
    }
  }, [selected, currentSelectedId, pendingIds]);

  const confirmAttendanceDetails = async () => {
    if (!selected) return;

    if (attendanceCpfDigits.length !== 11) {
      toast.error('Informe seu CPF para confirmar sua identidade.');
      return;
    }

    if (roleChanged && !selectedRole) {
      toast.error('Selecione o cargo correto.');
      return;
    }

    if (pixChanged && !newPix.trim()) {
      toast.error('Informe o PIX correto.');
      return;
    }

    if (
      (roleChanged || pixChanged) &&
      !adjustmentReason.trim()
    ) {
      toast.error('Informe o motivo da alteração.');
      return;
    }

    setConfirmingDetails(true);

    try {
      const { data, error } = await (supabase as any).rpc(
        'ps_public_confirm_attendance_details',
        {
          p_link_id: selected.id,
          p_cpf: attendanceCpfDigits,
          p_role_changed: roleChanged,
          p_role_value: roleChanged ? selectedRole : null,
          p_pix_changed: pixChanged,
          p_pix: pixChanged ? newPix.trim() : null,
          p_justification:
            roleChanged || pixChanged
              ? adjustmentReason.trim()
              : null,
        }
      );

      if (error) throw error;

      const result = data?.[0];

      if (!result?.success) {
        throw new Error(
          result?.message || 'Não foi possível confirmar os dados.'
        );
      }

      setRoleChanged(false);
      setPixChanged(false);
      setNewPix('');
      setAdjustmentReason('');
      setCorrectionMode(false);
      setDetailsAccepted(true);
      setAttendanceCpf('');

      await refetchAttendanceDetails();

      toast.success('Dados conferidos. Assinatura liberada.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível confirmar os dados.'
      );
    } finally {
      setConfirmingDetails(false);
    }
  };

  const resetToList = () => {
    setSelectedId('');
    setAttendanceCpf('');
    setSignature(null);
    setSaving(false);
    if (eventId) {
      navigate(`/ps/presenca/${eventId}`, { replace: true });
    }
  };

  const goBackToList = () => {
    if (signature && !saving) {
      const shouldDiscard = window.confirm('Descartar assinatura e voltar para a lista?');
      if (!shouldDiscard) return;
    }
    resetToList();
  };

  const submit = async () => {
    if (!selected) {
      toast.error('Selecione seu nome na lista antes de confirmar.');
      return;
    }
    if (!detailsAccepted && !attendanceDetails?.details_confirmed) {
      toast.error('Confirme que o CPF, o cargo e o PIX estão corretos antes de assinar.');
      return;
    }

    if (!signature) {
      toast.error('Assine no campo indicado antes de confirmar a presença.');
      return;
    }
    if (saving) return;

    const linkId = selected.id;
    const collaboratorName = selected.collaborator_name;

    setSaving(true);

    // Inicia o envio antes de trocar de tela.
    const savePromise =
      submitPublicProcessSelectionSignature(
        selected.id,
        signature
      );

    // Marca este fiscal como ocupado neste dispositivo.
    setPendingIds((current) => {
      const next = new Set(current);
      next.add(linkId);
      return next;
    });

    // Libera a interface imediatamente para a próxima assinatura.
    setSignature(null);
    setSelectedId('');
    setSaving(false);
    navigate(`/ps/presenca/${eventId}`, { replace: true });

    void savePromise
      .then(() => {
        toast.success(`Presença de ${collaboratorName} registrada com sucesso.`);
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : `Não foi possível registrar a presença de ${collaboratorName}.`
        );
      })
      .finally(() => {
        setPendingIds((current) => {
          const next = new Set(current);
          next.delete(linkId);
          return next;
        });

        void queryClient.invalidateQueries({
          queryKey: ['ps_public_roster', eventId],
        });
      });
  };

  const openAbsenceDialog = (link: any) => {
    if (link.signed_at) {
      toast.error('Este fiscal já registrou presença.');
      return;
    }

    setAbsenceTarget(link);
    setAbsenceResponsibleId('');
    setAbsenceResponsibleCpf('');
    setAbsenceReason('');
    setAbsenceSignature(null);
  };

  const closeAbsenceDialog = () => {
    if (absenceSaving) return;
    setAbsenceTarget(null);
    setAbsenceResponsibleId('');
    setAbsenceResponsibleCpf('');
    setAbsenceReason('');
    setAbsenceSignature(null);
  };

  const submitAbsence = async () => {
    if (!absenceTarget) return;

    if (!absenceResponsibleId) {
      toast.error('Selecione o responsável.');
      return;
    }

    if (absenceResponsibleCpfDigits.length !== 11) {
      toast.error('Informe o CPF do responsável.');
      return;
    }

    if (!absenceReason.trim()) {
      toast.error('Informe o motivo da ausência.');
      return;
    }

    if (!absenceSignature) {
      toast.error('O responsável precisa assinar.');
      return;
    }

    setAbsenceSaving(true);

    try {
      const fiscalName =
        absenceTarget.collaborator_name;

      await submitPublicProcessSelectionAbsence(
        absenceTarget.id,
        absenceResponsibleId,
        absenceResponsibleCpfDigits,
        absenceReason.trim(),
        absenceSignature
      );

      setAbsenceTarget(null);
      setAbsenceResponsibleId('');
      setAbsenceResponsibleCpf('');
      setAbsenceReason('');
      setAbsenceSignature(null);

      toast.success(
        `Ausência de ${fiscalName} registrada.`
      );

      await queryClient.invalidateQueries({
        queryKey: ['ps_public_roster', eventId],
      });

      void refetch();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível registrar a ausência.'
      );
    } finally {
      setAbsenceSaving(false);
    }
  };

  const handleOpenSignature = (link: any) => {
    if (link.absent) {
      toast.info('Fiscal registrado como ausente.');
      return;
    }

    if (link.signed_at) {
      toast.info('Presença já registrada.');
      return;
    }
    setSelectedId(link.id);
    setAttendanceCpf('');
    setSignature(null);
    navigate(`/ps/presenca/${eventId}/${link.id}`);
  };

  const handleEventChange = (nextEventId: string) => {
    setEventId(nextEventId);
    setSelectedId('');
    setAttendanceCpf('');
    setSignature(null);
    setSearch('');
    setShowSigned(false);
    setShowAbsent(false);
    setConfirmationFilter('all');
    setBuildingFilter('all');
    navigate(`/ps/presenca/${nextEventId}`);
  };

  const selectedEvent = events.find((event: any) => event.id === eventId) || null;

  const clearRosterFilters = () => {
    setSearch('');
    setConfirmationFilter('all');
    setBuildingFilter('all');
  };

  if (currentSelectedId && selected) {
    return (
      <div className="min-h-screen bg-muted/30 p-4">
        <div className="mx-auto max-w-3xl py-6">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="space-y-4 border-b bg-background/80 p-5">
              <Button variant="ghost" className="w-fit gap-2 px-2 text-sm" onClick={goBackToList}>
                <ArrowLeft className="h-4 w-4" />
                Voltar para lista
              </Button>

              <div className="space-y-3 text-center md:text-left">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  CONFIRA O NOME ANTES DE ASSINAR
                </p>
                <h1 className="text-3xl font-black leading-tight md:text-4xl">
                  Você está registrando presença de
                </h1>
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                  <p className="text-2xl font-bold text-primary md:text-3xl">{selected.collaborator_name}</p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 p-5 md:p-7">
              <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 text-sm md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Cargo</p>
                  <p className="mt-1 font-semibold">{selected.role_name || selected.assigned_role || 'Cargo não informado'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Evento</p>
                  <p className="mt-1 font-semibold">{events.find((event: any) => event.id === eventId)?.name || 'Evento'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Unidade / Sala</p>
                  <p className="mt-1 font-semibold">{[selected.sector || selected.unit, selected.floor, selected.room && `Sala ${selected.room}`].filter(Boolean).join(' • ') || 'Não informado'}</p>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4" />
                  A assinatura fica vinculada ao fiscal selecionado abaixo.
                </div>
                <p>Não é possível trocar o fiscal nesta etapa sem voltar à lista.</p>
              </div>

              <div className="space-y-4 rounded-2xl border bg-muted/10 p-4">
                <div>
                  <p className="font-semibold">Confira seus dados</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Confira o CPF, o cargo e a chave PIX antes de registrar a presença.
                  </p>
                </div>

                {attendanceDetailsLoading && (
                  <p className="text-sm text-muted-foreground">Carregando dados...</p>
                )}

                {attendanceDetailsError && (
                  <p className="text-sm font-medium text-destructive">
                    Não foi possível carregar os dados deste fiscal. Volte para a lista e tente novamente.
                  </p>
                )}

                {!attendanceDetailsLoading && attendanceDetails && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border bg-background p-3">
                        <p className="text-xs uppercase text-muted-foreground">CPF</p>
                        <p className="mt-1 font-semibold tabular-nums">{attendanceDetails.cpf_masked || 'Não informado'}</p>
                      </div>
                      <div className="rounded-xl border bg-background p-3">
                        <p className="text-xs uppercase text-muted-foreground">Cargo / função</p>
                        <p className="mt-1 font-semibold">{attendanceDetails.role_name || 'Não informado'}</p>
                      </div>
                      <div className="rounded-xl border bg-background p-3">
                        <p className="text-xs uppercase text-muted-foreground">Chave PIX cadastrada</p>
                        <p className="mt-1 break-all font-semibold">{attendanceDetails.pix || 'Não informado'}</p>
                      </div>
                    </div>

                    {!correctionMode ? (
                      <div className="space-y-3">
                        {!attendanceDetails.pix_configured && (
                          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                            Não há uma chave PIX cadastrada. Use a opção abaixo para corrigir antes de assinar.
                          </div>
                        )}

                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-background p-4">
                          <Checkbox
                            checked={detailsAccepted || !!attendanceDetails.details_confirmed}
                            disabled={!!attendanceDetails.details_confirmed || !attendanceDetails.pix_configured}
                            onCheckedChange={(checked) => setDetailsAccepted(checked === true)}
                            className="mt-0.5"
                          />
                          <span className="text-sm leading-relaxed">
                            <strong>Confirmo que meu CPF, meu cargo e minha chave PIX correspondem ao meu cadastro.</strong>
                            <span className="mt-1 block text-xs text-muted-foreground">Ao confirmar, a assinatura será vinculada a essas informações.</span>
                          </span>
                        </label>

                        {attendanceDetails.details_confirmed && (
                          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                            Dados já conferidos. A assinatura está liberada.
                          </div>
                        )}

                        <Button type="button" variant="ghost" className="w-full text-muted-foreground" onClick={() => { setCorrectionMode(true); setDetailsAccepted(false); }}>
                          Cargo ou PIX estão incorretos
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                        <div>
                          <p className="text-sm font-semibold">Corrigir meus dados</p>
                          <p className="mt-1 text-xs text-muted-foreground">Para alterar cargo ou PIX, confirme seu CPF. O CPF é exigido somente nesta correção.</p>
                        </div>

                        <div className="space-y-2">
                          <Label>Confirme seu CPF *</Label>
                          <Input type="password" inputMode="numeric" autoComplete="off" value={attendanceCpf} onChange={(event) => setAttendanceCpf(event.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="Digite os 11 dígitos do CPF" maxLength={11} />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant={roleChanged ? 'default' : 'outline'} onClick={() => setRoleChanged((value) => !value)}>{roleChanged ? 'Cargo será corrigido' : 'Corrigir cargo'}</Button>
                          <Button type="button" size="sm" variant={pixChanged ? 'default' : 'outline'} onClick={() => setPixChanged((value) => !value)}>{pixChanged ? 'PIX será corrigido' : 'Corrigir PIX'}</Button>
                        </div>

                        {roleChanged && (
                          <div className="space-y-2">
                            <Label>Novo cargo</Label>
                            <Select value={selectedRole} onValueChange={setSelectedRole}>
                              <SelectTrigger><SelectValue placeholder="Selecione o cargo correto" /></SelectTrigger>
                              <SelectContent>{roles.map((role: any) => <SelectItem key={role.id} value={role.value}>{role.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        )}

                        {pixChanged && (
                          <div className="space-y-2">
                            <Label>Novo PIX</Label>
                            <Input value={newPix} onChange={(event) => setNewPix(event.target.value)} placeholder="Informe o PIX correto" autoComplete="off" />
                          </div>
                        )}

                        {(roleChanged || pixChanged) && (
                          <div className="space-y-2">
                            <Label>Motivo da alteração</Label>
                            <Textarea value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} placeholder="Ex.: cargo alterado pela coordenação / PIX desatualizado" rows={2} />
                          </div>
                        )}

                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button type="button" variant="outline" className="flex-1" onClick={() => { setCorrectionMode(false); setAttendanceCpf(''); setRoleChanged(false); setPixChanged(false); setNewPix(''); setAdjustmentReason(''); }}>Cancelar correção</Button>
                          <Button type="button" className="flex-1" onClick={confirmAttendanceDetails} disabled={confirmingDetails || attendanceCpfDigits.length !== 11 || (!roleChanged && !pixChanged)}>{confirmingDetails ? 'Salvando correção...' : 'Salvar correção'}</Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {(detailsAccepted || attendanceDetails?.details_confirmed) && (
                <>
                  <SignaturePad
                    onSignatureChange={setSignature}
                    height={240}
                  />

                  <div className="flex flex-col gap-3 pt-2 md:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 flex-1"
                      onClick={goBackToList}
                    >
                      Voltar para lista
                    </Button>

                    <Button
                      type="button"
                      className="h-12 flex-1"
                      size="lg"
                      onClick={submit}
                      disabled={saving || !signature}
                    >
                      {saving
                        ? 'Registrando presença...'
                        : 'CONFIRMAR PRESENÇA'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (currentSelectedId && !selected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md rounded-2xl text-center">
          <CardHeader>
            <CardTitle>Presença já registrada.</CardTitle>
            <CardDescription>Esse fiscal não está disponível para nova assinatura nesta etapa.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={resetToList}>Voltar para lista</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-3 sm:p-5">
      <div className="mx-auto max-w-5xl space-y-4 py-3 sm:py-5">
        <div className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-r from-card via-card to-primary/[0.055] p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <PenLine className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Processo Seletivo · Dia do evento
                </p>
                <h1 className="mt-1 text-2xl font-bold">Lista de Presença</h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Localize o fiscal, confira a situação e registre presença ou ausência com segurança.
                </p>
              </div>
            </div>

            {selectedEvent && (
              <div className="flex flex-wrap gap-2 text-xs">
                {selectedEvent.date && (
                  <Badge variant="outline" className="rounded-full">
                    {new Date(`${selectedEvent.date}T00:00:00`).toLocaleDateString('pt-BR')}
                  </Badge>
                )}
                {selectedEvent.location && (
                  <Badge variant="outline" className="rounded-full">
                    <MapPin className="mr-1 h-3 w-3" />
                    {selectedEvent.location}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        <Card className="rounded-2xl border-border/60 bg-card/70 shadow-sm">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="space-y-2">
              <Label>Evento</Label>
              <Select value={eventId} onValueChange={handleEventChange}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Selecione o evento" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {eventId && (
              <>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <AttendanceKpi
                    label="Equipe operacional"
                    value={links.length}
                    helper="ativos na presença"
                    icon={<Users className="h-4 w-4" />}
                  />
                  <AttendanceKpi
                    label="Confirmados"
                    value={confirmedCount}
                    helper="participação confirmada"
                    icon={<UserCheck className="h-4 w-4" />}
                    tone="success"
                  />
                  <AttendanceKpi
                    label="Aguardando confirmação"
                    value={confirmationPendingCount}
                    helper="ainda podem comparecer"
                    icon={<Clock3 className="h-4 w-4" />}
                    tone={confirmationPendingCount ? 'warning' : 'default'}
                  />
                  <AttendanceKpi
                    label="Pendentes de presença"
                    value={pendingCount}
                    helper="sem presença/ausência"
                    icon={<PenLine className="h-4 w-4" />}
                    tone={pendingCount ? 'warning' : 'success'}
                  />
                  <AttendanceKpi
                    label="Presentes"
                    value={signedCount}
                    helper="assinatura registrada"
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    tone="success"
                  />
                  <AttendanceKpi
                    label="Ausentes"
                    value={absentCount}
                    helper="ausência registrada"
                    icon={<UserX className="h-4 w-4" />}
                    tone={absentCount ? 'danger' : 'default'}
                  />
                </div>

                {confirmationPendingCount > 0 && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3 text-xs leading-relaxed text-muted-foreground">
                    <strong className="text-foreground">{confirmationPendingCount} fiscal(is) ainda aguardam confirmação.</strong>{' '}
                    Eles permanecem na lista operacional para permitir presença caso compareçam.
                    Use o filtro de confirmação abaixo para visualizar somente os {confirmedCount} já confirmados.
                  </div>
                )}

                <div className="grid gap-2 xl:grid-cols-[minmax(320px,1fr)_230px_220px_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-10 rounded-xl pl-9"
                      placeholder="Buscar por nome, cargo, prédio, andar ou sala..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <Select value={confirmationFilter} onValueChange={setConfirmationFilter}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Confirmação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toda a equipe operacional</SelectItem>
                      <SelectItem value="confirmed">Somente confirmados</SelectItem>
                      <SelectItem value="pending_confirmation">Aguardando confirmação</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Prédio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os prédios</SelectItem>
                      {buildingOptions.map((building) => (
                        <SelectItem key={building} value={building}>{building}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 rounded-xl"
                    disabled={!search && confirmationFilter === 'all' && buildingFilter === 'all'}
                    onClick={clearRosterFilters}
                  >
                    <FilterX className="mr-2 h-4 w-4" />
                    Limpar
                  </Button>
                </div>

                <div className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={!showSigned && !showAbsent ? 'default' : 'outline'}
                      className="rounded-xl"
                      onClick={() => {
                        setShowSigned(false);
                        setShowAbsent(false);
                      }}
                    >
                      Pendentes de presença ({pendingCount})
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant={showSigned ? 'default' : 'outline'}
                      className="rounded-xl"
                      onClick={() => {
                        setShowSigned(true);
                        setShowAbsent(false);
                      }}
                    >
                      Presentes ({signedCount})
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant={showAbsent ? 'default' : 'outline'}
                      className="rounded-xl"
                      onClick={() => {
                        setShowAbsent(true);
                        setShowSigned(false);
                      }}
                    >
                      Ausentes ({absentCount})
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {savingCount > 0 && <Badge variant="secondary">{savingCount} salvando...</Badge>}
                    <span>
                      <strong className="text-foreground">{visibleLinks.length}</strong> exibido(s) · {links.length} na equipe
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-border/60 bg-card/70 shadow-sm">
          <CardHeader className="border-b border-border/50 pb-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">
                  {!showSigned && !showAbsent
                    ? 'Aguardando registro de presença'
                    : showSigned
                      ? 'Presenças registradas'
                      : 'Ausências registradas'}
                </CardTitle>
                <CardDescription>
                  {!showSigned && !showAbsent
                    ? 'Selecione o fiscal correto antes de iniciar a assinatura.'
                    : showSigned
                      ? 'Fiscais que já concluíram a assinatura.'
                      : 'Fiscais cuja ausência já foi formalizada.'}
                </CardDescription>
              </div>
              {buildingFilter !== 'all' && (
                <Badge variant="outline" className="w-fit rounded-full">
                  <Building2 className="mr-1 h-3 w-3" />
                  {buildingFilter}
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="max-h-[58vh] min-h-[24rem] divide-y divide-border/50 overflow-y-auto">
              {isLoading && (
                <p className="p-6 text-center text-sm text-muted-foreground">Carregando equipe operacional...</p>
              )}

              {!isLoading && !error && visibleLinks.length === 0 && (
                <div className="p-10 text-center">
                  <UserCheck className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-3 text-sm font-semibold">
                    {search || confirmationFilter !== 'all' || buildingFilter !== 'all'
                      ? 'Nenhum fiscal encontrado com esses filtros'
                      : showAbsent
                        ? 'Nenhuma ausência registrada'
                        : showSigned
                          ? 'Nenhuma presença registrada ainda'
                          : 'Nenhum fiscal pendente neste evento'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {search || confirmationFilter !== 'all' || buildingFilter !== 'all'
                      ? 'Limpe ou ajuste os filtros para visualizar outros fiscais.'
                      : 'A lista será atualizada automaticamente conforme os registros forem feitos.'}
                  </p>
                </div>
              )}

              {!isLoading && error && (
                <div className="space-y-2 p-6 text-center">
                  <p className="text-sm text-destructive">Não foi possível carregar a lista de presença.</p>
                  <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                    Tentar novamente
                  </Button>
                </div>
              )}

              {!isLoading && !error && visibleLinks.map((l: any) => {
                const isAlreadySigned = !!l.signed_at;
                const isAbsent = !!l.absent;
                const isSavingSignature = pendingIds.has(l.id);
                const isActive = selectedId === l.id;
                const isConfirmed = l.participation_status === 'confirmed';

                return (
                  <div
                    key={l.id}
                    className={`flex min-h-16 flex-col gap-3 p-3 transition-colors sm:flex-row sm:items-center sm:justify-between ${isActive ? 'bg-primary/10' : 'hover:bg-muted/15'}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenSignature(l)}
                      disabled={
                        isAlreadySigned ||
                        isAbsent ||
                        isSavingSignature
                      }
                      className="min-w-0 flex-1 rounded-xl p-1 text-left disabled:cursor-default"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{l.collaborator_name}</span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] ${isConfirmed
                            ? 'border-emerald-500/20 text-emerald-500'
                            : 'border-amber-500/20 text-amber-500'}`}
                        >
                          {isConfirmed ? 'Confirmado' : 'Aguardando confirmação'}
                        </Badge>
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {[l.role_name || l.assigned_role, l.sector || l.unit]
                          .filter(Boolean)
                          .join(' · ') || 'Cargo não informado'}
                      </p>

                      {(l.building || l.floor || l.room) && (
                        <p className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {[l.campus, l.building, l.floor && `${l.floor}º andar`, l.room && `Sala ${l.room}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                    </button>

                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                      {isSavingSignature ? (
                        <Badge variant="secondary">Salvando...</Badge>
                      ) : isAbsent ? (
                        <Badge variant="destructive">Ausente</Badge>
                      ) : isAlreadySigned ? (
                        <Badge className="bg-emerald-500/10 text-emerald-500">Presença registrada</Badge>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => handleOpenSignature(l)}
                          >
                            <PenLine className="mr-1.5 h-3.5 w-3.5" />
                            Assinar presença
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => openAbsenceDialog(l)}
                          >
                            Ausente
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {!eventId && (
                <p className="p-6 text-center text-sm text-muted-foreground">Selecione um evento.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog
        open={!!absenceTarget}
        onOpenChange={(open) => {
          if (!open) closeAbsenceDialog();
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Registrar ausência</DialogTitle>
          </DialogHeader>

          {absenceTarget && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="font-semibold">
                  {absenceTarget.collaborator_name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {absenceTarget.role_name ||
                    absenceTarget.assigned_role ||
                    'Fiscal'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Responsável *</Label>

                <Select
                  value={absenceResponsibleId}
                  onValueChange={(value) => {
                    setAbsenceResponsibleId(value);
                    setAbsenceResponsibleCpf('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Coordenador ou subcoordenador" />
                  </SelectTrigger>

                  <SelectContent>
                    {absenceResponsibleCandidates.map(
                      (responsible: any) => (
                        <SelectItem
                          key={responsible.id}
                          value={responsible.id}
                        >
                          {responsible.collaborator_name} ·{' '}
                          {responsible.role_name ||
                            responsible.assigned_role}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>CPF do responsável *</Label>

                <Input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={absenceResponsibleCpf}
                  onChange={(event) =>
                    setAbsenceResponsibleCpf(
                      event.target.value
                        .replace(/\D/g, '')
                        .slice(0, 11)
                    )
                  }
                  placeholder="11 dígitos do CPF"
                  maxLength={11}
                />
              </div>

              <div className="space-y-2">
                <Label>Motivo / observação *</Label>

                <Textarea
                  value={absenceReason}
                  onChange={(event) =>
                    setAbsenceReason(event.target.value)
                  }
                  placeholder="Ex.: não compareceu ao Processo Seletivo"
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div className="space-y-2">
                <Label>Assinatura do responsável *</Label>

                <SignaturePad
                  onSignatureChange={setAbsenceSignature}
                  height={170}
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
                absenceResponsibleCpfDigits.length !== 11 ||
                !absenceReason.trim() ||
                !absenceSignature
              }
              onClick={submitAbsence}
            >
              {absenceSaving
                ? 'Registrando...'
                : 'Confirmar ausência'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
