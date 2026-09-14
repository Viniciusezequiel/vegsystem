import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MainLayout } from '@/components/layout/MainLayout';
import { ContentState } from '@/components/layout/ContentState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Bell,
  BellRing,
  Check,
  CheckCircle,
  Clock,
  Trash2,
  Volume2,
  VolumeX,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Building2,
  Download,
  X,
  Search,
  Activity,
  ArrowUpRight,
  Radio,
} from 'lucide-react';
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
import { cn } from '@/lib/utils';

const ALARM_SOUND_URL = '/alert-siren.ogg';

const statusConfig = {
  pending: {
    label: 'Pendente',
    icon: BellRing,
    className: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  },
  accepted: {
    label: 'Em Atendimento',
    icon: Clock,
    className: 'border-violet-500/25 bg-violet-500/10 text-violet-300',
  },
  resolved: {
    label: 'Resolvido',
    icon: CheckCircle,
    className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  },
};

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: typeof Bell;
  label: string;
  value: number;
  helper: string;
  tone: 'blue' | 'amber' | 'violet' | 'emerald';
}) {
  const tones = {
    blue: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    violet: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
    emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  };

  return (
    <Card className="overflow-hidden rounded-2xl border-border/45 bg-card/65 shadow-[0_20px_50px_-38px_rgba(124,58,237,.7)] backdrop-blur-xl">
      <CardContent className="flex items-center gap-3.5 p-4">
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border', tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
          <p className="truncate text-xs font-semibold text-foreground/90">{label}</p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ClassroomCallsList() {
  const { isAdmin } = useAuth();
  const { canApprove, canEdit, canDelete } = useUserPermissions();
  const [activeTab, setActiveTab] = useState('pending');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<'accept' | 'resolve'>('accept');
  const [selectedCampus, setSelectedCampus] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
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
    const unique = [...new Set(roomsConfig.map((room) => room.campus))];
    unique.sort();
    return unique;
  }, [roomsConfig]);

  const campusFilter = selectedCampus !== 'all' ? selectedCampus : undefined;
  const { data: calls = [], isLoading } = useClassroomCalls(undefined, campusFilter);
  const { data: pendingCount } = usePendingCallsCount(campusFilter);

  const baseFilteredCalls = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return calls.filter((call) => {
      if (startDate) {
        const date = new Date(call.created_at);
        const start = new Date(`${startDate}T00:00:00`);
        if (date < start) return false;
      }
      if (endDate) {
        const date = new Date(call.created_at);
        const end = new Date(`${endDate}T23:59:59`);
        if (date > end) return false;
      }
      if (normalizedSearch) {
        const haystack = [call.room_name, call.reason, call.campus, call.accepted_by_name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }
      return true;
    });
  }, [calls, startDate, endDate, search]);

  const filteredCalls = useMemo(() => {
    if (activeTab === 'all') return baseFilteredCalls;
    return baseFilteredCalls.filter((call) => call.status === activeTab);
  }, [activeTab, baseFilteredCalls]);

  const metrics = useMemo(() => {
    const today = new Date();
    return {
      today: calls.filter((call) => isSameDay(new Date(call.created_at), today)).length,
      pending: calls.filter((call) => call.status === 'pending').length,
      accepted: calls.filter((call) => call.status === 'accepted').length,
      resolvedToday: calls.filter((call) => call.status === 'resolved' && call.resolved_at && isSameDay(new Date(call.resolved_at), today)).length,
    };
  }, [calls]);

  const tabCounts = useMemo(() => ({
    pending: baseFilteredCalls.filter((call) => call.status === 'pending').length,
    accepted: baseFilteredCalls.filter((call) => call.status === 'accepted').length,
    resolved: baseFilteredCalls.filter((call) => call.status === 'resolved').length,
    all: baseFilteredCalls.length,
  }), [baseFilteredCalls]);

  const highlightCalls = useMemo(() => {
    const weight: Record<ClassroomCall['status'], number> = { pending: 0, accepted: 1, resolved: 2 };
    return [...baseFilteredCalls]
      .sort((a, b) => weight[a.status] - weight[b.status] || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3);
  }, [baseFilteredCalls]);

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
    const rows = filteredCalls.map((call) => ({
      Sala: call.room_name,
      Campus: call.campus || '',
      Motivo: call.reason,
      Status: statusLabels[call.status] || call.status,
      Validação: call.is_valid === true ? 'Procede' : call.is_valid === false ? 'Não Procede' : '',
      Justificativa: call.validation_reason || '',
      Tratativa: call.treatment || '',
      'Resposta ao Solicitante': call.response_message || '',
      'Atendido por': call.accepted_by_name || '',
      'Criado em': format(new Date(call.created_at), 'dd/MM/yyyy HH:mm'),
      'Aceito em': call.accepted_at ? format(new Date(call.accepted_at), 'dd/MM/yyyy HH:mm') : '',
      'Resolvido em': call.resolved_at ? format(new Date(call.resolved_at), 'dd/MM/yyyy HH:mm') : '',
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 18 }, { wch: 14 }, { wch: 50 }, { wch: 14 }, { wch: 12 },
      { wch: 40 }, { wch: 40 }, { wch: 40 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Chamados');
    XLSX.writeFile(workbook, `chamados_sala_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Exportação realizada!');
  };

  const handleCleanupCalls = async () => {
    if (!filteredCalls.length) return;
    const ids = filteredCalls.map((call) => call.id);
    const { error } = await supabase.from('classroom_calls').delete().in('id', ids);
    if (error) {
      toast.error(`Erro ao limpar: ${error.message}`);
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
    if (loopIntervalRef.current || !audioRef.current) return;
    const tryPlay = () => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.loop = true;
      audio.play().catch(() => undefined);
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
      const currentAudio = audioRef.current;
      currentAudio.muted = true;
      currentAudio.play().then(() => {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio.muted = false;
        audioUnlockedRef.current = true;
        document.removeEventListener('pointerdown', unlock, true);
        document.removeEventListener('keydown', unlock, true);
        if (pendingCountRef.current > 0 && soundEnabledRef.current) startAlarm();
      }).catch(() => {
        currentAudio.muted = false;
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
      if (document.visibilityState === 'hidden') stopAlarm();
      else if (pendingCountRef.current > 0 && soundEnabledRef.current) startAlarm();
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
      await acceptCall.mutateAsync({ id: selectedCallId, responseMessage: data.responseMessage });
    } else {
      await resolveCall.mutateAsync({ id: selectedCallId, treatment: data.treatment });
    }
    if (dialogMode === 'accept') stopAlarm();
    setValidationDialogOpen(false);
    setSelectedCallId(null);
  };

  const formatDate = (dateString: string) => format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const handleToggleSound = () => {
    const nextEnabled = !soundEnabled;
    setSoundEnabled(nextEnabled);
    if (!nextEnabled) stopAlarm();
    else if ((pendingCount ?? 0) > 0) startAlarm();
  };

  const copyExternalLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/chamado-sala`);
    toast.success('Link externo copiado');
  };

  const getValidationBadge = (call: ClassroomCall) => {
    if (call.is_valid === null || call.is_valid === undefined) return null;
    return call.is_valid ? (
      <Badge variant="outline" className="gap-1 border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
        <ThumbsUp className="h-3 w-3" />
        Procede
      </Badge>
    ) : (
      <Badge variant="outline" className="gap-1 border-rose-500/25 bg-rose-500/10 text-rose-300">
        <ThumbsDown className="h-3 w-3" />
        Não procede
      </Badge>
    );
  };

  const hasActiveFilters = selectedCampus !== 'all' || startDate || endDate || search;
  const clearFilters = () => {
    setSelectedCampus('all');
    setStartDate('');
    setEndDate('');
    setSearch('');
  };

  return (
    <MainLayout>
      <div className="space-y-4 pb-2">
        <ClassroomCallsModuleNav />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Activity} label="Chamados hoje" value={metrics.today} helper="Novas solicitações do dia" tone="blue" />
          <MetricCard icon={BellRing} label="Pendentes" value={metrics.pending} helper="Aguardando atendimento" tone="amber" />
          <MetricCard icon={Radio} label="Em atendimento" value={metrics.accepted} helper="Em andamento agora" tone="violet" />
          <MetricCard icon={CheckCircle} label="Resolvidos hoje" value={metrics.resolvedToday} helper="Concluídos com sucesso" tone="emerald" />
        </div>

        <section className="rounded-2xl border border-border/45 bg-card/60 p-3 shadow-[0_20px_60px_-45px_rgba(124,58,237,.8)] backdrop-blur-xl sm:p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex min-w-[190px] flex-1 items-center gap-2 sm:flex-none">
              <Building2 className="h-4 w-4 text-primary/80" />
              <Select value={selectedCampus} onValueChange={setSelectedCampus}>
                <SelectTrigger className="w-full sm:w-[205px]">
                  <SelectValue placeholder="Todos os campus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os campus</SelectItem>
                  {campuses.map((campus) => <SelectItem key={campus} value={campus}>{campus}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-[155px]" />
            <span className="text-xs text-muted-foreground">até</span>
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-[155px]" />

            <div className="relative min-w-[220px] flex-1 xl:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por sala, motivo ou responsável..."
                className="pl-9"
              />
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-4 w-4" />
                  Limpar
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleToggleSound} title={soundEnabled ? 'Desativar alerta sonoro' : 'Ativar alerta sonoro'}>
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCalls} disabled={!filteredCalls.length}>
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
              <Button variant="outline" size="sm" onClick={copyExternalLink} className="border-primary/30 text-primary hover:bg-primary/10">
                <ExternalLink className="mr-2 h-4 w-4" />
                Copiar link externo
              </Button>
              {isAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={!filteredCalls.length || (!startDate && !endDate)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Limpar período
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Limpar chamados do período?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Serão excluídos {filteredCalls.length} chamado(s) dos filtros selecionados. Esta ação não pode ser desfeita.
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
        </section>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
          <TabsList className="grid h-auto w-full grid-cols-4 rounded-2xl border border-border/45 bg-card/55 p-1 sm:w-fit sm:min-w-[610px]">
            {(['pending', 'accepted', 'resolved', 'all'] as const).map((tab) => (
              <TabsTrigger key={tab} value={tab} className="gap-2 rounded-xl data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                {tab === 'pending' ? 'Pendentes' : tab === 'accepted' ? 'Em Atendimento' : tab === 'resolved' ? 'Resolvidos' : 'Todos'}
                <span className="rounded-full bg-background/50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                  {tabCounts[tab]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <Card className="overflow-hidden rounded-2xl border-border/45 bg-card/65 shadow-[0_22px_55px_-42px_rgba(124,58,237,.75)] backdrop-blur-xl">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between gap-3 border-b border-border/35 px-4 py-4 sm:px-5">
                    <div>
                      <h2 className="text-sm font-semibold">Chamados de Sala</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">Solicitações de suporte e manutenção das salas.</p>
                    </div>
                    <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                      {filteredCalls.length} registro{filteredCalls.length === 1 ? '' : 's'}
                    </Badge>
                  </div>

                  {isLoading ? (
                    <div className="p-5">
                      <ContentState loading title="Carregando chamados" description="Buscando as solicitações mais recentes." />
                    </div>
                  ) : filteredCalls.length > 0 ? (
                    <>
                      <div className="hidden overflow-x-auto md:block">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-border/35 bg-background/20">
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
                              const status = statusConfig[call.status];
                              const StatusIcon = status.icon;
                              return (
                                <TableRow key={call.id} className="border-border/30 transition hover:bg-primary/[0.035]">
                                  <TableCell className="font-semibold">{call.room_name}</TableCell>
                                  <TableCell className="max-w-[250px]">
                                    <Popover>
                                      <PopoverTrigger className="block max-w-[235px] cursor-pointer truncate text-left text-muted-foreground hover:text-foreground">
                                        {call.reason}
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto max-w-sm">
                                        <p className="mb-1 text-sm font-semibold">Motivo</p>
                                        <p className="whitespace-pre-wrap break-words text-sm">{call.reason}</p>
                                      </PopoverContent>
                                    </Popover>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={cn('gap-1', status.className)}>
                                      <StatusIcon className="h-3 w-3" />
                                      {status.label}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col items-start gap-1">
                                      {getValidationBadge(call)}
                                      {(call.validation_reason || call.treatment) && (
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Badge variant="outline" className="cursor-pointer gap-1 border-border/50 bg-background/25 text-muted-foreground">
                                              <MessageSquare className="h-3 w-3" />
                                              Detalhes
                                            </Badge>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-auto max-w-sm">
                                            <p className="mb-1 text-sm font-semibold">{call.treatment ? 'Tratativa' : 'Justificativa'}</p>
                                            <p className="whitespace-pre-wrap break-words text-sm">{call.treatment || call.validation_reason}</p>
                                          </PopoverContent>
                                        </Popover>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(call.created_at)}</TableCell>
                                  <TableCell className="max-w-[170px] truncate text-sm">{call.accepted_by_name || '-'}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      {call.status === 'pending' && canManageCalls && (
                                        <Button size="sm" onClick={() => handleOpenAcceptDialog(call.id)} disabled={acceptCall.isPending}>
                                          <Check className="mr-1 h-4 w-4" />
                                          Aceitar
                                        </Button>
                                      )}
                                      {call.status === 'accepted' && canManageCalls && (
                                        <Button size="sm" variant="secondary" onClick={() => handleOpenResolveDialog(call.id)} disabled={resolveCall.isPending}>
                                          <CheckCircle className="mr-1 h-4 w-4" />
                                          Resolver
                                        </Button>
                                      )}
                                      {canDeleteCalls && (
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
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
                                              <AlertDialogAction onClick={() => deleteCall.mutate(call.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
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

                      <div className="space-y-2 p-3 md:hidden">
                        {filteredCalls.map((call) => {
                          const status = statusConfig[call.status];
                          const StatusIcon = status.icon;
                          return (
                            <div key={call.id} className="rounded-xl border border-border/40 bg-background/25 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-semibold">{call.room_name}</p>
                                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{call.reason}</p>
                                </div>
                                <Badge variant="outline" className={cn('shrink-0 gap-1', status.className)}>
                                  <StatusIcon className="h-3 w-3" />
                                  {status.label}
                                </Badge>
                              </div>
                              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/30 pt-3">
                                <p className="text-[10px] text-muted-foreground">{formatDate(call.created_at)}</p>
                                <div className="flex gap-1">
                                  {call.status === 'pending' && canManageCalls && <Button size="sm" onClick={() => handleOpenAcceptDialog(call.id)}>Aceitar</Button>}
                                  {call.status === 'accepted' && canManageCalls && <Button size="sm" variant="secondary" onClick={() => handleOpenResolveDialog(call.id)}>Resolver</Button>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="p-5">
                      <ContentState icon={Bell} title="Nenhum chamado encontrado" description="Não há solicitações para a situação e os filtros selecionados." />
                    </div>
                  )}
                </CardContent>
              </Card>

              <aside className="space-y-3">
                <Card className="rounded-2xl border-border/45 bg-gradient-to-b from-card/75 to-card/55 shadow-[0_22px_55px_-42px_rgba(236,72,153,.55)] backdrop-blur-xl">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <BellRing className="h-4 w-4 text-rose-400" />
                          <h3 className="text-sm font-semibold">Chamados em destaque</h3>
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">Prioriza pendentes e atendimentos recentes.</p>
                      </div>
                    </div>

                    {highlightCalls.length > 0 ? (
                      <div className="space-y-2">
                        {highlightCalls.map((call) => {
                          const status = statusConfig[call.status];
                          const StatusIcon = status.icon;
                          return (
                            <button
                              key={call.id}
                              type="button"
                              onClick={() => setActiveTab(call.status)}
                              className="group w-full rounded-xl border border-border/40 bg-background/25 p-3 text-left transition hover:border-primary/30 hover:bg-primary/[0.045]"
                            >
                              <div className="flex items-start gap-3">
                                <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border', status.className)}>
                                  <StatusIcon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="truncate text-xs font-semibold">{call.room_name}</p>
                                    <span className="text-[9px] text-muted-foreground">{format(new Date(call.created_at), 'HH:mm')}</span>
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{call.reason}</p>
                                  <div className="mt-2 flex items-center justify-between gap-2">
                                    <Badge variant="outline" className={cn('text-[9px]', status.className)}>{status.label}</Badge>
                                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition group-hover:text-primary" />
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="rounded-xl border border-dashed border-border/40 bg-background/20 px-3 py-6 text-center text-xs text-muted-foreground">Nenhum chamado em destaque.</p>
                    )}
                  </CardContent>
                </Card>

                <div className="rounded-2xl border border-primary/20 bg-primary/[0.055] p-4">
                  <div className="flex gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                      <ExternalLink className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold">Dica do VEG</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Compartilhe o link externo com os professores para que abram chamados diretamente.</p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
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
