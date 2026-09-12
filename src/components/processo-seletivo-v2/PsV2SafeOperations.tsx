import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, ExternalLink, GraduationCap, Mail, ShieldCheck, Star, Users, WalletCards } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePsEvent } from '@/hooks/useProcessoSeletivo';
import { usePsV2EventReadOnly } from '@/hooks/usePsV2EventReadOnly';
import { PS_EVENT_STATUS } from '@/lib/psConstants';
import { PS_V2_BASE_PATH } from '@/lib/psV2Architecture';

const money = (value: unknown) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const formatDate = (value?: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR') : 'Sem data definida';
const statusLabel: Record<string, string> = { sent: 'Enviado', pending: 'Pendente', processing: 'Processando', waiting_provider_quota: 'Aguardando cota', failed: 'Falhou', failed_missing_recipient: 'Sem e-mail', cancelled: 'Cancelado' };
const sections = [
  { key: 'equipe', title: 'Equipe', description: 'Necessidades, proposta automática e revisão.', icon: Users },
  { key: 'comunicacao', title: 'Comunicação', description: 'Envios, confirmações e falhas.', icon: Mail },
  { key: 'treinamentos', title: 'Treinamentos', description: 'Grupos, sessões e escolhas.', icon: GraduationCap },
  { key: 'execucao', title: 'Dia do evento', description: 'Presença e situação operacional.', icon: ClipboardCheck },
  { key: 'avaliacoes', title: 'Avaliações', description: 'Avaliações e autoavaliações.', icon: Star },
  { key: 'financeiro', title: 'Financeiro', description: 'Previsão e valores por pessoa.', icon: WalletCards },
] as const;

function SafeNotice() {
  return <Card className="mb-5 rounded-2xl border-emerald-500/20 bg-emerald-500/[0.05]"><CardContent className="flex gap-3 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /><div><p className="text-sm font-semibold">Modo seguro: somente leitura dos dados oficiais.</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">O V2 organiza estas informações, mas não envia mensagens, altera presença, avaliações ou pagamentos. Essas ações continuam no módulo atual.</p></div></CardContent></Card>;
}

export function PsV2SafeOperations() {
  const { eventId } = useParams();
  const [params] = useSearchParams();
  const view = params.get('view') || 'overview';
  const { data: event, isLoading: eventLoading } = usePsEvent(eventId);
  const query = usePsV2EventReadOnly(eventId);
  const data = query.data;
  const metrics = data?.metrics;
  const base = `${PS_V2_BASE_PATH}/eventos/${eventId}/equipe`;

  if (eventLoading || query.isLoading) return <MainLayout><div className="py-16 text-center text-sm text-muted-foreground">Carregando central do evento...</div></MainLayout>;
  if (!event) return <MainLayout><Card className="rounded-2xl border-dashed"><CardContent className="p-10 text-center"><p className="text-sm font-medium">Evento não encontrado.</p><Button asChild variant="outline" size="sm" className="mt-4"><Link to={PS_V2_BASE_PATH}>Voltar</Link></Button></CardContent></Card></MainLayout>;

  const header = (title: string, description: string, icon?: any) => <>
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Link to={PS_V2_BASE_PATH} className="hover:text-foreground">Processo Seletivo 2</Link><span>/</span><Link to={`${base}?view=overview`} className="hover:text-foreground">{event.name}</Link>{view !== 'overview' && <><span>/</span><span className="text-foreground">{title}</span></>}</div>
    <PageHeader title={title} description={description} actions={<div className="flex flex-wrap gap-2"><Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">{icon ? (() => { const Icon = icon; return <Icon className="mr-1.5 h-3.5 w-3.5" />; })() : null}V2 · leitura segura</Badge>{view !== 'overview' && <Button asChild variant="outline" size="sm"><Link to={`${base}?view=overview`}><ArrowLeft className="mr-2 h-4 w-4" />Evento</Link></Button>}<Button asChild variant="outline" size="sm"><Link to={`/admin-module/processo-seletivo/eventos/${event.id}`}>Módulo oficial <ExternalLink className="ml-2 h-4 w-4" /></Link></Button></div>} />
  </>;

  if (view === 'overview') return <MainLayout>
    {header(event.name, `${formatDate(event.date)} · ${event.location || 'Local não informado'} · Central operacional V2`)}
    <SafeNotice />
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {[
        ['Equipe', metrics?.team ?? '—', `${metrics?.confirmed ?? 0} confirmados`, Users],
        ['Confirmações', metrics?.confirmed ?? '—', `${metrics?.pendingConfirmation ?? 0} pendentes`, CheckCircle2],
        ['Presentes', metrics?.present ?? '—', `${metrics?.absent ?? 0} ausentes`, ClipboardCheck],
        ['Comunicações', metrics?.communicationSent ?? '—', `${metrics?.communicationFailed ?? 0} falhas`, Mail],
        ['Avaliações', metrics?.evaluations ?? '—', `${metrics?.selfEvaluations ?? 0} autoavaliações`, Star],
        ['Previsto', metrics ? money(metrics.forecastTotal) : '—', `${metrics?.payablePeople ?? 0} com presença`, WalletCards],
      ].map(([label, value, detail, Icon]: any) => <Card key={label} className="rounded-2xl border-border/60 bg-card/70"><CardContent className="flex items-center justify-between gap-3 p-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-1.5 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div></CardContent></Card>)}
    </section>
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <section><div className="mb-3"><h2 className="text-base font-semibold">Operação do evento</h2><p className="mt-1 text-xs text-muted-foreground">Cada área mantém este evento como contexto.</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{sections.map((section) => { const Icon = section.icon; const href = section.key === 'equipe' ? base : `${base}?view=${section.key}`; return <Link key={section.key} to={href}><Card className="group h-full rounded-2xl border-border/60 bg-card/70 transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"><CardContent className="p-4"><div className="flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div><ArrowRight className="h-4 w-4 text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:text-primary" /></div><h3 className="mt-4 text-sm font-semibold">{section.title}</h3><p className="mt-1.5 text-xs text-muted-foreground">{section.description}</p></CardContent></Card></Link>; })}</div></section>
      <aside className="space-y-4"><Card className="rounded-2xl border-border/60 bg-card/70"><CardHeader className="pb-3"><CardTitle className="text-base">Leitura operacional</CardTitle><CardDescription>Dados atuais do módulo oficial.</CardDescription></CardHeader><CardContent className="space-y-2.5 text-xs text-muted-foreground"><div className="flex justify-between"><span>Treinamentos</span><strong className="text-foreground">{metrics?.trainingGroups ?? 0} grupos</strong></div><div className="flex justify-between"><span>Sessões</span><strong className="text-foreground">{metrics?.trainingSessions ?? 0}</strong></div><div className="flex justify-between"><span>Escolhas registradas</span><strong className="text-foreground">{metrics?.trainingChoiceParticipants ?? 0}</strong></div><div className="flex justify-between"><span>Total com presença</span><strong className="text-foreground">{metrics ? money(metrics.payableTotal) : '—'}</strong></div></CardContent></Card></aside>
    </div>
  </MainLayout>;

  const current = sections.find((item) => item.key === view);
  if (!current) return <MainLayout>{header('Área não encontrada', event.name)}<Card className="rounded-2xl border-dashed"><CardContent className="p-8 text-center"><Button asChild variant="outline"><Link to={`${base}?view=overview`}>Voltar para o evento</Link></Button></CardContent></Card></MainLayout>;
  const Icon = current.icon;

  return <MainLayout>
    {header(current.title, `${event.name} · ${current.description}`, Icon)}
    <SafeNotice />

    {view === 'comunicacao' && <div className="space-y-5"><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Enviadas', metrics?.communicationSent ?? 0], ['Na fila', metrics?.communicationWaiting ?? 0], ['Falhas', metrics?.communicationFailed ?? 0], ['Confirmados', `${metrics?.confirmed ?? 0}/${metrics?.team ?? 0}`]].map(([label, value]) => <Card key={label} className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></CardContent></Card>)}</section><Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Histórico recente</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Tentativa</TableHead><TableHead>Solicitado</TableHead><TableHead>Erro</TableHead></TableRow></TableHeader><TableBody>{(data?.communications || []).slice(0, 30).map((item: any) => <TableRow key={item.id}><TableCell>{item.communication_type || '—'}</TableCell><TableCell><Badge variant={item.status === 'sent' ? 'default' : item.status?.includes('failed') ? 'destructive' : 'secondary'}>{statusLabel[item.status] || item.status}</Badge></TableCell><TableCell>{item.attempt_count ?? 0}</TableCell><TableCell>{dateTime(item.requested_at)}</TableCell><TableCell className="max-w-[320px] truncate text-xs text-muted-foreground">{item.last_error || '—'}</TableCell></TableRow>)}</TableBody></Table></div>{!data?.communications?.length && <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma comunicação registrada.</p>}</CardContent></Card></div>}

    {view === 'treinamentos' && <div className="space-y-5"><section className="grid gap-3 sm:grid-cols-3">{[['Grupos', metrics?.trainingGroups ?? 0], ['Sessões', metrics?.trainingSessions ?? 0], ['Pessoas com escolha', metrics?.trainingChoiceParticipants ?? 0]].map(([label, value]) => <Card key={label} className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></CardContent></Card>)}</section><div className="grid gap-3 lg:grid-cols-2">{(data?.trainingGroups || []).map((group: any) => { const sessions = (data?.trainingSessions || []).filter((session: any) => session.training_group_id === group.id); const choices = (data?.trainingChoices || []).filter((choice: any) => choice.training_group_id === group.id); return <Card key={group.id} className="rounded-2xl"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{group.name}</CardTitle><CardDescription className="mt-1">{group.description || 'Sem descrição'}</CardDescription></div>{group.required ? <Badge>Obrigatório</Badge> : <Badge variant="secondary">Opcional</Badge>}</div></CardHeader><CardContent><p className="text-xs text-muted-foreground">{sessions.length} sessão(ões) · {choices.length} escolha(s)</p>{sessions.map((session: any) => <div key={session.id} className="mt-2 rounded-xl border border-border/60 p-3 text-xs"><p className="font-medium text-foreground">{dateTime(session.starts_at)}</p><p className="mt-1 text-muted-foreground">{session.location || 'Local não informado'}{session.capacity ? ` · capacidade ${session.capacity}` : ''}</p></div>)}</CardContent></Card>; })}</div></div>}

    {view === 'execucao' && <div className="space-y-5"><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Equipe ativa', metrics?.team ?? 0], ['Presentes', metrics?.present ?? 0], ['Ausentes', metrics?.absent ?? 0], ['Confirmação pendente', metrics?.pendingConfirmation ?? 0]].map(([label, value]) => <Card key={label} className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></CardContent></Card>)}</section><Card className="rounded-2xl"><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Função</TableHead><TableHead>Local</TableHead><TableHead>Confirmação</TableHead><TableHead>Presença</TableHead></TableRow></TableHeader><TableBody>{(data?.team || []).map((member: any) => <TableRow key={member.id} className={member.absent || member.participation_status === 'replaced' ? 'opacity-55' : ''}><TableCell className="font-medium">{member.collaborator_name}</TableCell><TableCell>{member.assigned_role || member.role_name || '—'}</TableCell><TableCell>{[member.floor, member.room].filter(Boolean).join(' · ') || member.unit || '—'}</TableCell><TableCell><Badge variant="outline">{member.participation_status || 'pending_confirmation'}</Badge></TableCell><TableCell>{member.absent ? <Badge variant="destructive">Ausente</Badge> : member.present || member.signed_at ? <Badge className="bg-emerald-600">Presente</Badge> : <Badge variant="secondary">Pendente</Badge>}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card></div>}

    {view === 'avaliacoes' && <div className="space-y-5"><section className="grid gap-3 sm:grid-cols-3">{[['Avaliações', metrics?.evaluations ?? 0], ['Autoavaliações', metrics?.selfEvaluations ?? 0], ['Equipe oficial', metrics?.team ?? 0]].map(([label, value]) => <Card key={label} className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></CardContent></Card>)}</section><Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Links públicos</CardTitle><CardDescription>Os formulários continuam ligados ao módulo oficial.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to={`/ps/avaliacao/${event.id}`}>Abrir avaliação</Link></Button><Button asChild variant="outline"><Link to={`/ps/autoavaliacao/${event.id}`}>Abrir autoavaliação</Link></Button></CardContent></Card></div>}

    {view === 'financeiro' && <div className="space-y-5"><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Equipe ativa', metrics?.team ?? 0], ['Previsão', money(metrics?.forecastTotal)], ['Com presença', metrics?.payablePeople ?? 0], ['Total com presença', money(metrics?.payableTotal)]].map(([label, value]) => <Card key={label} className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></CardContent></Card>)}</section><Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Previsão por colaborador</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Função</TableHead><TableHead>Presença</TableHead><TableHead className="text-right">Previsto</TableHead></TableRow></TableHeader><TableBody>{(data?.financialRows || []).map((row: any) => <TableRow key={row.id}><TableCell className="font-medium">{row.collaborator_name}</TableCell><TableCell>{row.assigned_role || row.role_name || '—'}</TableCell><TableCell>{row.present || row.signed_at ? <span className="inline-flex items-center gap-1.5 text-emerald-600"><CheckCircle2 className="h-4 w-4" />Confirmada</span> : <span className="text-muted-foreground">Pendente</span>}</TableCell><TableCell className="text-right font-semibold tabular-nums">{money(row.total)}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card></div>}
  </MainLayout>;
}
