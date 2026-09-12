import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ClipboardCheck, ExternalLink, GraduationCap, Mail, MapPinned, ShieldCheck, Star, Users, WalletCards } from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePsEvent } from '@/hooks/useProcessoSeletivo';
import { usePsV2AllocationReview } from '@/hooks/usePsV2AllocationReview';
import { usePsV2EventReadOnly } from '@/hooks/usePsV2EventReadOnly';
import { usePsV2EventStaffing } from '@/hooks/usePsV2EventStaffing';
import { PS_EVENT_STATUS } from '@/lib/psConstants';
import { PS_V2_BASE_PATH } from '@/lib/psV2Architecture';

const money=(value:unknown)=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const formatDate=(value?:string|null)=>value?new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR'):'Sem data definida';
const normalize=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
const daysToEvent=(value?:string|null)=>{if(!value)return null;const eventDate=new Date(`${value}T12:00:00`);const today=new Date();today.setHours(12,0,0,0);return Math.round((eventDate.getTime()-today.getTime())/86400000);};

type StageStatus='complete'|'active'|'attention'|'pending';
type ActionItem={title:string;detail:string;href:string;label:string;level:'critical'|'warning'|'info'};
const stageTone:Record<StageStatus,string>={complete:'border-emerald-500/25 bg-emerald-500/[0.07]',active:'border-primary/35 bg-primary/[0.07]',attention:'border-amber-500/30 bg-amber-500/[0.07]',pending:'border-border/60 bg-card/60'};
const stageDot:Record<StageStatus,string>={complete:'bg-emerald-500',active:'bg-primary',attention:'bg-amber-500',pending:'bg-muted-foreground/35'};
const actionTone:Record<ActionItem['level'],string>={critical:'border-destructive/25 bg-destructive/[0.05]',warning:'border-amber-500/25 bg-amber-500/[0.05]',info:'border-primary/20 bg-primary/[0.04]'};

export default function PsV2EventOverview(){
  const {eventId}=useParams();
  const {data:event,isLoading:eventLoading}=usePsEvent(eventId);
  const readOnly=usePsV2EventReadOnly(eventId);
  const staffing=usePsV2EventStaffing(eventId);
  const review=usePsV2AllocationReview(eventId);
  const data=readOnly.data; const metrics=data?.metrics; const base=`${PS_V2_BASE_PATH}/eventos/${eventId}/equipe`;
  const requirements=staffing.data?.requirements||[]; const allocationItems=review.data?.items||[]; const allocationRun=review.data?.run||null;
  const eventDays=daysToEvent(event?.date); const statusText=normalize(event?.status); const isFinished=statusText.includes('final')||statusText.includes('conclu');
  const teamCount=Number(metrics?.team||0); const confirmed=Number(metrics?.confirmed||0); const pendingConfirmation=Number(metrics?.pendingConfirmation||0); const declined=Number(metrics?.declined||0);
  const present=Number(metrics?.present||0); const absent=Number(metrics?.absent||0); const attendanceAccounted=present+absent; const communicationFailed=Number(metrics?.communicationFailed||0); const communicationSent=Number(metrics?.communicationSent||0);
  const requiredTrainingGroups=Number(metrics?.requiredTrainingGroups||0); const trainingChoiceParticipants=Number(metrics?.trainingChoiceParticipants||0); const evaluations=Number(metrics?.evaluations||0);

  const actions=useMemo<ActionItem[]>(()=>{const result:ActionItem[]=[];
    if(!teamCount) result.push({level:'critical',title:'Equipe oficial ainda está vazia',detail:'Planeje a demanda e revise uma proposta antes de escalar o evento.',href:base,label:'Abrir alocação'});
    if(communicationFailed>0) result.push({level:'critical',title:`${communicationFailed} comunicação(ões) com falha`,detail:'Revise os destinatários e os erros registrados antes de novos envios.',href:`${base}?view=comunicacao`,label:'Ver comunicação'});
    if(pendingConfirmation>0) result.push({level:'warning',title:`${pendingConfirmation} confirmação(ões) pendente(s)`,detail:`${confirmed} de ${teamCount} integrantes ativos já confirmaram participação.`,href:`${base}?view=comunicacao`,label:'Acompanhar confirmações'});
    if(declined>0) result.push({level:'warning',title:`${declined} recusa(s) registrada(s)`,detail:'Verifique se será necessário substituir integrantes antes do evento.',href:base,label:'Revisar equipe'});
    if(requiredTrainingGroups>0&&confirmed>0&&trainingChoiceParticipants<confirmed) result.push({level:'warning',title:'Treinamentos obrigatórios precisam de acompanhamento',detail:`${trainingChoiceParticipants} pessoa(s) possuem escolha registrada para ${requiredTrainingGroups} grupo(s) obrigatório(s).`,href:`${base}?view=treinamentos`,label:'Ver treinamentos'});
    if(eventDays!=null&&eventDays<=0&&teamCount>attendanceAccounted) result.push({level:'warning',title:`${teamCount-attendanceAccounted} presença(s) ainda sem registro`,detail:'A central está somente em leitura; o lançamento continua sendo feito no módulo oficial.',href:`${base}?view=execucao`,label:'Ver execução'});
    if(eventDays!=null&&eventDays<0&&present>0&&evaluations<present) result.push({level:'info',title:'Avaliações ainda podem estar incompletas',detail:`${evaluations} avaliação(ões) para ${present} presença(s) confirmada(s).`,href:`${base}?view=avaliacoes`,label:'Ver avaliações'});
    return result.slice(0,6);
  },[attendanceAccounted,base,communicationFailed,confirmed,declined,evaluations,eventDays,pendingConfirmation,present,requiredTrainingGroups,teamCount,trainingChoiceParticipants]);

  const workflow=useMemo(()=>{const staffingReady=staffing.data?.schemaReady!==false; const planningStatus:StageStatus=!staffingReady?'pending':requirements.length>0?'complete':'attention'; const teamStatus:StageStatus=teamCount>0?'complete':'attention';
    const communicationStatus:StageStatus=!teamCount?'pending':communicationFailed>0?'attention':pendingConfirmation>0?'active':confirmed>=teamCount?'complete':communicationSent>0?'active':'pending';
    const trainingStatus:StageStatus=requiredTrainingGroups===0?'complete':confirmed>0&&trainingChoiceParticipants>=confirmed?'complete':trainingChoiceParticipants>0?'active':'pending';
    let executionStatus:StageStatus='pending'; if(eventDays===0)executionStatus='active'; if(eventDays!=null&&eventDays<0)executionStatus=attendanceAccounted>=teamCount&&teamCount>0?'complete':'attention';
    let evaluationStatus:StageStatus='pending'; if(eventDays!=null&&eventDays<0&&present>0)evaluationStatus=evaluations>=present?'complete':evaluations>0?'active':'pending';
    let paymentStatus:StageStatus='pending'; if(eventDays!=null&&eventDays<0&&Number(metrics?.payablePeople||0)>0)paymentStatus=isFinished?'complete':'active';
    const closingStatus:StageStatus=isFinished?'complete':eventDays!=null&&eventDays<0&&actions.length===0?'active':'pending';
    return [
      {label:'Planejamento',status:planningStatus,detail:staffingReady?`${requirements.length} regra(s)`:'Aguardando V2'},
      {label:'Equipe',status:teamStatus,detail:`${teamCount} escalado(s)`},
      {label:'Comunicação',status:communicationStatus,detail:`${confirmed}/${teamCount} confirmados`},
      {label:'Treinamentos',status:trainingStatus,detail:`${requiredTrainingGroups} obrigatório(s)`},
      {label:'Execução',status:executionStatus,detail:eventDays==null?'Sem data':eventDays>0?`em ${eventDays} dia(s)`:eventDays===0?'Hoje':`${present} presentes`},
      {label:'Avaliações',status:evaluationStatus,detail:`${evaluations} registradas`},
      {label:'Pagamentos',status:paymentStatus,detail:money(metrics?.payableTotal)},
      {label:'Encerramento',status:closingStatus,detail:isFinished?'Finalizado':'Pendente'},
    ];
  },[actions.length,attendanceAccounted,communicationFailed,communicationSent,confirmed,evaluations,eventDays,isFinished,metrics?.payablePeople,metrics?.payableTotal,pendingConfirmation,present,requiredTrainingGroups,requirements.length,staffing.data?.schemaReady,teamCount,trainingChoiceParticipants]);

  const modules=[
    {title:'Equipe',description:'Necessidades, proposta e revisão da escala.',icon:Users,href:base,badge:allocationRun?`${allocationItems.length} vaga(s)`:'Planejar'},
    {title:'Comunicação',description:'Confirmações, envios e falhas.',icon:Mail,href:`${base}?view=comunicacao`,badge:`${communicationFailed} falha(s)`},
    {title:'Treinamentos',description:'Grupos, sessões e escolhas registradas.',icon:GraduationCap,href:`${base}?view=treinamentos`,badge:`${Number(metrics?.trainingGroups||0)} grupo(s)`},
    {title:'Dia do evento',description:'Presença e situação operacional.',icon:ClipboardCheck,href:`${base}?view=execucao`,badge:`${present}/${teamCount}`},
    {title:'Avaliações',description:'Avaliações e autoavaliações.',icon:Star,href:`${base}?view=avaliacoes`,badge:`${evaluations} registro(s)`},
    {title:'Financeiro',description:'Previsão e valores com presença.',icon:WalletCards,href:`${base}?view=financeiro`,badge:money(metrics?.forecastTotal)},
  ];

  if(eventLoading||readOnly.isLoading)return <MainLayout><div className="py-16 text-center text-sm text-muted-foreground">Carregando central do evento...</div></MainLayout>;
  if(!event)return <MainLayout><Card className="rounded-2xl border-dashed"><CardContent className="p-10 text-center"><p className="text-sm font-medium">Evento não encontrado.</p><Button asChild variant="outline" size="sm" className="mt-4"><Link to={PS_V2_BASE_PATH}>Voltar</Link></Button></CardContent></Card></MainLayout>;

  return <MainLayout>
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Link to={PS_V2_BASE_PATH} className="hover:text-foreground">Processo Seletivo 2</Link><span>/</span><span className="max-w-[420px] truncate text-foreground">{event.name}</span></div>
    <PageHeader title={event.name} description={`${formatDate(event.date)} · ${event.location||'Local não informado'} · Central operacional V2`} actions={<div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">V2 · leitura segura</Badge><Badge variant={event.status==='em_andamento'?'default':'secondary'}>{PS_EVENT_STATUS[event.status]||event.status||'Sem status'}</Badge><Button asChild variant="outline" size="sm"><Link to={`/admin-module/processo-seletivo/eventos/${event.id}`}>Módulo oficial <ExternalLink className="ml-2 h-4 w-4"/></Link></Button></div>} />
    <Card className="mb-5 rounded-2xl border-emerald-500/20 bg-emerald-500/[0.05]"><CardContent className="flex gap-3 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500"/><div><p className="text-sm font-semibold">Modo seguro: o módulo atual continua sendo o ambiente oficial.</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">A Central V2 consolida dados e aponta pendências, mas não envia mensagens, altera presença, avaliações, pagamentos ou a equipe oficial.</p></div></CardContent></Card>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{[
      ['Equipe escalada',teamCount,`${confirmed} confirmados`,Users],['Confirmações',`${teamCount?Math.round((confirmed/teamCount)*100):0}%`,`${pendingConfirmation} pendentes`,CheckCircle2],['Presentes',present,`${absent} ausentes`,ClipboardCheck],['Avaliações',evaluations,`${Number(metrics?.selfEvaluations||0)} autoavaliações`,Star],['Pagamentos previstos',money(metrics?.forecastTotal),`${Number(metrics?.payablePeople||0)} com presença`,WalletCards],['Pendências',actions.length,actions.length?'Requer atenção':'Sem alertas críticos',AlertTriangle],
    ].map(([label,value,detail,Icon]:any)=><Card key={label} className={`rounded-2xl border-border/60 bg-card/70 ${label==='Pendências'&&actions.length?'border-amber-500/25 bg-amber-500/[0.04]':''}`}><CardContent className="flex items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-1.5 truncate text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p></div><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5"/></div></CardContent></Card>)}</section>
    <section className="mt-5"><div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-base font-semibold">Fluxo operacional</h2><p className="mt-1 text-xs text-muted-foreground">Leitura automática do estágio atual do evento.</p></div>{eventDays!=null&&<div className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="h-4 w-4"/>{eventDays>0?`Faltam ${eventDays} dia(s)`:eventDays===0?'Evento hoje':`Evento ocorreu há ${Math.abs(eventDays)} dia(s)`}</div>}</div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">{workflow.map((step,index)=><Card key={step.label} className={`rounded-xl ${stageTone[step.status]}`}><CardContent className="p-3"><div className="flex items-center justify-between gap-2"><span className={`h-2.5 w-2.5 rounded-full ${stageDot[step.status]}`}/><span className="text-[10px] font-medium text-muted-foreground">{String(index+1).padStart(2,'0')}</span></div><p className="mt-3 text-xs font-semibold">{step.label}</p><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{step.detail}</p></CardContent></Card>)}</div></section>
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section><div className="mb-3"><h2 className="text-base font-semibold">Operação do evento</h2><p className="mt-1 text-xs text-muted-foreground">Entre em cada área sem perder o contexto deste evento.</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{modules.map(module=>{const Icon=module.icon;return <Link key={module.title} to={module.href}><Card className="group h-full rounded-2xl border-border/60 bg-card/70 transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5"/></div><Badge variant="outline" className="max-w-[150px] truncate text-[10px]">{module.badge}</Badge></div><div className="mt-4 flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{module.title}</h3><p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{module.description}</p></div><ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:text-primary"/></div></CardContent></Card></Link>;})}</div></section>
      <aside className="space-y-4"><Card className="rounded-2xl border-border/60 bg-card/70"><CardHeader className="pb-3"><CardTitle className="text-base">Pendências e próximas ações</CardTitle><CardDescription>Prioridades sugeridas a partir dos dados atuais.</CardDescription></CardHeader><CardContent className="space-y-2.5">{actions.length?actions.map(item=><div key={`${item.title}-${item.href}`} className={`rounded-xl border p-3 ${actionTone[item.level]}`}><div className="flex gap-2.5"><AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${item.level==='critical'?'text-destructive':item.level==='warning'?'text-amber-500':'text-primary'}`}/><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p><Button asChild variant="ghost" size="sm" className="mt-1.5 h-7 px-0 text-xs hover:bg-transparent"><Link to={item.href}>{item.label}<ArrowRight className="ml-1.5 h-3.5 w-3.5"/></Link></Button></div></div></div>):<div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-emerald-500"/><p className="mt-2 text-sm font-semibold">Nenhuma pendência crítica detectada.</p><p className="mt-1 text-xs text-muted-foreground">Continue acompanhando o fluxo até o encerramento.</p></div>}</CardContent></Card>
      <Card className="rounded-2xl border-primary/20 bg-primary/[0.04]"><CardContent className="p-4"><div className="flex gap-3"><MapPinned className="mt-0.5 h-5 w-5 shrink-0 text-primary"/><div><p className="text-sm font-semibold">Atalho inteligente</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{actions[0]?.title||'O evento não possui uma prioridade crítica detectada agora.'}</p></div></div>{actions[0]?<Button asChild size="sm" className="mt-3 w-full"><Link to={actions[0].href}>{actions[0].label}<ArrowRight className="ml-2 h-4 w-4"/></Link></Button>:<Button asChild variant="outline" size="sm" className="mt-3 w-full"><Link to={base}>Revisar equipe e alocação<ArrowRight className="ml-2 h-4 w-4"/></Link></Button>}</CardContent></Card></aside>
    </div>
  </MainLayout>;
}
