import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  MapPinned,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePsCollaborators, usePsEvaluations, usePsEvents } from '@/hooks/useProcessoSeletivo';
import { PS_EVENT_STATUS } from '@/lib/psConstants';
import { PS_V2_BASE_PATH, PS_V2_MODULES, PS_V2_RESOURCES, PS_V2_WORKFLOW } from '@/lib/psV2Architecture';

const formatDate = (value?: string | null) => {
  if (!value) return 'Sem data definida';
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');
};

function MetricCard({ title, value, detail, icon: Icon, attention = false }: { title: string; value: string | number; detail: string; icon: typeof CalendarDays; attention?: boolean }) {
  return (
    <Card className="rounded-2xl border-border/60 bg-card/70 shadow-sm">
      <CardContent className="flex items-center justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${attention ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function PsV2Home() {
  const { data: events = [], isLoading: loadingEvents } = usePsEvents();
  const { data: collaborators = [] } = usePsCollaborators();
  const { data: evaluations = [] } = usePsEvaluations();

  const today = new Date().toISOString().slice(0, 10);
  const orderedEvents = useMemo(
    () => [...events].sort((a: any, b: any) => String(a.date || '').localeCompare(String(b.date || ''))),
    [events],
  );
  const activeEvents = orderedEvents.filter((event: any) => event.status !== 'finalizado');
  const nextEvent = activeEvents.find((event: any) => !event.date || event.date >= today) || activeEvents[0];
  const pendingEvaluations = evaluations.filter((evaluation: any) => !evaluation.final_score || Number(evaluation.final_score) <= 0).length;

  return (
    <MainLayout>
      <PageHeader
        title="Processo Seletivo 2"
        description="Nova central operacional em construção paralela, sem interromper o módulo atual."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">V2 · ambiente paralelo</Badge>
            <Button asChild size="sm">
              <Link to="/admin-module/processo-seletivo/eventos"><Plus className="mr-2 h-4 w-4" />Novo evento</Link>
            </Button>
          </div>
        )}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Eventos ativos" value={activeEvents.length} detail={`${events.length} eventos cadastrados`} icon={CalendarDays} />
        <MetricCard title="Próximo evento" value={nextEvent ? formatDate(nextEvent.date) : '—'} detail={nextEvent?.name || 'Nenhum evento programado'} icon={CalendarClock} />
        <MetricCard title="Banco de fiscais" value={collaborators.length} detail="Base compartilhada com o módulo atual" icon={Users} />
        <MetricCard title="Pendências" value={pendingEvaluations} detail="Indicador inicial; será ampliado no V2" icon={AlertTriangle} attention={pendingEvaluations > 0} />
      </section>

      <section className="mt-5 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/[0.08] via-card/70 to-card/60 p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-[0.14em]">Fluxo inteligente</span></div>
            <h2 className="mt-2 text-lg font-semibold">O evento passa a orientar o trabalho, em vez de apenas guardar cadastros.</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Planejamento, estrutura física, equipe, comunicação, execução, avaliação e financeiro ficam conectados em uma sequência única, com pendências e próximas ações.</p>
          </div>
          <Button asChild variant="outline" className="shrink-0"><Link to={`${PS_V2_BASE_PATH}/locais`}><MapPinned className="mr-2 h-4 w-4" />Estruturar locais</Link></Button>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
          {PS_V2_WORKFLOW.map((step, index) => (
            <div key={step.key} className="relative rounded-xl border border-border/60 bg-background/45 px-3 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{index + 1}</div>
                <p className="text-xs font-medium">{step.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div><h2 className="text-base font-semibold">Operação do processo</h2><p className="mt-0.5 text-xs text-muted-foreground">Cada área concentra somente as ações relacionadas àquela etapa.</p></div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {PS_V2_MODULES.map(module => {
                const Icon = module.icon;
                const content = (
                  <Card className="group h-full rounded-2xl border-border/60 bg-card/65 transition hover:-translate-y-0.5 hover:border-primary/25 hover:bg-card/85 hover:shadow-md">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                        {module.href ? <ArrowRight className="h-4 w-4 text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:text-primary" /> : <Badge variant="secondary" className="text-[10px]">em construção</Badge>}
                      </div>
                      <h3 className="mt-4 text-sm font-semibold">{module.title}</h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{module.description}</p>
                    </CardContent>
                  </Card>
                );
                return module.href ? <Link key={module.key} to={module.href}>{content}</Link> : <div key={module.key}>{content}</div>;
              })}
            </div>
          </section>

          <Card className="rounded-2xl border-border/60 bg-card/65">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3"><div><CardTitle className="text-base">Eventos</CardTitle><CardDescription className="mt-1">Acesso rápido aos processos já cadastrados.</CardDescription></div><Button asChild variant="ghost" size="sm"><Link to="/admin-module/processo-seletivo/eventos">Ver todos <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {loadingEvents ? <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Carregando eventos...</div> : orderedEvents.slice(0, 5).map((event: any) => (
                <Link key={event.id} to={`/admin-module/processo-seletivo/eventos/${event.id}`} className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/10 p-3 transition hover:border-primary/25 hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{event.name}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(event.date)} · {event.location || 'Local ainda não estruturado'}</p></div>
                  <div className="flex items-center gap-2"><Badge variant={event.status === 'em_andamento' ? 'default' : 'secondary'}>{PS_EVENT_STATUS[event.status] || event.status}</Badge><ArrowRight className="h-4 w-4 text-muted-foreground" /></div>
                </Link>
              ))}
              {!loadingEvents && !orderedEvents.length && <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum evento cadastrado.</div>}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="rounded-2xl border-border/60 bg-card/65 xl:sticky xl:top-20">
            <CardHeader className="pb-3"><CardTitle className="text-base">Recursos do módulo</CardTitle><CardDescription>Cadastros reutilizáveis e regras gerais, fora do fluxo diário do evento.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {PS_V2_RESOURCES.map(resource => {
                const Icon = resource.icon;
                const row = (
                  <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/10 p-3 transition hover:border-primary/20 hover:bg-muted/20">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium">{resource.title}</p><p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{resource.description}</p></div>
                    {resource.legacyHref ? <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60" /> : <CircleDot className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />}
                  </div>
                );
                return resource.legacyHref ? <Link key={resource.title} to={resource.legacyHref}>{row}</Link> : <div key={resource.title}>{row}</div>;
              })}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-emerald-500/20 bg-emerald-500/[0.05]">
            <CardContent className="flex gap-3 p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /><div><p className="text-sm font-medium">Módulo atual preservado</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">O V2 está sendo desenvolvido em paralelo. Os dados existentes continuam sendo a fonte principal enquanto cada nova etapa é validada.</p></div></CardContent>
          </Card>
        </aside>
      </div>
    </MainLayout>
  );
}
