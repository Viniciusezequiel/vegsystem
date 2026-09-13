import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ExternalLink, FileSpreadsheet, FileText, Search, ShieldCheck, Users } from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PsEventDocumentsPanel } from '@/components/processo-seletivo/PsEventDocumentsPanel';
import { PsV2PreparationAudit } from '@/components/processo-seletivo-v2/PsV2PreparationAudit';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePsCandidates, usePsEvent, usePsEventCollaborators } from '@/hooks/useProcessoSeletivo';
import { PS_EVENT_STATUS } from '@/lib/psConstants';
import { PS_V2_BASE_PATH } from '@/lib/psV2Architecture';
import { exportPsV2PreparationWorkbook } from '@/lib/psV2PreparationExport';

const formatDate = (value?: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem data definida';

export default function PsV2EventPreparation() {
  const { eventId } = useParams();
  const { data: event, isLoading: eventLoading } = usePsEvent(eventId);
  const { data: candidates = [], isLoading: candidatesLoading } = usePsCandidates(eventId);
  const { data: team = [], isLoading: teamLoading } = usePsEventCollaborators(eventId);
  const [search, setSearch] = useState('');
  const base = `${PS_V2_BASE_PATH}/eventos/${eventId}/equipe`;

  const filteredCandidates = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('pt-BR');
    if (!needle) return candidates;
    return candidates.filter((candidate: any) => [candidate.full_name, candidate.registration_number, candidate.campus, candidate.room, candidate.seat_number || candidate.seat]
      .filter(Boolean).some((value) => String(value).toLocaleLowerCase('pt-BR').includes(needle)));
  }, [candidates, search]);

  const activeTeam = team.filter((item: any) => item.participation_status !== 'replaced');
  const pcdCandidates = candidates.filter((item: any) => !!item.pcd_type).length;
  const roomCount = new Set(candidates.map((item: any) => [item.campus, item.room].filter(Boolean).join('|')).filter(Boolean)).size;

  if (eventLoading || candidatesLoading || teamLoading) return <MainLayout><div className="py-16 text-center text-sm text-muted-foreground">Carregando preparação...</div></MainLayout>;
  if (!event) return <MainLayout><Card className="rounded-2xl border-dashed"><CardContent className="p-10 text-center">Evento não encontrado.</CardContent></Card></MainLayout>;

  return <MainLayout>
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Link to={PS_V2_BASE_PATH} className="hover:text-foreground">Processo Seletivo 2</Link><span>/</span><Link to={`${base}?view=overview`} className="hover:text-foreground">{event.name}</Link><span>/</span><span className="text-foreground">Preparação</span></div>
    <PageHeader title="Preparação e etiquetas" description={`${event.name} · ${formatDate(event.date)} · candidatos, conferência e documentos em uma única área`} actions={<div className="flex flex-wrap gap-2"><Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">V2 · seguro</Badge><Badge variant={event.status === 'em_andamento' ? 'default' : 'secondary'}>{PS_EVENT_STATUS[event.status] || event.status || 'Sem status'}</Badge><Button asChild variant="outline" size="sm"><Link to={`${base}?view=prontidao`}><CheckCircle2 className="mr-2 h-4 w-4" />Prontidão</Link></Button><Button variant="outline" size="sm" disabled={!candidates.length && !activeTeam.length} onClick={() => exportPsV2PreparationWorkbook(event, candidates as any[], team as any[])}><FileSpreadsheet className="mr-2 h-4 w-4" />XLSX</Button><Button asChild variant="outline" size="sm"><Link to={`${base}?view=overview`}><ArrowLeft className="mr-2 h-4 w-4" />Evento</Link></Button><Button asChild variant="outline" size="sm"><Link to={`/admin-module/processo-seletivo/eventos/${event.id}`}>Módulo oficial <ExternalLink className="ml-2 h-4 w-4" /></Link></Button></div>} />

    <Card className="mb-5 rounded-2xl border-emerald-500/20 bg-emerald-500/[0.05]"><CardContent className="flex gap-3 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /><div><p className="text-sm font-semibold">Esta área não altera candidatos nem a equipe oficial.</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">A consulta e a conferência são somente leitura. PDFs e XLSX são gerados no navegador e não modificam o Processo Seletivo atual.</p></div></CardContent></Card>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Candidatos</p><p className="mt-1 text-2xl font-semibold">{candidates.length}</p></CardContent></Card>
      <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Salas</p><p className="mt-1 text-2xl font-semibold">{roomCount}</p></CardContent></Card>
      <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">PCD / atendimento</p><p className="mt-1 text-2xl font-semibold">{pcdCandidates}</p></CardContent></Card>
      <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Equipe ativa</p><p className="mt-1 text-2xl font-semibold">{activeTeam.length}</p></CardContent></Card>
      <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Documentos</p><p className="mt-1 flex items-center gap-2 text-lg font-semibold"><FileText className="h-5 w-5 text-primary" />PDF / XLSX</p></CardContent></Card>
    </section>

    <div className="mt-5 space-y-5">
      <PsV2PreparationAudit candidates={candidates as any[]} />

      <Card className="rounded-2xl border-border/60 bg-card/70"><CardHeader className="pb-3"><CardTitle className="text-base">Etiquetas e documentos</CardTitle><CardDescription>Use os dados atuais do evento para gerar os PDFs já suportados pelo sistema.</CardDescription></CardHeader><CardContent><PsEventDocumentsPanel event={event} /></CardContent></Card>

      <Card className="rounded-2xl border-border/60 bg-card/70"><CardHeader className="pb-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><CardTitle className="text-base">Candidatos do evento</CardTitle><CardDescription className="mt-1">Consulta rápida para conferência antes da impressão.</CardDescription></div><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar candidato..." className="pl-9" /></div></div></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Inscrição</TableHead><TableHead>Campus / sala</TableHead><TableHead>Assento</TableHead><TableHead>Observação</TableHead></TableRow></TableHeader><TableBody>{filteredCandidates.slice(0, 100).map((candidate: any) => <TableRow key={candidate.id}><TableCell className="font-medium">{candidate.full_name}</TableCell><TableCell>{candidate.registration_number || '—'}</TableCell><TableCell>{[candidate.campus, candidate.room].filter(Boolean).join(' · ') || '—'}</TableCell><TableCell>{candidate.seat_number || candidate.seat || '—'}</TableCell><TableCell>{candidate.pcd_type ? <Badge variant="outline">{candidate.pcd_type}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell></TableRow>)}</TableBody></Table></div>{!filteredCandidates.length && <div className="p-8 text-center"><Users className="mx-auto h-8 w-8 text-muted-foreground/40" /><p className="mt-2 text-sm text-muted-foreground">Nenhum candidato corresponde à busca.</p></div>}{filteredCandidates.length > 100 && <p className="border-t border-border/50 p-3 text-center text-xs text-muted-foreground">Exibindo os 100 primeiros de {filteredCandidates.length} candidatos encontrados.</p>}</CardContent></Card>
    </div>
  </MainLayout>;
}
