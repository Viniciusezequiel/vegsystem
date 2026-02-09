import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Bell, BellRing, Check, CheckCircle, Clock, Trash2, Volume2, VolumeX, ExternalLink, ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react';
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
  const { isAdmin } = useAuth();
  const { canApprove, canEdit, canDelete } = useUserPermissions();
  const [activeTab, setActiveTab] = useState('pending');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<'accept' | 'resolve'>('accept');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Permission checks for classroom calls
  const canManageCalls = isAdmin || canApprove('classroomCalls') || canEdit('classroomCalls');
  const canDeleteCalls = isAdmin || canDelete('classroomCalls');
  
  const { data: calls, isLoading } = useClassroomCalls(activeTab === 'all' ? undefined : activeTab);
  const { data: pendingCount } = usePendingCallsCount();
  const acceptCall = useAcceptClassroomCall();
  const resolveCall = useResolveClassroomCall();
  const deleteCall = useDeleteClassroomCall();

  // Initialize continuous alarm audio
  useEffect(() => {
    // Create oscillator-based continuous alarm
    const createAlarmSound = () => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      
      // Create pulsing effect for urgency
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      
      const pulseAlarm = () => {
        const now = audioContext.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      };
      
      oscillator.start();
      
      return { audioContext, oscillator, gainNode, pulseAlarm };
    };

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Play continuous alarm when there are pending calls
  useEffect(() => {
    if (pendingCount !== undefined && pendingCount > 0 && soundEnabled) {
      // Create audio context for continuous sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      oscillator.start();
      
      // Continuous pulsing alarm
      const pulseAlarm = () => {
        if (audioContext.state === 'running') {
          const now = audioContext.currentTime;
          gainNode.gain.cancelScheduledValues(now);
          gainNode.gain.setValueAtTime(0.25, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        }
      };
      
      pulseAlarm();
      intervalRef.current = setInterval(pulseAlarm, 300); // Rapid pulsing for continuous effect
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        oscillator.stop();
        audioContext.close();
      };
    } else {
      // Stop sound when no pending calls or sound disabled
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [pendingCount, soundEnabled]);

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

  const handleValidationConfirm = async (data: { isValid?: boolean; validationReason?: string; treatment?: string }) => {
    if (!selectedCallId) return;
    
    if (dialogMode === 'accept') {
      await acceptCall.mutateAsync({ 
        id: selectedCallId, 
        isValid: data.isValid, 
        validationReason: data.validationReason 
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
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={soundEnabled ? '' : 'text-muted-foreground'}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
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
