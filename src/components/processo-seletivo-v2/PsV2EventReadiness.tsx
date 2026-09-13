import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleDot, ExternalLink, ShieldCheck } from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePsCandidates, usePsEvent } from '@/hooks/useProcessoSeletivo';
import { usePsV2AllocationReview } from '@/hooks/usePsV2AllocationReview';
import { usePsV2EventReadOnly } from '@/hooks/usePsV2EventReadOnly';
import { usePsV2EventStaffing } from '@/hooks/usePsV2EventStaffing';
import { PS_V2_BASE_PATH } from '@/lib/psV2Architecture';

type CheckStatus = 'ok' | 'attention' | 'critical' | 'waiting';
type ReadinessCheck = { title: string; detail: string; status: CheckStatus; href?: string; action?: string };

const value = (input: unknown) => String(input ?? '').trim();
const tone: Record<CheckStatus, string> = {
  ok: 'border-emerald-500/25 bg-emerald-500/[0.05]',
  attention: 'border-amber-500/25 bg-amber-500/[0.05]',
  critical: 'border-destructive/25 bg-destructive/[0.05]',
  waiting: 'border-border/60 bg-card/60',
};
const labels: Record<CheckStatus, string> = { ok: 'OK', attention: 'Atenção', critical: 'Crítico', waiting: 'Aguardando' };

export default function PsV2EventReadiness() {
  const { eventId } = useParams();
  const { data: event, isLoading: eventLoading } = usePsEvent(eventId);
  const { data: candidates = [], isLoading: candidatesLoading } = usePsCandidates(eventId);
  const readOnly = usePsV2EventReadOnly(eventId);
  const staffing = usePsV2EventStaffing(eventId);
  const review = usePsV2AllocationReview(eventId);
  const base = `${PS_V2_BASE_PATH}/eventos/${eventId}/equipe`;

  const checks = useMemo<ReadinessCheck[]>(() => {
    if (!event) return [];
    const metrics = readOnly.data?.metrics;
    const team = Number(metrics?.team || 0);
    const pending = Number(metrics?.pendingConfirmation || 0);
    const failures = Number(metrics?.communicationFailed || 0);
    const requiredTrainings = Number(metrics?.requiredTrainingGroups || 0);
    const trainingPeople = Number(metrics?.trainingChoiceParticipants || 0);
    const requirements = staffing.data?.requirements || [];
    const allocationItems = review.data?.items || [];

    let missingRegistration = 0;
    let missingRoom = 0;
    let missingSeat = 0;
    const seatMap = new Map<string, number>();
    for (const candidate of candidates as any[]) {
      const campus = value(candidate.campus);
      const room = value(candidate.room);
      const seat = value(candidate.seat_number || candidate.seat);
      if (!value(candidate.registration_number)) missingRegistration += 1;
      if (!room) missingRoom += 1;
      if (!seat) missingSeat += 1;
      if (room && seat) {
        const key = `${campus}|${room}|${seat}`.toLocaleLowerCase('pt-BR');
        seatMap.set(key, (seatMap.get(key) || 0) + 1);
      }
    }
    const duplicateSeats = [...seatMap.values()].filter((count) => count > 1).length;
    const candidateIssues = missingRegistration + missingRoom + missingSeat + duplicateSeats;

    return [
      {
        title: 'Dados básicos do evento',
        detail: event.date && event.location ? 'Data e local definidos.' : 'Revise data e local antes da operação.',
        status: event.date && event.location ? 'ok' : 'critical',
      },
      {
        title: 'Candidatos e mapa de salas',
        detail: !candidates.length ? 'Nenhum candidato importado.' : candidateIssues ? `${candidateIssues} ocorrência(s) de inscrição, sala, assento ou duplicidade.` : `${candidates.length} candidato(s) sem pendências básicas.`,
        status: !candidates.length ? 'waiting' : candidateIssues ? 'attention' : 'ok',
        href: `${base}?view=preparacao`,
        action: 'Abrir preparação',
      },
      {
        title: 'Necessidades de equipe',
        detail: staffing.data?.schemaReady === false ? 'Estrutura V2 ainda não está ativa no banco.' : requirements.length ? `${requirements.length} regra(s) de necessidade cadastrada(s).` : 'Ainda não há demanda de equipe definida.',
        status: staffing.data?.schemaReady === false ? 'waiting' : requirements.length ? 'ok' : 'attention',
        href: base,
        action: 'Abrir alocação',
      },
      {
        title: 'Proposta de alocação',
        detail: review.data?.run ? `${allocationItems.length} posição(ões) na proposta atual.` : 'Nenhuma proposta de alocação em revisão.',
        status: review.data?.run ? 'ok' : requirements.length ? 'attention' : 'waiting',
        href: base,
        action: 'Revisar equipe',
      },
      {
        title: 'Equipe oficial',
        detail: team ? `${team} integrante(s) ativos no módulo oficial.` : 'Equipe oficial ainda vazia.',
        status: team ? 'ok' : 'critical',
      },
      {
        title: 'Confirmações',
        detail: team ? pending ? `${pending} confirmação(ões) ainda pendente(s).` : 'Todos os integrantes ativos estão sem pendência de confirmação.' : 'Aguardando equipe oficial.',
        status: !team ? 'waiting' : pending ? 'attention' : 'ok',
        href: `${base}?view=comunicacao`,
        action: 'Ver comunicação',
      },
      {
        title: 'Comunicações',
        detail: failures ? `${failures} envio(s) com falha precisam de revisão.` : 'Nenhuma falha de comunicação registrada.',
        status: failures ? 'critical' : 'ok',
        href: `${base}?view=comunicacao`,
        action: 'Ver histórico',
      },
      {
        title: 'Treinamentos obrigatórios',
        detail: !requiredTrainings ? 'Nenhum treinamento obrigatório configurado.' : `${trainingPeople} pessoa(s) com escolha registrada em ${requiredTrainings} grupo(s) obrigatório(s).`,
        status: !requiredTrainings ? 'ok' : team && trainingPeople >= team ? 'ok' : 'attention',
        href: `${base}?view=treinamentos`,
        action: 'Ver treinamentos',
      },
    ];
  }, [base, candidates, event, readOnly.data?.metrics, review.data?.items, review.data?.run, staffing.data?.requirements, staffing.data?.schemaReady]);

  const counts = checks.reduce((acc, item) => ({ ...acc, [item.status]: acc[item.status] + 1 }), { ok: 0, attention: 0, critical: 0, waiting: 0 } as Record<CheckStatus, number>);
  const score = checks.length ? Math.round((counts.ok / checks.length) * 100) : 0;

  if (eventLoading || candidatesLoading || readOnly.isLoading) return <MainLayout><div className="py-16 text-center text-sm text-muted-foreground">Calculando prontidão...</div></MainLayout>;
  if (!event) return <MainLayout><Card className="rounded-2xl border-dashed"><CardContent className="p-10 text-center">Evento não encontrado.</CardContent></Card></MainLayout>;

  return <MainLayout>
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Link to={PS_V2_BASE_PATH}>Processo Seletivo 2</Link><span>/</span><Link to={`${base}?view=overview`}>{event.name}</Link><span>/</span><span className="text-foreground">Prontidão</span></div>
    <PageHeader title="Prontidão operacional" description="Checklist automático e somente leitura para identificar o que falta antes do evento." actions={<div className="flex flex-wrap gap-2"><Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">V2 · seguro</Badge><Button asChild variant="outline" size="sm"><Link to={`${base}?view=overview`}><ArrowLeft className="mr-2 h-4 w-4" />Evento</Link></Button><Button asChild variant="outline" size="sm"><Link to={`/admin-module/processo-seletivo/eventos/${event.id}`}>Módulo oficial <ExternalLink className="ml-2 h-4 w-4" /></Link></Button></div>} />

    <Card className="mb-5 rounded-2xl border-emerald-500/20 bg-emerald-500/[0.05]"><CardContent className="flex gap-3 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /><div><p className="text-sm font-semibold">Diagnóstico sem ações automáticas.</p><p className="mt-1 text-xs text-muted-foreground">Esta tela apenas cruza os dados atuais. Nenhuma confirmação, presença, equipe ou configuração é alterada.</p></div></CardContent></Card>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Card className="rounded-2xl border-primary/25 bg-primary/[0.04]"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Prontidão</p><p className="mt-1 text-3xl font-semibold">{score}%</p></CardContent></Card>
      <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">OK</p><p className="mt-1 text-2xl font-semibold text-emerald-600">{counts.ok}</p></CardContent></Card>
      <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Atenção</p><p className="mt-1 text-2xl font-semibold text-amber-600">{counts.attention}</p></CardContent></Card>
      <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Crítico</p><p className="mt-1 text-2xl font-semibold text-destructive">{counts.critical}</p></CardContent></Card>
      <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Aguardando</p><p className="mt-1 text-2xl font-semibold">{counts.waiting}</p></CardContent></Card>
    </section>

    <div className="mt-5 grid gap-3 lg:grid-cols-2">
      {checks.map((item) => <Card key={item.title} className={`rounded-2xl ${tone[item.status]}`}><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base">{item.status === 'ok' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : item.status === 'waiting' ? <CircleDot className="h-4 w-4 text-muted-foreground" /> : <AlertTriangle className={`h-4 w-4 ${item.status === 'critical' ? 'text-destructive' : 'text-amber-500'}`} />}{item.title}</CardTitle><CardDescription className="mt-2">{item.detail}</CardDescription></div><Badge variant="outline">{labels[item.status]}</Badge></div></CardHeader>{item.href && <CardContent className="pt-0"><Button asChild variant="outline" size="sm"><Link to={item.href}>{item.action || 'Abrir'}</Link></Button></CardContent>}</Card>)}
    </div>
  </MainLayout>;
}
