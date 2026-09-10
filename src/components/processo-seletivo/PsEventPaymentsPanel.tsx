import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleDollarSign, Download, Loader2, Pencil, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePsEventCollaborators, usePsRoles } from '@/hooks/useProcessoSeletivo';
import { supabase } from '@/integrations/supabase/client';
import { psAssignmentsTotal, buildLegacyAssignment } from '@/lib/psEventAssignments.mjs';
import { generatePsPaymentsPdf } from '@/lib/psPaymentPdf';
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

  const assignmentMap = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const item of assignmentsQuery.data || []) {
      const current = map.get(item.event_collaborator_id) || [];
      current.push(item);
      map.set(item.event_collaborator_id, current);
    }
    return map;
  }, [assignmentsQuery.data]);

  const rows = useMemo(() => links.map((link: any) => {
    const persisted = assignmentMap.get(link.id) || [];
    const fallback = persisted.length ? [] : [buildLegacyAssignment(link, roles)].filter(Boolean);
    const assignments = persisted.length ? persisted : fallback;
    return { link, assignments, total: psAssignmentsTotal(assignments) };
  }), [links, assignmentMap, roles]);

  const activeRows = rows.filter(row => !row.link.absent && row.link.participation_status !== 'replaced');
  const payableRows = activeRows.filter(row => !!row.link.present || !!row.link.signed_at);
  const forecastTotal = activeRows.reduce((sum, row) => sum + row.total, 0);
  const grandTotal = payableRows.reduce((sum, row) => sum + row.total, 0);

  const exportPdf = () => {
    const pdfRows = payableRows.map(row => ({
      collaborator_name: row.link.collaborator_name,
      unit: row.link.unit,
      institution: row.link.institution,
      campus: row.link.campus,
      pix: row.link.pix,
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
    generatePsPaymentsPdf(eventInfo, pdfRows).save(`pagamentos-${slug || 'evento'}.pdf`);
  };

  if (linksLoading || assignmentsQuery.isLoading) {
    return <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando pagamentos...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Colaboradores escalados</p><p className="mt-1 text-2xl font-semibold">{activeRows.length}</p><p className="mt-1 text-[10px] text-muted-foreground">Previsto: {money(forecastTotal)}</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Presença confirmada</p><p className="mt-1 text-2xl font-semibold">{payableRows.length}</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Atribuições de cargo</p><p className="mt-1 text-2xl font-semibold">{payableRows.reduce((sum, row) => sum + row.assignments.length, 0)}</p></CardContent></Card>
        <Card className="rounded-2xl border-primary/30 bg-primary/5"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total a pagar</p><p className="mt-1 text-2xl font-semibold tabular-nums">{money(grandTotal)}</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Pagamentos por colaborador</h2>
          <p className="mt-1 text-xs text-muted-foreground">Cada pessoa aparece uma única vez; os cargos e valores são discriminados individualmente.</p>
        </div>
        <Button onClick={exportPdf} disabled={!payableRows.length}><Download className="mr-2 h-4 w-4" />Gerar PDF de pagamentos</Button>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-primary" />Equipe do evento</CardTitle></CardHeader>
        <CardContent className="divide-y p-0">
          {rows.map(({ link, assignments, total }) => (
            <div key={link.id} className={`flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between ${link.absent || link.participation_status === 'replaced' ? 'opacity-55' : ''}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{link.collaborator_name}</p>
                  {link.absent && <Badge variant="destructive">Ausente</Badge>}
                  {link.participation_status === 'replaced' && <Badge variant="secondary">Substituído</Badge>}
                  {!link.absent && link.participation_status !== 'replaced' && !link.present && !link.signed_at && <Badge variant="outline">Presença pendente</Badge>}
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
              </div>
              <div className="flex items-center justify-between gap-4 lg:justify-end">
                <div className="text-right"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p><p className="text-lg font-semibold tabular-nums">{money(total)}</p></div>
                <Button size="sm" variant="outline" onClick={() => setEditLink(link)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar cargos</Button>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="p-8 text-center"><CircleDollarSign className="mx-auto h-8 w-8 text-muted-foreground/45" /><p className="mt-2 text-sm text-muted-foreground">Nenhum colaborador vinculado ao evento.</p></div>
          )}
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
