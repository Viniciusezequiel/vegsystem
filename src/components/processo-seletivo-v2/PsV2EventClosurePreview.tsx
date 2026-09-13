import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, CircleDot } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePsEvent } from '@/hooks/useProcessoSeletivo';
import { usePsV2EventReadOnly } from '@/hooks/usePsV2EventReadOnly';
import { PS_V2_BASE_PATH } from '@/lib/psV2Architecture';

export default function PsV2EventClosurePreview(){
  const {eventId}=useParams();
  const {data:event,isLoading}=usePsEvent(eventId);
  const query=usePsV2EventReadOnly(eventId); const m=query.data?.metrics;
  const base=`${PS_V2_BASE_PATH}/eventos/${eventId}/equipe`;
  if(isLoading||query.isLoading)return <MainLayout><div className="p-10 text-center">Conferindo encerramento...</div></MainLayout>;
  if(!event)return <MainLayout><div className="p-10 text-center">Evento não encontrado.</div></MainLayout>;
  const checks=[['Equipe definida',Number(m?.team||0)>0],['Confirmações resolvidas',Number(m?.pendingConfirmation||0)===0],['Comunicações sem falha',Number(m?.communicationFailed||0)===0],['Presenças registradas',Number(m?.team||0)===0||Number(m?.present||0)+Number(m?.absent||0)>=Number(m?.team||0)],['Avaliações acompanhadas',Number(m?.present||0)===0||Number(m?.evaluations||0)>=Number(m?.present||0)]] as const;
  const done=checks.filter(([,ok])=>ok).length;
  return <MainLayout><PageHeader title="Prévia de encerramento" description={`${event.name} · conferência final sem alterar o status`} actions={<Button asChild variant="outline" size="sm"><Link to={`${base}?view=overview`}>Voltar ao evento</Link></Button>}/><Card className="mb-4"><CardContent className="p-4 text-sm">O V2 apenas confere. A finalização oficial continua bloqueada aqui.</CardContent></Card><Card><CardContent className="p-5"><p className="mb-4 font-semibold">Checklist final · {done}/{checks.length}</p><div className="space-y-2">{checks.map(([label,ok])=><div key={label} className="flex items-center gap-3 rounded-xl border p-3">{ok?<CheckCircle2 className="h-5 w-5 text-emerald-500"/>:<CircleDot className="h-5 w-5 text-amber-500"/>}<span className="text-sm">{label}</span></div>)}</div></CardContent></Card></MainLayout>;
}
