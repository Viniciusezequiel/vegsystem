import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, FileDown, Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react';
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
const toDateTimeLocal = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

export function PsEventTrainingTab({ eventId, roles }: Props) {
  const qc = useQueryClient();
  const [groupOpen, setGroupOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [groupForm, setGroupForm] = useState<GroupForm>(emptyGroup);
  const [sessionForm, setSessionForm] = useState<SessionForm>(emptySession);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [selectedCollaborator, setSelectedCollaborator] = useState<any>(null);
  const [collaboratorDialogOpen, setCollaboratorDialogOpen] = useState(false);
  const [selectedNewSession, setSelectedNewSession] = useState("");

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

  const openCollaboratorManager = (choice: any) => {
    const collaborator = linkById.get(String(choice.event_collaborator_id));

    setSelectedCollaborator({
      choice,
      collaborator,
    });

    setSelectedNewSession(String(choice.training_session_id));
    setCollaboratorDialogOpen(true);
  };

  const moveCollaboratorTraining = async () => {
    if (!selectedCollaborator || !selectedNewSession) return;

    const { error } = await (supabase as any)
      .from('ps_event_training_choices')
      .update({
        training_session_id: selectedNewSession,
      })
      .eq('id', selectedCollaborator.choice.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Treinamento alterado com sucesso.');
    setCollaboratorDialogOpen(false);
    setSelectedCollaborator(null);
    await refresh();
  };

  const toggleRole = (value: string) => setGroupForm(f => ({ ...f, roleValues: f.roleValues.includes(value) ? f.roleValues.filter(v => v !== value) : [...f.roleValues, value] }));

  const closeGroupDialog = () => {
    if (saving) return;
    setGroupOpen(false);
    setEditingGroupId(null);
    setGroupForm(emptyGroup);
  };

  const openNewGroup = () => {
    setEditingGroupId(null);
    setGroupForm(emptyGroup);
    setGroupOpen(true);
  };

  const openEditGroup = (group: any, groupRoles: any[]) => {
    setEditingGroupId(String(group.id));
    setGroupForm({
      name: String(group.name || ''),
      description: String(group.description || ''),
      required: group.required !== false,
      roleValues: groupRoles.map((item: any) => String(item.role_value)),
    });
    setGroupOpen(true);
  };

  const saveGroup = async () => {
    const name = groupForm.name.trim();
    const roleValues = [...new Set(groupForm.roleValues.map(String))];
    if (name.length < 2 || !roleValues.length) return toast.error('Informe o nome e pelo menos um cargo participante.');

    setSaving(true);
    try {
      if (editingGroupId) {
        const updated = await (supabase as any)
          .from('ps_event_training_groups')
          .update({ name, description: groupForm.description.trim() || null, required: groupForm.required })
          .eq('id', editingGroupId)
          .eq('event_id', eventId);
        if (updated.error) throw updated.error;

        const currentRoleValues = data.groupRoles
          .filter((item: any) => String(item.training_group_id) === editingGroupId)
          .map((item: any) => String(item.role_value));
        const toAdd = roleValues.filter(value => !currentRoleValues.includes(value));
        const toRemove = currentRoleValues.filter(value => !roleValues.includes(value));

        if (toAdd.length) {
          const added = await (supabase as any)
            .from('ps_event_training_group_roles')
            .insert(toAdd.map(role_value => ({ training_group_id: editingGroupId, role_value })));
          if (added.error) throw added.error;
        }
        if (toRemove.length) {
          const removed = await (supabase as any)
            .from('ps_event_training_group_roles')
            .delete()
            .eq('training_group_id', editingGroupId)
            .in('role_value', toRemove);
          if (removed.error) throw removed.error;
        }

        toast.success('Treinamento atualizado.');
      } else {
        const created = await (supabase as any)
          .from('ps_event_training_groups')
          .insert({ event_id: eventId, name, description: groupForm.description.trim() || null, required: groupForm.required, active: true })
          .select('id')
          .single();
        if (created.error) throw created.error;
        const linked = await (supabase as any)
          .from('ps_event_training_group_roles')
          .insert(roleValues.map(role_value => ({ training_group_id: created.data.id, role_value })));
        if (linked.error) throw linked.error;
        toast.success('Treinamento criado.');
      }

      setGroupOpen(false);
      setEditingGroupId(null);
      setGroupForm(emptyGroup);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : editingGroupId ? 'Não foi possível atualizar o treinamento.' : 'Não foi possível criar o treinamento.');
    } finally {
      setSaving(false);
    }
  };

  const closeSessionDialog = () => {
    if (saving) return;
    setSessionOpen(false);
    setEditingSessionId(null);
    setSessionForm(emptySession);
  };

  const openNewSession = (groupId: string) => {
    setEditingSessionId(null);
    setSessionForm({ ...emptySession, groupId });
    setSessionOpen(true);
  };

  const openEditSession = (session: any) => {
    setEditingSessionId(String(session.id));
    setSessionForm({
      groupId: String(session.training_group_id),
      startsAt: toDateTimeLocal(session.starts_at),
      endsAt: toDateTimeLocal(session.ends_at),
      campus: String(session.campus || ''),
      location: String(session.location || ''),
      room: String(session.room || ''),
      capacity: session.capacity ? String(session.capacity) : '',
      notes: String(session.notes || ''),
    });
    setSessionOpen(true);
  };

  const saveSession = async () => {
    if (!sessionForm.groupId || !sessionForm.startsAt || !sessionForm.campus.trim()) return toast.error('Informe data/horário e campus.');
    const startsAt = new Date(sessionForm.startsAt);
    const endsAt = sessionForm.endsAt ? new Date(sessionForm.endsAt) : null;
    if (endsAt && endsAt <= startsAt) return toast.error('O término deve ser posterior ao início.');

    const capacity = sessionForm.capacity ? Number(sessionForm.capacity) : null;
    if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) return toast.error('O limite de vagas deve ser um inteiro maior que zero.');

    if (editingSessionId && capacity !== null) {
      const selectedCount = data.choices.filter((choice: any) => String(choice.training_session_id) === editingSessionId).length;
      if (capacity < selectedCount) return toast.error(`Esta data já possui ${selectedCount} inscrito(s). O limite não pode ser menor que esse total.`);
    }

    setSaving(true);
    try {
      const payload = {
        training_group_id: sessionForm.groupId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt ? endsAt.toISOString() : null,
        campus: sessionForm.campus.trim(),
        location: sessionForm.location.trim() || null,
        room: sessionForm.room.trim() || null,
        capacity,
        notes: sessionForm.notes.trim() || null,
      };

      if (editingSessionId) {
        const res = await (supabase as any)
          .from('ps_event_training_sessions')
          .update(payload)
          .eq('id', editingSessionId)
          .eq('event_id', eventId);
        if (res.error) throw res.error;
        toast.success('Data de treinamento atualizada.');
      } else {
        const res = await (supabase as any)
          .from('ps_event_training_sessions')
          .insert({ event_id: eventId, ...payload, active: true });
        if (res.error) throw res.error;
        toast.success('Data adicionada.');
      }

      setSessionOpen(false);
      setEditingSessionId(null);
      setSessionForm(emptySession);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : editingSessionId ? 'Não foi possível atualizar a data.' : 'Não foi possível adicionar a data.');
    } finally {
      setSaving(false);
    }
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
      <Button onClick={openNewGroup}><Plus className="mr-2 h-4 w-4" />Novo treinamento</Button>
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
                    <Button size="sm" variant="outline" onClick={() => openEditGroup(group, groupRoles)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />Editar treinamento
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openNewSession(String(group.id))}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />Adicionar data
                    </Button>
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
                              {session.ends_at && <p className="mt-1 text-[11px] text-muted-foreground">Término: {fmt(session.ends_at)}</p>}
                              {session.notes && <p className="mt-1 text-[11px] text-muted-foreground">{session.notes}</p>}
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
                              <Button size="icon" variant="ghost" title="Editar data" onClick={() => openEditSession(session)}>
                                <Pencil className="h-3.5 w-3.5" />
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
                                {choices.slice(0, 8).map((c: any) => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => openCollaboratorManager(c)}
                                    className="rounded-md bg-muted px-2 py-1 text-[11px] hover:bg-primary/20"
                                  >
                                    {linkMap.get(String(c.event_collaborator_id)) || 'Colaborador'}
                                  </button>
                                ))}
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

    <Dialog open={groupOpen} onOpenChange={open => { if (!open) closeGroupDialog(); else if (!saving) setGroupOpen(true); }}>
      <DialogContent className="sm:max-w-2xl" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader><DialogTitle>{editingGroupId ? 'Editar treinamento' : 'Novo treinamento'}</DialogTitle></DialogHeader>
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
              {roles.filter((r: any) => r.active !== false).map((r: any) => <Button key={r.id} type="button" variant={groupForm.roleValues.includes(String(r.value)) ? 'default' : 'outline'} className="justify-start" onClick={() => toggleRole(String(r.value))}>{r.name}</Button>)}
            </div>
            {editingGroupId && <p className="mt-2 text-xs text-muted-foreground">Alterar os cargos muda quem visualizará este treinamento no link de confirmação. Escolhas já registradas não são apagadas.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={closeGroupDialog}>Cancelar</Button>
          <Button disabled={saving} onClick={() => void saveGroup()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingGroupId ? 'Salvar alterações' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={sessionOpen} onOpenChange={open => { if (!open) closeSessionDialog(); else if (!saving) setSessionOpen(true); }}>
      <DialogContent className="sm:max-w-xl" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader><DialogTitle>{editingSessionId ? 'Editar data de treinamento' : 'Adicionar data de treinamento'}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Início *</Label><Input type="datetime-local" value={sessionForm.startsAt} onChange={e => setSessionForm({ ...sessionForm, startsAt: e.target.value })} /></div>
          <div><Label>Término</Label><Input type="datetime-local" value={sessionForm.endsAt} onChange={e => setSessionForm({ ...sessionForm, endsAt: e.target.value })} /></div>
          <div><Label>Campus *</Label><Input value={sessionForm.campus} onChange={e => setSessionForm({ ...sessionForm, campus: e.target.value })} /></div>
          <div><Label>Local</Label><Input value={sessionForm.location} onChange={e => setSessionForm({ ...sessionForm, location: e.target.value })} /></div>
          <div><Label>Sala</Label><Input value={sessionForm.room} onChange={e => setSessionForm({ ...sessionForm, room: e.target.value })} /></div>
          <div><Label>Limite de vagas</Label><Input type="number" min="1" step="1" value={sessionForm.capacity} onChange={e => setSessionForm({ ...sessionForm, capacity: e.target.value })} placeholder="Sem limite" /></div>
          <div className="sm:col-span-2"><Label>Observações</Label><Textarea rows={2} value={sessionForm.notes} onChange={e => setSessionForm({ ...sessionForm, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={closeSessionDialog}>Cancelar</Button>
          <Button disabled={saving} onClick={() => void saveSession()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingSessionId ? 'Salvar alterações' : 'Adicionar data'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={collaboratorDialogOpen} onOpenChange={setCollaboratorDialogOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Treinamentos da pessoa</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="font-semibold">
            {selectedCollaborator?.collaborator?.collaborator_name || 'Colaborador'}
          </p>

          <div>
            <Label>Mover para outro treinamento</Label>
            <select
              className="mt-2 w-full rounded-md border p-2"
              value={selectedNewSession}
              onChange={(e) => setSelectedNewSession(e.target.value)}
            >
              {data.sessions.map((session: any) => (
                <option key={session.id} value={session.id}>
                  {fmt(session.starts_at)} - {session.campus} {session.room ? `Sala ${session.room}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setCollaboratorDialogOpen(false)}>
            Cancelar
          </Button>

          <Button onClick={() => void moveCollaboratorTraining()}>
            Confirmar transferência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
