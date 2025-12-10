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
import { Bell, BellRing, Check, CheckCircle, Clock, Trash2, Volume2, VolumeX, ExternalLink } from 'lucide-react';
import { useClassroomCalls, useAcceptClassroomCall, useResolveClassroomCall, useDeleteClassroomCall, usePendingCallsCount, ClassroomCall } from '@/hooks/useClassroomCalls';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

const statusConfig = {
  pending: { label: 'Pendente', variant: 'destructive' as const, icon: BellRing },
  accepted: { label: 'Em Atendimento', variant: 'secondary' as const, icon: Clock },
  resolved: { label: 'Resolvido', variant: 'outline' as const, icon: CheckCircle },
};

export default function ClassroomCallsList() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('pending');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [previousPendingCount, setPreviousPendingCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { data: calls, isLoading } = useClassroomCalls(activeTab === 'all' ? undefined : activeTab);
  const { data: pendingCount } = usePendingCallsCount();
  const acceptCall = useAcceptClassroomCall();
  const resolveCall = useResolveClassroomCall();
  const deleteCall = useDeleteClassroomCall();

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleDoAAABBmeDrl1wEChU4drjeyIhlJxFnvObdbj4BABQvYqHNzptbKhZPnNnPe0sGABM/cpnNynNKFA5RndvMfEsDAA9Ed5THzHZGDApWod3Lf0cCAAxHe5TGy3dECgZbpd/KgUUAAApKf5TFyng/BwNgqeHJgkIAAAdNgpXDynk9BQBkrOTIg0AAAQVPhZfByno6AwBns+fGhD0AAANRh5rAyXo4AQBsuOrEhDsAAAFTipzAyHs2AAB0v+3ChDoAAABVjJ3AyHo0AAB8xvDAhDkAAABXjp+/x3ozAACD0PHAhDgAAABZkKC+xnkyAAGK2fO/hDcAAABbkqK9xXgwAAGR4fa+hDUAAABdlKO8xHcvAAKY5/i9gzQAAABfl6W7w3YtAAOf7Pq8gzIAAABhmKe6wnUrAASm8fy7gi8AAABjmqi5wXQpAAWt9/66gS0AAABlnKq4wHMnAAa0/QC5gCsAAABnnqu3v3ImAAe7/wG4fyoAAABpoa21vnEkAAnC/wK2fiMAAABro663vXAiAAjL/wO1fCIAAABtpK62vG8hAArS/wSzeyAAEABvprC1u24fAAvZ/wWyeR4AEABxqLK0um0dAA3h/wawdxwAEABzqrOzuWwbAA7p/waudhoAEAB1rLWyuGsZABDx/wisc/+/');
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Play sound when new pending calls arrive
  useEffect(() => {
    if (pendingCount !== undefined && pendingCount > previousPendingCount && soundEnabled && pendingCount > 0) {
      // Play sound repeatedly while there are pending calls
      const playSound = () => {
        if (audioRef.current && soundEnabled) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(console.error);
        }
      };
      
      playSound();
      
      // Set up interval to repeat sound every 5 seconds
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      if (pendingCount > 0) {
        intervalRef.current = setInterval(playSound, 5000);
      }
    }
    
    // Stop sound when no pending calls
    if (pendingCount === 0 && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setPreviousPendingCount(pendingCount || 0);
  }, [pendingCount, soundEnabled, previousPendingCount]);

  // Stop sound when user interacts
  useEffect(() => {
    if (!soundEnabled && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [soundEnabled]);

  const handleAccept = async (id: string) => {
    await acceptCall.mutateAsync(id);
    // Stop sound when call is accepted
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const copyExternalLink = () => {
    const link = `${window.location.origin}/chamado-sala`;
    navigator.clipboard.writeText(link);
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
                            <TableCell className="max-w-xs truncate">{call.reason}</TableCell>
                            <TableCell>
                              <Badge variant={status.variant} className="gap-1">
                                <StatusIcon className="h-3 w-3" />
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatDate(call.created_at)}</TableCell>
                            <TableCell>{call.accepted_by_name || '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {call.status === 'pending' && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleAccept(call.id)}
                                    disabled={acceptCall.isPending}
                                  >
                                    <Check className="h-4 w-4 mr-1" />
                                    Aceitar
                                  </Button>
                                )}
                                {call.status === 'accepted' && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => resolveCall.mutate(call.id)}
                                    disabled={resolveCall.isPending}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Resolver
                                  </Button>
                                )}
                                {isAdmin && (
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
    </MainLayout>
  );
}
