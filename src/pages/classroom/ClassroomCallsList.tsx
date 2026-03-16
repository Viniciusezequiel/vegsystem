import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { ptBR } from 'date-fns/locale';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Bell, BellRing, Check, CheckCircle, Clock, Trash2, Volume2, VolumeX, ExternalLink, ThumbsUp, ThumbsDown, MessageSquare, Settings2 } from 'lucide-react';
import { useClassroomCalls, useAcceptClassroomCall, useResolveClassroomCall, useDeleteClassroomCall, usePendingCallsCount, ClassroomCall } from '@/hooks/useClassroomCalls';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from '@/hooks/usePermissions';
import { Skeleton } from '@/components/ui/skeleton';
import ClassroomCallValidationDialog from '@/components/classroom/ClassroomCallValidationDialog';

const statusConfig = {
  pending: { label: 'Pendente', variant: 'destructive' as const, icon: BellRing },
  accepted: { label: 'Em Atendimento', variant: 'secondary' as const, icon: Clock },
  resolved: { label: 'Resolvido', variant: 'outline' as const, icon: CheckCircle },
};

export default function ClassroomCallsList() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { canApprove, canEdit, canDelete } = useUserPermissions();
  const [activeTab, setActiveTab] = useState('pending');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioActivated, setAudioActivated] = useState(false);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<'accept' | 'resolve'>('accept');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const isAlarmActiveRef = useRef(false);
  const pendingCountRef = useRef(0);
  const soundEnabledRef = useRef(true);

  // Permission checks for classroom calls
  const canManageCalls = isAdmin || canApprove('classroomCalls') || canEdit('classroomCalls');
  const canDeleteCalls = isAdmin || canDelete('classroomCalls');
  
  const { data: calls, isLoading } = useClassroomCalls(activeTab === 'all' ? undefined : activeTab);
  const { data: pendingCount } = usePendingCallsCount();
  const acceptCall = useAcceptClassroomCall();
  const resolveCall = useResolveClassroomCall();
  const deleteCall = useDeleteClassroomCall();

  const clearAlarmInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const stopAlarm = () => {
    clearAlarmInterval();

    if (gainNodeRef.current && audioContextRef.current?.state === 'running') {
      const now = audioContextRef.current.currentTime;
      gainNodeRef.current.gain.cancelScheduledValues(now);
      gainNodeRef.current.gain.setValueAtTime(0, now);
    }

    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch (_) {
        // no-op
      }
      oscillatorRef.current.disconnect();
      oscillatorRef.current = null;
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }

    isAlarmActiveRef.current = false;
  };

  const ensureAudioContextRunning = async () => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return false;

    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContextClass();
    }

    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (_) {
        return false;
      }
    }

    return ctx.state === 'running';
  };

  const startAlarm = async () => {
    if (isAlarmActiveRef.current) return;

    const canPlay = await ensureAudioContextRunning();
    if (!canPlay || !audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    gainNode.gain.setValueAtTime(0, ctx.currentTime);

    oscillator.start();

    oscillatorRef.current = oscillator;
    gainNodeRef.current = gainNode;
    isAlarmActiveRef.current = true;

    const pulseAlarm = () => {
      if (!audioContextRef.current || !gainNodeRef.current) return;
      if (audioContextRef.current.state !== 'running') return;

      const now = audioContextRef.current.currentTime;
      gainNodeRef.current.gain.cancelScheduledValues(now);
      gainNodeRef.current.gain.setValueAtTime(0.23, now);
      gainNodeRef.current.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
    };

    pulseAlarm();
    intervalRef.current = setInterval(pulseAlarm, 450);
  };

  useEffect(() => {
    pendingCountRef.current = pendingCount ?? 0;
    soundEnabledRef.current = soundEnabled;
  }, [pendingCount, soundEnabled]);

  // Activate audio on explicit user gesture (required by mobile browsers)
  const handleActivateAudio = async () => {
    const unlocked = await ensureAudioContextRunning();
    if (unlocked) {
      // Play a tiny silent burst to fully unlock audio on iOS/Safari
      const ctx = audioContextRef.current!;
      const silentOsc = ctx.createOscillator();
      const silentGain = ctx.createGain();
      silentOsc.connect(silentGain);
      silentGain.connect(ctx.destination);
      silentGain.gain.setValueAtTime(0, ctx.currentTime);
      silentOsc.start();
      silentOsc.stop(ctx.currentTime + 0.05);

      setAudioActivated(true);

      // If there are already pending calls, start alarm immediately
      if (pendingCountRef.current > 0 && soundEnabledRef.current) {
        await startAlarm();
      }
    }
  };

  // Start/stop alarm based on pending calls (only if audio is activated)
  useEffect(() => {
    if (!audioActivated) return;

    if (pendingCount !== undefined && pendingCount > 0 && soundEnabled) {
      void startAlarm();
    } else {
      stopAlarm();
    }
  }, [pendingCount, soundEnabled, audioActivated]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAlarm();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    };
  }, []);

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
        responseMessage: data.responseMessage 
      });
    } else {
      await resolveCall.mutateAsync({ 
        id: selectedCallId, 
        treatment: data.treatment 
      });
    }
    
    // Stop sound when call is accepted
    if (dialogMode === 'accept' && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setValidationDialogOpen(false);
    setSelectedCallId(null);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const handleToggleSound = async () => {
    const nextEnabled = !soundEnabled;
    setSoundEnabled(nextEnabled);

    if (nextEnabled) {
      const unlocked = await ensureAudioContextRunning();
      if (unlocked && (pendingCount ?? 0) > 0) {
        await startAlarm();
      }
    } else {
      stopAlarm();
    }
  };

  const copyExternalLink = () => {
    const link = `${window.location.origin}/chamado-sala`;
    navigator.clipboard.writeText(link);
  };

  const getValidationBadge = (call: ClassroomCall) => {
    if (call.is_valid === null || call.is_valid === undefined) return null;
    
    return call.is_valid ? (
      <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 gap-1">
        <ThumbsUp className="h-3 w-3" />
        Procede
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30 gap-1">
        <ThumbsDown className="h-3 w-3" />
        Não Procede
      </Badge>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Chamados de Sala</h1>
            <p className="text-muted-foreground">
              Gerencie os chamados de professores
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void handleToggleSound();
              }}
              className={soundEnabled ? '' : 'text-muted-foreground'}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/classroom-calls/settings')}
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Configurações
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={copyExternalLink}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Copiar Link Externo
            </Button>
          </div>
        </div>

        {/* Pending Calls Alert */}
        {pendingCount !== undefined && pendingCount > 0 && (
          <Card className="border-destructive bg-destructive/5 animate-pulse">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <BellRing className="h-6 w-6 text-destructive animate-bounce" />
                <div>
                  <p className="font-semibold text-destructive">
                    {pendingCount} chamado{pendingCount > 1 ? 's' : ''} pendente{pendingCount > 1 ? 's' : ''}!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Clique em "Aceitar" para atender
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending" className="relative">
              Pendentes
              {pendingCount !== undefined && pendingCount > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="accepted">Em Atendimento</TabsTrigger>
            <TabsTrigger value="resolved">Resolvidos</TabsTrigger>
            <TabsTrigger value="all">Todos</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  {activeTab === 'pending' && 'Chamados Pendentes'}
                  {activeTab === 'accepted' && 'Chamados em Atendimento'}
                  {activeTab === 'resolved' && 'Chamados Resolvidos'}
                  {activeTab === 'all' && 'Todos os Chamados'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : calls && calls.length > 0 ? (
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
                      {calls.map((call) => {
                        const status = statusConfig[call.status as keyof typeof statusConfig];
                        const StatusIcon = status.icon;
                        
                        return (
                          <TableRow key={call.id} className={call.status === 'pending' ? 'bg-destructive/5' : ''}>
                            <TableCell className="font-medium">{call.room_name}</TableCell>
                            <TableCell className="max-w-xs">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger className="truncate block max-w-[200px] text-left">
                                    {call.reason}
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-sm">
                                    <p>{call.reason}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
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
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="outline" className="gap-1 cursor-help">
                                          <MessageSquare className="h-3 w-3" />
                                          {call.treatment ? 'Tratativa' : 'Justificativa'}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm">
                                        <p className="font-semibold mb-1">
                                          {call.treatment ? 'Tratativa:' : 'Justificativa:'}
                                        </p>
                                        <p>{call.treatment || call.validation_reason}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
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
                                    <Check className="h-4 w-4 mr-1" />
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
                                    <CheckCircle className="h-4 w-4 mr-1" />
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
                                        <AlertDialogDescription>
                                          Esta ação não pode ser desfeita.
                                        </AlertDialogDescription>
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
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum chamado encontrado</p>
                  </div>
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
