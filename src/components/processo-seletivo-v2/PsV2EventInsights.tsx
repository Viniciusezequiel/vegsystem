import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ExternalLink, ShieldCheck } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PsV2PendingPeople } from '@/components/processo-seletivo-v2/PsV2PendingPeople';
import { PsV2PublicLinks } from '@/components/processo-seletivo-v2/PsV2PublicLinks';
import { PsV2RecentActivity } from '@/components/processo-seletivo-v2/PsV2RecentActivity';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePsEvent } from '@/hooks/useProcessoSeletivo';
import { usePsV2EventReadOnly } from '@/hooks/usePsV2EventReadOnly';
import { PS_EVENT_STATUS } from '@/lib/psConstants';
import { PS_V2_BASE_PATH } from '@/lib/psV2Architecture';

const formatDate = (value?: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem data definida';

export default function PsV2EventInsights() {
  const { eventId } = useParams();
  const { data: event, isLoading: eventLoading } = usePsEvent(eventId);
  const query = usePsV2EventReadOnly(eventId);
  const data = query.data;
  const base = `${PS_V2_BASE_PATH}/eventos/${eventId}/equipe`;
  const requiredGroups = (data?.trainingGroups || []).filter((group: any) => group.required);
  const peopleWithTrainingChoice = new Set((data?.trainingChoices || []).map((item: any) => item.event_collaborator_id).filter(Boolean)).size;

  if (eventLoading || query.isLoading) return <MainLayout><div className="py-16 text-center text-sm text-muted-foreground">Carregando acompanhamento...</div></MainLayout>;
  if (!event) return <MainLayout><Card className="rounded-2xl border-dashed"><CardContent className="p-10 text-center">Evento não encontrado.</CardContent></Card></MainLayout>;

  return <MainLayout>
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Link to={PS_V2_BASE_PATH} className="hover:text-foreground">Processo Seletivo 2</Link><span>/</span><Link to={`${base}?view=overview`} className="hover:text-foreground">{event.name}</Link><span>/</span><span className="text-foreground">Acompanhamento</span></div>
    <PageHeader title="Pendências e acompanhamento" description={`${event.name} · ${formatDate(event.date)} · leitura detalhada sem alterar o módulo oficial`} actions={<div className="flex flex-wrap gap-2"><Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">V2 · leitura segura</Badge><Badge variant={event.status === 'em_andamento' ? 'default' : 'secondary'}>{PS_EVENT_STATUS[event.status] || event.status || 'Sem status'}</Badge><Button asChild variant="outline" size="sm"><Link to={`${base}?view=overview`}><ArrowLeft className="mr-2 h-4 w-4" />Evento</Link></Button><Button asChild variant="outline" size="sm"><Link to={`/admin-module/processo-seletivo/eventos/${event.id}`}>Módulo oficial <ExternalLink className="ml-2 h-4 w-4" /></Link></Button></div>} />

    <Card className="mb-5 rounded-2xl border-emerald-500/20 bg-emerald-500/[0.05]"><CardContent className="flex gap-3 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /><div><p className="text-sm font-semibold">Nenhuma ação operacional é executada nesta tela.</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">O V2 apenas cruza os dados atuais para destacar quem precisa de atenção. Correções continuam sendo feitas no módulo oficial.</p></div></CardContent></Card>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section><PsV2PendingPeople team={data?.team || []} communications={data?.communications || []} eventDate={event.date} /></section>
      <aside className="space-y-4">
        <PsV2PublicLinks eventId={eventId} />
        <PsV2RecentActivity data={data} />
        {requiredGroups.length > 0 && <Card className="rounded-2xl border-amber-500/20 bg-amber-500/[0.04]"><CardContent className="flex gap-3 p-4"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /><div><p className="text-xs font-semibold">Treinamentos obrigatórios</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Há {requiredGroups.length} grupo(s) obrigatório(s) e {peopleWithTrainingChoice} pessoa(s) com escolha registrada. A conferência por cargo permanece na área de Treinamentos.</p><Button asChild variant="outline" size="sm" className="mt-3"><Link to={`${base}?view=treinamentos`}>Abrir treinamentos</Link></Button></div></CardContent></Card>}
      </aside>
    </div>
  </MainLayout>;
}
