import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleDollarSign, Clock3, Download, History, Loader2, Pencil, Search, Users, WalletCards } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

export function PsEventPaymentsPanel({ event }: Props) {
  const eventId = event.id as string;
  const { data: links = [], isLoading: linksLoading } = usePsEventCollaborators(eventId);
  const { data: roles = [] } = usePsRoles();
  const [editLink, setEditLink] = useState<any>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'all' | 'ready' | 'presence-pending' | 'missing-pix' | 'adjusted' | 'inactive'>('all');

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

  const rows = useMemo(() => links.map((link: any) => {
    const persisted = assignmentMap.get(link.id) || [];
    const fallback = persisted.length ? [] : [buildLegacyAssignment(link, roles)].filter(Boolean);
    const assignments = persisted.length ? persisted : fallback;
    const adjustments = adjustmentMap.get(String(link.id)) || [];
    const total = psAssignmentsTotal(assignments);
    const participationStatus = String(link.participation_status || 'pending_confirmation');
    const active =
      !link.absent &&
      !link.manually_excluded &&
      participationStatus !== 'replaced' &&
      participationStatus !== 'declined';
    const attendanceReleased = active && (!!link.present || !!link.signed_at);
    const hasPix = !!String(link.attendance_pix_snapshot || link.pix || '').trim();
    const ready = attendanceReleased && hasPix;

    return {
      link,
      assignments,
      adjustments,
      total,
      active,
      attendanceReleased,
      hasPix,
      ready,
    };
  }), [links, assignmentMap, adjustmentMap, roles]);

  const activeRows = rows.filter(row => row.active);
  const payableRows = activeRows.filter(row => row.attendanceReleased);
  const readyRows = activeRows.filter(row => row.ready);
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
      if (paymentStatus === 'ready' && !row.ready) return false;
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

  const exportPdf = async () => {
    if (!readyRows.length || exportingPdf) return;
    setExportingPdf(true);

    try {
      const ids = readyRows.map(row => row.link.id);
      const { data: signatureRows, error: signatureError } = await (supabase as any)
        .from('ps_event_collaborators')
        .select('id,signature_url')
        .in('id', ids);
      if (signatureError) throw signatureError;

      const signatureMap = new Map<string, string | null>(
        (signatureRows || []).map((item: any) => [item.id, item.signature_url || null]),
      );

      const pdfRows = readyRows.map(row => ({
        collaborator_name: row.link.collaborator_name,
        unit: row.link.unit,
        institution: row.link.institution,
        campus: row.link.campus,
        floor: row.link.floor,
        room: row.link.room,
        pix: row.link.attendance_pix_snapshot || row.link.pix,
        notes: row.link.notes,
        signature_url: signatureMap.get(row.link.id) || null,
        assignments: row.assignments.map((item: any) => ({
          role_name: item.role_name,
          journey_key: item.journey_key,
          work_schedule: item.work_schedule,
          pay_value: Number(item.pay_value || 0),
        })),
      }));

      const eventInfo = {
        name: event.name || '',
        date: event.date ? new Date(`${event.date}T00:00:00`).toLocaleDateString('pt-BR') : null,
        location: event.location || null,
      };
      const slug = String(event.name || 'evento').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const pdf = await generatePsPaymentsPdfAsync(eventInfo, pdfRows);
      pdf.save(`pagamentos-${slug || 'evento'}.pdf`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar o PDF de pagamentos.');
    } finally {
      setExportingPdf(false);
    }
  };

  if (linksLoading || assignmentsQuery.isLoading || adjustmentsQuery.isLoading) {
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
                O valor só entra como pronto para pagamento quando a presença está liberada e o fiscal possui PIX cadastrado.
              </p>
            </div>

            <Button
              className="shrink-0 rounded-xl"
              onClick={() => void exportPdf()}
              disabled={!readyRows.length || exportingPdf}
            >
              {exportingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {exportingPdf ? 'Gerando PDF...' : 'Gerar PDF dos prontos'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Previsto no evento</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{money(forecastTotal)}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{activeRows.length} colaborador(es) ativos</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Liberado por presença</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{money(releasedTotal)}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{payableRows.length} presença(s) confirmada(s)</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-primary/25 bg-primary/[0.035]">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pronto para pagamento</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-primary">{money(readyTotal)}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{readyRows.length} com presença + PIX</p>
          </CardContent>
        </Card>

        <Card className={`rounded-2xl ${pendingPresenceRows.length || missingPixRows.length ? 'border-amber-500/25 bg-amber-500/[0.035]' : 'border-emerald-500/20 bg-emerald-500/[0.025]'}`}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pendências financeiras</p>
            <p className={`mt-1 text-2xl font-semibold ${pendingPresenceRows.length || missingPixRows.length ? 'text-amber-500' : 'text-emerald-500'}`}>
              {new Set([...pendingPresenceRows.map(row => row.link.id), ...missingPixRows.map(row => row.link.id)]).size}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {pendingPresenceRows.length} presença(s) · {missingPixRows.length} sem PIX
            </p>
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
                <SelectItem value="ready">Pronto para pagamento</SelectItem>
                <SelectItem value="presence-pending">Presença pendente</SelectItem>
                <SelectItem value="missing-pix">Sem PIX</SelectItem>
                <SelectItem value="adjusted">Com ajuste registrado</SelectItem>
                <SelectItem value="inactive">Ausente / recusado / substituído</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="divide-y">
            {filteredRows.map(({ link, assignments, adjustments, total, active, attendanceReleased, hasPix, ready }) => (
              <div key={link.id} className={`flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between ${!active ? 'opacity-55' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{link.collaborator_name}</p>

                    {link.absent && <Badge variant="destructive">Ausente</Badge>}
                    {link.participation_status === 'declined' && <Badge variant="destructive">Recusou</Badge>}
                    {link.participation_status === 'replaced' && <Badge variant="secondary">Substituído</Badge>}
                    {link.manually_excluded && <Badge variant="secondary">Excluído</Badge>}

                    {active && ready && (
                      <Badge className="rounded-full">
                        <CheckCircle2 className="mr-1 h-3 w-3" />Pronto para pagamento
                      </Badge>
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
                    <p className={`mt-0.5 text-[9px] font-medium ${ready ? 'text-emerald-500' : attendanceReleased ? 'text-amber-500' : 'text-muted-foreground'}`}>
                      {ready ? 'Pronto' : attendanceReleased ? 'Aguardando PIX' : active ? 'Aguardando presença' : 'Fora do pagamento'}
                    </p>
                  </div>

                  {active && (
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setEditLink(link)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />Editar cargos
                    </Button>
                  )}
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
