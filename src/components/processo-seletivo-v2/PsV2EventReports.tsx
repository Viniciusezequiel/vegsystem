import { Link, useParams } from 'react-router-dom';
import { FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePsCandidates, usePsEvent } from '@/hooks/useProcessoSeletivo';
import { usePsV2EventReadOnly } from '@/hooks/usePsV2EventReadOnly';
import { exportPsV2EventWorkbook } from '@/lib/psV2EventExport';
import { PS_V2_BASE_PATH } from '@/lib/psV2Architecture';

export default function PsV2EventReports() {
  const { eventId } = useParams();
  const { data: event, isLoading: eventLoading } = usePsEvent(eventId);
  const { data: candidates = [], isLoading: candidatesLoading } = usePsCandidates(eventId);
  const query = usePsV2EventReadOnly(eventId);
  const data = query.data;
  const metrics = data?.metrics;
  const base = `${PS_V2_BASE_PATH}/eventos/${eventId}/equipe`;
  if (eventLoading || candidatesLoading || query.isLoading) return <MainLayout><div className="py-16 text-center text-sm text-muted-foreground">Preparando relatórios...</div></MainLayout>;
  if (!event) return <MainLayout><div className="p-10 text-center">Evento não encontrado.</div></MainLayout>;
  const cards = [
    ['Candidatos', candidates.length],
    ['Equipe', Number(metrics?.team || 0)],
    ['Confirmados', Number(metrics?.confirmed || 0)],
    ['Presentes', Number(metrics?.present || 0)],
    ['Avaliações', Number(metrics?.evaluations || 0)],
    ['Falhas', Number(metrics?.communicationFailed || 0)],
  ];
  return <MainLayout>
    <PageHeader title="Relatórios e exportações" description={`${event.name} · consolidação segura do evento`} actions={<div className="flex gap-2"><Button asChild variant="outline" size="sm"><Link to={`${base}?view=overview`}>Evento</Link></Button><Button size="sm" onClick={() => exportPsV2EventWorkbook(event, candidates as any[], data)}><FileSpreadsheet className="mr-2 h-4 w-4" />XLSX completo</Button></div>} />
    <Card className="mb-5 border-emerald-500/20 bg-emerald-500/[0.05]"><CardContent className="flex gap-3 p-4"><ShieldCheck className="h-5 w-5 text-emerald-500" /><p className="text-sm">Somente leitura. A exportação não altera o módulo oficial.</p></CardContent></Card>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{cards.map(([label, value]) => <Card key={String(label)}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></CardContent></Card>)}</section>
    <Card className="mt-5"><CardContent className="p-5"><p className="text-sm text-muted-foreground">O XLSX reúne Resumo, Equipe, Candidatos, Comunicações, Treinamentos, Avaliações, Autoavaliações e Financeiro.</p><Button className="mt-4" onClick={() => exportPsV2EventWorkbook(event, candidates as any[], data)}><FileSpreadsheet className="mr-2 h-4 w-4" />Gerar arquivo consolidado</Button></CardContent></Card>
  </MainLayout>;
}
