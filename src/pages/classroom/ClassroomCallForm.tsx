import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, CheckCircle, Loader2, Navigation, Clock, MessageSquare, Building2, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
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

  const campuses = useMemo(() => {
    const unique = [...new Set(rooms.map(r => r.campus))];
    unique.sort();
    return unique;
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    if (!selectedCampus) return [];
    return rooms.filter(r => r.campus === selectedCampus);
  }, [rooms, selectedCampus]);

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

      const urlRoom = searchParams.get('sala') || searchParams.get('room');
      if (urlRoom) {
        const found = roomsWithIssues.find(r => r.name.toLowerCase() === urlRoom.toLowerCase());
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

  useEffect(() => {
    if (!submittedCallId) return;

    let active = true;
    const fetchStatus = async () => {
      const { data, error } = await supabase.rpc('get_public_classroom_call_status', {
        p_id: submittedCallId,
      });
      if (!active || error) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setCallStatus({
          status: (row as any).status,
          accepted_by_name: (row as any).accepted_by_name,
          accepted_at: (row as any).accepted_at,
          response_message: (row as any).response_message,
        });
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [submittedCallId]);

  const handleCampusChange = (campus: string) => {
    setSelectedCampus(campus);
    setSelectedRoomId('');
    setSelectedIssueId('');
    setCustomIssueText('');
  };

  const handleRoomChange = (roomId: string) => {
    setSelectedRoomId(roomId);
    setSelectedIssueId('');
    setCustomIssueText('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;

    setIsSubmitting(true);
    try {
      const roomName = `${selectedRoom.name} (${selectedRoom.campus})`;
      let reason = '';
      if (selectedIssueId === '__other__') {
        reason = customIssueText.trim();
        if (additionalInfo.trim()) reason += ' — ' + additionalInfo.trim();
      } else if (selectedIssue?.description) {
        reason = selectedIssue.description;
        if (additionalInfo.trim()) reason += ' — ' + additionalInfo.trim();
      } else {
        reason = additionalInfo.trim();
      }

      const { data, error } = await supabase.rpc('create_public_classroom_call', {
        p_room_name: roomName,
        p_reason: reason,
        p_campus: selectedRoom.campus,
      });

      if (error) throw new Error(error.message || 'Erro ao criar chamado');

      setSubmittedRoomName(roomName);
      setSubmittedCallId(data as unknown as string);
      setCallStatus({ status: 'pending' });
    } catch (error: any) {
      console.error('Error creating call:', error);
      toast({
        title: 'Erro ao enviar chamado',
        description: error.message || 'Não foi possível criar o chamado. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewCall = () => {
    setSubmittedCallId(null);
    setCallStatus(null);
    setSelectedIssueId('');
    setCustomIssueText('');
    setAdditionalInfo('');
  };

  const hasIssues = selectedRoom && selectedRoom.issues.length > 0;
  const isOther = selectedIssueId === '__other__';
  const canSubmit = selectedRoomId && (
    hasIssues
      ? (isOther ? customIssueText.trim() : selectedIssueId)
      : additionalInfo.trim()
  );

  const statusPresentation = callStatus?.status === 'accepted'
    ? {
        icon: Navigation,
        iconClass: 'bg-primary/10 text-primary',
        title: 'Chamado aceito',
        titleClass: 'text-primary',
        description: callStatus.accepted_by_name
          ? `${callStatus.accepted_by_name} aceitou seu chamado e está em atendimento.`
          : 'Um colaborador aceitou seu chamado e está em atendimento.',
      }
    : callStatus?.status === 'resolved'
      ? {
          icon: CheckCircle,
          iconClass: 'bg-emerald-500/10 text-emerald-600',
          title: 'Chamado resolvido',
          titleClass: 'text-emerald-600',
          description: 'Seu chamado foi atendido e marcado como resolvido.',
        }
      : {
          icon: Clock,
          iconClass: 'bg-amber-500/10 text-amber-600',
          title: 'Aguardando atendimento',
          titleClass: 'text-amber-600',
          description: 'Seu chamado foi recebido e já está disponível para a equipe de apoio.',
        };

  if (submittedCallId && callStatus) {
    const StatusIcon = statusPresentation.icon;
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_35%),radial-gradient(circle_at_bottom_right,hsl(var(--primary)/0.08),transparent_30%)]" />

        <Card className="relative z-10 w-full max-w-lg border-border/60 bg-card/85 shadow-2xl backdrop-blur-xl">
          <CardHeader className="pb-4 text-center">
            <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${statusPresentation.iconClass}`}>
              <StatusIcon className={`h-8 w-8 ${callStatus.status !== 'resolved' ? 'animate-pulse' : ''}`} />
            </div>
            <CardTitle className={`text-2xl font-semibold tracking-tight ${statusPresentation.titleClass}`}>
              {statusPresentation.title}
            </CardTitle>
            <CardDescription className="mx-auto max-w-sm text-sm leading-relaxed">
              {statusPresentation.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-muted/25 p-4">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Local do chamado</p>
                  <p className="font-semibold">{submittedRoomName}</p>
                </div>
              </div>
            </div>

            {callStatus.status === 'accepted' && callStatus.response_message && (
              <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4">
                <div className="mb-1 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium text-primary">Mensagem da equipe</p>
                </div>
                <p className="font-medium text-foreground">{callStatus.response_message}</p>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 rounded-lg border border-border/50 bg-background/40 py-2.5">
              <div className={`h-2.5 w-2.5 rounded-full ${
                callStatus.status === 'pending' ? 'bg-amber-500 animate-pulse' :
                callStatus.status === 'accepted' ? 'bg-primary animate-pulse' :
                'bg-emerald-500'
              }`} />
              <span className="text-sm text-muted-foreground">
                {callStatus.status === 'pending' && 'Aguardando aceite da equipe'}
                {callStatus.status === 'accepted' && 'Atendimento em andamento'}
                {callStatus.status === 'resolved' && 'Atendimento concluído'}
              </span>
            </div>

            <Button onClick={handleNewCall} variant="outline" className="w-full">
              Enviar Novo Chamado
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_35%),radial-gradient(circle_at_bottom_right,hsl(var(--primary)/0.08),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:linear-gradient(hsl(var(--foreground))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground))_1px,transparent_1px)] [background-size:48px_48px]" />

      <Card className="relative z-10 w-full max-w-lg border-border/60 bg-card/85 shadow-2xl backdrop-blur-xl">
        <CardHeader className="pb-4 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Bell className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight">Chamado de Sala</CardTitle>
          <CardDescription className="mx-auto max-w-sm leading-relaxed">
            Informe onde você está e o que precisa. A equipe receberá o chamado imediatamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingConfig ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando salas disponíveis...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/60 bg-muted/20 p-2 text-center text-[11px] text-muted-foreground">
                <div className={selectedCampus ? 'font-medium text-primary' : ''}>1. Campus</div>
                <div className={selectedRoomId ? 'font-medium text-primary' : ''}>2. Sala</div>
                <div className={selectedIssueId || (!hasIssues && additionalInfo) ? 'font-medium text-primary' : ''}>3. Motivo</div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Campus *
                </Label>
                <Select value={selectedCampus} onValueChange={handleCampusChange}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Selecione o campus..." />
                  </SelectTrigger>
                  <SelectContent>
                    {campuses.map((campus) => (
                      <SelectItem key={campus} value={campus}>{campus}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCampus && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Sala *
                  </Label>
                  <Select value={selectedRoomId} onValueChange={handleRoomChange}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Selecione a sala..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredRooms.map((room) => (
                        <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedRoom && selectedRoom.issues.length > 0 && (
                <div className="space-y-2">
                  <Label>Tipo do Problema *</Label>
                  <Select
                    value={selectedIssueId}
                    onValueChange={(v) => {
                      setSelectedIssueId(v);
                      if (v !== '__other__') setCustomIssueText('');
                    }}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Selecione o problema..." />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedRoom.issues.map((issue) => (
                        <SelectItem key={issue.id} value={issue.id}>{issue.description}</SelectItem>
                      ))}
                      <SelectItem value="__other__">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedIssueId === '__other__' && (
                    <Textarea
                      placeholder="Descreva o problema..."
                      value={customIssueText}
                      onChange={(e) => setCustomIssueText(e.target.value)}
                      required
                      maxLength={500}
                      rows={3}
                    />
                  )}
                </div>
              )}

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
                  <div className="text-right text-[11px] text-muted-foreground">{additionalInfo.length}/500</div>
                </div>
              )}

              <Button
                type="submit"
                className="h-11 w-full font-semibold"
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
