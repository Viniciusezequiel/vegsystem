import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleDollarSign, Clock3, Download, History, Loader2, Pencil, Search, Users, WalletCards } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePsEventCollaborators, usePsRoles } from '@/hooks/useProcessoSeletivo';
import { supabase } from '@/integrations/supabase/client';
import { psAssignmentsTotal, buildLegacyAssignment } from '@/lib/psEventAssignments.mjs';
import { generatePsPaymentsPdfAsync } from '@/lib/psPaymentPdf';
import { PsEventCollaboratorEditDialog } from './PsEventCollaboratorEditDialog';

type Props = {
  event: any;
};

const money = (value: unknown) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const paymentObservation = (notes: unknown, adjustments: any[]) => {
  const parts: string[] = [];
  const manualNote = String(notes || '').trim();
  if (manualNote) parts.push(manualNote);

  for (const adjustment of adjustments || []) {
    const justification = String(adjustment.justification || '').trim();
    const status = String(adjustment.status || '').trim();
    const statusLabel = status === 'pending'
      ? 'pendente'
      : status === 'approved'
        ? 'aprovado'
        : status === 'rejected'
          ? 'rejeitado'
          : status;

    if (adjustment.adjustment_type === 'role') {
      const oldRole = String(adjustment.old_value || '').trim();
      const newRole = String(adjustment.new_value || '').trim();
      const change = oldRole && newRole && oldRole !== newRole
        ? `Cargo: ${oldRole} → ${newRole}`
        : 'Cargo alterado';
      parts.push([change, statusLabel ? `[${statusLabel}]` : '', justification].filter(Boolean).join(' · '));
      continue;
    }

    if (adjustment.adjustment_type === 'pix') {
      parts.push(['PIX alterado', statusLabel ? `[${statusLabel}]` : '', justification].filter(Boolean).join(' · '));
      continue;
    }

    parts.push([
      'Ajuste registrado',
      statusLabel ? `[${statusLabel}]` : '',
      justification,
    ].filter(Boolean).join(' · '));
  }

  return parts.join(' | ');
};

export function PsEventPaymentsPanel({ event }: Props) {
  const eventId = event.id as string;
  const queryClient = useQueryClient();
  const { data: links = [], isLoading: linksLoading } = usePsEventCollaborators(eventId);
  const { data: roles = [] } = usePsRoles();
  const [editLink, setEditLink] = useState<any>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'all' | 'decision-ready' | 'decision-review' | 'decision-no-pay' | 'presence-pending' | 'missing-pix' | 'adjusted' | 'inactive'>('all');
  const [decisionTarget, setDecisionTarget] = useState<any>(null);
  const [manualDecision, setManualDecision] = useState<'ready' | 'review' | 'no_pay'>('review');
  const [manualDecisionReason, setManualDecisionReason] = useState('');
  const [savingDecision, setSavingDecision] = useState(false);

  const assignmentsQuery = useQuery({
    queryKey: ['ps_event_assignments', eventId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ps_event_collaborator_assignments')
        .select('id,event_id,event_collaborator_id,role_value,role_name,journey_key,work_schedule,pay_value,is_primary,source,created_at')
        .eq('event_id', eventId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const adjustmentsQuery = useQuery({
    queryKey: ['ps_event_payment_adjustments', eventId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ps_event_collaborator_adjustments')
        .select('id,event_collaborator_id,adjustment_type,source,old_value,new_value,justification,status,created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const paymentOverridesQuery = useQuery({
    queryKey: ['ps_event_payment_decision_overrides', eventId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ps_event_payment_decision_overrides')
        .select('id,event_collaborator_id,decision,reason,decided_at,active')
        .eq('event_id', eventId)
        .eq('active', true)
        .order('decided_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const assignmentMap = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const item of assignmentsQuery.data || []) {
      const current = map.get(item.event_collaborator_id) || [];
      current.push(item);
      map.set(item.event_collaborator_id, current);
    }
    return map;
  }, [assignmentsQuery.data]);

  const adjustmentMap = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const item of adjustmentsQuery.data || []) {
      const current = map.get(String(item.event_collaborator_id)) || [];
      current.push(item);
      map.set(String(item.event_collaborator_id), current);
    }
    return map;
  }, [adjustmentsQuery.data]);

  const paymentOverrideMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const item of paymentOverridesQuery.data || []) {
      if (!map.has(String(item.event_collaborator_id))) {
        map.set(String(item.event_collaborator_id), item);
      }
    }
    return map;
  }, [paymentOverridesQuery.data]);

  const rows = useMemo(() => links.map((link: any) => {
    const persisted = assignmentMap.get(link.id) || [];
    const fallback = persisted.length ? [] : [buildLegacyAssignment(link, roles)].filter(Boolean);
    const assignments = persisted.length ? persisted : fallback;
    const adjustments = adjustmentMap.get(String(link.id)) || [];
    const total = psAssignmentsTotal(assignments);
    const participationStatus = String(link.participation_status || 'pending_confirmation');
    const excluded =
      !!link.absent ||
      !!link.manually_excluded ||
      participationStatus === 'replaced' ||
      participationStatus === 'declined';
    const active = !excluded;
    const attendanceReleased = active && !!link.present && !!link.signed_at;
    const hasPix = !!String(link.attendance_pix_snapshot || link.pix || '').trim();
    const pendingAdjustments = adjustments.filter((adjustment: any) => String(adjustment.status || 'pending') !== 'approved');
    const manualOverride = paymentOverrideMap.get(String(link.id)) || null;

    let automaticDecision: 'ready' | 'review' | 'no_pay' = 'review';
    let automaticReason = 'Presença ou assinatura ainda precisa de conferência.';

    if (excluded) {
      automaticDecision = 'no_pay';
      automaticReason = link.absent
        ? 'Ausência registrada.'
        : participationStatus === 'declined'
          ? 'Participação recusada.'
          : participationStatus === 'replaced'
            ? 'Participante substituído.'
            : 'Participante excluído da operação.';
    } else if (!attendanceReleased) {
      automaticDecision = 'review';
      automaticReason = link.present || link.signed_at
        ? 'Presença e assinatura estão divergentes.'
        : 'Presença ainda não concluída.';
    } else if (!hasPix) {
      automaticDecision = 'review';
      automaticReason = 'Presente e assinado, mas sem PIX.';
    } else if (pendingAdjustments.length > 0) {
      automaticDecision = 'review';
      automaticReason = `${pendingAdjustments.length} ajuste(s) ainda precisam de conferência.`;
    } else {
      automaticDecision = 'ready';
      automaticReason = 'Presença, assinatura e PIX conferidos, sem ajustes pendentes.';
    }

    const decision = manualOverride?.decision || automaticDecision;
    const decisionReason = manualOverride?.reason || automaticReason;
    const ready = decision === 'ready';

    return {
      link,
      assignments,
      adjustments,
      pendingAdjustments,
      total,
      active,
      attendanceReleased,
      hasPix,
      automaticDecision,
      automaticReason,
      manualOverride,
      decision,
      decisionReason,
      ready,
    };
  }), [links, assignmentMap, adjustmentMap, paymentOverrideMap, roles]);

  const activeRows = rows.filter(row => row.active);
  const payableRows = activeRows.filter(row => row.attendanceReleased);
  const readyRows = rows.filter(row => row.decision === 'ready');
  const reviewRows = rows.filter(row => row.decision === 'review');
  const noPayRows = rows.filter(row => row.decision === 'no_pay');
  const manualDecisionRows = rows.filter(row => !!row.manualOverride);
  const pendingPresenceRows = activeRows.filter(row => !row.attendanceReleased);
  const missingPixRows = activeRows.filter(row => !row.hasPix);
  const adjustedRows = rows.filter(row => row.adjustments.length > 0);

  const forecastTotal = activeRows.reduce((sum, row) => sum + row.total, 0);
  const releasedTotal = payableRows.reduce((sum, row) => sum + row.total, 0);
  const readyTotal = readyRows.reduce((sum, row) => sum + row.total, 0);

  const filteredRows = useMemo(() => {
    const query = paymentSearch
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    return rows.filter((row) => {
      if (paymentStatus === 'decision-ready' && row.decision !== 'ready') return false;
      if (paymentStatus === 'decision-review' && row.decision !== 'review') return false;
      if (paymentStatus === 'decision-no-pay' && row.decision !== 'no_pay') return false;
      if (paymentStatus === 'presence-pending' && (!row.active || row.attendanceReleased)) return false;
      if (paymentStatus === 'missing-pix' && (!row.active || row.hasPix)) return false;
      if (paymentStatus === 'adjusted' && !row.adjustments.length) return false;
      if (paymentStatus === 'inactive' && row.active) return false;

      if (!query) return true;

      const haystack = [
        row.link.collaborator_name,
        row.link.pix,
        row.link.attendance_pix_snapshot,
        row.link.campus,
        row.link.building,
        row.link.floor,
        row.link.room,
        ...row.assignments.map((assignment: any) => assignment.role_name),
      ]
        .filter(Boolean)
        .join(' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [rows, paymentSearch, paymentStatus]);

  const savePaymentDecisionOverride = async () => {
    if (!decisionTarget) return;
    const reason = manualDecisionReason.trim();
    if (reason.length < 3) {
      toast.error('Informe o motivo da intervenção manual.');
      return;
    }

    setSavingDecision(true);
    try {
      const { error } = await (supabase as any).rpc('ps_set_payment_decision_override', {
        p_event_id: eventId,
        p_event_collaborator_id: decisionTarget.link.id,
        p_decision: manualDecision,
        p_reason: reason,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['ps_event_payment_decision_overrides', eventId] });
      toast.success('Decisão manual de pagamento registrada.');
      setDecisionTarget(null);
      setManualDecisionReason('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar a decisão manual.');
    } finally {
      setSavingDecision(false);
    }
  };

  const clearPaymentDecisionOverride = async (eventCollaboratorId: string) => {
    try {
      const { error } = await (supabase as any).rpc('ps_clear_payment_decision_override', {
        p_event_id: eventId,
        p_event_collaborator_id: eventCollaboratorId,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['ps_event_payment_decision_overrides', eventId] });
      toast.success('Decisão manual removida. A classificação automática voltou a valer.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível remover a decisão manual.');
    }
  };

  const exportPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);

    try {
      const { data: signedLinks, error: signedLinksError } = await (supabase as any)
        .from('ps_event_collaborators')
        .select('id,collaborator_name,unit,institution,campus,building,floor,room,pix,attendance_pix_snapshot,signature_url,notes,role_value,role_name,assigned_role,pay_value,work_schedule,participation_status,present,absent,signed_at,manually_excluded')
        .eq('event_id', eventId)
        .eq('present', true)
        .eq('absent', false)
        .eq('manually_excluded', false)
        .in('participation_status', ['pending_confirmation', 'confirmed'])
        .not('signed_at', 'is', null)
        .order('collaborator_name');
      if (signedLinksError) throw signedLinksError;

      const currentSignedLinks = signedLinks || [];
      if (!currentSignedLinks.length) {
        toast.error('Nenhum presente com assinatura foi encontrado para o PDF.');
        return;
      }

      const pdfRows = currentSignedLinks.map((link: any) => {
        const persisted = assignmentMap.get(link.id) || [];
        const fallback = persisted.length ? [] : [buildLegacyAssignment(link, roles)].filter(Boolean);
        const assignments = persisted.length ? persisted : fallback;
        const adjustments = adjustmentMap.get(String(link.id)) || [];
        const effectivePix = String(link.attendance_pix_snapshot || link.pix || '').trim();
        const notes = [
          paymentObservation(link.notes, adjustments),
          effectivePix ? '' : 'PIX pendente',
        ].filter(Boolean).join(' | ');

        return {
          id: link.id,
          collaborator_name: link.collaborator_name,
          unit: link.unit,
          institution: link.institution,
          campus: link.campus,
          floor: link.floor,
          room: link.room,
          pix: effectivePix || 'PENDENTE',
          notes,
          signature_url: link.signature_url || null,
          assignments: assignments.map((item: any) => ({
            role_name: item.role_name,
            journey_key: item.journey_key,
            work_schedule: item.work_schedule,
            pay_value: Number(item.pay_value || 0),
          })),
        };
      });

      const eventInfo = {
        name: event.name || '',
        date: event.date ? new Date(`${event.date}T00:00:00`).toLocaleDateString('pt-BR') : null,
        location: event.location || null,
      };
      const slug = String(event.name || 'evento').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (pdfRows.length !== currentSignedLinks.length) {
        throw new Error(`Falha de integridade: ${currentSignedLinks.length} presentes assinados foram encontrados, mas apenas ${pdfRows.length} foram preparados para o PDF.`);
      }

      const sourceIds = new Set(currentSignedLinks.map((link: any) => String(link.id)));
      const preparedIds = new Set(pdfRows.map((row: any) => String(row.id)));
      const missing = [...sourceIds].filter((id) => !preparedIds.has(id));
      if (missing.length) {
        throw new Error(`Falha de integridade: ${missing.length} pessoa(s) ficaram fora da preparação do PDF. Gere novamente após atualizar a página.`);
      }

      const pdf = await generatePsPaymentsPdfAsync(eventInfo, pdfRows);
      pdf.save(`pagamentos-${slug || 'evento'}.pdf`);
      toast.success(`${pdfRows.length} presente(s) com assinatura incluído(s) no PDF.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar o PDF de pagamentos.');
    } finally {
      setExportingPdf(false);
    }
  };

  if (linksLoading || assignmentsQuery.isLoading || adjustmentsQuery.isLoading || paymentOverridesQuery.isLoading) {
    return <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando pagamentos...</div>;
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden rounded-2xl border-primary/20 bg-gradient-to-r from-card/80 via-card/70 to-primary/[0.04]">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">Conferência de pagamentos</h2>
                <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 text-primary">
                  {readyRows.length} pronto(s)
                </Badge>
              </div>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                O sistema classifica automaticamente cada pessoa em Pronto, Revisar ou Não pagar. Decisões manuais ficam registradas com justificativa.
              </p>
            </div>

            <Button
              className="shrink-0 rounded-xl"
              onClick={() => void exportPdf()}
              disabled={!readyRows.length || exportingPdf}
            >
              {exportingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {exportingPdf ? 'Gerando PDF...' : 'Gerar PDF de assinados'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button type="button" className="text-left" onClick={() => setPaymentStatus('decision-ready')}>
          <Card className="h-full rounded-2xl border-emerald-500/20 bg-emerald-500/[0.03] transition hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Pronto para pagamento</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-500">{readyRows.length}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{money(readyTotal)} liberados</p>
            </CardContent>
          </Card>
        </button>

        <button type="button" className="text-left" onClick={() => setPaymentStatus('decision-review')}>
          <Card className="h-full rounded-2xl border-amber-500/20 bg-amber-500/[0.03] transition hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Revisar</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-500">{reviewRows.length}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">presença, PIX ou ajuste pendente</p>
            </CardContent>
          </Card>
        </button>

        <button type="button" className="text-left" onClick={() => setPaymentStatus('decision-no-pay')}>
          <Card className="h-full rounded-2xl border-border/70 bg-muted/[0.02] transition hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Não pagar</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{noPayRows.length}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">ausentes, recusados ou substituídos</p>
            </CardContent>
          </Card>
        </button>

        <Card className="rounded-2xl border-primary/20 bg-primary/[0.025]">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Intervenções manuais</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-primary">{manualDecisionRows.length}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{activeRows.length} ativos · {money(forecastTotal)} previstos</p>
          </CardContent>
        </Card>
      </div>

      {(missingPixRows.length > 0 || adjustedRows.length > 0) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {missingPixRows.length > 0 && (
            <button type="button" className="text-left" onClick={() => setPaymentStatus('missing-pix')}>
              <Card className="h-full rounded-2xl border-amber-500/20 bg-amber-500/[0.03] transition hover:-translate-y-0.5 hover:shadow-md">
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                    <WalletCards className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{missingPixRows.length} fiscal(is) sem PIX</p>
                    <p className="mt-1 text-xs text-muted-foreground">Clique para revisar quem ainda precisa completar o dado de pagamento.</p>
                  </div>
                </CardContent>
              </Card>
            </button>
          )}

          {adjustedRows.length > 0 && (
            <button type="button" className="text-left" onClick={() => setPaymentStatus('adjusted')}>
              <Card className="h-full rounded-2xl border-primary/15 bg-primary/[0.02] transition hover:-translate-y-0.5 hover:shadow-md">
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <History className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{adjustedRows.length} colaborador(es) com ajuste registrado</p>
                    <p className="mt-1 text-xs text-muted-foreground">Alterações de cargo ou PIX ficam sinalizadas para conferência.</p>
                  </div>
                </CardContent>
              </Card>
            </button>
          )}
        </div>
      )}

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" />
                Pagamentos por colaborador
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Filtre por situação para revisar somente quem ainda precisa de ação.
              </p>
            </div>
            <Badge variant="secondary" className="w-fit rounded-full">{filteredRows.length} registro(s)</Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="grid gap-2 border-b p-4 lg:grid-cols-[minmax(280px,1fr)_240px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={paymentSearch}
                onChange={(event) => setPaymentSearch(event.target.value)}
                placeholder="Buscar por nome, cargo, PIX, prédio ou sala..."
                className="h-10 rounded-xl pl-10"
              />
            </div>

            <Select value={paymentStatus} onValueChange={(value: any) => setPaymentStatus(value)}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="Situação financeira" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as situações</SelectItem>
                <SelectItem value="decision-ready">Pronto para pagamento</SelectItem>
                <SelectItem value="decision-review">Revisar</SelectItem>
                <SelectItem value="decision-no-pay">Não pagar</SelectItem>
                <SelectItem value="presence-pending">Presença pendente</SelectItem>
                <SelectItem value="missing-pix">Sem PIX</SelectItem>
                <SelectItem value="adjusted">Com ajuste registrado</SelectItem>
                <SelectItem value="inactive">Ausente / recusado / substituído</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="divide-y">
            {filteredRows.map(({ link, assignments, adjustments, pendingAdjustments, total, active, attendanceReleased, hasPix, ready, automaticDecision, automaticReason, manualOverride, decision, decisionReason }) => (
              <div key={link.id} className={`flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between ${!active ? 'opacity-55' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{link.collaborator_name}</p>

                    {link.absent && <Badge variant="destructive">Ausente</Badge>}
                    {link.participation_status === 'declined' && <Badge variant="destructive">Recusou</Badge>}
                    {link.participation_status === 'replaced' && <Badge variant="secondary">Substituído</Badge>}
                    {link.manually_excluded && <Badge variant="secondary">Excluído</Badge>}

                    {decision === 'ready' && (
                      <Badge className="rounded-full bg-emerald-600 hover:bg-emerald-600">
                        <CheckCircle2 className="mr-1 h-3 w-3" />Pronto para pagamento
                      </Badge>
                    )}
                    {decision === 'review' && (
                      <Badge variant="outline" className="rounded-full border-amber-500/25 text-amber-500">
                        <Clock3 className="mr-1 h-3 w-3" />Revisar
                      </Badge>
                    )}
                    {decision === 'no_pay' && (
                      <Badge variant="secondary" className="rounded-full">Não pagar</Badge>
                    )}
                    {manualOverride && (
                      <Badge variant="outline" className="rounded-full border-primary/20 text-primary">Decisão manual</Badge>
                    )}
                    {active && !attendanceReleased && (
                      <Badge variant="outline" className="rounded-full border-amber-500/25 text-amber-500">
                        <Clock3 className="mr-1 h-3 w-3" />Presença pendente
                      </Badge>
                    )}
                    {active && !hasPix && (
                      <Badge variant="outline" className="rounded-full border-amber-500/25 text-amber-500">
                        <WalletCards className="mr-1 h-3 w-3" />Sem PIX
                      </Badge>
                    )}
                    {adjustments.length > 0 && (
                      <Badge variant="outline" className="rounded-full border-primary/20 text-primary">
                        <History className="mr-1 h-3 w-3" />{adjustments.length} ajuste(s)
                      </Badge>
                    )}
                    {assignments.length > 1 && <Badge variant="outline">{assignments.length} cargos</Badge>}
                  </div>

                  <div className="mt-2 space-y-1">
                    {assignments.map((assignment: any, index: number) => (
                      <div key={assignment.id || `${link.id}-${index}`} className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span className="text-foreground/90">{assignment.role_name}</span>
                        {assignment.journey_key && <span>· {assignment.journey_key === 'integral' ? 'Integral' : assignment.journey_key}</span>}
                        {assignment.work_schedule && <span>· {assignment.work_schedule}</span>}
                        <span>· <strong className="font-medium text-foreground">{money(assignment.pay_value)}</strong></span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                    <span>PIX: <strong className={hasPix ? 'text-foreground' : 'text-amber-500'}>{hasPix ? String(link.attendance_pix_snapshot || link.pix) : 'não cadastrado'}</strong></span>
                    {attendanceReleased && <span>Presença liberada</span>}
                  </div>

                  <div className="mt-2 rounded-lg border border-border/50 bg-muted/[0.025] px-2.5 py-2 text-[10px]">
                    <p className="font-medium text-foreground">
                      Automático: {automaticDecision === 'ready' ? 'Pronto' : automaticDecision === 'review' ? 'Revisar' : 'Não pagar'}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">{automaticReason}</p>
                    {manualOverride && (
                      <p className="mt-1 text-primary">
                        Manual: {decision === 'ready' ? 'Pronto' : decision === 'review' ? 'Revisar' : 'Não pagar'} · {decisionReason}
                      </p>
                    )}
                  </div>

                  {adjustments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {adjustments.slice(0, 3).map((adjustment: any) => (
                        <span key={adjustment.id} className="rounded-full border border-primary/10 bg-primary/[0.04] px-2 py-0.5 text-[9px] text-primary">
                          {adjustment.adjustment_type === 'role' ? 'Cargo alterado' : 'PIX alterado'}
                          {adjustment.justification ? ` · ${adjustment.justification}` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-4 lg:justify-end">
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total previsto</p>
                    <p className="text-lg font-semibold tabular-nums">{money(total)}</p>
                    <p className={`mt-0.5 text-[9px] font-medium ${decision === 'ready' ? 'text-emerald-500' : decision === 'review' ? 'text-amber-500' : 'text-muted-foreground'}`}>
                      {decision === 'ready' ? 'Pronto' : decision === 'review' ? 'Revisar' : 'Não pagar'}
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => {
                        setDecisionTarget({ link, automaticDecision, automaticReason, manualOverride, decision });
                        setManualDecision((manualOverride?.decision || decision) as 'ready' | 'review' | 'no_pay');
                        setManualDecisionReason('');
                      }}
                    >
                      <History className="mr-1.5 h-3.5 w-3.5" />Intervenção manual
                    </Button>
                    {manualOverride && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-xl text-primary"
                        onClick={() => void clearPaymentDecisionOverride(link.id)}
                      >
                        Usar automático
                      </Button>
                    )}
                    {active && (
                      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setEditLink(link)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />Editar cargos
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {filteredRows.length === 0 && (
              <div className="p-10 text-center">
                <CircleDollarSign className="mx-auto h-8 w-8 text-muted-foreground/45" />
                <p className="mt-2 text-sm font-semibold">Nenhum colaborador encontrado</p>
                <p className="mt-1 text-xs text-muted-foreground">Ajuste a busca ou o filtro financeiro.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!decisionTarget}
        onOpenChange={(open) => {
          if (savingDecision) return;
          if (!open) {
            setDecisionTarget(null);
            setManualDecisionReason('');
          }
        }}
      >
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Intervenção manual no pagamento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-muted/[0.025] p-3">
              <p className="font-semibold">{decisionTarget?.link?.collaborator_name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Regra automática: {decisionTarget?.automaticDecision === 'ready' ? 'Pronto' : decisionTarget?.automaticDecision === 'review' ? 'Revisar' : 'Não pagar'} · {decisionTarget?.automaticReason}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Decisão manual</Label>
              <Select value={manualDecision} onValueChange={(value: any) => setManualDecision(value)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ready">Pronto para pagamento</SelectItem>
                  <SelectItem value="review">Revisar</SelectItem>
                  <SelectItem value="no_pay">Não pagar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payment-decision-reason">Justificativa obrigatória</Label>
              <Textarea
                id="payment-decision-reason"
                value={manualDecisionReason}
                onChange={(event) => setManualDecisionReason(event.target.value)}
                placeholder="Explique por que a decisão manual deve prevalecer sobre a regra automática."
                rows={4}
              />
              <p className="text-[10px] text-muted-foreground">
                A classificação automática permanece registrada e pode ser restaurada a qualquer momento.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={savingDecision}
              onClick={() => {
                setDecisionTarget(null);
                setManualDecisionReason('');
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={savingDecision || manualDecisionReason.trim().length < 3}
              onClick={() => void savePaymentDecisionOverride()}
            >
              {savingDecision ? 'Salvando...' : 'Salvar decisão manual'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PsEventCollaboratorEditDialog
        eventId={eventId}
        link={editLink}
        roles={roles as any[]}
        open={!!editLink}
        onOpenChange={open => !open && setEditLink(null)}
      />
    </div>
  );
}
