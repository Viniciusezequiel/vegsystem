import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleDollarSign, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { normalizePix } from '@/lib/psPixPlan';
import {
  PS_JOURNEY_OPTIONS,
  buildLegacyAssignment,
  hydratePsAssignmentSnapshot,
  psAssignmentsTotal,
  resolvePsRoleRate,
} from '@/lib/psEventAssignments.mjs';

type AssignmentDraft = {
  id?: string;
  role_value: string | null;
  role_name: string;
  journey_key: string | null;
  work_schedule: string | null;
  pay_value: number | string;
  is_primary?: boolean;
  source?: string;
  notes?: string | null;
};

type Props = {
  eventId: string;
  link: any | null;
  roles: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const money = (value: unknown) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

export function PsEventCollaboratorEditDialog({ eventId, link, roles, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<any>(null);
  const [assignments, setAssignments] = useState<AssignmentDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const assignmentQuery = useQuery({
    queryKey: ['ps_event_collaborator_assignments', link?.id],
    enabled: open && !!link?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ps_event_collaborator_assignments')
        .select('id,event_id,event_collaborator_id,role_value,role_name,journey_key,work_schedule,pay_value,is_primary,source,notes,created_at')
        .eq('event_collaborator_id', link.id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!open || !link) return;
    setForm({ ...link });
  }, [open, link]);

  useEffect(() => {
    if (!open || !link || assignmentQuery.isLoading) return;
    if (assignmentQuery.data?.length) {
      setAssignments(
        assignmentQuery.data.map((item: any) => hydratePsAssignmentSnapshot(item, link, roles))
      );
      return;
    }
    const legacy = buildLegacyAssignment(link, roles);
    setAssignments(legacy ? [legacy] : []);
  }, [open, link, roles, assignmentQuery.data, assignmentQuery.isLoading]);

  const activeRoles = useMemo(() => roles.filter((role: any) => role.active !== false), [roles]);
  const total = psAssignmentsTotal(assignments);
  const hasMultipleAssignments = assignments.length > 1;

  const patchAssignment = (index: number, patch: Partial<AssignmentDraft>) => {
    setAssignments(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const selectRole = (index: number, roleValue: string) => {
    const role = roles.find((item: any) => item.value === roleValue);
    if (!role) return;
    const current = assignments[index];
    const journey = current?.journey_key || '8h';
    const rate = resolvePsRoleRate(role, journey) ?? Number(role.pay_value_8h ?? role.pay_value ?? 0);
    patchAssignment(index, {
      role_value: role.value,
      role_name: role.name,
      journey_key: journey,
      pay_value: rate,
    });
  };

  const selectJourney = (index: number, journeyKey: string) => {
    const current = assignments[index];
    const role = roles.find((item: any) => item.value === current?.role_value);
    if (journeyKey === 'custom') {
      patchAssignment(index, { journey_key: null });
      return;
    }
    const rate = resolvePsRoleRate(role, journeyKey);
    patchAssignment(index, {
      journey_key: journeyKey,
      ...(rate === null ? {} : { pay_value: rate }),
    });
  };

  const addAssignment = () => {
    setAssignments(current => [
      ...current,
      {
        role_value: null,
        role_name: '',
        journey_key: '8h',
        work_schedule: null,
        pay_value: 0,
        source: 'manual',
      },
    ]);
  };

  const removeAssignment = (index: number) => {
    setAssignments(current => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const save = async () => {
    if (!link || !form) return;
    if (!assignments.length || assignments.some(item => !item.role_value || !item.role_name.trim())) {
      toast.error('Cadastre pelo menos um cargo válido para o colaborador.');
      return;
    }
    const normalizedPix = normalizePix(form.pix);
    if (!normalizedPix) {
      toast.error('Informe um PIX válido antes de salvar.');
      return;
    }

    setSaving(true);
    try {
      const payload = assignments.map((item, index) => ({
        role_value: item.role_value,
        role_name: item.role_name.trim(),
        journey_key: item.journey_key,
        work_schedule: item.work_schedule || null,
        pay_value: Number(item.pay_value || 0),
        is_primary: index === 0,
        source: ['import', 'legacy', 'attendance_adjustment'].includes(item.source || '') ? item.source : 'manual',
        notes: item.notes || null,
      }));

      const patch = {
        collaborator_name: form.collaborator_name,
        building: form.building || null,
        floor: form.floor || null,
        room: form.room || null,
        campus: form.campus || null,
        sector: form.sector || null,
        email: form.email || null,
        phone: form.phone || null,
        pix: normalizedPix,
        deposit_info: form.deposit_info || null,
      };

      const { data, error } = await (supabase as any).rpc(
        'ps_admin_update_event_collaborator_details',
        {
          p_event_collaborator_id: link.id,
          p_patch: patch,
          p_assignments: payload,
        }
      );
      if (error) throw error;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ps_event_collaborators', eventId] }),
        queryClient.invalidateQueries({ queryKey: ['ps_event_collaborator_assignments', link.id] }),
        queryClient.invalidateQueries({ queryKey: ['ps_event_assignments', eventId] }),
        queryClient.invalidateQueries({ queryKey: ['ps_collaborators'] }),
      ]);

      const savedTotal = Number(data?.[0]?.total_pay ?? total);
      toast.success(`Dados salvos. Total previsto: ${money(savedTotal)}.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar os dados do colaborador.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={value => !saving && onOpenChange(value)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl" onInteractOutside={event => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Editar dados no evento</DialogTitle>
        </DialogHeader>

        {!form || assignmentQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados...
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.collaborator_name || ''} onChange={event => setForm({ ...form, collaborator_name: event.target.value })} />
            </div>

            <section className="rounded-2xl border border-border/60 bg-muted/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CircleDollarSign className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">Cargo e pagamento neste evento</h3>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {hasMultipleAssignments
                      ? 'O primeiro cargo é considerado principal. Os demais são funções adicionais exercidas no mesmo evento.'
                      : 'Os dados abaixo refletem o cargo e a jornada vinculados ao fiscal neste evento.'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total a receber</p>
                  <p className="text-xl font-semibold tabular-nums">{money(total)}</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {assignments.map((assignment, index) => (
                  <div key={assignment.id || `new-${index}`} className="rounded-xl border border-border/60 bg-background/50 p-3">
                    {hasMultipleAssignments && (
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">Cargo {index + 1}</p>
                          {index === 0 && <Badge variant="secondary">Principal</Badge>}
                        </div>
                        <Button type="button" size="icon" variant="ghost" onClick={() => removeAssignment(index)} aria-label="Remover cargo">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    <div className="grid gap-3 md:grid-cols-[1.45fr_.65fr_.75fr]">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Função</Label>
                        <Select value={assignment.role_value || undefined} onValueChange={value => selectRole(index, value)}>
                          <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                          <SelectContent>
                            {activeRoles.map((role: any) => <SelectItem key={role.id} value={role.value}>{role.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Jornada</Label>
                        <Select value={assignment.journey_key || 'custom'} onValueChange={value => selectJourney(index, value)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PS_JOURNEY_OPTIONS.map(option => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}
                            <SelectItem value="custom">Personalizada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Valor (R$)</Label>
                        <Input type="number" min="0" step="0.01" value={assignment.pay_value} onChange={event => patchAssignment(index, { pay_value: event.target.value })} />
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      <Label className="text-xs">Horário deste cargo</Label>
                      <Input value={assignment.work_schedule || ''} onChange={event => patchAssignment(index, { work_schedule: event.target.value || null })} placeholder="Ex.: 08:00 às 12:00" />
                    </div>
                  </div>
                ))}

                <Button type="button" variant="outline" className="w-full" onClick={addAssignment}>
                  <Plus className="mr-2 h-4 w-4" />Adicionar outro cargo
                </Button>
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label>Prédio</Label><Input value={form.building || ''} onChange={event => setForm({ ...form, building: event.target.value })} /></div>
              <div><Label>Andar</Label><Input value={form.floor || ''} onChange={event => setForm({ ...form, floor: event.target.value })} /></div>
              <div><Label>Sala</Label><Input value={form.room || ''} onChange={event => setForm({ ...form, room: event.target.value })} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Setor</Label><Input value={form.sector || ''} onChange={event => setForm({ ...form, sector: event.target.value })} /></div>
              <div><Label>Campus do evento</Label><Input value={form.campus || ''} onChange={event => setForm({ ...form, campus: event.target.value })} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>E-mail</Label><Input value={form.email || ''} onChange={event => setForm({ ...form, email: event.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.phone || ''} onChange={event => setForm({ ...form, phone: event.target.value })} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>PIX</Label><Input value={form.pix || ''} onChange={event => setForm({ ...form, pix: event.target.value })} /></div>
              <div><Label>Depósito</Label><Input value={form.deposit_info || ''} onChange={event => setForm({ ...form, deposit_info: event.target.value })} /></div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={saving || assignmentQuery.isLoading} onClick={() => void save()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
