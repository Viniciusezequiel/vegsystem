import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ExternalLink,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePsEvents } from '@/hooks/useProcessoSeletivo';
import { PS_EVENT_STATUS } from '@/lib/psConstants';
import { PS_V2_BASE_PATH } from '@/lib/psV2Architecture';

const formatDate = (value?: string | null) => {
  if (!value) return 'Sem data definida';
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');
};

export default function PsV2Team() {
  const { data: events = [], isLoading } = usePsEvents();
  const [search, setSearch] = useState('');

  const filteredEvents = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('pt-BR');
    return [...events]
      .filter((event: any) => {
        if (!needle) return true;
        return [event.name, event.location, PS_EVENT_STATUS[event.status] || event.status]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase('pt-BR').includes(needle));
      })
      .sort((a: any, b: any) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [events, search]);

  return (
    <MainLayout>
      <PageHeader
        title="Equipe e alocação"
        description="Selecione um evento para revisar a proposta de alocação antes de publicar qualquer alteração na equipe oficial."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">V2 · paralelo</Badge>
            <Button asChild variant="outline" size="sm">
              <Link to={PS_V2_BASE_PATH}><ArrowLeft className="mr-2 h-4 w-4" />Central V2</Link>
            </Button>
          </div>
        )}
      />

      <Card className="mb-5 rounded-2xl border-emerald-500/20 bg-emerald-500/[0.05]">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">O Processo Seletivo atual continua sendo o ambiente oficial.</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              O V2 trabalha em paralelo. Uma proposta só entra na equipe oficial depois de ser revisada e publicada de forma explícita.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link to="/admin-module/processo-seletivo">Abrir módulo atual <ExternalLink className="ml-2 h-4 w-4" /></Link>
          </Button>
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Eventos</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Abra a área de equipe do V2 sem interferir na operação vigente.</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar evento..." className="pl-9" />
        </div>
      </div>

      {isLoading ? (
        <Card className="rounded-2xl border-dashed"><CardContent className="p-8 text-center text-sm text-muted-foreground">Carregando eventos...</CardContent></Card>
      ) : filteredEvents.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {filteredEvents.map((event: any) => (
            <Card key={event.id} className="rounded-2xl border-border/60 bg-card/70 transition hover:border-primary/25 hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{event.name}</CardTitle>
                    <CardDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDate(event.date)}</span>
                      <span>{event.location || 'Local ainda não informado'}</span>
                    </CardDescription>
                  </div>
                  <Badge variant={event.status === 'em_andamento' ? 'default' : 'secondary'}>
                    {PS_EVENT_STATUS[event.status] || event.status || 'Sem status'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-4 w-4 text-primary" />
                  Revisão e publicação controlada da equipe
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/admin-module/processo-seletivo/eventos/${event.id}`}>Equipe atual <ExternalLink className="ml-2 h-3.5 w-3.5" /></Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link to={`${PS_V2_BASE_PATH}/eventos/${event.id}/equipe`}>Abrir alocação <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="p-10 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">Nenhum evento encontrado.</p>
            <p className="mt-1 text-xs text-muted-foreground">Ajuste a busca ou cadastre o evento no módulo atual.</p>
          </CardContent>
        </Card>
      )}
    </MainLayout>
  );
}
