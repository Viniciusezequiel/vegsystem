import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/dashboard/StatCard';
import {
  GraduationCap, CalendarDays, CalendarClock, Users, ClipboardCheck, AlertTriangle,
  ClipboardList, FileBarChart, Settings, ScrollText, ArrowRight, ShieldCheck,
  Activity, ExternalLink,
} from 'lucide-react';
import { usePsEvents, usePsCollaborators, usePsEvaluations, usePsEventCollaborators } from '@/hooks/useProcessoSeletivo';
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

// Fetches team size for a single upcoming event via the existing per-event hook.
function UpcomingEventRow({ event }: { event: any }) {
  const { data: teamLinks } = usePsEventCollaborators(event.id);
  const fiscalCount = teamLinks?.length ?? null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/50 p-3">
      <div className="min-w-0 space-y-1">
        <p className="truncate font-medium">{event.name}</p>
        <p className="text-sm text-muted-foreground">
          {event.date ? new Date(`${event.date}T00:00:00`).toLocaleDateString('pt-BR') : 'Data não definida'}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {fiscalCount === null ? '—' : fiscalCount}
        </div>
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
    .filter((e: any) => e.date >= today)
    .sort((a: any, b: any) => (a.date > b.date ? 1 : -1))
    .slice(0, 5);
  const pendingEvaluations = evaluations.filter((e: any) => !e.final_score || Number(e.final_score) <= 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Gestor de Processo Seletivo</h1>
              <p className="text-muted-foreground">Eventos, fiscais, avaliações e banco de talentos.</p>
            </div>
          </div>
          <Button asChild>
            <Link to="/admin-module/processo-seletivo/eventos">Ver eventos</Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard title="Eventos" value={events.length} icon={<CalendarDays className="h-5 w-5" />} />
          <StatCard title="Próximos eventos" value={upcomingEvents.length} icon={<CalendarClock className="h-5 w-5" />} />
          <StatCard title="Colaboradores" value={collaborators.length} icon={<Users className="h-5 w-5" />} />
          <StatCard title="Avaliações" value={evaluations.length} icon={<ClipboardCheck className="h-5 w-5" />} />
          <StatCard
            title="Pendências"
            value={pendingEvaluations.length}
            icon={<AlertTriangle className="h-5 w-5" />}
            iconClassName="bg-amber-500/10 text-amber-500"
          />
        </div>

        <div className="space-y-4">
          {moduleGroups.map((group) => (
            <div key={group.title} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {group.modules.map((m) => {
                  const content = (
                    <Card className={`h-full rounded-2xl transition-all ${m.comingSoon ? 'opacity-60' : 'hover:-translate-y-1 hover:shadow-lg'}`}>
                      <CardHeader>
                        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                          <m.icon className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="flex items-center justify-between text-base">
                          {m.name}
                          {m.comingSoon
                            ? <Badge variant="outline">Em breve</Badge>
                            : <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                        </CardTitle>
                        <CardDescription>{m.description}</CardDescription>
                      </CardHeader>
                      <CardContent />
                    </Card>
                  );
                  return m.href
                    ? <Link key={m.name} to={m.href}>{content}</Link>
                    : <div key={m.name}>{content}</div>;
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="rounded-2xl lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-5 w-5 text-primary" /> Próximos eventos
              </CardTitle>
              <CardDescription>Eventos programados a partir de hoje.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingEvents.length === 0 && (
                <p className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                  Nenhum evento futuro programado.
                </p>
              )}
              {upcomingEvents.map((event: any) => <UpcomingEventRow key={event.id} event={event} />)}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-5 w-5 text-primary" /> Portal dos Avaliadores
              </CardTitle>
              <CardDescription>Acesso e pendências da equipe avaliadora.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/60 p-3 text-center">
                  <p className="text-2xl font-semibold text-foreground">—</p>
                  <p className="text-xs text-muted-foreground">Avaliadores ativos</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3 text-center">
                  <p className="text-2xl font-semibold text-foreground">—</p>
                  <p className="text-xs text-muted-foreground">Pendências de escopo</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Consulte um evento para ver os indicadores da equipe avaliadora.
              </p>
              <Button asChild variant="secondary" className="w-full">
                <Link to="/ps/avaliador">
                  Acessar portal <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 text-primary" /> Atividades recentes
            </CardTitle>
            <CardDescription>Últimas movimentações do processo seletivo.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-dashed border-border/60 p-8 text-center">
              <ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Nenhuma atividade recente</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Este painel será atualizado automaticamente conforme novas ações forem registradas.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
