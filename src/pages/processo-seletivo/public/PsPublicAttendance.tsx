import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { PenLine, Search, ArrowLeft, ShieldCheck } from 'lucide-react';
import { usePsEvents, usePsRoles } from '@/hooks/useProcessoSeletivo';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { submitPublicProcessSelectionSignature } from '@/lib/signatureStorage';

export default function PsPublicAttendance() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { eventId: routeEventId, eventCollaboratorId: routeSelectedId } = useParams();
  const { data: events = [] } = usePsEvents();
  const { data: roles = [] } = usePsRoles();
  const [eventId, setEventId] = useState(routeEventId || '');
  const [selectedId, setSelectedId] = useState(routeSelectedId || '');
  const [search, setSearch] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [showSigned, setShowSigned] = useState(false);
  const [roleChanged, setRoleChanged] = useState(false);
  const [pixChanged, setPixChanged] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [newPix, setNewPix] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [confirmingDetails, setConfirmingDetails] = useState(false);

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
    return filtered
      .filter((item: any) =>
        showSigned
          ? !!item.signed_at
          : !item.signed_at && !pendingIds.has(item.id)
      )
      .sort((a: any, b: any) =>
        String(a.collaborator_name || '').localeCompare(
          String(b.collaborator_name || ''),
          'pt-BR'
        )
      );
  }, [filtered, pendingIds, showSigned]);

  const signedCount = links.filter((l: any) => !!l.signed_at).length;
  const savingCount = pendingIds.size;
  const pendingCount = links.filter(
    (l: any) => !l.signed_at && !pendingIds.has(l.id)
  ).length;

  const currentSelectedId = routeSelectedId || selectedId;
  const selected = links.find((l: any) => l.id === currentSelectedId) ?? null;

  const {
    data: attendanceDetails,
    isLoading: attendanceDetailsLoading,
    refetch: refetchAttendanceDetails,
  } = useQuery({
    queryKey: ['ps_public_attendance_details', currentSelectedId],
    enabled: !!currentSelectedId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        'ps_public_get_attendance_details',
        { p_link_id: currentSelectedId }
      );

      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  useEffect(() => {
    setRoleChanged(false);
    setPixChanged(false);
    setNewPix('');
    setAdjustmentReason('');
    setSelectedRole('');
  }, [currentSelectedId]);

  useEffect(() => {
    if (attendanceDetails?.role_value) {
      setSelectedRole(String(attendanceDetails.role_value));
    }
  }, [attendanceDetails?.role_value, currentSelectedId]);

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
    if (!selected || !currentSelectedId) return;

    // Se foi este dispositivo que acabou de enviar a assinatura,
    // o realtime pode atualizar signed_at antes da troca de rota.
    // Nesse caso não exibimos o alerta de outro dispositivo.
    if (selected.signed_at && pendingIds.has(selected.id)) return;

    if (selected.signed_at) {
      setSignature(null);
      setSaving(false);
      toast.error('Esta presença já foi registrada em outro dispositivo.');
    }
  }, [selected, currentSelectedId, pendingIds]);

  const confirmAttendanceDetails = async () => {
    if (!selected) return;

    if (roleChanged && !selectedRole) {
      toast.error('Selecione o cargo correto.');
      return;
    }

    if (pixChanged && !newPix.trim()) {
      toast.error('Informe o PIX correto.');
      return;
    }

    if (
      (roleChanged || pixChanged) &&
      !adjustmentReason.trim()
    ) {
      toast.error('Informe o motivo da alteração.');
      return;
    }

    setConfirmingDetails(true);

    try {
      const { data, error } = await (supabase as any).rpc(
        'ps_public_confirm_attendance_details',
        {
          p_link_id: selected.id,
          p_role_changed: roleChanged,
          p_role_value: roleChanged ? selectedRole : null,
          p_pix_changed: pixChanged,
          p_pix: pixChanged ? newPix.trim() : null,
          p_justification:
            roleChanged || pixChanged
              ? adjustmentReason.trim()
              : null,
        }
      );

      if (error) throw error;

      const result = data?.[0];

      if (!result?.success) {
        throw new Error(
          result?.message || 'Não foi possível confirmar os dados.'
        );
      }

      setRoleChanged(false);
      setPixChanged(false);
      setNewPix('');
      setAdjustmentReason('');

      await refetchAttendanceDetails();

      toast.success('Dados conferidos. Assinatura liberada.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível confirmar os dados.'
      );
    } finally {
      setConfirmingDetails(false);
    }
  };

  const resetToList = () => {
    setSelectedId('');
    setSignature(null);
    setSaving(false);
    if (eventId) {
      navigate(`/ps/presenca/${eventId}`, { replace: true });
    }
  };

  const goBackToList = () => {
    if (signature && !saving) {
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
    if (!attendanceDetails?.details_confirmed) {
      toast.error('Confirme o cargo e o PIX antes de assinar.');
      return;
    }

    if (!signature) {
      toast.error('Assine no campo indicado antes de confirmar a presença.');
      return;
    }
    if (saving) return;

    const linkId = selected.id;
    const collaboratorName = selected.collaborator_name;

    setSaving(true);

    // Inicia o envio antes de trocar de tela.
    const savePromise = submitPublicProcessSelectionSignature(selected.id, signature);

    // Marca este fiscal como ocupado neste dispositivo.
    setPendingIds((current) => {
      const next = new Set(current);
      next.add(linkId);
      return next;
    });

    // Libera a interface imediatamente para a próxima assinatura.
    setSignature(null);
    setSelectedId('');
    setSaving(false);
    navigate(`/ps/presenca/${eventId}`, { replace: true });

    void savePromise
      .then(() => {
        toast.success(`Presença de ${collaboratorName} registrada com sucesso.`);
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : `Não foi possível registrar a presença de ${collaboratorName}.`
        );
      })
      .finally(() => {
        setPendingIds((current) => {
          const next = new Set(current);
          next.delete(linkId);
          return next;
        });

        void queryClient.invalidateQueries({
          queryKey: ['ps_public_roster', eventId],
        });
      });
  };

  const handleOpenSignature = (link: any) => {
    if (link.signed_at) {
      toast.info('Presença já registrada.');
      return;
    }
    setSelectedId(link.id);
    setSignature(null);
    navigate(`/ps/presenca/${eventId}/${link.id}`);
  };

  const handleEventChange = (nextEventId: string) => {
    setEventId(nextEventId);
    setSelectedId('');
    setSignature(null);
    setSearch('');
    setShowSigned(false);
    navigate(`/ps/presenca/${nextEventId}`);
  };

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

              <div className="space-y-4 rounded-2xl border bg-muted/10 p-4">
                <div>
                  <p className="font-semibold">Confira seus dados</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Confirme o cargo e o PIX antes de registrar a presença.
                  </p>
                </div>

                {attendanceDetailsLoading && (
                  <p className="text-sm text-muted-foreground">
                    Carregando dados...
                  </p>
                )}

                {!attendanceDetailsLoading && attendanceDetails && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border bg-background p-3">
                        <p className="text-xs uppercase text-muted-foreground">
                          Cargo / função
                        </p>
                        <p className="mt-1 font-semibold">
                          {attendanceDetails.role_name || 'Não informado'}
                        </p>
                      </div>

                      <div className="rounded-xl border bg-background p-3">
                        <p className="text-xs uppercase text-muted-foreground">
                          PIX cadastrado
                        </p>
                        <p className="mt-1 font-semibold">
                          {attendanceDetails.pix_masked || 'Não informado'}
                        </p>
                      </div>
                    </div>

                    {!attendanceDetails.details_confirmed ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={roleChanged ? 'default' : 'outline'}
                            onClick={() => setRoleChanged((value) => !value)}
                          >
                            {roleChanged ? 'Cargo será corrigido' : 'Corrigir cargo'}
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant={pixChanged ? 'default' : 'outline'}
                            onClick={() => setPixChanged((value) => !value)}
                          >
                            {pixChanged ? 'PIX será corrigido' : 'Corrigir PIX'}
                          </Button>
                        </div>

                        {roleChanged && (
                          <div className="space-y-2">
                            <Label>Novo cargo</Label>
                            <Select
                              value={selectedRole}
                              onValueChange={setSelectedRole}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o cargo correto" />
                              </SelectTrigger>
                              <SelectContent>
                                {roles.map((role: any) => (
                                  <SelectItem
                                    key={role.id}
                                    value={role.value}
                                  >
                                    {role.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {pixChanged && (
                          <div className="space-y-2">
                            <Label>Novo PIX</Label>
                            <Input
                              value={newPix}
                              onChange={(event) =>
                                setNewPix(event.target.value)
                              }
                              placeholder="Informe o PIX correto"
                              autoComplete="off"
                            />
                          </div>
                        )}

                        {(roleChanged || pixChanged) && (
                          <div className="space-y-2">
                            <Label>Motivo da alteração</Label>
                            <Textarea
                              value={adjustmentReason}
                              onChange={(event) =>
                                setAdjustmentReason(event.target.value)
                              }
                              placeholder="Ex.: cargo alterado pela coordenação / PIX desatualizado"
                              rows={2}
                            />
                          </div>
                        )}

                        <Button
                          type="button"
                          className="w-full"
                          size="lg"
                          onClick={confirmAttendanceDetails}
                          disabled={confirmingDetails}
                        >
                          {confirmingDetails
                            ? 'Confirmando dados...'
                            : 'ESTÁ CORRETO / DE ACORDO'}
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        Dados conferidos. A assinatura está liberada.
                      </div>
                    )}
                  </>
                )}
              </div>

              {attendanceDetails?.details_confirmed && (
                <>
                  <SignaturePad
                    onSignatureChange={setSignature}
                    height={240}
                  />

                  <div className="flex flex-col gap-3 pt-2 md:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 flex-1"
                      onClick={goBackToList}
                    >
                      Voltar para lista
                    </Button>

                    <Button
                      type="button"
                      className="h-12 flex-1"
                      size="lg"
                      onClick={submit}
                      disabled={saving || !signature}
                    >
                      {saving
                        ? 'Registrando presença...'
                        : 'CONFIRMAR PRESENÇA'}
                    </Button>
                  </div>
                </>
              )}
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
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={!showSigned ? "default" : "outline"}
                  onClick={() => setShowSigned(false)}
                >
                  Pendentes ({pendingCount})
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant={showSigned ? "default" : "outline"}
                  onClick={() => setShowSigned(true)}
                >
                  Ver assinados ({signedCount})
                </Button>

                {savingCount > 0 && (
                  <Badge variant="secondary">{savingCount} salvando...</Badge>
                )}

                <span className="ml-auto text-xs text-muted-foreground">
                  {links.length} fiscais
                </span>
              </div>
            )}

            <div className="h-[calc(100vh-22rem)] min-h-[18rem] max-h-[42rem] divide-y overflow-y-auto rounded-xl border">
              {isLoading && <p className="p-3 text-sm text-muted-foreground">Carregando fiscais...</p>}
              {!isLoading && !error && visibleLinks.length === 0 && (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  {search
                    ? 'Nenhum fiscal encontrado para esta busca.'
                    : showSigned
                      ? 'Nenhuma presença registrada ainda.'
                      : 'Todos os fiscais disponíveis já registraram presença.'}
                </p>
              )}
              {!isLoading && error && (
                <div className="space-y-2 p-3">
                  <p className="text-sm text-destructive">Não foi possível carregar a lista de presença.</p>
                  <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Tentar novamente</Button>
                </div>
              )}
              {!isLoading && !error && visibleLinks.map((l: any) => {
                const isAlreadySigned = !!l.signed_at;
                const isSavingSignature = pendingIds.has(l.id);
                const isActive = selectedId === l.id;

                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => handleOpenSignature(l)}
                    disabled={isAlreadySigned || isSavingSignature}
                    className={`flex min-h-16 w-full items-center justify-between gap-2 p-3 text-left text-sm transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-70 ${isActive ? 'bg-primary/10' : ''}`}
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground">{l.collaborator_name}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {[l.role_name || l.assigned_role, l.unit, l.floor, l.room && `Sala ${l.room}`].filter(Boolean).join(' • ')}
                      </span>
                    </span>
                    <span className="flex flex-wrap justify-end gap-1">
                      {isSavingSignature
                        ? <Badge variant="secondary">Salvando...</Badge>
                        : isAlreadySigned
                          ? <Badge variant="secondary">Presença já registrada</Badge>
                          : <Badge className="bg-primary/10 text-primary">Selecionar</Badge>}
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
