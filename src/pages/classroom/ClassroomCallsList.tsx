import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageToolbar } from '@/components/layout/PageToolbar';
import { ContentState } from '@/components/layout/ContentState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, BellRing, Check, CheckCircle, Clock, Trash2, Volume2, VolumeX, ExternalLink, ThumbsUp, ThumbsDown, MessageSquare, Building2, Download, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useClassroomCalls, useAcceptClassroomCall, useResolveClassroomCall, useDeleteClassroomCall, usePendingCallsCount, ClassroomCall } from '@/hooks/useClassroomCalls';
import { useClassroomCallRooms } from '@/hooks/useClassroomCallSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useNativeCallNotification } from '@/hooks/useNativeNotifications';
import { useUserPermissions } from '@/hooks/usePermissions';
import ClassroomCallValidationDialog from '@/components/classroom/ClassroomCallValidationDialog';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { ClassroomCallsModuleNav } from '@/components/classroom/ClassroomCallsModuleNav';

const ALARM_SOUND_URL = '/alert-siren.ogg';

const statusConfig = {
  pending: { label: 'Pendente', variant: 'destructive' as const, icon: BellRing },
  accepted: { label: 'Em Atendimento', variant: 'secondary' as const, icon: Clock },
  resolved: { label: 'Resolvido', variant: 'outline' as const, icon: CheckCircle },
};

export default function ClassroomCallsList() {
  const { isAdmin } = useAuth();
  const { canApprove, canEdit, canDelete } = useUserPermissions();
  const [activeTab, setActiveTab] = useState('pending');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<'accept' | 'resolve'>('accept');
  const [selectedCampus, setSelectedCampus] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const queryClient = useQueryClient();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loopIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingCountRef = useRef(0);
  const soundEnabledRef = useRef(true);
  const audioUnlockedRef = useRef(false);

  const canManageCalls = isAdmin || canApprove('classroomCalls') || canEdit('classroomCalls');
  const canDeleteCalls = isAdmin || canDelete('classroomCalls');

  const { data: roomsConfig } = useClassroomCallRooms(true);
  const campuses = useMemo(() => {
    if (!roomsConfig) return [];
    const unique = [...new Set(roomsConfig.map(r => r.campus))];
    unique.sort();
    return unique;
  }, [roomsConfig]);

  const campusFilter = selectedCampus && selectedCampus !== 'all' ? selectedCampus : undefined;

  const { data: calls, isLoading } = useClassroomCalls(activeTab === 'all' ? undefined : activeTab, campusFilter);
  const { data: pendingCount } = usePendingCallsCount(campusFilter);

  const filteredCalls = useMemo(() => {
    if (!calls) return [];
    return calls.filter((c) => {
      if (startDate) {
        const d = new Date(c.created_at);
        const s = new Date(startDate + 'T00:00:00');
        if (d < s) return false;
      }
      if (endDate) {
        const d = new Date(c.created_at);
        const e = new Date(endDate + 'T23:59:59');
        if (d > e) return false;
      }
      return true;
    });
  }, [calls, startDate, endDate]);

  const handleExportCalls = () => {
    if (!filteredCalls.length) {
      toast.error('Nenhum chamado no período selecionado');
      return;
    }
    const statusLabels: Record<string, string> = {
      pending: 'Pendente',
      accepted: 'Em Atendimento',
      resolved: 'Resolvido',
    };
    const rows = filteredCalls.map(c => ({
      Sala: c.room_name,
      Campus: c.campus || '',
      Motivo: c.reason,
      Status: statusLabels[c.status] || c.status,
      Validação: c.is_valid === true ? 'Procede' : c.is_valid === false ? 'Não Procede' : '',
      Justificativa: c.validation_reason || '',
      Tratativa: c.treatment || '',
      'Resposta ao Solicitante': c.response_message || '',
      'Atendido por': c.accepted_by_name || '',
      'Criado em': format(new Date(c.created_at), 'dd/MM/yyyy HH:mm'),
      'Aceito em': c.accepted_at ? format(new Date(c.accepted_at), 'dd/MM/yyyy HH:mm') : '',
      'Resolvido em': c.resolved_at ? format(new Date(c.resolved_at), 'dd/MM/yyyy HH:mm') : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 18 }, { wch: 14 }, { wch: 50 }, { wch: 14 }, { wch: 12 },
      { wch: 40 }, { wch: 40 }, { wch: 40 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Chamados');
    XLSX.writeFile(wb, `chamados_sala_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Exportação realizada!');
  };

  const handleCleanupCalls = async () => {
    if (!filteredCalls.length) return;
    const ids = filteredCalls.map(c => c.id);
    const { error } = await supabase.from('classroom_calls').delete().in('id', ids);
    if (error) {
      toast.error('Erro ao limpar: ' + error.message);
    } else {
      toast.success(`${ids.length} chamado(s) removido(s).`);
      queryClient.invalidateQueries({ queryKey: ['classroom-calls'] });
      queryClient.invalidateQueries({ queryKey: ['pending-calls-count'] });
    }
  };

  useNativeCallNotification(pendingCount);
  const acceptCall = useAcceptClassroomCall();
  const resolveCall = useResolveClassroomCall();
  const deleteCall = useDeleteClassroomCall();

  const stopAlarm = useCallback(() => {
    if (loopIntervalRef.current) {
      clearInterval(loopIntervalRef.current);
      loopIntervalRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  const startAlarm = useCallback(() => {
    if (loopIntervalRef.current) return;
    if (!audioRef.current) return;

    const tryPlay = () => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.loop = true;
      audio.play().catch(() => {
        // Browser may block autoplay; retry loop below keeps trying.
      });
    };

    tryPlay();

    loopIntervalRef.current = setInterval(() => {
      if (!pendingCountRef.current || !soundEnabledRef.current) {
        stopAlarm();
        return;
      }

      if (audioRef.current?.paused) tryPlay();
    }, 2000);
  }, [stopAlarm]);

  useEffect(() => {
    const audio = new Audio(ALARM_SOUND_URL);
    audio.preload = 'auto';
    audio.loop = true;
    audioRef.current = audio;

    const unlock = () => {
      if (audioUnlockedRef.current || !audioRef.current) return;
      const a = audioRef.current;

      a.muted = true;
      a.play().then(() => {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
        audioUnlockedRef.current = true;

        document.removeEventListener('pointerdown', unlock, true);
        document.removeEventListener('keydown', unlock, true);

        if (pendingCountRef.current > 0 && soundEnabledRef.current) startAlarm();
      }).catch(() => {
        a.muted = false;
      });
    };

    document.addEventListener('pointerdown', unlock, { capture: true });
    document.addEventListener('keydown', unlock, { capture: true });

    return () => {
      stopAlarm();
      audio.src = '';
      audioRef.current = null;
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    };
  }, [startAlarm, stopAlarm]);

  useEffect(() => {
    pendingCountRef.current = pendingCount ?? 0;
    soundEnabledRef.current = soundEnabled;
  }, [pendingCount, soundEnabled]);

  useEffect(() => {
    if (pendingCount !== undefined && pendingCount > 0 && soundEnabled) startAlarm();
    else stopAlarm();
  }, [pendingCount, soundEnabled, startAlarm, stopAlarm]);

  useEffect(() => {
    const cleanup = () => stopAlarm();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopAlarm();
      } else if (document.visibilityState === 'visible') {
        if (pendingCountRef.current > 0 && soundEnabledRef.current) startAlarm();
      }
    };

    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', cleanup);
      window.removeEventListener('pagehide', cleanup);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cleanup();
    };
  }, [stopAlarm, startAlarm]);

  const handleOpenAcceptDialog = (id: string) => {
    setSelectedCallId(id);
    setDialogMode('accept');
    setValidationDialogOpen(true);
  };

  const handleOpenResolveDialog = (id: string) => {
    setSelectedCallId(id);
    setDialogMode('resolve');
    setValidationDialogOpen(true);
  };

  const handleValidationConfirm = async (data: { responseMessage?: string; treatment?: string }) => {
    if (!selectedCallId) return;

    if (dialogMode === 'accept') {
      await acceptCall.mutateAsync({
        id: selectedCallId,
        responseMessage: data.responseMessage,
      });
    } else {
      await resolveCall.mutateAsync({
        id: selectedCallId,
        treatment: data.treatment,
      });
    }

    if (dialogMode === 'accept') stopAlarm();

    setValidationDialogOpen(false);
    setSelectedCallId(null);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const handleToggleSound = () => {
    const nextEnabled = !soundEnabled;
    setSoundEnabled(nextEnabled);

    if (!nextEnabled) stopAlarm();
    else if ((pendingCount ?? 0) > 0) startAlarm();
  };

  const copyExternalLink = () => {
    const link = `${window.location.origin}/chamado-sala`;
    navigator.clipboard.writeText(link);
    toast.success('Link externo copiado');
  };

  const getValidationBadge = (call: ClassroomCall) => {
    if (call.is_valid === null || call.is_valid === undefined) return null;

    return call.is_valid ? (
      <Badge variant="outline" className="gap-1 border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400">
        <ThumbsUp className="h-3 w-3" />
        Procede
      </Badge>
    ) : (
      <Badge variant="outline" className="gap-1 border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400">
        <ThumbsDown className="h-3 w-3" />
        Não Procede
      </Badge>
    );
  };

  const hasActiveFilters = (selectedCampus && selectedCampus !== 'all') || startDate || endDate;
  const clearFilters = () => {
    setSelectedCampus('all');
    setStartDate('');
    setEndDate('');
  };

  return (
    <MainLayout>
      <div className="space-y-5">
        <ClassroomCallsModuleNav />

        <PageHeader
          title="Chamados de Sala"
          description="Gerencie solicitações de apoio enviadas pelos professores"
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleSound}
                className={soundEnabled ? '' : 'text-muted-foreground'}
                title={soundEnabled ? 'Desativar alerta sonoro' : 'Ativar alerta sonoro'}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={copyExternalLink}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Copiar Link Externo
              </Button>
            </>
          }
        />

        <PageToolbar className="mb-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-[210px] flex-1 items-center gap-2 sm:flex-none">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedCampus} onValueChange={setSelectedCampus}>
                <SelectTrigger className="w-full sm:w-[210px]">
                  <SelectValue placeholder="Todos os campus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os campus</SelectItem>
                  {campuses.map((campus) => (
                    <SelectItem key={campus} value={campus}>{campus}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-[155px]"
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-[155px]"
              />
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-4 w-4" />
                  Limpar
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleExportCalls} disabled={!filteredCalls.length}>
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
              {isAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={!filteredCalls.length || (!startDate && !endDate)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Limpar Período
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Limpar chamados do período?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Serão excluídos {filteredCalls.length} chamado(s) do período/filtros selecionados. Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCleanupCalls}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </PageToolbar>

        {pendingCount !== undefined && pendingCount > 0 && (
          <Card className="border-destructive/50 bg-destructive/[0.06]">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-destructive">
                  {pendingCount} chamado{pendingCount > 1 ? 's' : ''} pendente{pendingCount > 1 ? 's' : ''}
                </p>
                <p className="text-sm text-muted-foreground">Abra um chamado para iniciar o atendimento.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-4 rounded-xl border border-border/60 bg-card/65 p-1 lg:w-fit lg:min-w-[520px]">
            <TabsTrigger value="pending" className="relative">
              Pendentes
              {pendingCount !== undefined && pendingCount > 0 && (
                <Badge variant="destructive" className="ml-2 flex h-5 min-w-5 items-center justify-center p-1 text-[10px]">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="accepted">Em Atendimento</TabsTrigger>
            <TabsTrigger value="resolved">Resolvidos</TabsTrigger>
            <TabsTrigger value="all">Todos</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            <Card className="border-border/60 bg-card/65">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {activeTab === 'pending' && 'Chamados Pendentes'}
                  {activeTab === 'accepted' && 'Chamados em Atendimento'}
                  {activeTab === 'resolved' && 'Chamados Resolvidos'}
                  {activeTab === 'all' && 'Todos os Chamados'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <ContentState loading title="Carregando chamados" description="Buscando as solicitações mais recentes." />
                ) : filteredCalls.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Sala</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Validação</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Atendido por</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCalls.map((call) => {
                          const status = statusConfig[call.status as keyof typeof statusConfig];
                          const StatusIcon = status.icon;

                          return (
                            <TableRow key={call.id} className={call.status === 'pending' ? 'bg-destructive/[0.04]' : ''}>
                              <TableCell className="font-medium">{call.room_name}</TableCell>
                              <TableCell className="max-w-xs">
                                <Popover>
                                  <PopoverTrigger className="block max-w-[220px] cursor-pointer truncate text-left hover:underline">
                                    {call.reason}
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto max-w-sm">
                                    <p className="mb-1 text-sm font-semibold">Motivo:</p>
                                    <p className="break-words whitespace-pre-wrap text-sm">{call.reason}</p>
                                  </PopoverContent>
                                </Popover>
                              </TableCell>
                              <TableCell>
                                <Badge variant={status.variant} className="gap-1">
                                  <StatusIcon className="h-3 w-3" />
                                  {status.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  {getValidationBadge(call)}
                                  {(call.validation_reason || call.treatment) && (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Badge variant="outline" className="cursor-pointer gap-1">
                                          <MessageSquare className="h-3 w-3" />
                                          {call.treatment ? 'Tratativa' : 'Justificativa'}
                                        </Badge>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto max-w-sm">
                                        <p className="mb-1 text-sm font-semibold">
                                          {call.treatment ? 'Tratativa:' : 'Justificativa:'}
                                        </p>
                                        <p className="break-words whitespace-pre-wrap text-sm">
                                          {call.treatment || call.validation_reason}
                                        </p>
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{formatDate(call.created_at)}</TableCell>
                              <TableCell>{call.accepted_by_name || '-'}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  {call.status === 'pending' && canManageCalls && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleOpenAcceptDialog(call.id)}
                                      disabled={acceptCall.isPending}
                                    >
                                      <Check className="mr-1 h-4 w-4" />
                                      Aceitar
                                    </Button>
                                  )}
                                  {call.status === 'accepted' && canManageCalls && (
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => handleOpenResolveDialog(call.id)}
                                      disabled={resolveCall.isPending}
                                    >
                                      <CheckCircle className="mr-1 h-4 w-4" />
                                      Resolver
                                    </Button>
                                  )}
                                  {canDeleteCalls && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button size="sm" variant="ghost" className="text-destructive">
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Excluir chamado?</AlertDialogTitle>
                                          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => deleteCall.mutate(call.id)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            Excluir
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <ContentState
                    icon={Bell}
                    title="Nenhum chamado encontrado"
                    description="Não há solicitações para a situação e os filtros selecionados."
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ClassroomCallValidationDialog
        open={validationDialogOpen}
        onOpenChange={setValidationDialogOpen}
        callId={selectedCallId || ''}
        mode={dialogMode}
        onConfirm={handleValidationConfirm}
        isPending={acceptCall.isPending || resolveCall.isPending}
      />
    </MainLayout>
  );
}
