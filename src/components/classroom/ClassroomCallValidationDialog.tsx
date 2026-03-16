import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useClassroomCallResponses } from '@/hooks/useClassroomCallSettings';

interface ClassroomCallValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callId: string;
  mode: 'accept' | 'resolve';
  onConfirm: (data: { responseMessage?: string; treatment?: string }) => void;
  isPending: boolean;
}

export default function ClassroomCallValidationDialog({
  open,
  onOpenChange,
  callId,
  mode,
  onConfirm,
  isPending,
}: ClassroomCallValidationDialogProps) {
  const [selectedResponse, setSelectedResponse] = useState('');
  const [treatment, setTreatment] = useState('');

  const { data: responses = [] } = useClassroomCallResponses(true);

  const handleConfirm = () => {
    if (mode === 'accept') {
      onConfirm({ responseMessage: selectedResponse || undefined });
    } else {
      onConfirm({ treatment: treatment || undefined });
    }
    setSelectedResponse('');
    setTreatment('');
  };

  const canSubmit = mode === 'accept' 
    ? true // Accept is always possible, response is optional
    : treatment.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'accept' ? 'Aceitar Chamado' : 'Resolver Chamado'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'accept' 
              ? 'Selecione uma mensagem para o solicitante (opcional).'
              : 'Descreva a tratativa realizada para resolver o chamado.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {mode === 'accept' ? (
            <div className="space-y-2">
              <Label>Mensagem para o solicitante</Label>
              {responses.length > 0 ? (
                <Select value={selectedResponse} onValueChange={setSelectedResponse}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma resposta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {responses.map((resp) => (
                      <SelectItem key={resp.id} value={resp.message}>
                        {resp.message}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma resposta pré-definida cadastrada. Configure em Configurações de Chamados.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="treatment">Tratativa Realizada *</Label>
              <Textarea
                id="treatment"
                placeholder="Descreva o que foi feito para resolver o chamado..."
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
                rows={4}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit || isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mode === 'accept' ? 'Aceitar Chamado' : 'Resolver Chamado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
