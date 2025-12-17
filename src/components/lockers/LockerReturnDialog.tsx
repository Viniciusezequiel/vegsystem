import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { Loader2 } from 'lucide-react';

interface LockerReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: LockerReturnData) => void;
  lockerCode: string;
  borrowerName: string;
  isPending?: boolean;
}

export interface LockerReturnData {
  returner_name: string;
  notes?: string;
  signature?: string;
}

export function LockerReturnDialog({
  open,
  onOpenChange,
  onConfirm,
  lockerCode,
  borrowerName,
  isPending = false,
}: LockerReturnDialogProps) {
  const [returnerName, setReturnerName] = useState(borrowerName);
  const [notes, setNotes] = useState('');
  const [signature, setSignature] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      returner_name: returnerName,
      notes: notes || undefined,
      signature: signature || undefined,
    });
  };

  const resetForm = () => {
    setReturnerName(borrowerName);
    setNotes('');
    setSignature(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Devolução</DialogTitle>
          <DialogDescription>
            Registre a devolução do escaninho "{lockerCode}"
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="returner-name">Nome de quem está devolvendo *</Label>
            <Input
              id="returner-name"
              value={returnerName}
              onChange={(e) => setReturnerName(e.target.value)}
              placeholder="Nome completo"
              required
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="return-notes">Observações</Label>
            <Textarea
              id="return-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informações adicionais sobre a devolução..."
              rows={3}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Assinatura de quem está devolvendo</Label>
            <div className="mt-1.5">
              <SignaturePad
                onSignatureChange={setSignature}
                width={350}
                height={150}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Devolução
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
