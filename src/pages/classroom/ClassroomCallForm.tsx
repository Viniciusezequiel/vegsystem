import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Bell, CheckCircle, Loader2, Navigation, Clock, Settings, X } from 'lucide-react';
import { useCreateClassroomCall } from '@/hooks/useClassroomCalls';

interface CallStatus {
  status: 'pending' | 'accepted' | 'resolved';
  accepted_by_name?: string;
  accepted_at?: string;
}

const ROOM_NAME_STORAGE_KEY = 'classroom_call_room_name';

export default function ClassroomCallForm() {
  const [searchParams] = useSearchParams();
  const createCall = useCreateClassroomCall();
  const [roomName, setRoomName] = useState('');
  const [reason, setReason] = useState('');
  const [submittedCallId, setSubmittedCallId] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus | null>(null);
  const [isRoomLocked, setIsRoomLocked] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Initialize room name from URL param or localStorage
  useEffect(() => {
    const urlRoom = searchParams.get('sala') || searchParams.get('room');
    const savedRoom = localStorage.getItem(ROOM_NAME_STORAGE_KEY);
    
    if (urlRoom) {
      setRoomName(urlRoom);
      setIsRoomLocked(true);
      localStorage.setItem(ROOM_NAME_STORAGE_KEY, urlRoom);
    } else if (savedRoom) {
      setRoomName(savedRoom);
      setIsRoomLocked(true);
    }
  }, [searchParams]);

  const handleSaveRoom = () => {
    if (roomName.trim()) {
      localStorage.setItem(ROOM_NAME_STORAGE_KEY, roomName.trim());
      setIsRoomLocked(true);
      setShowSettings(false);
    }
  };

  const handleClearRoom = () => {
    localStorage.removeItem(ROOM_NAME_STORAGE_KEY);
    setIsRoomLocked(false);
    setRoomName('');
    setShowSettings(false);
  };

  // Subscribe to real-time updates for the submitted call
  useEffect(() => {
    if (!submittedCallId) return;

    const channel = supabase
      .channel(`call-${submittedCallId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'classroom_calls',
          filter: `id=eq.${submittedCallId}`,
        },
        (payload) => {
          const newData = payload.new as any;
          setCallStatus({
            status: newData.status,
            accepted_by_name: newData.accepted_by_name,
            accepted_at: newData.accepted_at,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [submittedCallId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Use edge function to create call (allows unauthenticated access)
      const { data, error } = await supabase.functions.invoke('create-classroom-call', {
        body: {
          room_name: roomName,
          reason: reason,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Erro ao criar chamado');
      }

      setSubmittedCallId(data.data.id);
      setCallStatus({ status: data.data.status as 'pending' });
    } catch (error: any) {
      createCall.mutate({ room_name: roomName, reason }); // Use mutation for error handling/toast
    }
  };

  const handleNewCall = () => {
    setSubmittedCallId(null);
    setCallStatus(null);
    setReason('');
    // Keep room name if locked
  };

  if (submittedCallId && callStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            {callStatus.status === 'pending' && (
              <>
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-yellow-100 flex items-center justify-center animate-pulse">
                  <Clock className="h-8 w-8 text-yellow-600" />
                </div>
                <CardTitle className="text-2xl text-yellow-600">Aguardando Atendimento</CardTitle>
                <CardDescription className="text-base">
                  Seu chamado foi recebido. Aguarde enquanto um colaborador aceita o chamado.
                </CardDescription>
              </>
            )}
            
            {callStatus.status === 'accepted' && (
              <>
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                  <Navigation className="h-8 w-8 text-blue-600 animate-bounce" />
                </div>
                <CardTitle className="text-2xl text-blue-600">Estamos a Caminho!</CardTitle>
                <CardDescription className="text-base">
                  {callStatus.accepted_by_name ? (
                    <span><strong>{callStatus.accepted_by_name}</strong> aceitou seu chamado e está indo até você.</span>
                  ) : (
                    <span>Um colaborador aceitou seu chamado e está a caminho.</span>
                  )}
                </CardDescription>
              </>
            )}
            
            {callStatus.status === 'resolved' && (
              <>
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="text-2xl text-green-600">Chamado Resolvido</CardTitle>
                <CardDescription className="text-base">
                  Seu chamado foi atendido e marcado como resolvido.
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Sala</p>
                <p className="font-semibold">{roomName}</p>
              </div>
              
              {/* Status indicator */}
              <div className="flex items-center justify-center gap-2 py-2">
                <div className={`w-3 h-3 rounded-full ${
                  callStatus.status === 'pending' ? 'bg-yellow-500 animate-pulse' :
                  callStatus.status === 'accepted' ? 'bg-blue-500 animate-pulse' :
                  'bg-green-500'
                }`} />
                <span className="text-sm text-muted-foreground">
                  {callStatus.status === 'pending' && 'Aguardando...'}
                  {callStatus.status === 'accepted' && 'A caminho...'}
                  {callStatus.status === 'resolved' && 'Concluído'}
                </span>
              </div>
              
              <Button 
                onClick={handleNewCall}
                variant="outline"
                className="w-full"
              >
                Enviar Novo Chamado
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={() => setShowSettings(!showSettings)}
            title="Configurar sala"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Bell className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Chamado de Sala</CardTitle>
          <CardDescription>
            Solicite atendimento de um colaborador
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showSettings ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <h3 className="font-medium text-sm">Configurar Sala Fixa</h3>
                <p className="text-xs text-muted-foreground">
                  Configure o nome da sala para não precisar digitar novamente. 
                  Você também pode acessar via URL: <code className="bg-background px-1 rounded">/classroom-calls?sala=Nome</code>
                </p>
                <div className="space-y-2">
                  <Label htmlFor="config-room">Nome da Sala</Label>
                  <Input
                    id="config-room"
                    placeholder="Ex: Sala 101, Laboratório 3..."
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    maxLength={100}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveRoom} disabled={!roomName.trim()} className="flex-1">
                    Salvar
                  </Button>
                  {isRoomLocked && (
                    <Button onClick={handleClearRoom} variant="outline">
                      <X className="h-4 w-4 mr-1" />
                      Limpar
                    </Button>
                  )}
                </div>
              </div>
              <Button variant="ghost" className="w-full" onClick={() => setShowSettings(false)}>
                Voltar
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="room">Sala *</Label>
                {isRoomLocked ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-3 bg-muted rounded-md font-medium">
                      {roomName}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowSettings(true)}
                      title="Alterar sala"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Input
                    id="room"
                    placeholder="Ex: Sala 101, Laboratório 3..."
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    required
                    maxLength={100}
                  />
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="reason">Motivo do Chamado *</Label>
                <Textarea
                  id="reason"
                  placeholder="Descreva brevemente o motivo do chamado..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  maxLength={500}
                  rows={4}
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={createCall.isPending || !roomName.trim() || !reason.trim()}
              >
                {createCall.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Bell className="mr-2 h-4 w-4" />
                    Enviar Chamado
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
