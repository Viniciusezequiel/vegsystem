import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FileBarChart,
  MapPin,
  Plus,
  Settings,
  Users,
} from 'lucide-react';

import { StatCard } from '@/components/dashboard/StatCard';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePsCollaborators, usePsEvents } from '@/hooks/useProcessoSeletivo';
import { supabase } from '@/integrations/supabase/client';
import { PS_EVENT_STATUS } from '@/lib/psConstants';

type ActionCardProps = {
  title: string;
  description: string;
  icon: typeof CalendarDays;
  href: string;
};

function ActionCard({ title, description, icon: Icon, href }: ActionCardProps) {
  return (
    <Link to={href} className="block h-full">
      <div className="ps-gradient-surface group flex h-full items-center gap-4 rounded-2xl border border-border/60 bg-card/65 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/85 hover:shadow-md">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
    </Link>
  );
}

export default function PsHome() {
  const { data: events = [] } = usePsEvents();
  const { data: collaborators = [] } = usePsCollaborators();

  const eventIds = useMemo(
    () => events.map((event: any) => String(event.id)).filter(Boolean).sort(),
    [events]
  );

  const operationalQuery = useQuery({
    queryKey: ['ps-home-operational-summary', eventIds.join(',')],
    enabled: eventIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const [linksRes, candidatesRes] = await Promise.all([
        (supabase as any)
          .from('ps_event_collaborators')
          .select('id,event_id,participation_status,manually_excluded,absent,present,signed_at,pix,attendance_pix_snapshot')
          .in('event_id', eventIds),
        (supabase as any)
          .from('ps_candidates')
          .select('id,event_id,campus,building,room')
          .in('event_id', eventIds),
      ]);

      if (linksRes.error) throw linksRes.error;
      if (candidatesRes.error) throw candidatesRes.error;

      return {
        links: linksRes.data || [],
        candidates: candidatesRes.data || [],
      };
    },
  });

  const operationalData = operationalQuery.data || { links: [], candidates: [] };

  const eventSummary = useMemo(() => {
    const map = new Map<string, any>();

    for (const event of events as any[]) {
      const eventId = String(event.id);
      const allLinks = operationalData.links.filter((link: any) => String(link.event_id) === eventId);
      const links = allLinks.filter((link: any) =>
        !link.manually_excluded &&
        String(link.participation_status || '') !== 'replaced'
      );

      const activeLinks = links.filter((link: any) =>
        !['declined', 'replaced'].includes(String(link.participation_status || ''))
      );

      const confirmed = activeLinks.filter((link: any) => link.participation_status === 'confirmed').length;
      const pending = activeLinks.filter((link: any) =>
        !link.participation_status || link.participation_status === 'pending_confirmation'
      ).length;
      const declined = links.filter((link: any) => link.participation_status === 'declined').length;
      const missingPix = activeLinks.filter((link: any) =>
        !String(link.attendance_pix_snapshot || link.pix || '').trim()
      ).length;

      const candidates = operationalData.candidates.filter((candidate: any) =>
        String(candidate.event_id) === eventId
      );

      const missingCandidateLocation = candidates.filter((candidate: any) =>
        !String(candidate.campus || '').trim() ||
        !String(candidate.building || '').trim() ||
        !String(candidate.room || '').trim()
      ).length;

      const attention = pending + declined + missingPix + missingCandidateLocation;

      map.set(eventId, {
        team: activeLinks.length,
        confirmed,
        pending,
        declined,
        missingPix,
        candidates: candidates.length,
        missingCandidateLocation,
        attention,
      });
    }

    return map;
  }, [events, operationalData]);

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const nonFinalized = useMemo(
    () => events
      .filter((event: any) => event.status !== 'finalizado')
      .sort((a: any, b: any) => {
        if (a.status === 'em_andamento' && b.status !== 'em_andamento') return -1;
        if (b.status === 'em_andamento' && a.status !== 'em_andamento') return 1;
        return String(a.date || '').localeCompare(String(b.date || ''));
      }),
    [events]
  );

  const focusEvent: any = nonFinalized[0] || null;
  const focusSummary = focusEvent
    ? eventSummary.get(String(focusEvent.id)) || {
        team: 0,
        confirmed: 0,
        pending: 0,
        declined: 0,
        missingPix: 0,
        candidates: 0,
        missingCandidateLocation: 0,
        attention: 0,
      }
    : null;

  const focusDate = focusEvent?.date ? new Date(`${focusEvent.date}T00:00:00`) : null;
  const daysUntilFocus = focusDate
    ? Math.round((focusDate.getTime() - today.getTime()) / 86_400_000)
    : null;

  const upcomingEvents = useMemo(
    () => nonFinalized
      .filter((event: any) => {
        if (!event.date) return false;
        return new Date(`${event.date}T00:00:00`).getTime() >= today.getTime();
      })
      .slice(0, 5),
    [nonFinalized, today]
  );

  const pageSummary = useMemo(() => {
    const activeEvents = events.filter((event: any) => event.status === 'em_andamento').length;
    const planningEvents = events.filter((event: any) => event.status === 'planejamento').length;
    const eventsWithAttention = nonFinalized.filter((event: any) =>
      Number(eventSummary.get(String(event.id))?.attention || 0) > 0
    ).length;

    const totalOperationalPending = nonFinalized.reduce((total: number, event: any) => {
      const summary = eventSummary.get(String(event.id));
      return total + Number(summary?.pending || 0) + Number(summary?.declined || 0);
    }, 0);

    return {
      activeEvents,
      planningEvents,
      eventsWithAttention,
      totalOperationalPending,
    };
  }, [events, nonFinalized, eventSummary]);

  const focusActions = useMemo(() => {
    if (!focusEvent || !focusSummary) return [];

    const actions: any[] = [];

    if (focusSummary.declined > 0) {
      actions.push({
        key: 'replacements',
        title: `${focusSummary.declined} vaga(s) aberta(s) por recusa`,
        description: 'Substitua os fiscais recusados para recompor a equipe.',
        tab: 'equipe-comunicacao',
        severity: 'critical',
      });
    }

    if (focusSummary.pending > 0) {
      actions.push({
        key: 'confirmation',
        title: `${focusSummary.pending} aguardando confirmação`,
        description: 'Cobre quem ainda não respondeu antes do evento.',
        tab: 'equipe-comunicacao',
        severity: 'warning',
      });
    }

    if (focusSummary.missingCandidateLocation > 0) {
      actions.push({
        key: 'candidates',
        title: `${focusSummary.missingCandidateLocation} candidato(s) sem localização completa`,
        description: 'Revise campus, prédio e sala antes da impressão das etiquetas.',
        tab: 'candidatos',
        severity: 'warning',
      });
    }

    if (focusSummary.missingPix > 0) {
      actions.push({
        key: 'pix',
        title: `${focusSummary.missingPix} fiscal(is) sem PIX`,
        description: 'Complete os dados para evitar pendência na consolidação de pagamentos.',
        tab: 'pagamentos',
        severity: 'info',
      });
    }

    return actions;
  }, [focusEvent, focusSummary]);

  return (
    <MainLayout>
      <div className="ps-module-modern">
        <PageHeader
          title="Central do Processo Seletivo"
          description="Veja o que precisa de atenção agora e acesse rapidamente cada etapa do processo."
          actions={
            <Button asChild size="sm" className="ps-gradient-button">
              <Link to="/admin-module/processo-seletivo/eventos">
                <Plus className="mr-2 h-4 w-4" />
                Novo / gerenciar evento
              </Link>
            </Button>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            className="ps-gradient-surface"
            title="Em andamento"
            value={pageSummary.activeEvents}
            icon={<CalendarDays className="h-5 w-5" />}
          />
          <StatCard
            className="ps-gradient-surface"
            title="Planejamento"
            value={pageSummary.planningEvents}
            icon={<CalendarClock className="h-5 w-5" />}
          />
          <StatCard
            className="ps-gradient-surface"
            title="Banco de fiscais"
            value={collaborators.filter((collaborator: any) => collaborator.active !== false).length}
            icon={<Users className="h-5 w-5" />}
          />
          <StatCard
            className="ps-gradient-surface"
            title="Eventos com atenção"
            value={pageSummary.eventsWithAttention}
            icon={<AlertTriangle className="h-5 w-5" />}
            iconClassName={pageSummary.eventsWithAttention ? 'bg-warning/10 text-warning' : undefined}
          />
          <StatCard
            className="ps-gradient-surface"
            title="Confirmações / vagas"
            value={pageSummary.totalOperationalPending}
            icon={<CheckCircle2 className="h-5 w-5" />}
            iconClassName={pageSummary.totalOperationalPending ? 'bg-warning/10 text-warning' : undefined}
          />
        </div>

        {focusEvent && focusSummary && (
          <Card className="mt-5 overflow-hidden rounded-2xl border-primary/20 bg-gradient-to-r from-card/85 via-card/70 to-primary/[0.045] shadow-sm">
            <CardContent className="p-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 text-primary">
                      Evento em foco
                    </Badge>
                    <Badge variant={focusEvent.status === 'em_andamento' ? 'default' : 'secondary'}>
                      {PS_EVENT_STATUS[focusEvent.status] || focusEvent.status}
                    </Badge>
                    {focusSummary.attention > 0 && (
                      <Badge variant="outline" className="rounded-full border-amber-500/25 text-amber-500">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        {focusSummary.attention} ponto(s) de atenção
                      </Badge>
                    )}
                  </div>

                  <h2 className="mt-3 text-xl font-semibold">{focusEvent.name}</h2>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {focusEvent.date && (
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {new Date(`${focusEvent.date}T00:00:00`).toLocaleDateString('pt-BR')}
                        {daysUntilFocus !== null && daysUntilFocus > 0 && ` · faltam ${daysUntilFocus} dia(s)`}
                        {daysUntilFocus === 0 && ' · hoje'}
                      </span>
                    )}
                    {focusEvent.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {focusEvent.location}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-border/50 bg-background/35 p-3">
                      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Equipe ativa</p>
                      <p className="mt-1 text-xl font-bold">{focusSummary.team}</p>
                      <p className="text-[9px] text-muted-foreground">{focusSummary.confirmed} confirmado(s)</p>
                    </div>
                    <div className={`rounded-xl border p-3 ${focusSummary.pending ? 'border-amber-500/20 bg-amber-500/[0.03]' : 'border-border/50 bg-background/35'}`}>
                      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Aguardando</p>
                      <p className={`mt-1 text-xl font-bold ${focusSummary.pending ? 'text-amber-500' : ''}`}>{focusSummary.pending}</p>
                      <p className="text-[9px] text-muted-foreground">confirmação pendente</p>
                    </div>
                    <div className={`rounded-xl border p-3 ${focusSummary.declined ? 'border-destructive/20 bg-destructive/[0.025]' : 'border-border/50 bg-background/35'}`}>
                      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Vagas abertas</p>
                      <p className={`mt-1 text-xl font-bold ${focusSummary.declined ? 'text-destructive' : ''}`}>{focusSummary.declined}</p>
                      <p className="text-[9px] text-muted-foreground">por recusa</p>
                    </div>
                    <div className={`rounded-xl border p-3 ${focusSummary.missingPix ? 'border-amber-500/20 bg-amber-500/[0.03]' : 'border-border/50 bg-background/35'}`}>
                      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">PIX pendente</p>
                      <p className={`mt-1 text-xl font-bold ${focusSummary.missingPix ? 'text-amber-500' : ''}`}>{focusSummary.missingPix}</p>
                      <p className="text-[9px] text-muted-foreground">fiscal(is) sem dado</p>
                    </div>
                  </div>
                </div>

                <div className="w-full shrink-0 space-y-2 xl:w-[330px]">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold">Próximas ações</p>
                    <Button asChild size="sm" className="h-8 rounded-xl">
                      <Link to={`/admin-module/processo-seletivo/eventos/${focusEvent.id}`}>
                        Abrir evento
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>

                  {focusActions.length > 0 ? (
                    focusActions.slice(0, 4).map((action: any) => (
                      <Link
                        key={action.key}
                        to={`/admin-module/processo-seletivo/eventos/${focusEvent.id}?tab=${action.tab}`}
                        className={`group block rounded-xl border p-3 transition hover:-translate-y-0.5 hover:shadow-sm ${action.severity === 'critical'
                          ? 'border-destructive/20 bg-destructive/[0.02]'
                          : action.severity === 'warning'
                            ? 'border-amber-500/20 bg-amber-500/[0.02]'
                            : 'border-border/60 bg-background/40'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold">{action.title}</p>
                            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{action.description}</p>
                          </div>
                          <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.025] p-4 text-center">
                      <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-500" />
                      <p className="mt-2 text-xs font-semibold">Nenhuma pendência principal</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">Os pontos básicos deste evento estão em dia.</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <section>
              <div className="mb-2.5 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Acessos principais</h2>
                <span className="text-[11px] text-muted-foreground">As rotinas específicas ficam dentro de cada evento</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <ActionCard
                  title="Eventos"
                  description="Abra um evento para gerenciar equipe, comunicação, treinamentos, pagamentos, presença e avaliações."
                  icon={CalendarDays}
                  href="/admin-module/processo-seletivo/eventos"
                />
                <ActionCard
                  title="Banco de Fiscais"
                  description="Consulte cadastro, experiência, avaliações e disponibilidade dos fiscais."
                  icon={Users}
                  href="/admin-module/processo-seletivo/colaboradores"
                />
                <ActionCard
                  title="Cargos e Valores"
                  description="Gerencie funções, jornadas e faixas de pagamento usadas nos eventos."
                  icon={Settings}
                  href="/admin-module/processo-seletivo/cargos"
                />
                <ActionCard
                  title="Resultados e Relatórios"
                  description="Acompanhe médias, critérios de desempenho e avaliações consolidadas."
                  icon={FileBarChart}
                  href="/admin-module/processo-seletivo/avaliacao-geral"
                />
              </div>
            </section>

            <Card className="ps-gradient-surface rounded-2xl border-border/60 bg-card/65">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  Próximos eventos
                </CardTitle>
                <CardDescription>Resumo rápido antes de abrir cada processo.</CardDescription>
              </CardHeader>

              <CardContent className="space-y-2.5">
                {upcomingEvents.length ? upcomingEvents.map((event: any) => {
                  const summary = eventSummary.get(String(event.id)) || {
                    team: 0,
                    pending: 0,
                    declined: 0,
                    attention: 0,
                  };

                  return (
                    <Link
                      key={event.id}
                      to={`/admin-module/processo-seletivo/eventos/${event.id}`}
                      className={`flex flex-col gap-3 rounded-xl border p-3 transition hover:border-primary/25 hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between ${summary.attention
                        ? 'border-amber-500/15 bg-amber-500/[0.015]'
                        : 'border-border/60 bg-muted/10'}`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">{event.name}</p>
                          {summary.attention > 0 && (
                            <Badge variant="outline" className="rounded-full border-amber-500/20 text-[8px] text-amber-500">
                              {summary.attention} atenção
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {event.date ? new Date(`${event.date}T00:00:00`).toLocaleDateString('pt-BR') : 'Data não definida'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[9px]">{summary.team} fiscais</Badge>
                        {summary.pending > 0 && <Badge variant="outline" className="border-amber-500/20 text-[9px] text-amber-500">{summary.pending} aguardando</Badge>}
                        {summary.declined > 0 && <Badge variant="destructive" className="text-[9px]">{summary.declined} vaga(s)</Badge>}
                        <Badge variant={event.status === 'em_andamento' ? 'default' : 'secondary'}>
                          {PS_EVENT_STATUS[event.status] || event.status}
                        </Badge>
                      </div>
                    </Link>
                  );
                }) : (
                  <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Nenhum evento futuro programado.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card className="ps-gradient-surface rounded-2xl border-border/60 bg-card/65 xl:sticky xl:top-20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ações rápidas</CardTitle>
                <CardDescription>Atalhos para as rotinas administrativas mais usadas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild className="ps-gradient-button w-full justify-start">
                  <Link to="/admin-module/processo-seletivo/eventos">
                    <Plus className="mr-2 h-4 w-4" />
                    Novo evento
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link to="/admin-module/processo-seletivo/eventos">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Abrir eventos
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link to="/admin-module/processo-seletivo/colaboradores">
                    <Users className="mr-2 h-4 w-4" />
                    Banco de fiscais
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link to="/admin-module/processo-seletivo/cargos">
                    <CircleDollarSign className="mr-2 h-4 w-4" />
                    Cargos e valores
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>

        {operationalQuery.isFetching && (
          <p className="mt-3 text-right text-[10px] text-muted-foreground">
            Atualizando indicadores operacionais...
          </p>
        )}
      </div>
    </MainLayout>
  );
}
