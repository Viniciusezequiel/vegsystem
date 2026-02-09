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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';

interface ClassroomCallValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callId: string;
  mode: 'accept' | 'resolve';
  onConfirm: (data: { isValid?: boolean; validationReason?: string; treatment?: string }) => void;
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
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [validationReason, setValidationReason] = useState('');
  const [treatment, setTreatment] = useState('');

  const handleConfirm = () => {
    if (mode === 'accept') {
      onConfirm({ 
        isValid: isValid ?? undefined, 
        validationReason: validationReason || undefined 
      });
    } else {
      onConfirm({ treatment: treatment || undefined });
    }
    // Reset form
    setIsValid(null);
    setValidationReason('');
    setTreatment('');
  };

  const canSubmit = mode === 'accept' 
    ? isValid !== null && (isValid || validationReason.trim().length > 0)
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
              ? 'Informe se a intercorrência procede e, se necessário, adicione uma justificativa.'
              : 'Descreva a tratativa realizada para resolver o chamado.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {mode === 'accept' ? (
            <>
              <div className="space-y-3">
                <Label>A intercorrência procede?</Label>
                <RadioGroup
                  value={isValid === null ? '' : isValid ? 'yes' : 'no'}
                  onValueChange={(value) => setIsValid(value === 'yes')}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="valid-yes" />
                    <Label htmlFor="valid-yes" className="font-normal cursor-pointer">
                      Sim, procede
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="valid-no" />
                    <Label htmlFor="valid-no" className="font-normal cursor-pointer">
                      Não procede
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="validationReason">
                  {isValid === false ? 'Justificativa (obrigatório)' : 'Justificativa (opcional)'}
                </Label>
                <Textarea
                  id="validationReason"
                  placeholder={isValid === false 
                    ? 'Informe o motivo pelo qual a intercorrência não procede...'
                    : 'Adicione observações sobre o chamado...'}
                  value={validationReason}
                  onChange={(e) => setValidationReason(e.target.value)}
                  rows={3}
                />
              </div>
            </>
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
