import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, CheckCircle, Loader2, Navigation, Clock, MessageSquare } from 'lucide-react';
import { useCreateClassroomCall } from '@/hooks/useClassroomCalls';

interface CallStatus {
  status: 'pending' | 'accepted' | 'resolved';
  accepted_by_name?: string;
  accepted_at?: string;
  response_message?: string;
}

interface RoomConfig {
  id: string;
  name: string;
  campus: string;
  issues: { id: string; description: string }[];
}

export default function ClassroomCallForm() {
  const [searchParams] = useSearchParams();
  const createCall = useCreateClassroomCall();
  const [selectedCampus, setSelectedCampus] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedIssueId, setSelectedIssueId] = useState('');
  const [customIssueText, setCustomIssueText] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [submittedCallId, setSubmittedCallId] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus | null>(null);
  const [rooms, setRooms] = useState<RoomConfig[]>([]);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [submittedRoomName, setSubmittedRoomName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derive unique campuses from rooms
  const campuses = useMemo(() => {
    const unique = [...new Set(rooms.map(r => r.campus))];
    unique.sort();
    return unique;
  }, [rooms]);

  // Filter rooms by selected campus
  const filteredRooms = useMemo(() => {
    if (!selectedCampus) return [];
    return rooms.filter(r => r.campus === selectedCampus);
  }, [rooms, selectedCampus]);

  // Fetch rooms config directly from database (faster than edge function)
  const fetchConfig = async () => {
    try {
      const [roomsResult, issuesResult] = await Promise.all([
        supabase
          .from('classroom_call_rooms')
          .select('id, name, campus')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('classroom_call_room_issues')
          .select('id, room_id, description')
          .eq('is_active', true)
          .order('order_index'),
      ]);

      if (roomsResult.error) throw roomsResult.error;
      if (issuesResult.error) throw issuesResult.error;

      const roomsWithIssues: RoomConfig[] = (roomsResult.data || []).map(room => ({
        ...room,
        issues: (issuesResult.data || []).filter(i => i.room_id === room.id),
      }));

      setRooms(roomsWithIssues);

      // Auto-select room from URL param
      const urlRoom = searchParams.get('sala') || searchParams.get('room');
      if (urlRoom) {
        const found = roomsWithIssues.find(r =>
          r.name.toLowerCase() === urlRoom.toLowerCase()
        );
        if (found) {
          setSelectedCampus(found.campus);
          setSelectedRoomId(found.id);
        }
      }
    } catch (e) {
      console.error('Failed to load config:', e);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [searchParams]);

  // Subscribe to realtime updates on rooms and issues config
  useEffect(() => {
    const roomsChannel = supabase
      .channel('classroom-call-rooms-config')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'classroom_call_rooms' },
        () => { fetchConfig(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'classroom_call_room_issues' },
        () => { fetchConfig(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomsChannel);
    };
  }, []);

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const selectedIssue = selectedRoom?.issues.find(i => i.id === selectedIssueId);

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
            response_message: newData.response_message,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [submittedCallId]);

  const handleCampusChange = (campus: string) => {
    setSelectedCampus(campus);
    setSelectedRoomId('');
    setSelectedIssueId('');
  };

  const handleRoomChange = (roomId: string) => {
    setSelectedRoomId(roomId);
    setSelectedIssueId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;
    
    setIsSubmitting(true);
    try {
      const roomName = `${selectedRoom.name} (${selectedRoom.campus})`;
      let reason = '';
      if (selectedIssue?.description) {
        reason = selectedIssue.description;
        if (additionalInfo.trim()) {
          reason += ' — ' + additionalInfo.trim();
        }
      } else {
        reason = additionalInfo.trim();
      }

      const { data, error } = await supabase
        .from('classroom_calls')
        .insert({
          room_name: roomName,
          reason: reason,
          status: 'pending',
          campus: selectedRoom.campus,
        })
        .select('id, status')
        .single();

      if (error) {
        throw new Error(error.message || 'Erro ao criar chamado');
      }

      setSubmittedRoomName(roomName);
      setSubmittedCallId(data.id);
      setCallStatus({ status: data.status as 'pending' });
    } catch (error: any) {
      console.error('Error creating call:', error);
      createCall.mutate({ room_name: selectedRoom.name, reason: selectedIssue?.description || additionalInfo });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewCall = () => {
    setSubmittedCallId(null);
    setCallStatus(null);
    setSelectedIssueId('');
    setAdditionalInfo('');
  };

  // Determine if form can be submitted
  const hasIssues = selectedRoom && selectedRoom.issues.length > 0;
  const canSubmit = selectedRoomId && (hasIssues ? selectedIssueId : additionalInfo.trim());

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
                <CardTitle className="text-2xl text-blue-600">Chamado Aceito!</CardTitle>
                <CardDescription className="text-base">
                  {callStatus.accepted_by_name ? (
                    <span><strong>{callStatus.accepted_by_name}</strong> aceitou seu chamado.</span>
                  ) : (
                    <span>Um colaborador aceitou seu chamado.</span>
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
                <p className="font-semibold">{submittedRoomName}</p>
              </div>

              {/* Show response message from collaborator */}
              {callStatus.status === 'accepted' && callStatus.response_message && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Mensagem do Colaborador</p>
                  </div>
                  <p className="text-blue-800 dark:text-blue-300 font-semibold">{callStatus.response_message}</p>
                </div>
              )}
              
              {/* Status indicator */}
              <div className="flex items-center justify-center gap-2 py-2">
                <div className={`w-3 h-3 rounded-full ${
                  callStatus.status === 'pending' ? 'bg-yellow-500 animate-pulse' :
                  callStatus.status === 'accepted' ? 'bg-blue-500 animate-pulse' :
                  'bg-green-500'
                }`} />
                <span className="text-sm text-muted-foreground">
                  {callStatus.status === 'pending' && 'Aguardando...'}
                  {callStatus.status === 'accepted' && 'Em atendimento...'}
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
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Bell className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Chamado de Sala</CardTitle>
          <CardDescription>
            Solicite atendimento de um colaborador
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingConfig ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Campus Selection */}
              <div className="space-y-2">
                <Label>Campus *</Label>
                <Select value={selectedCampus} onValueChange={handleCampusChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o campus..." />
                  </SelectTrigger>
                  <SelectContent>
                    {campuses.map((campus) => (
                      <SelectItem key={campus} value={campus}>
                        {campus}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Room Selection (filtered by campus) */}
              {selectedCampus && (
                <div className="space-y-2">
                  <Label>Sala *</Label>
                  <Select value={selectedRoomId} onValueChange={handleRoomChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a sala..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredRooms.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Issue Selection (if room has issues) */}
              {selectedRoom && selectedRoom.issues.length > 0 && (
                <div className="space-y-2">
                  <Label>Tipo do Problema *</Label>
                  <Select value={selectedIssueId} onValueChange={setSelectedIssueId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o problema..." />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedRoom.issues.map((issue) => (
                        <SelectItem key={issue.id} value={issue.id}>
                          {issue.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Additional Info (optional if has issues, required if no issues) */}
              {selectedRoomId && (
                <div className="space-y-2">
                  <Label htmlFor="additionalInfo">
                    {hasIssues ? 'Informações adicionais (opcional)' : 'Motivo do Chamado *'}
                  </Label>
                  <Textarea
                    id="additionalInfo"
                    placeholder={hasIssues ? 'Descreva detalhes adicionais...' : 'Descreva o motivo do chamado...'}
                    value={additionalInfo}
                    onChange={(e) => setAdditionalInfo(e.target.value)}
                    required={!hasIssues}
                    maxLength={500}
                    rows={3}
                  />
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isSubmitting || !canSubmit}
              >
                {isSubmitting ? (
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
