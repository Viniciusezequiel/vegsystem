import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { PenLine, CheckCircle2, Search, ArrowLeft, ShieldCheck } from 'lucide-react';
import { usePsEvents } from '@/hooks/useProcessoSeletivo';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { submitPublicProcessSelectionSignature } from '@/lib/signatureStorage';

export default function PsPublicAttendance() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { eventId: routeEventId, eventCollaboratorId: routeSelectedId } = useParams();
  const { data: events = [] } = usePsEvents();
  const [eventId, setEventId] = useState(routeEventId || '');
  const [selectedId, setSelectedId] = useState(routeSelectedId || '');
  const [search, setSearch] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (routeEventId) setEventId(routeEventId);
  }, [routeEventId]);

  useEffect(() => {
    if (routeSelectedId) setSelectedId(routeSelectedId);
    else if (!routeSelectedId && selectedId) setSelectedId('');
  }, [routeSelectedId, selectedId]);

  const { data: links = [], isLoading, error, refetch } = useQuery({
    queryKey: ['ps_public_roster', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ps_public_search_event_roster', {
        p_event_id: eventId,
        p_search: '',
      });
      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        matricula_masked: row.matricula_masked ?? null,
        email_masked: row.email_masked ?? null,
      }));
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return links;
    return links.filter((l: any) => {
      const haystack = [
        l.collaborator_name,
        l.role_name,
        l.assigned_role,
        l.sector,
        l.unit,
        l.floor,
        l.room,
        l.building,
        l.email_masked,
        l.matricula_masked,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [links, search]);

  const visibleLinks = useMemo(() => {
    return [...filtered].sort((a: any, b: any) => {
      const signedOrder = Number(!!a.signed_at) - Number(!!b.signed_at);
      if (signedOrder !== 0) return signedOrder;
      return String(a.collaborator_name || '').localeCompare(
        String(b.collaborator_name || ''),
        'pt-BR'
      );
    });
  }, [filtered]);

  const signedCount = links.filter((l: any) => !!l.signed_at).length;
  const pendingCount = Math.max(0, links.length - signedCount);

  const currentSelectedId = routeSelectedId || selectedId;
  const selected = links.find((l: any) => l.id === currentSelectedId) ?? null;

  useEffect(() => {
    if (!eventId) return;
    const channel = supabase.channel(`ps:event:${eventId}`)
      .on('broadcast', { event: 'roster_changed' }, (payload) => {
        const payloadEventId = payload?.payload?.event_id;
        if (payloadEventId && payloadEventId !== eventId) return;
        queryClient.invalidateQueries({ queryKey: ['ps_public_roster', eventId] });
        void refetch();
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [eventId, queryClient, refetch]);

  useEffect(() => {
    if (!routeSelectedId && !selectedId) return;
    const validSelected = links.some((l: any) => l.id === currentSelectedId);
    if (!validSelected && eventId) {
      setSelectedId('');
      navigate(`/ps/presenca/${eventId}`, { replace: true });
    }
  }, [currentSelectedId, eventId, links, navigate, routeSelectedId, selectedId]);

  useEffect(() => {
    if (!selected || !currentSelectedId || done) return;
    if (selected.signed_at) {
      setSignature(null);
      setSaving(false);
      toast.error('Esta presença já foi registrada em outro dispositivo.');
    }
  }, [selected, currentSelectedId, done]);

  const resetToList = () => {
    setSelectedId('');
    setSignature(null);
    setDone(false);
    setSaving(false);
    if (eventId) {
      navigate(`/ps/presenca/${eventId}`, { replace: true });
    }
  };

  const goBackToList = () => {
    if (signature && !saving && !done) {
      const shouldDiscard = window.confirm('Descartar assinatura e voltar para a lista?');
      if (!shouldDiscard) return;
    }
    resetToList();
  };

  const submit = async () => {
    if (!selected) {
      toast.error('Selecione seu nome na lista antes de confirmar.');
      return;
    }
    if (!signature) {
      toast.error('Assine no campo indicado antes de confirmar a presença.');
      return;
    }
    if (saving) return;

    setSaving(true);
    try {
      const linkId = selected.id;
      await submitPublicProcessSelectionSignature(linkId, signature);

      const signedAt = new Date().toISOString();

      queryClient.setQueryData<any[]>(
        ['ps_public_roster', eventId],
        (current = []) =>
          current.map((item: any) =>
            item.id === linkId
              ? { ...item, signed_at: signedAt }
              : item
          )
      );

      toast.success(`Presença registrada para ${selected.collaborator_name}.`);

      setSignature(null);
      setDone(false);
      setSelectedId('');
      navigate(`/ps/presenca/${eventId}`, { replace: true });

      // Atualiza com o banco em segundo plano, sem travar a próxima assinatura.
      void refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar a assinatura.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenSignature = (link: any) => {
    if (link.signed_at) {
      toast.info('Presença já registrada.');
      return;
    }
    setSelectedId(link.id);
    setSignature(null);
    setDone(false);
    navigate(`/ps/presenca/${eventId}/${link.id}`);
  };

  const handleEventChange = (nextEventId: string) => {
    setEventId(nextEventId);
    setSelectedId('');
    setSignature(null);
    setDone(false);
    setSearch('');
    navigate(`/ps/presenca/${nextEventId}`);
  };

  if (done && selected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-lg rounded-2xl border border-emerald-200 bg-white shadow-sm">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl">Presença registrada com sucesso.</CardTitle>
              <CardDescription className="text-base text-muted-foreground">
                {selected.collaborator_name}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" size="lg" onClick={resetToList}>
              Voltar para Lista de Presença
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentSelectedId && selected) {
    return (
      <div className="min-h-screen bg-muted/30 p-4">
        <div className="mx-auto max-w-3xl py-6">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="space-y-4 border-b bg-background/80 p-5">
              <Button variant="ghost" className="w-fit gap-2 px-2 text-sm" onClick={goBackToList}>
                <ArrowLeft className="h-4 w-4" />
                Voltar para lista
              </Button>

              <div className="space-y-3 text-center md:text-left">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  CONFIRA O NOME ANTES DE ASSINAR
                </p>
                <h1 className="text-3xl font-black leading-tight md:text-4xl">
                  Você está registrando presença de
                </h1>
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                  <p className="text-2xl font-bold text-primary md:text-3xl">{selected.collaborator_name}</p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 p-5 md:p-7">
              <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 text-sm md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Cargo</p>
                  <p className="mt-1 font-semibold">{selected.role_name || selected.assigned_role || 'Cargo não informado'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Evento</p>
                  <p className="mt-1 font-semibold">{events.find((event: any) => event.id === eventId)?.name || 'Evento'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Unidade / Sala</p>
                  <p className="mt-1 font-semibold">{[selected.sector || selected.unit, selected.floor, selected.room && `Sala ${selected.room}`].filter(Boolean).join(' • ') || 'Não informado'}</p>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4" />
                  A assinatura fica vinculada ao fiscal selecionado abaixo.
                </div>
                <p>Não é possível trocar o fiscal nesta etapa sem voltar à lista.</p>
              </div>

              <SignaturePad onSignatureChange={setSignature} height={240} />

              <div className="flex flex-col gap-3 pt-2 md:flex-row">
                <Button type="button" variant="outline" className="h-12 flex-1" onClick={goBackToList}>
                  Voltar para lista
                </Button>
                <Button type="button" className="h-12 flex-1" size="lg" onClick={submit} disabled={saving || !signature}>
                  {saving ? 'Registrando presença...' : 'CONFIRMAR PRESENÇA'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (currentSelectedId && !selected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md rounded-2xl text-center">
          <CardHeader>
            <CardTitle>Presença já registrada.</CardTitle>
            <CardDescription>Esse fiscal não está disponível para nova assinatura nesta etapa.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={resetToList}>Voltar para lista</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="mx-auto max-w-2xl space-y-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <PenLine className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Lista de Presença</h1>
            <p className="text-muted-foreground">Selecione o fiscal e confirme a presença em uma etapa dedicada.</p>
          </div>
        </div>

        <Card className="rounded-2xl">
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label>Evento</Label>
              <Select value={eventId} onValueChange={handleEventChange}>
                <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
                <SelectContent>
                  {events.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar fiscal por nome, cargo, unidade, andar ou sala" value={search} onChange={(e) => setSearch(e.target.value)} disabled={!eventId} />
            </div>

            {eventId && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">{pendingCount} pendentes</Badge>
                <Badge variant="secondary">{signedCount} assinados</Badge>
                <span className="ml-auto text-muted-foreground">
                  {links.length} fiscais no evento
                </span>
              </div>
            )}

            <div className="max-h-[60vh] divide-y overflow-y-auto rounded-xl border">
              {isLoading && <p className="p-3 text-sm text-muted-foreground">Carregando fiscais...</p>}
              {!isLoading && !error && filtered.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">{search ? 'Nenhum fiscal encontrado para esta busca.' : 'Nenhum fiscal vinculado a este evento.'}</p>
              )}
              {!isLoading && error && (
                <div className="space-y-2 p-3">
                  <p className="text-sm text-destructive">Não foi possível carregar a lista de presença.</p>
                  <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Tentar novamente</Button>
                </div>
              )}
              {!isLoading && !error && visibleLinks.map((l: any) => {
                const isAlreadySigned = !!l.signed_at;
                const isActive = selectedId === l.id;

                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => handleOpenSignature(l)}
                    disabled={isAlreadySigned}
                    className={`flex min-h-16 w-full items-center justify-between gap-2 p-3 text-left text-sm transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-70 ${isActive ? 'bg-primary/10' : ''}`}
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground">{l.collaborator_name}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {[l.role_name || l.assigned_role, l.unit, l.floor, l.room && `Sala ${l.room}`].filter(Boolean).join(' • ')}
                      </span>
                    </span>
                    <span className="flex flex-wrap justify-end gap-1">
                      {isAlreadySigned ? <Badge variant="secondary">Presença já registrada</Badge> : <Badge className="bg-primary/10 text-primary">Selecionar</Badge>}
                    </span>
                  </button>
                );
              })}
              {!eventId && <p className="p-3 text-sm text-muted-foreground">Selecione um evento.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
