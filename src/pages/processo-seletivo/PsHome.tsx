import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  ExternalLink,
  FileBarChart,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { StatCard } from '@/components/dashboard/StatCard';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  usePsCollaborators,
  usePsEvaluations,
  usePsEventCollaborators,
  usePsEvents,
} from '@/hooks/useProcessoSeletivo';
import { PS_EVENT_STATUS } from '@/lib/psConstants';

type PsModule = {
  name: string;
  description: string;
  href?: string;
  icon: typeof CalendarDays;
  comingSoon?: boolean;
};

const moduleGroups: { title: string; modules: PsModule[] }[] = [
  {
    title: 'Operação',
    modules: [
      { name: 'Eventos', description: 'Processos seletivos, equipe importada e avaliações.', href: '/admin-module/processo-seletivo/eventos', icon: CalendarDays },
      { name: 'Banco de Fiscais', description: 'Cadastro único, ranking e inscrições públicas.', href: '/admin-module/processo-seletivo/colaboradores', icon: Users },
    ],
  },
  {
    title: 'Avaliação',
    modules: [
      { name: 'Equipe Avaliadora', description: 'Contas, escopos e acesso da equipe avaliadora por evento.', href: '/admin-module/processo-seletivo/eventos', icon: ShieldCheck },
      { name: 'Resultados e Relatórios', description: 'Rodadas de avaliação, médias e classificações.', href: '/admin-module/processo-seletivo/avaliacao-geral', icon: FileBarChart },
    ],
  },
  {
    title: 'Configuração',
    modules: [
      { name: 'Cargos e Valores', description: 'Cargos, valores R$ e funções combinadas.', href: '/admin-module/processo-seletivo/cargos', icon: Settings },
      { name: 'Regras do Processo', description: 'Parâmetros e critérios do processo seletivo.', icon: ScrollText, comingSoon: true },
    ],
  },
];

function UpcomingEventRow({ event }: { event: any }) {
  const { data: teamLinks } = usePsEventCollaborators(event.id);
  const fiscalCount = teamLinks?.length ?? null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{event.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {event.date ? new Date(`${event.date}T00:00:00`).toLocaleDateString('pt-BR') : 'Data não definida'}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {fiscalCount === null ? '—' : fiscalCount}
        </span>
        <Badge variant={event.status === 'em_andamento' ? 'default' : 'secondary'}>
          {PS_EVENT_STATUS[event.status] || event.status}
        </Badge>
      </div>
    </div>
  );
}

export default function PsHome() {
  const { data: events = [] } = usePsEvents();
  const { data: collaborators = [] } = usePsCollaborators();
  const { data: evaluations = [] } = usePsEvaluations();

  const today = new Date().toISOString().slice(0, 10);
  const upcomingEvents = events
    .filter((event: any) => event.date >= today)
    .sort((a: any, b: any) => (a.date > b.date ? 1 : -1))
    .slice(0, 5);
  const pendingEvaluations = evaluations.filter((evaluation: any) => !evaluation.final_score || Number(evaluation.final_score) <= 0);

  return (
    <MainLayout>
      <PageHeader
        title="Gestor de Processo Seletivo"
        description="Centralize eventos, fiscais, avaliações, classificações e configurações do processo."
        actions={
          <Button asChild size="sm">
            <Link to="/admin-module/processo-seletivo/eventos">Ver eventos</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Eventos" value={events.length} icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard title="Próximos eventos" value={upcomingEvents.length} icon={<CalendarClock className="h-5 w-5" />} />
        <StatCard title="Colaboradores" value={collaborators.length} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Avaliações" value={evaluations.length} icon={<ClipboardCheck className="h-5 w-5" />} />
        <StatCard
          title="Pendências"
          value={pendingEvaluations.length}
          icon={<AlertTriangle className="h-5 w-5" />}
          iconClassName="bg-warning/10 text-warning"
        />
      </div>

      <div className="mt-5 space-y-5">
        {moduleGroups.map(group => (
          <section key={group.title}>
            <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{group.title}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.modules.map(module => {
                const Icon = module.icon;
                const content = (
                  <Card className={`h-full border-border/60 bg-card/65 shadow-sm transition-all duration-200 ${module.comingSoon ? 'opacity-60' : 'group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:bg-card/85 group-hover:shadow-md'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        {module.comingSoon
                          ? <Badge variant="outline" className="text-[10px]">Em breve</Badge>
                          : <ArrowRight className="h-4 w-4 text-muted-foreground/55 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />}
                      </div>
                      <h3 className="mt-3 text-sm font-semibold">{module.name}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{module.description}</p>
                    </CardContent>
                  </Card>
                );

                return module.href
                  ? <Link key={module.name} to={module.href} className="group block">{content}</Link>
                  : <div key={module.name}>{content}</div>;
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/65 shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-primary" />
              Próximos eventos
            </CardTitle>
            <CardDescription>Eventos programados a partir de hoje.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {upcomingEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-7 text-center">
                <CalendarClock className="mx-auto h-7 w-7 text-muted-foreground/45" />
                <p className="mt-2 text-sm font-medium">Nenhum evento futuro programado</p>
              </div>
            ) : upcomingEvents.map((event: any) => <UpcomingEventRow key={event.id} event={event} />)}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/65 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Portal dos Avaliadores
            </CardTitle>
            <CardDescription>Acesso externo da equipe avaliadora.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-center">
                <p className="text-xl font-semibold">—</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Avaliadores ativos</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-center">
                <p className="text-xl font-semibold">—</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Pendências</p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">Abra um evento para consultar indicadores e escopos da equipe avaliadora.</p>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/ps/avaliador">
                Acessar portal
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 border-border/60 bg-card/65 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            Atividades recentes
          </CardTitle>
          <CardDescription>Últimas movimentações do processo seletivo.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-7 text-center">
            <ClipboardList className="mx-auto h-7 w-7 text-muted-foreground/45" />
            <p className="mt-2 text-sm font-medium">Nenhuma atividade recente</p>
            <p className="mt-1 text-xs text-muted-foreground">Este painel será preenchido conforme novas movimentações forem registradas.</p>
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
