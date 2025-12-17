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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';
import { SignaturePad } from '@/components/ui/SignaturePad';

interface ReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: ReturnData) => void;
  itemName: string;
  borrowerName: string;
  isPending?: boolean;
}

export interface ReturnData {
  returner_name: string;
  returner_phone: string;
  returner_sector: string;
  item_condition: 'good' | 'damaged' | 'missing_parts';
  notes?: string;
  return_signature?: string;
}

export function ReturnDialog({
  open,
  onOpenChange,
  onConfirm,
  itemName,
  borrowerName,
  isPending = false,
}: ReturnDialogProps) {
  const [returnerName, setReturnerName] = useState(borrowerName);
  const [returnerPhone, setReturnerPhone] = useState('');
  const [returnerSector, setReturnerSector] = useState('');
  const [itemCondition, setItemCondition] = useState<'good' | 'damaged' | 'missing_parts'>('good');
  const [notes, setNotes] = useState('');
  const [signature, setSignature] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signature) {
      return;
    }
    onConfirm({
      returner_name: returnerName,
      returner_phone: returnerPhone,
      returner_sector: returnerSector,
      item_condition: itemCondition,
      notes: notes || undefined,
      return_signature: signature,
    });
  };

  const resetForm = () => {
    setReturnerName(borrowerName);
    setReturnerPhone('');
    setReturnerSector('');
    setItemCondition('good');
    setNotes('');
    setSignature(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Devolução</DialogTitle>
          <DialogDescription>
            Registre a devolução de "{itemName}"
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="returner-phone">Telefone *</Label>
              <Input
                id="returner-phone"
                value={returnerPhone}
                onChange={(e) => setReturnerPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="returner-sector">Setor *</Label>
              <Input
                id="returner-sector"
                value={returnerSector}
                onChange={(e) => setReturnerSector(e.target.value)}
                placeholder="Ex: TI"
                required
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label>Condição do Item *</Label>
            <RadioGroup
              value={itemCondition}
              onValueChange={(v) => setItemCondition(v as any)}
              className="mt-2 space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="good" id="good" />
                <Label htmlFor="good" className="font-normal cursor-pointer">
                  Em boas condições
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="damaged" id="damaged" />
                <Label htmlFor="damaged" className="font-normal cursor-pointer">
                  Danificado
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="missing_parts" id="missing_parts" />
                <Label htmlFor="missing_parts" className="font-normal cursor-pointer">
                  Faltando peças/acessórios
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div>
            <Label htmlFor="return-notes">Observações</Label>
            <Textarea
              id="return-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informações adicionais sobre a devolução..."
              rows={2}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Assinatura de quem está devolvendo *</Label>
            <div className="mt-1.5">
              <SignaturePad
                onSignatureChange={setSignature}
                width={350}
                height={150}
              />
            </div>
            {!signature && (
              <p className="text-sm text-destructive mt-1">Assinatura obrigatória</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !signature}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Devolução
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}