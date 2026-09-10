import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, FileDown, Loader2, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { generatePsTrainingAttendancePdf } from '@/lib/psTrainingAttendancePdf';

type Props = { eventId: string; roles: any[] };
type GroupForm = { name: string; description: string; required: boolean; roleValues: string[] };
type SessionForm = { groupId: string; startsAt: string; endsAt: string; campus: string; location: string; room: string; capacity: string; notes: string };
const emptyGroup: GroupForm = { name: '', description: '', required: true, roleValues: [] };
const emptySession: SessionForm = { groupId: '', startsAt: '', endsAt: '', campus: '', location: '', room: '', capacity: '', notes: '' };
const fmt = (value?: string) => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Data não definida';

export function PsEventTrainingTab({ eventId, roles }: Props) {
  const qc = useQueryClient();
  const [groupOpen, setGroupOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [groupForm, setGroupForm] = useState<GroupForm>(emptyGroup);
  const [sessionForm, setSessionForm] = useState<SessionForm>(emptySession);
  const [saving, setSaving] = useState(false);

  const query = useQuery({
    queryKey: ['ps_event_trainings', eventId],
    queryFn: async () => {
      const groupsRes = await (supabase as any).from('ps_event_training_groups').select('*').eq('event_id', eventId).order('created_at');
      if (groupsRes.error) throw groupsRes.error;
      const groups = groupsRes.data || [];
      const ids = groups.map((g: any) => g.id);
      const [roleRes, sessionRes, choiceRes, linkRes, assignmentRes, eventRes] = await Promise.all([
        ids.length ? (supabase as any).from('ps_event_training_group_roles').select('*').in('training_group_id', ids) : Promise.resolve({ data: [], error: null }),
        (supabase as any).from('ps_event_training_sessions').select('*').eq('event_id', eventId).order('starts_at'),
        (supabase as any).from('ps_event_training_choices').select('*').eq('event_id', eventId),
        (supabase as any).from('ps_event_collaborators').select('id,collaborator_name,role_name,assigned_role').eq('event_id', eventId),
        (supabase as any).from('ps_event_collaborator_assignments').select('event_collaborator_id,role_value,role_name,is_primary').eq('event_id', eventId),
        (supabase as any).from('ps_events').select('id,name,date,location').eq('id', eventId).maybeSingle(),
      ]);
      const error = roleRes.error || sessionRes.error || choiceRes.error || linkRes.error || assignmentRes.error || eventRes.error;
      if (error) throw error;
      return {
        groups,
        groupRoles: roleRes.data || [],
        sessions: sessionRes.data || [],
        choices: choiceRes.data || [],
        links: linkRes.data || [],
        assignments: assignmentRes.data || [],
        event: eventRes.data || null,
      };
    },
  });

  const data = query.data || { groups: [], groupRoles: [], sessions: [], choices: [], links: [], assignments: [], event: null };
  const roleMap = useMemo(
    () => new Map<string, string>(roles.map((r: any) => [String(r.value), String(r.name)] as [string, string])),
    [roles]
  );
  const linkMap = useMemo(
    () => new Map<string, string>(data.links.map((l: any) => [String(l.id), String(l.collaborator_name || '')] as [string, string])),
    [data.links]
  );
  const linkById = useMemo(
    () => new Map<string, any>(data.links.map((l: any) => [String(l.id), l] as [string, any])),
    [data.links]
  );
  const assignmentsByLink = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const assignment of data.assignments) {
      const id = String((assignment as any).event_collaborator_id || '');
      if (!id) continue;
      const current = map.get(id) || [];
      current.push(assignment);
      map.set(id, current);
    }
    return map;
  }, [data.assignments]);
  const refresh = () => qc.invalidateQueries({ queryKey: ['ps_event_trainings', eventId] });

  const toggleRole = (value: string) => setGroupForm(f => ({ ...f, roleValues: f.roleValues.includes(value) ? f.roleValues.filter(v => v !== value) : [...f.roleValues, value] }));

  const saveGroup = async () => {
    if (!groupForm.name.trim() || !groupForm.roleValues.length) return toast.error('Informe o nome e pelo menos um cargo participante.');
    setSaving(true);
    try {
      const created = await (supabase as any).from('ps_event_training_groups').insert({ event_id: eventId, name: groupForm.name.trim(), description: groupForm.description.trim() || null, required: groupForm.required, active: true }).select('id').single();
      if (created.error) throw created.error;
      const linked = await (supabase as any).from('ps_event_training_group_roles').insert(groupForm.roleValues.map(role_value => ({ training_group_id: created.data.id, role_value })));
      if (linked.error) throw linked.error;
      setGroupOpen(false); setGroupForm(emptyGroup); await refresh(); toast.success('Treinamento criado.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível criar o treinamento.'); }
    finally { setSaving(false); }
  };

  const saveSession = async () => {
    if (!sessionForm.groupId || !sessionForm.startsAt || !sessionForm.campus.trim()) return toast.error('Informe data/horário e campus.');
    const capacity = sessionForm.capacity ? Number(sessionForm.capacity) : null;
    if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) return toast.error('O limite de vagas deve ser um inteiro maior que zero.');
    setSaving(true);
    try {
      const res = await (supabase as any).from('ps_event_training_sessions').insert({ event_id: eventId, training_group_id: sessionForm.groupId, starts_at: new Date(sessionForm.startsAt).toISOString(), ends_at: sessionForm.endsAt ? new Date(sessionForm.endsAt).toISOString() : null, campus: sessionForm.campus.trim(), location: sessionForm.location.trim() || null, room: sessionForm.room.trim() || null, capacity, notes: sessionForm.notes.trim() || null, active: true });
      if (res.error) throw res.error;
      setSessionOpen(false); setSessionForm(emptySession); await refresh(); toast.success('Data adicionada.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível adicionar a data.'); }
    finally { setSaving(false); }
  };

  const toggleGroup = async (group: any, active: boolean) => {
    const res = await (supabase as any).from('ps_event_training_groups').update({ active }).eq('id', group.id).eq('event_id', eventId);
    if (res.error) return toast.error(res.error.message);
    await refresh();
    toast.success(active ? 'Treinamento ativado.' : 'Treinamento pausado.');
  };

  const toggleSession = async (session: any, active: boolean) => {
    const res = await (supabase as any).from('ps_event_training_sessions').update({ active }).eq('id', session.id).eq('event_id', eventId);
    if (res.error) return toast.error(res.error.message);
    await refresh();
    toast.success(active ? 'Data reativada.' : 'Data pausada.');
  };

  const removeGroup = async (group: any) => {
    if (data.choices.some((c: any) => c.training_group_id === group.id)) return toast.error('Este treinamento já possui escolhas registradas. Pause-o em vez de excluir.');
    if (!confirm(`Excluir “${group.name}” e suas datas?`)) return;
    const res = await (supabase as any).from('ps_event_training_groups').delete().eq('id', group.id).eq('event_id', eventId);
    if (res.error) return toast.error(res.error.message);
    await refresh();
  };

  const removeSession = async (session: any) => {
    if (data.choices.some((c: any) => c.training_session_id === session.id)) return toast.error('Essa data já possui escolhas. Pause-a e realoque os colaboradores antes de excluir.');
    if (!confirm('Excluir esta data?')) return;
    const res = await (supabase as any).from('ps_event_training_sessions').delete().eq('id', session.id).eq('event_id', eventId);
    if (res.error) return toast.error(res.error.message);
    await refresh();
  };

  const exportSessionAttendance = (group: any, session: any, choices: any[]) => {
    if (!choices.length) return toast.error('Nenhuma pessoa escolheu esta data de treinamento.');

    const groupRoleValues = new Set(
      data.groupRoles
        .filter((item: any) => item.training_group_id === group.id)
        .map((item: any) => String(item.role_value))
    );

    const rows = choices.map((choice: any) => {
      const linkId = String(choice.event_collaborator_id);
      const link = linkById.get(linkId);
      const assignments = (assignmentsByLink.get(linkId) || []).filter((assignment: any) =>
        !groupRoleValues.size || groupRoleValues.has(String(assignment.role_value))
      );
      const assignmentRoles = assignments.map((assignment: any) =>
        String(assignment.role_name || roleMap.get(String(assignment.role_value)) || assignment.role_value || '').trim()
      ).filter(Boolean);
      const fallbackRole = String(link?.role_name || link?.assigned_role || '').trim();
      const roleNames = [...new Set(assignmentRoles.length ? assignmentRoles : fallbackRole ? [fallbackRole] : [])];

      return {
        collaborator_name: String(link?.collaborator_name || linkMap.get(linkId) || 'Colaborador'),
        roles: roleNames,
      };
    });

    const eventInfo = {
      name: String((data.event as any)?.name || 'Processo Seletivo'),
      date: (data.event as any)?.date || null,
      location: (data.event as any)?.location || null,
    };
    const pdf = generatePsTrainingAttendancePdf(eventInfo, { name: String(group.name || 'Treinamento') }, session, rows);
    const slug = String(group.name || 'treinamento')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const dateSlug = session.starts_at ? new Date(session.starts_at).toISOString().slice(0, 10) : 'data';
    pdf.save(`lista-presenca-${slug || 'treinamento'}-${dateSlug}.pdf`);
  };

  if (query.isLoading) return <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando treinamentos...</div>;
  if (query.isError) return <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">Não foi possível carregar os treinamentos.</div>;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold">Treinamentos do evento</h2>
        <p className="mt-1 text-xs text-muted-foreground">Defina cargos, datas, campi e vagas para escolha no link de confirmação.</p>
      </div>
      <Button onClick={() => { setGroupForm(emptyGroup); setGroupOpen(true); }}><Plus className="mr-2 h-4 w-4" />Novo treinamento</Button>
    </div>

    {!data.groups.length ? (
      <Card className="rounded-2xl border-dashed">
        <CardContent className="p-8 text-center">
          <CalendarClock className="mx-auto h-8 w-8 text-muted-foreground/45" />
          <p className="mt-3 text-sm font-medium">Nenhum treinamento configurado</p>
          <p className="mt-1 text-xs text-muted-foreground">Crie um treinamento e vincule os cargos que precisam realizá-lo.</p>
        </CardContent>
      </Card>
    ) : (
      <div className="space-y-4">
        {data.groups.map((group: any) => {
          const groupRoles = data.groupRoles.filter((r: any) => r.training_group_id === group.id);
          const sessions = data.sessions.filter((s: any) => s.training_group_id === group.id);
          const groupChoices = data.choices.filter((c: any) => c.training_group_id === group.id);
          return (
            <Card key={group.id} className="rounded-2xl">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{group.name}</CardTitle>
                      <Badge variant={group.required ? 'default' : 'secondary'}>{group.required ? 'Obrigatório' : 'Opcional'}</Badge>
                      {!group.active && <Badge variant="outline">Pausado</Badge>}
                    </div>
                    {group.description && <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {groupRoles.map((r: any) => <Badge key={r.role_value} variant="outline">{roleMap.get(String(r.role_value)) || String(r.role_value)}</Badge>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!group.active} onCheckedChange={active => void toggleGroup(group, active)} />
                    <Button size="sm" variant="outline" onClick={() => { setSessionForm({ ...emptySession, groupId: group.id }); setSessionOpen(true); }}><Plus className="mr-1.5 h-3.5 w-3.5" />Adicionar data</Button>
                    <Button size="icon" variant="ghost" onClick={() => void removeGroup(group)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!sessions.length ? (
                  <div className="rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground">Nenhuma data disponível. Um treinamento obrigatório precisa ter pelo menos uma opção ativa.</div>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {sessions.map((session: any) => {
                      const choices = groupChoices.filter((c: any) => c.training_session_id === session.id);
                      const full = !!session.capacity && choices.length >= session.capacity;
                      return (
                        <div key={session.id} className="rounded-xl border border-border/60 bg-muted/10 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">{fmt(session.starts_at)}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{[session.campus, session.location, session.room && `Sala ${session.room}`].filter(Boolean).join(' · ')}</p>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!choices.length}
                                onClick={() => exportSessionAttendance(group, session, choices)}
                              >
                                <FileDown className="mr-1.5 h-3.5 w-3.5" />Lista PDF
                              </Button>
                              <Switch checked={!!session.active} onCheckedChange={active => void toggleSession(session, active)} />
                              <Button size="icon" variant="ghost" onClick={() => void removeSession(session)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge variant={full ? 'secondary' : 'outline'}><Users className="mr-1 h-3 w-3" />{choices.length}{session.capacity ? `/${session.capacity}` : ''}</Badge>
                            {!session.active && <Badge variant="outline">Pausada</Badge>}
                            {full && <Badge variant="secondary">Lotado</Badge>}
                          </div>
                          {choices.length > 0 && (
                            <div className="mt-3 border-t pt-3">
                              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Escolhas registradas</p>
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {choices.slice(0, 8).map((c: any) => <span key={c.id} className="rounded-md bg-muted px-2 py-1 text-[11px]">{linkMap.get(String(c.event_collaborator_id)) || 'Colaborador'}</span>)}
                                {choices.length > 8 && <span className="px-1 py-1 text-[11px] text-muted-foreground">+{choices.length - 8}</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    )}

    <Dialog open={groupOpen} onOpenChange={open => !saving && setGroupOpen(open)}>
      <DialogContent className="sm:max-w-2xl" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader><DialogTitle>Novo treinamento</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Nome *</Label><Input value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} /></div>
          <div><Label>Descrição</Label><Textarea rows={3} value={groupForm.description} onChange={e => setGroupForm({ ...groupForm, description: e.target.value })} /></div>
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div><p className="text-sm font-medium">Obrigatório para confirmar participação</p><p className="text-xs text-muted-foreground">Se ativo, a pessoa precisa escolher uma data antes de confirmar.</p></div>
            <Switch checked={groupForm.required} onCheckedChange={required => setGroupForm({ ...groupForm, required })} />
          </div>
          <div>
            <Label>Cargos participantes *</Label>
            <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto rounded-xl border p-2 sm:grid-cols-2">
              {roles.filter((r: any) => r.active !== false).map((r: any) => <Button key={r.id} type="button" variant={groupForm.roleValues.includes(r.value) ? 'default' : 'outline'} className="justify-start" onClick={() => toggleRole(r.value)}>{r.name}</Button>)}
            </div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setGroupOpen(false)}>Cancelar</Button><Button disabled={saving} onClick={() => void saveGroup()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={sessionOpen} onOpenChange={open => !saving && setSessionOpen(open)}>
      <DialogContent className="sm:max-w-xl" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader><DialogTitle>Adicionar data de treinamento</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Início *</Label><Input type="datetime-local" value={sessionForm.startsAt} onChange={e => setSessionForm({ ...sessionForm, startsAt: e.target.value })} /></div>
          <div><Label>Término</Label><Input type="datetime-local" value={sessionForm.endsAt} onChange={e => setSessionForm({ ...sessionForm, endsAt: e.target.value })} /></div>
          <div><Label>Campus *</Label><Input value={sessionForm.campus} onChange={e => setSessionForm({ ...sessionForm, campus: e.target.value })} /></div>
          <div><Label>Local</Label><Input value={sessionForm.location} onChange={e => setSessionForm({ ...sessionForm, location: e.target.value })} /></div>
          <div><Label>Sala</Label><Input value={sessionForm.room} onChange={e => setSessionForm({ ...sessionForm, room: e.target.value })} /></div>
          <div><Label>Limite de vagas</Label><Input type="number" min="1" step="1" value={sessionForm.capacity} onChange={e => setSessionForm({ ...sessionForm, capacity: e.target.value })} placeholder="Sem limite" /></div>
          <div className="sm:col-span-2"><Label>Observações</Label><Textarea rows={2} value={sessionForm.notes} onChange={e => setSessionForm({ ...sessionForm, notes: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setSessionOpen(false)}>Cancelar</Button><Button disabled={saving} onClick={() => void saveSession()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Adicionar data</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
