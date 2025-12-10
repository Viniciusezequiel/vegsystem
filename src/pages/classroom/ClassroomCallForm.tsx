import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Bell, CheckCircle, Loader2 } from 'lucide-react';
import { useCreateClassroomCall } from '@/hooks/useClassroomCalls';

export default function ClassroomCallForm() {
  const navigate = useNavigate();
  const createCall = useCreateClassroomCall();
  const [roomName, setRoomName] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createCall.mutateAsync({
      room_name: roomName,
      reason: reason,
    });
    
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-600">Chamado Enviado!</CardTitle>
            <CardDescription className="text-base">
              Seu chamado foi recebido. Um colaborador será notificado e irá atendê-lo em breve.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Sala</p>
                <p className="font-semibold">{roomName}</p>
              </div>
              <Button 
                onClick={() => {
                  setSubmitted(false);
                  setRoomName('');
                  setReason('');
                }}
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="room">Sala *</Label>
              <Input
                id="room"
                placeholder="Ex: Sala 101, Laboratório 3..."
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                required
                maxLength={100}
              />
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
        </CardContent>
      </Card>
    </div>
  );
}
