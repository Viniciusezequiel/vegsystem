import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, CalendarClock, CalendarDays,
  ClipboardCheck, FileBarChart, FileText, GraduationCap, IdCard, Mail, Plus,
  ScrollText, Settings, ShieldCheck, Users, WalletCards,
} from 'lucide-react';

import { StatCard } from '@/components/dashboard/StatCard';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PsEventCommunicationTab } from '@/components/processo-seletivo/PsEventCommunicationTab';
import { PsEventDocumentsPanel } from '@/components/processo-seletivo/PsEventDocumentsPanel';
import { PsEventPaymentsPanel } from '@/components/processo-seletivo/PsEventPaymentsPanel';
import { PsEventTrainingTab } from '@/components/processo-seletivo/PsEventTrainingTab';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePsCollaborators, usePsEvaluations, usePsEventCollaborators, usePsEvents, usePsRoles } from '@/hooks/useProcessoSeletivo';
import { PS_EVENT_STATUS } from '@/lib/psConstants';

type EventAction = 'communication' | 'labels' | 'training' | 'payments' | 'evaluators';
type Workspace = Exclude<EventAction, 'evaluators'>;

type ActionCardProps = {
  title: string;
  description: string;
  icon: typeof CalendarDays;
  onClick?: () => void;
  href?: string;
  badge?: string;
};

function ActionCard({ title, description, icon: Icon, onClick, href, badge }: ActionCardProps) {
  const content = (
    <div className="group flex h-full items-center gap-4 rounded-2xl border border-border/60 bg-card/65 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/85 hover:shadow-md">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{title}</h3>{badge && <Badge variant="outline" className="text-[10px]">{badge}</Badge>}</div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:text-primary" />
    </div>
  );
  if (href) return <Link to={href} className="block h-full">{content}</Link>;
  return <button type="button" onClick={onClick} className="block h-full w-full">{content}</button>;
}

function UpcomingEventRow({ event }: { event: any }) {
  const { data: teamLinks } = usePsEventCollaborators(event.id);
  return (
    <Link to={`/admin-module/processo-seletivo/eventos/${event.id}`} className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/10 p-3 transition hover:border-primary/25 hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0"><p className="truncate text-sm font-medium">{event.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{event.date ? new Date(`${event.date}T00:00:00`).toLocaleDateString('pt-BR') : 'Data não definida'}</p></div>
      <div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{teamLinks?.length ?? '—'} fiscais</span><Badge variant={event.status === 'em_andamento' ? 'default' : 'secondary'}>{PS_EVENT_STATUS[event.status] || event.status}</Badge></div>
    </Link>
  );
}

function WorkspaceView({ workspace, event, onBack }: { workspace: Workspace; event: any; onBack: () => void }) {
  const { data: links = [] } = usePsEventCollaborators(event.id);
  const { data: roles = [] } = usePsRoles();
  const labels: Record<Workspace, { title: string; description: string }> = {
    communication: { title: 'Comunicações', description: 'Envios, confirmações e histórico de comunicação deste evento.' },
    labels: { title: 'Gerar etiquetas', description: 'Documentos e etiquetas vinculados ao evento selecionado.' },
    training: { title: 'Treinamentos', description: 'Cargos participantes, datas, campi e escolhas dos colaboradores.' },
    payments: { title: 'Pagamentos', description: 'Múltiplos cargos, valores individuais e PDF financeiro do evento.' },
  };
  const meta = labels[workspace];

  return (
    <MainLayout>
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/55 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <div><p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">{event.name}</p><h1 className="mt-1 text-xl font-semibold">{meta.title}</h1><p className="mt-1 text-sm text-muted-foreground">{meta.description}</p></div>
        </div>
        <Button asChild variant="outline" size="sm"><Link to={`/admin-module/processo-seletivo/eventos/${event.id}`}>Abrir evento completo</Link></Button>
      </div>

      {workspace === 'communication' && <PsEventCommunicationTab event={event} links={links as any[]} />}
      {workspace === 'labels' && <PsEventDocumentsPanel event={event} />}
      {workspace === 'training' && <PsEventTrainingTab eventId={event.id} roles={roles as any[]} />}
      {workspace === 'payments' && <PsEventPaymentsPanel event={event} />}
    </MainLayout>
  );
}

export default function PsHome() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: events = [] } = usePsEvents();
  const { data: collaborators = [] } = usePsCollaborators();
  const { data: evaluations = [] } = usePsEvaluations();
  const [selectAction, setSelectAction] = useState<EventAction | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const upcomingEvents = useMemo(() => events.filter((event: any) => event.date >= today && event.status !== 'finalizado').sort((a: any, b: any) => String(a.date).localeCompare(String(b.date))).slice(0, 5), [events, today]);
  const pendingEvaluations = evaluations.filter((evaluation: any) => !evaluation.final_score || Number(evaluation.final_score) <= 0);
  const workspace = searchParams.get('workspace') as Workspace | null;
  const workspaceEventId = searchParams.get('event');
  const workspaceEvent = workspaceEventId ? events.find((event: any) => event.id === workspaceEventId) : null;

  if (workspace && workspaceEvent && ['communication', 'labels', 'training', 'payments'].includes(workspace)) {
    return <WorkspaceView workspace={workspace} event={workspaceEvent} onBack={() => setSearchParams({})} />;
  }

  const chooseEvent = (event: any) => {
    if (!selectAction) return;
    if (selectAction === 'evaluators') {
      navigate(`/admin-module/processo-seletivo/eventos/${event.id}/avaliadores`);
    } else {
      setSearchParams({ workspace: selectAction, event: event.id });
    }
    setSelectAction(null);
  };

  const orderedEvents = [...events].sort((a: any, b: any) => String(b.date || '').localeCompare(String(a.date || '')));

  return (
    <MainLayout>
      <PageHeader title="Central do Processo Seletivo" description="Eventos, fiscais, comunicações, treinamentos, pagamentos e configurações em um só lugar." actions={<Button asChild size="sm"><Link to="/admin-module/processo-seletivo/eventos"><Plus className="mr-2 h-4 w-4" />Novo / gerenciar evento</Link></Button>} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Eventos" value={events.length} icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard title="Próximos eventos" value={upcomingEvents.length} icon={<CalendarClock className="h-5 w-5" />} />
        <StatCard title="Banco de fiscais" value={collaborators.length} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Avaliações" value={evaluations.length} icon={<ClipboardCheck className="h-5 w-5" />} />
        <StatCard title="Pendências" value={pendingEvaluations.length} icon={<AlertTriangle className="h-5 w-5" />} iconClassName="bg-warning/10 text-warning" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <section>
            <div className="mb-2.5 flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Fluxos principais</h2><span className="text-[11px] text-muted-foreground">Acesso direto às rotinas mais usadas</span></div>
            <div className="grid gap-3 md:grid-cols-2">
              <ActionCard title="Eventos criados" description="Abra, crie e acompanhe os processos seletivos." icon={CalendarDays} href="/admin-module/processo-seletivo/eventos" />
              <ActionCard title="Banco de Fiscais" description="Cadastro único, histórico, ranking e inscrições." icon={Users} href="/admin-module/processo-seletivo/colaboradores" />
              <ActionCard title="Comunicações" description="Escolha o evento e envie confirmações ou orientações." icon={Mail} onClick={() => setSelectAction('communication')} />
              <ActionCard title="Gerar Etiquetas" description="Etiquetas da equipe e dos candidatos por evento." icon={IdCard} onClick={() => setSelectAction('labels')} />
              <ActionCard title="Treinamentos" description="Crie datas por cargo e acompanhe as escolhas." icon={GraduationCap} onClick={() => setSelectAction('training')} badge="Novo" />
              <ActionCard title="Pagamentos" description="Gerencie múltiplos cargos e gere o PDF financeiro." icon={WalletCards} onClick={() => setSelectAction('payments')} badge="Novo" />
            </div>
          </section>

          <section>
            <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Cadastros e configurações</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <ActionCard title="Cargos e Valores" description="Faixas por jornada e importação da tabela." icon={Settings} href="/admin-module/processo-seletivo/cargos" />
              <ActionCard title="Equipe Avaliadora" description="Selecione um evento para gerenciar avaliadores." icon={ShieldCheck} onClick={() => setSelectAction('evaluators')} />
              <ActionCard title="Regras do Processo" description="Parâmetros gerais e critérios do processo." icon={ScrollText} badge="Em breve" />
            </div>
          </section>

          <section>
            <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Acompanhamento</h2>
            <div className="grid gap-3 md:grid-cols-2"><ActionCard title="Resultados e Relatórios" description="Avaliações, médias e classificações consolidadas." icon={FileBarChart} href="/admin-module/processo-seletivo/avaliacao-geral" /><ActionCard title="Atividades recentes" description="Acompanhamento das movimentações importantes do módulo." icon={Activity} badge="Em evolução" /></div>
          </section>

          <Card className="rounded-2xl border-border/60 bg-card/65">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-primary" />Próximos eventos</CardTitle><CardDescription>Eventos programados a partir de hoje.</CardDescription></CardHeader>
            <CardContent className="space-y-2.5">{upcomingEvents.length ? upcomingEvents.map((event: any) => <UpcomingEventRow key={event.id} event={event} />) : <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum evento futuro programado.</div>}</CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="rounded-2xl border-border/60 bg-card/65 xl:sticky xl:top-20">
            <CardHeader className="pb-3"><CardTitle className="text-base">Atalhos rápidos</CardTitle><CardDescription>Ações frequentes sem poluir o menu principal.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              <Button asChild className="w-full justify-start"><Link to="/admin-module/processo-seletivo/eventos"><Plus className="mr-2 h-4 w-4" />Novo evento</Link></Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => setSelectAction('communication')}><Mail className="mr-2 h-4 w-4" />Nova comunicação</Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => setSelectAction('labels')}><IdCard className="mr-2 h-4 w-4" />Gerar etiquetas</Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => setSelectAction('training')}><GraduationCap className="mr-2 h-4 w-4" />Configurar treinamento</Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => setSelectAction('payments')}><WalletCards className="mr-2 h-4 w-4" />Abrir pagamentos</Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={!!selectAction} onOpenChange={open => !open && setSelectAction(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Selecione o evento</DialogTitle><DialogDescription>Escolha em qual processo seletivo deseja executar esta ação.</DialogDescription></DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {orderedEvents.map((event: any) => (
              <button key={event.id} type="button" onClick={() => chooseEvent(event)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/10 p-3 text-left transition hover:border-primary/30 hover:bg-muted/20">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{event.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{event.date ? new Date(`${event.date}T00:00:00`).toLocaleDateString('pt-BR') : 'Data não definida'} · {event.location || 'Local não informado'}</p></div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
            {!orderedEvents.length && <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground"><FileText className="mx-auto mb-2 h-6 w-6" />Nenhum evento cadastrado.</div>}
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
