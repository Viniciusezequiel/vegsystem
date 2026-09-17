import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BriefcaseBusiness, Building2, CircleDollarSign, CreditCard, Loader2, Plus, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-4xl" onInteractOutside={event => event.preventDefault()}>
        <DialogHeader className="border-b border-border/60 px-6 py-5 pr-12">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <DialogTitle>Editar fiscal no evento</DialogTitle>
              <DialogDescription className="mt-1">
                As alterações abaixo valem para este evento e não removem o histórico do fiscal.
              </DialogDescription>
            </div>
            {form && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-right">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total previsto</p>
                <p className="text-lg font-semibold tabular-nums">{money(total)}</p>
              </div>
            )}
          </div>
        </DialogHeader>

        {!form || assignmentQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados...
          </div>
        ) : (
          <Tabs defaultValue="assignment" className="flex min-h-0 flex-col">
            <div className="border-b border-border/60 px-6 py-3">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted/45 p-1 sm:grid-cols-4">
                <TabsTrigger value="assignment" className="gap-2 py-2 text-xs"><BriefcaseBusiness className="h-3.5 w-3.5" />Atuação</TabsTrigger>
                <TabsTrigger value="identity" className="gap-2 py-2 text-xs"><UserRound className="h-3.5 w-3.5" />Dados</TabsTrigger>
                <TabsTrigger value="location" className="gap-2 py-2 text-xs"><Building2 className="h-3.5 w-3.5" />Local</TabsTrigger>
                <TabsTrigger value="payment" className="gap-2 py-2 text-xs"><CreditCard className="h-3.5 w-3.5" />Financeiro</TabsTrigger>
              </TabsList>
            </div>

            <div className="max-h-[calc(92dvh-225px)] min-h-0 overflow-y-auto px-4 py-4 sm:min-h-[360px] sm:px-6 sm:py-5">
              <TabsContent value="assignment" className="m-0 space-y-4">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold"><CircleDollarSign className="h-4 w-4 text-primary" />Funções e jornada</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {hasMultipleAssignments
                      ? 'O primeiro cargo é o principal. Os demais representam funções adicionais neste evento.'
                      : 'Defina o cargo, a jornada, o horário e o valor específico deste evento.'}
                  </p>
                </div>

                <div className="space-y-3">
                  {assignments.map((assignment, index) => (
                    <section key={assignment.id || `new-${index}`} className="rounded-xl border border-border/60 bg-muted/10 p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">Cargo {index + 1}</p>
                          {index === 0 && <Badge variant="secondary">Principal</Badge>}
                        </div>
                        {hasMultipleAssignments && (
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeAssignment(index)} aria-label={`Remover cargo ${index + 1}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

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
                    </section>
                  ))}

                  <Button type="button" variant="outline" className="border-dashed" onClick={addAssignment}>
                    <Plus className="mr-2 h-4 w-4" />Adicionar outro cargo
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="identity" className="m-0 space-y-4">
                <div>
                  <h3 className="font-semibold">Identificação e contato</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Dados usados nas listas, comunicações e documentos deste evento.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input value={form.collaborator_name || ''} onChange={event => setForm({ ...form, collaborator_name: event.target.value })} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" value={form.email || ''} onChange={event => setForm({ ...form, email: event.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Telefone</Label><Input value={form.phone || ''} onChange={event => setForm({ ...form, phone: event.target.value })} /></div>
                </div>
              </TabsContent>

              <TabsContent value="location" className="m-0 space-y-4">
                <div>
                  <h3 className="font-semibold">Alocação no evento</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Informe onde o fiscal atuará. Esses dados aparecem nas comunicações e listas.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>Campus do evento</Label><Input value={form.campus || ''} onChange={event => setForm({ ...form, campus: event.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Setor</Label><Input value={form.sector || ''} onChange={event => setForm({ ...form, sector: event.target.value })} /></div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5"><Label>Prédio</Label><Input value={form.building || ''} onChange={event => setForm({ ...form, building: event.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Andar</Label><Input value={form.floor || ''} onChange={event => setForm({ ...form, floor: event.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Sala</Label><Input value={form.room || ''} onChange={event => setForm({ ...form, room: event.target.value })} /></div>
                </div>
              </TabsContent>

              <TabsContent value="payment" className="m-0 space-y-4">
                <div>
                  <h3 className="font-semibold">Dados para pagamento</h3>
                  <p className="mt-1 text-xs text-muted-foreground">O PIX é obrigatório para salvar. O total é calculado pelos cargos cadastrados na aba Atuação.</p>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs text-muted-foreground">Total previsto neste evento</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{money(total)}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>PIX *</Label><Input value={form.pix || ''} onChange={event => setForm({ ...form, pix: event.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Informações de depósito</Label><Input value={form.deposit_info || ''} onChange={event => setForm({ ...form, deposit_info: event.target.value })} /></div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        )}

        <DialogFooter className="border-t border-border/60 bg-background/95 px-6 py-4">
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={saving || assignmentQuery.isLoading} onClick={() => void save()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
