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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ArrowLeftRight } from 'lucide-react';
import { Locker } from '@/hooks/useLockers';

interface LockerExchangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (newLockerId: string, reason: string) => void;
  currentLocker: Locker | null;
  availableLockers: Locker[];
  isPending?: boolean;
}

export function LockerExchangeDialog({
  open,
  onOpenChange,
  onConfirm,
  currentLocker,
  availableLockers,
  isPending = false,
}: LockerExchangeDialogProps) {
  const [selectedLockerId, setSelectedLockerId] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLockerId) return;
    onConfirm(selectedLockerId, reason);
  };

  const resetForm = () => {
    setSelectedLockerId('');
    setReason('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5" />
            Trocar Escaninho
          </DialogTitle>
          <DialogDescription>
            Trocar o escaninho "{currentLocker?.code}" por outro disponível
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Escaninho Atual</Label>
            <div className="mt-1.5 p-3 bg-muted rounded-md">
              <p className="font-medium">{currentLocker?.code}</p>
              <p className="text-sm text-muted-foreground">
                {currentLocker?.campus} - {currentLocker?.location}
              </p>
            </div>
          </div>
          <div>
            <Label htmlFor="new-locker">Novo Escaninho *</Label>
            <Select value={selectedLockerId} onValueChange={setSelectedLockerId} required>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Selecione um escaninho disponível" />
              </SelectTrigger>
              <SelectContent>
                {availableLockers
                  .filter(l => l.id !== currentLocker?.id)
                  .map((locker) => (
                    <SelectItem key={locker.id} value={locker.id}>
                      {locker.code} - {locker.campus} ({locker.location})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="exchange-reason">Motivo da Troca *</Label>
            <Textarea
              id="exchange-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Informe o motivo da troca de escaninho..."
              rows={3}
              className="mt-1.5"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !selectedLockerId}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Troca
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
