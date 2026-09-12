import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, ExternalLink, MapPinned, Search, ShieldCheck, SlidersHorizontal, Users } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PsV2EligibilityDialog } from '@/components/processo-seletivo-v2/PsV2EligibilityDialog';
import { PsV2StaffingDialog } from '@/components/processo-seletivo-v2/PsV2StaffingDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePsEvents } from '@/hooks/useProcessoSeletivo';
import { PS_EVENT_STATUS } from '@/lib/psConstants';
import { PS_V2_BASE_PATH } from '@/lib/psV2Architecture';

const formatDate = (value?: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR') : 'Sem data definida';

export default function PsV2Team() {
  const { data: events = [], isLoading } = usePsEvents();
  const [search, setSearch] = useState('');
  const [eligibilityOpen, setEligibilityOpen] = useState(false);
  const [staffingEventId, setStaffingEventId] = useState<string | null>(null);
  const filteredEvents = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('pt-BR');
    return [...events]
      .filter((event: any) => !needle || [event.name, event.location, PS_EVENT_STATUS[event.status] || event.status].filter(Boolean).some((value) => String(value).toLocaleLowerCase('pt-BR').includes(needle)))
      .sort((a: any, b: any) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [events, search]);

  return <MainLayout>
    <PageHeader title="Equipe e operação" description="Escolha o evento, planeje a demanda e acompanhe as demais áreas do V2 sem alterar a operação oficial." actions={<div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">V2 · paralelo</Badge><Button variant="outline" size="sm" onClick={() => setEligibilityOpen(true)}><SlidersHorizontal className="mr-2 h-4 w-4" />Elegibilidade</Button><Button asChild variant="outline" size="sm"><Link to={PS_V2_BASE_PATH}><ArrowLeft className="mr-2 h-4 w-4" />Central V2</Link></Button></div>} />

    <Card className="mb-5 rounded-2xl border-emerald-500/20 bg-emerald-500/[0.05]"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500"><ShieldCheck className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">O módulo atual continua sendo o ambiente oficial.</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">No V2, planejamento e propostas usam as tabelas isoladas; comunicação, presença, avaliações e financeiro entram inicialmente em modo de leitura.</p></div><Button asChild variant="ghost" size="sm"><Link to="/admin-module/processo-seletivo">Abrir módulo atual <ExternalLink className="ml-2 h-4 w-4" /></Link></Button></CardContent></Card>

    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-base font-semibold">Eventos</h2><p className="mt-1 text-xs text-muted-foreground">A central de cada evento reúne Equipe, Comunicação, Treinamentos, Execução, Avaliações e Financeiro.</p></div><div className="relative w-full sm:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar evento..." className="pl-9" /></div></div>

    {isLoading ? <Card className="rounded-2xl border-dashed"><CardContent className="p-8 text-center text-sm text-muted-foreground">Carregando eventos...</CardContent></Card> : filteredEvents.length ? <div className="grid gap-3 lg:grid-cols-2">{filteredEvents.map((event: any) => {
      const eventBase = `${PS_V2_BASE_PATH}/eventos/${event.id}/equipe`;
      return <Card key={event.id} className="rounded-2xl border-border/60 bg-card/70 transition hover:border-primary/25 hover:shadow-md"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="truncate text-base">{event.name}</CardTitle><CardDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1"><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDate(event.date)}</span><span>{event.location || 'Local ainda não informado'}</span></CardDescription></div><Badge variant={event.status === 'em_andamento' ? 'default' : 'secondary'}>{PS_EVENT_STATUS[event.status] || event.status || 'Sem status'}</Badge></div></CardHeader><CardContent className="space-y-3 border-t border-border/50 pt-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-4 w-4 text-primary" />Planejamento isolado + leitura segura da operação atual.</div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setStaffingEventId(event.id)}><MapPinned className="mr-2 h-3.5 w-3.5" />Necessidades</Button><Button asChild variant="outline" size="sm"><Link to={eventBase}>Alocação</Link></Button><Button asChild variant="outline" size="sm"><Link to={`${eventBase}?view=pendencias`}><AlertTriangle className="mr-2 h-3.5 w-3.5" />Pendências</Link></Button><Button asChild size="sm"><Link to={`${eventBase}?view=overview`}>Central do evento <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div></CardContent></Card>;
    })}</div> : <Card className="rounded-2xl border-dashed"><CardContent className="p-10 text-center"><Users className="mx-auto h-8 w-8 text-muted-foreground/50" /><p className="mt-3 text-sm font-medium">Nenhum evento encontrado.</p></CardContent></Card>}

    <PsV2EligibilityDialog open={eligibilityOpen} onOpenChange={setEligibilityOpen} />
    <PsV2StaffingDialog open={!!staffingEventId} onOpenChange={(open) => { if (!open) setStaffingEventId(null); }} eventId={staffingEventId || undefined} />
  </MainLayout>;
}
