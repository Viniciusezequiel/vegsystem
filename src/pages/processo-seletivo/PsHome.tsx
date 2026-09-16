import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarClock, CalendarDays, ClipboardCheck, FileBarChart, Plus, Settings, Users } from 'lucide-react';

import { StatCard } from '@/components/dashboard/StatCard';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePsCollaborators, usePsEvaluations, usePsEventCollaborators, usePsEvents } from '@/hooks/useProcessoSeletivo';
import { PS_EVENT_STATUS } from '@/lib/psConstants';

type ActionCardProps = { title: string; description: string; icon: typeof CalendarDays; href: string };

function ActionCard({ title, description, icon: Icon, href }: ActionCardProps) {
  return (
    <Link to={href} className="block h-full">
      <div className="ps-gradient-surface group flex h-full items-center gap-4 rounded-2xl border border-border/60 bg-card/65 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/85 hover:shadow-md">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
    </Link>
  );
}

function UpcomingEventRow({ event }: { event: any }) {
  const { data: teamLinks } = usePsEventCollaborators(event.id);
  return (
    <Link to={`/admin-module/processo-seletivo/eventos/${event.id}`} className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/10 p-3 transition hover:border-primary/25 hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{event.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{event.date ? new Date(`${event.date}T00:00:00`).toLocaleDateString('pt-BR') : 'Data não definida'}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{teamLinks?.length ?? '—'} fiscais</span>
        <Badge variant={event.status === 'em_andamento' ? 'default' : 'secondary'}>{PS_EVENT_STATUS[event.status] || event.status}</Badge>
      </div>
    </Link>
  );
}

export default function PsHome() {
  const { data: events = [] } = usePsEvents();
  const { data: collaborators = [] } = usePsCollaborators();
  const { data: evaluations = [] } = usePsEvaluations();
  const today = new Date().toISOString().slice(0, 10);
  const upcomingEvents = events
    .filter((event: any) => event.date >= today && event.status !== 'finalizado')
    .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)))
    .slice(0, 5);
  const pendingEvaluations = evaluations.filter((evaluation: any) => !evaluation.final_score || Number(evaluation.final_score) <= 0);

  return (
    <MainLayout>
      <div className="ps-module-modern">
        <PageHeader
          title="Central do Processo Seletivo"
          description="Acesse os eventos e gerencie todas as etapas em um único ambiente."
          actions={<Button asChild size="sm" className="ps-gradient-button"><Link to="/admin-module/processo-seletivo/eventos"><Plus className="mr-2 h-4 w-4" />Novo / gerenciar evento</Link></Button>}
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard className="ps-gradient-surface" title="Eventos" value={events.length} icon={<CalendarDays className="h-5 w-5" />} />
          <StatCard className="ps-gradient-surface" title="Próximos eventos" value={upcomingEvents.length} icon={<CalendarClock className="h-5 w-5" />} />
          <StatCard className="ps-gradient-surface" title="Banco de fiscais" value={collaborators.length} icon={<Users className="h-5 w-5" />} />
          <StatCard className="ps-gradient-surface" title="Avaliações" value={evaluations.length} icon={<ClipboardCheck className="h-5 w-5" />} />
          <StatCard className="ps-gradient-surface" title="Pendências" value={pendingEvaluations.length} icon={<AlertTriangle className="h-5 w-5" />} iconClassName="bg-warning/10 text-warning" />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            <section>
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Acessos principais</h2>
                <span className="text-[11px] text-muted-foreground">As rotinas específicas ficam dentro de cada evento</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <ActionCard title="Eventos" description="Abra um evento para gerenciar equipe, comunicação, treinamentos, pagamentos, presença e avaliações." icon={CalendarDays} href="/admin-module/processo-seletivo/eventos" />
                <ActionCard title="Banco de Fiscais" description="Consulte o cadastro único, histórico, ranking e inscrições dos fiscais." icon={Users} href="/admin-module/processo-seletivo/colaboradores" />
                <ActionCard title="Cargos e Valores" description="Gerencie funções, jornadas e faixas de pagamento usadas nos eventos." icon={Settings} href="/admin-module/processo-seletivo/cargos" />
                <ActionCard title="Resultados e Relatórios" description="Acompanhe avaliações, médias e classificações consolidadas." icon={FileBarChart} href="/admin-module/processo-seletivo/avaliacao-geral" />
              </div>
            </section>

            <Card className="ps-gradient-surface rounded-2xl border-border/60 bg-card/65">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-primary" />Próximos eventos</CardTitle>
                <CardDescription>Entre no evento para acessar todas as etapas sem trocar de layout.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {upcomingEvents.length
                  ? upcomingEvents.map((event: any) => <UpcomingEventRow key={event.id} event={event} />)
                  : <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum evento futuro programado.</div>}
              </CardContent>
            </Card>
          </div>

          <aside>
            <Card className="ps-gradient-surface rounded-2xl border-border/60 bg-card/65 xl:sticky xl:top-20">
              <CardHeader className="pb-3"><CardTitle className="text-base">Comece por aqui</CardTitle><CardDescription>Selecione um evento para acessar as ferramentas operacionais.</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                <Button asChild className="ps-gradient-button w-full justify-start"><Link to="/admin-module/processo-seletivo/eventos"><Plus className="mr-2 h-4 w-4" />Novo evento</Link></Button>
                <Button asChild variant="outline" className="w-full justify-start"><Link to="/admin-module/processo-seletivo/eventos"><CalendarDays className="mr-2 h-4 w-4" />Abrir eventos</Link></Button>
                <Button asChild variant="outline" className="w-full justify-start"><Link to="/admin-module/processo-seletivo/colaboradores"><Users className="mr-2 h-4 w-4" />Banco de fiscais</Link></Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </MainLayout>
  );
}
