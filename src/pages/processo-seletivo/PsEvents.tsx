import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, GraduationCap, MapPin, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';

import { ContentState } from '@/components/layout/ContentState';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageToolbar } from '@/components/layout/PageToolbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePsEventMutations, usePsEvents } from '@/hooks/useProcessoSeletivo';
import { PS_EVENT_STATUS } from '@/lib/psConstants';
import { supabase } from '@/integrations/supabase/client';

const emptyForm = {
  name: '',
  date: '',
  location: '',
  description: '',
  status: 'planejamento',
  coordinator_name: '',
  notes: '',
};

export default function PsEvents() {
  const { data: events = [], isLoading } = usePsEvents();
  const { save, remove } = usePsEventMutations();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);

  const eventIds = useMemo(
    () => events.map((event: any) => String(event.id)).filter(Boolean).sort(),
    [events]
  );

  const operationalQuery = useQuery({
    queryKey: ['ps-events-operational-summary', eventIds.join(',')],
    enabled: eventIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const [linksRes, groupsRes, sessionsRes, choicesRes, assignmentsRes] = await Promise.all([
        (supabase as any)
          .from('ps_event_collaborators')
          .select('id,event_id,role_value,participation_status,absent,present,signed_at,manually_excluded')
          .in('event_id', eventIds),
        (supabase as any)
          .from('ps_event_training_groups')
          .select('id,event_id,required,active')
          .in('event_id', eventIds),
        (supabase as any)
          .from('ps_event_training_sessions')
          .select('id,event_id,training_group_id,active,cancelled_at')
          .in('event_id', eventIds),
        (supabase as any)
          .from('ps_event_training_choices')
          .select('event_id,event_collaborator_id,training_group_id,training_session_id')
          .in('event_id', eventIds),
        (supabase as any)
          .from('ps_event_collaborator_assignments')
          .select('event_id,event_collaborator_id,role_value,is_primary')
          .in('event_id', eventIds),
      ]);

      const firstError =
        linksRes.error ||
        groupsRes.error ||
        sessionsRes.error ||
        choicesRes.error ||
        assignmentsRes.error;

      if (firstError) throw firstError;

      const groups = groupsRes.data || [];
      const groupIds = groups.map((group: any) => group.id);

      const groupRolesRes = groupIds.length
        ? await (supabase as any)
            .from('ps_event_training_group_roles')
            .select('training_group_id,role_value')
            .in('training_group_id', groupIds)
        : { data: [], error: null };

      if (groupRolesRes.error) throw groupRolesRes.error;

      return {
        links: linksRes.data || [],
        groups,
        sessions: sessionsRes.data || [],
        choices: choicesRes.data || [],
        assignments: assignmentsRes.data || [],
        groupRoles: groupRolesRes.data || [],
      };
    },
  });

  const operationalData = operationalQuery.data || {
    links: [],
    groups: [],
    sessions: [],
    choices: [],
    assignments: [],
    groupRoles: [],
  };

  const eventSummary = useMemo(() => {
    const summary = new Map<string, any>();
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    for (const event of events as any[]) {
      const eventId = String(event.id);
      const allLinks = operationalData.links.filter((link: any) => String(link.event_id) === eventId);
      const links = allLinks.filter((link: any) => !link.manually_excluded && String(link.participation_status || '') !== 'replaced');

      const confirmed = links.filter((link: any) => String(link.participation_status || '') === 'confirmed').length;
      const pending = links.filter((link: any) => !link.participation_status || String(link.participation_status) === 'pending_confirmation').length;
      const declined = links.filter((link: any) => String(link.participation_status || '') === 'declined').length;

      const attendanceLinks = links.filter((link: any) =>
        !['declined', 'replaced'].includes(String(link.participation_status || ''))
      );
      const attendanceResolved = attendanceLinks.filter((link: any) =>
        !!link.absent || !!link.present || !!link.signed_at
      ).length;
      const attendancePending = Math.max(0, attendanceLinks.length - attendanceResolved);

      const groups = operationalData.groups.filter((group: any) =>
        String(group.event_id) === eventId &&
        group.active !== false &&
        group.required !== false
      );
      const groupIds = new Set(groups.map((group: any) => String(group.id)));

      const rolesByGroup = new Map<string, Set<string>>();
      for (const row of operationalData.groupRoles) {
        const groupId = String(row.training_group_id || '');
        if (!groupIds.has(groupId)) continue;
        const roles = rolesByGroup.get(groupId) || new Set<string>();
        if (row.role_value) roles.add(String(row.role_value));
        rolesByGroup.set(groupId, roles);
      }

      const primaryRoleByLink = new Map<string, string>();
      for (const assignment of operationalData.assignments) {
        if (String(assignment.event_id) !== eventId || assignment.is_primary !== true) continue;
        const linkId = String(assignment.event_collaborator_id || '');
        const roleValue = String(assignment.role_value || '');
        if (linkId && roleValue && !primaryRoleByLink.has(linkId)) {
          primaryRoleByLink.set(linkId, roleValue);
        }
      }

      const activeSessionIds = new Set(
        operationalData.sessions
          .filter((session: any) =>
            String(session.event_id) === eventId &&
            session.active !== false &&
            !session.cancelled_at
          )
          .map((session: any) => String(session.id))
      );

      const validChoiceKeys = new Set(
        operationalData.choices
          .filter((choice: any) =>
            String(choice.event_id) === eventId &&
            activeSessionIds.has(String(choice.training_session_id))
          )
          .map((choice: any) => `${choice.event_collaborator_id}|${choice.training_group_id}`)
      );

      let trainingRequired = 0;
      let trainingCompleted = 0;

      for (const link of attendanceLinks) {
        const roleValue =
          primaryRoleByLink.get(String(link.id)) ||
          String(link.role_value || '');

        if (!roleValue) continue;

        const requiredGroups = groups.filter((group: any) =>
          rolesByGroup.get(String(group.id))?.has(roleValue)
        );

        if (!requiredGroups.length) continue;

        trainingRequired += 1;
        const complete = requiredGroups.every((group: any) =>
          validChoiceKeys.has(`${link.id}|${group.id}`)
        );
        if (complete) trainingCompleted += 1;
      }

      const trainingPending = Math.max(0, trainingRequired - trainingCompleted);
      const eventDate = event.date ? new Date(`${event.date}T00:00:00`) : null;
      const attendanceRelevant = !!eventDate && eventDate.getTime() <= todayStart.getTime();

      const attentionItems = event.status === 'finalizado'
        ? []
        : [
            declined > 0 ? { key: 'declined', label: `${declined} vaga(s) aberta(s)`, critical: true } : null,
            pending > 0 ? { key: 'pending', label: `${pending} aguardando confirmação`, critical: false } : null,
            trainingPending > 0 ? { key: 'training', label: `${trainingPending} treinamento(s) pendente(s)`, critical: false } : null,
            attendanceRelevant && attendancePending > 0
              ? { key: 'attendance', label: `${attendancePending} presença(s) pendente(s)`, critical: true }
              : null,
          ].filter(Boolean);

      summary.set(eventId, {
        team: attendanceLinks.length,
        confirmed,
        pending,
        declined,
        trainingRequired,
        trainingCompleted,
        trainingPending,
        attendanceResolved,
        attendanceTotal: attendanceLinks.length,
        attendancePending,
        attendanceRelevant,
        attentionItems,
        hasAttention: attentionItems.length > 0,
        hasCritical: attentionItems.some((item: any) => item.critical),
      });
    }

    return summary;
  }, [events, operationalData]);

  const filtered = events.filter((event: any) => {
    const matchesSearch = [event.name, event.location, event.coordinator_name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'open' && event.status !== 'finalizado') ||
      event.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const pageSummary = useMemo(() => ({
    planning: events.filter((event: any) => event.status === 'planejamento').length,
    active: events.filter((event: any) => event.status === 'em_andamento').length,
    finished: events.filter((event: any) => event.status === 'finalizado').length,
    attention: events.filter((event: any) =>
      event.status !== 'finalizado' &&
      eventSummary.get(String(event.id))?.hasAttention
    ).length,
  }), [events, eventSummary]);

  const openCreate = () => {
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (event: any) => {
    setForm({
      id: event.id,
      name: event.name || '',
      date: event.date || '',
      location: event.location || '',
      description: event.description || '',
      status: event.status || 'planejamento',
      coordinator_name: event.coordinator_name || '',
      notes: event.notes || '',
      self_evaluation_enabled: !!event.self_evaluation_enabled,
      hidden_from_evaluation: !!event.hidden_from_evaluation,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name || !form.date) return;
    await save.mutateAsync(form);
    setOpen(false);
    setForm(emptyForm);
  };

  return (
    <MainLayout>
      <div className="ps-module-modern">
      <PageHeader
        title="Eventos"
        description="Cadastre e acompanhe os processos seletivos, datas, locais e responsáveis."
        actions={
          <Button size="sm" className="ps-gradient-button" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo evento
          </Button>
        }
      />

      {!isLoading && events.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-2xl border-primary/20 bg-primary/[0.035]">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Em andamento</p>
              <p className="mt-1 text-2xl font-bold">{pageSummary.active}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">evento(s) em operação</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Planejamento</p>
              <p className="mt-1 text-2xl font-bold">{pageSummary.planning}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">evento(s) em preparação</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Finalizados</p>
              <p className="mt-1 text-2xl font-bold">{pageSummary.finished}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">histórico concluído</p>
            </CardContent>
          </Card>
          <Card className={`rounded-2xl ${pageSummary.attention ? 'border-amber-500/25 bg-amber-500/[0.035]' : 'border-emerald-500/20 bg-emerald-500/[0.025]'}`}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Precisam de atenção</p>
              <p className={`mt-1 text-2xl font-bold ${pageSummary.attention ? 'text-amber-500' : 'text-emerald-500'}`}>
                {pageSummary.attention}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {pageSummary.attention ? 'com pendências operacionais' : 'nenhuma pendência identificada'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <PageToolbar>
        <div className="grid w-full gap-2 lg:grid-cols-[minmax(320px,1fr)_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 rounded-xl pl-9"
              placeholder="Buscar por evento, local ou coordenador..."
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Em aberto — padrão</SelectItem>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(PS_EVENT_STATUS).map(([key, value]) => (
                <SelectItem key={key} value={key}>{value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PageToolbar>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
        <span>{isLoading ? 'Carregando eventos...' : `${filtered.length} ${filtered.length === 1 ? 'evento encontrado' : 'eventos encontrados'}`}</span>
        {operationalQuery.isFetching && <span>Atualizando indicadores operacionais...</span>}
      </div>

      {isLoading ? (
        <ContentState loading title="Carregando eventos" description="Buscando os processos seletivos cadastrados." />
      ) : filtered.length === 0 ? (
        <ContentState
          icon={CalendarDays}
          title="Nenhum evento encontrado"
          description={search ? 'Tente ajustar a busca para encontrar outros eventos.' : 'Crie o primeiro evento para começar a organizar o processo seletivo.'}
          action={!search ? <Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo evento</Button> : undefined}
        />
      ) : (
        <div className="ps-events-grid">
          {filtered.map((event: any) => {
            const summary = eventSummary.get(String(event.id)) || {
              team: 0,
              confirmed: 0,
              pending: 0,
              declined: 0,
              trainingRequired: 0,
              trainingCompleted: 0,
              trainingPending: 0,
              attendanceResolved: 0,
              attendanceTotal: 0,
              attendancePending: 0,
              attendanceRelevant: false,
              attentionItems: [],
              hasAttention: false,
              hasCritical: false,
            };

            return (
            <Card key={event.id} className={`ps-gradient-surface group bg-card/65 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-card/85 hover:shadow-md ${summary.hasCritical ? 'border-destructive/25' : summary.hasAttention ? 'border-amber-500/20' : 'border-border/60 hover:border-primary/30'}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold">{event.name}</h2>
                      {summary.hasAttention && (
                        <Badge
                          variant="outline"
                          className={`rounded-full text-[9px] ${summary.hasCritical ? 'border-destructive/25 text-destructive' : 'border-amber-500/25 text-amber-500'}`}
                        >
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          Atenção
                        </Badge>
                      )}
                    </div>
                    {event.coordinator_name && <p className="mt-1 truncate text-xs text-muted-foreground">Coord. {event.coordinator_name}</p>}
                  </div>
                  <Badge variant={event.status === 'em_andamento' ? 'default' : 'secondary'} className="shrink-0">
                    {PS_EVENT_STATUS[event.status] || event.status}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border/50 bg-background/35 p-2.5">
                    <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                      <Users className="h-3 w-3" />Equipe
                    </div>
                    <p className="mt-1 text-lg font-bold">{summary.team}</p>
                    <p className="text-[9px] text-muted-foreground">{summary.confirmed} confirmado(s)</p>
                  </div>

                  <div className={`rounded-xl border p-2.5 ${summary.pending ? 'border-amber-500/15 bg-amber-500/[0.025]' : 'border-border/50 bg-background/35'}`}>
                    <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3" />Confirmação
                    </div>
                    <p className={`mt-1 text-lg font-bold ${summary.pending ? 'text-amber-500' : ''}`}>{summary.pending}</p>
                    <p className="text-[9px] text-muted-foreground">aguardando</p>
                  </div>

                  <div className={`rounded-xl border p-2.5 ${summary.trainingPending ? 'border-amber-500/15 bg-amber-500/[0.025]' : 'border-border/50 bg-background/35'}`}>
                    <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                      <GraduationCap className="h-3 w-3" />Treinamento
                    </div>
                    <p className="mt-1 text-sm font-bold">
                      {summary.trainingRequired ? `${summary.trainingCompleted}/${summary.trainingRequired}` : '—'}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {summary.trainingRequired ? 'obrigatórios definidos' : 'não exigido'}
                    </p>
                  </div>

                  <div className={`rounded-xl border p-2.5 ${summary.attendanceRelevant && summary.attendancePending ? 'border-amber-500/15 bg-amber-500/[0.025]' : 'border-border/50 bg-background/35'}`}>
                    <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3" />Presença
                    </div>
                    <p className="mt-1 text-sm font-bold">
                      {summary.attendanceRelevant
                        ? `${summary.attendanceResolved}/${summary.attendanceTotal}`
                        : 'Aguardando'}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {summary.attendanceRelevant ? 'presenças resolvidas' : 'dia do evento'}
                    </p>
                  </div>
                </div>

                {summary.attentionItems.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {summary.attentionItems.slice(0, 4).map((item: any) => (
                      <Badge
                        key={item.key}
                        variant="outline"
                        className={`text-[9px] ${item.critical ? 'border-destructive/20 text-destructive' : 'border-amber-500/20 text-amber-500'}`}
                      >
                        {item.label}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="mt-4 space-y-2 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    {new Date(`${event.date}T00:00:00`).toLocaleDateString('pt-BR')}
                  </p>
                  {event.location && (
                    <p className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </p>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <Button asChild size="sm" className="flex-1">
                    <Link to={`/admin-module/processo-seletivo/eventos/${event.id}`}>
                      Abrir evento
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9"
                    onClick={() => openEdit(event)}
                    aria-label={`Editar ${event.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      if (confirm('Excluir evento?')) remove.mutate(event.id);
                    }}
                    aria-label={`Excluir ${event.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg" onInteractOutside={event => event.preventDefault()}>
          <DialogHeader><DialogTitle>{form.id ? 'Editar evento' : 'Novo evento'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome *</Label>
              <Input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data *</Label>
                <Input type="date" value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={form.status} onValueChange={value => setForm({ ...form, status: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PS_EVENT_STATUS).map(([key, value]) => <SelectItem key={key} value={key}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Local</Label>
                <Input value={form.location} onChange={event => setForm({ ...form, location: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Coordenador</Label>
                <Input value={form.coordinator_name} onChange={event => setForm({ ...form, coordinator_name: event.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              <Textarea rows={3} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => void submit()} disabled={save.isPending || !form.name || !form.date}>
              {save.isPending ? 'Salvando...' : form.id ? 'Salvar alterações' : 'Salvar evento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </MainLayout>
  );
}
