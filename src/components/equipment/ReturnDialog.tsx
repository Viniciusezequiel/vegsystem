import { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { useAuth } from '@/contexts/AuthContext';

interface ReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: ReturnData) => void;
  itemName: string;
  itemNames?: { name: string; patrimony: string; quantity: number; loanId: string }[];
  borrowerName: string;
  isPending?: boolean;
}

export interface ReturnData {
  returner_name: string;
  returner_phone: string;
  returner_sector: string;
  item_condition: 'good' | 'damaged' | 'missing_parts';
  all_items_returned: boolean;
  pending_items_description?: string;
  notes?: string;
  return_signature?: string;
  return_collaborator_name?: string;
  /** IDs of loans being returned (for partial returns) */
  selectedLoanIds?: string[];
}

export function ReturnDialog({
  open,
  onOpenChange,
  onConfirm,
  itemName,
  itemNames,
  borrowerName,
  isPending = false,
}: ReturnDialogProps) {
  const { profile } = useAuth();
  const [returnerName, setReturnerName] = useState(borrowerName);
  const [returnerPhone, setReturnerPhone] = useState('');
  const [returnerSector, setReturnerSector] = useState('');
  const [itemCondition, setItemCondition] = useState<'good' | 'damaged' | 'missing_parts'>('good');
  const [pendingItemsDescription, setPendingItemsDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);

  const isGrouped = itemNames && itemNames.length > 1;
  const isPartialReturn = isGrouped && selectedLoanIds.length < (itemNames?.length || 0);

  // Initialize selected loan IDs when dialog opens
  useEffect(() => {
    if (open && itemNames) {
      setSelectedLoanIds(itemNames.map(i => i.loanId));
    }
  }, [open, itemNames]);

  const toggleLoanSelection = (loanId: string) => {
    setSelectedLoanIds(prev => {
      if (prev.includes(loanId)) {
        return prev.filter(id => id !== loanId);
      }
      return [...prev, loanId];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signature) return;
    if (selectedLoanIds.length === 0) return;

    onConfirm({
      returner_name: returnerName,
      returner_phone: returnerPhone,
      returner_sector: returnerSector,
      item_condition: itemCondition,
      all_items_returned: !isPartialReturn,
      pending_items_description: isPartialReturn
        ? `Itens pendentes: ${itemNames?.filter(i => !selectedLoanIds.includes(i.loanId)).map(i => `${i.name} (${i.patrimony})`).join(', ')}`
        : (pendingItemsDescription || undefined),
      notes: notes || undefined,
      return_signature: signature,
      return_collaborator_name: profile?.full_name || undefined,
      selectedLoanIds,
    });
  };

  const resetForm = () => {
    setReturnerName(borrowerName);
    setReturnerPhone('');
    setReturnerSector('');
    setItemCondition('good');
    setPendingItemsDescription('');
    setNotes('');
    setSignature(null);
    setSelectedLoanIds([]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Devolução</DialogTitle>
          <DialogDescription>
            {isGrouped ? (
              <span>Selecione os equipamentos que estão sendo devolvidos:</span>
            ) : (
              <span>Registre a devolução de "{itemName}"</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Item selection for grouped loans */}
        {isGrouped && itemNames && (
          <div className="space-y-2 border rounded-lg p-3">
            <Label className="font-medium text-sm">Equipamentos a devolver</Label>
            {itemNames.map((item) => (
              <div key={item.loanId} className="flex items-center gap-3 py-1">
                <Checkbox
                  id={`loan-${item.loanId}`}
                  checked={selectedLoanIds.includes(item.loanId)}
                  onCheckedChange={() => toggleLoanSelection(item.loanId)}
                />
                <label htmlFor={`loan-${item.loanId}`} className="flex-1 text-sm cursor-pointer">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">({item.patrimony}) Qtd: {item.quantity}</span>
                </label>
              </div>
            ))}
            {isPartialReturn && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                ⚠ Devolução parcial: {selectedLoanIds.length} de {itemNames.length} itens selecionados. Os demais permanecerão como empréstimo ativo.
              </p>
            )}
          </div>
        )}

        {/* Single item display */}
        {!isGrouped && itemNames && itemNames.length === 1 && (
          <div className="mt-2 space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="font-medium">{itemNames[0].name}</span>
              <span className="text-xs">({itemNames[0].patrimony})</span>
              <span className="text-xs">Qtd: {itemNames[0].quantity}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="returner-name">Nome de quem está devolvendo *</Label>
            <Input id="returner-name" value={returnerName} onChange={(e) => setReturnerName(e.target.value)} placeholder="Nome completo" required className="mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="returner-phone">Telefone *</Label>
              <Input id="returner-phone" value={returnerPhone} onChange={(e) => setReturnerPhone(e.target.value)} placeholder="(00) 00000-0000" required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="returner-sector">Setor *</Label>
              <Input id="returner-sector" value={returnerSector} onChange={(e) => setReturnerSector(e.target.value)} placeholder="Ex: TI" required className="mt-1.5" />
            </div>
          </div>

          <Separator />

          <div>
            <Label className="font-medium">Estado de conservação do(s) equipamento(s) *</Label>
            <RadioGroup value={itemCondition} onValueChange={(v) => setItemCondition(v as any)} className="mt-2 space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="good" id="good" />
                <Label htmlFor="good" className="font-normal cursor-pointer">Em condições de uso</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="damaged" id="damaged" />
                <Label htmlFor="damaged" className="font-normal cursor-pointer">Equipamento danificado</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="missing_parts" id="missing_parts" />
                <Label htmlFor="missing_parts" className="font-normal cursor-pointer">Faltando peças/acessórios</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="return-notes">Observações</Label>
            <Textarea id="return-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informações adicionais sobre a devolução..." rows={2} className="mt-1.5" />
          </div>

          {/* Collaborator info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Colaborador responsável pelo recebimento:</span>{' '}
              {profile?.full_name || 'Não identificado'}
            </p>
          </div>

          <div>
            <Label>Assinatura de quem está devolvendo *</Label>
            <div className="mt-1.5">
              <SignaturePad onSignatureChange={setSignature} height={150} />
            </div>
            {!signature && (
              <p className="text-sm text-destructive mt-1">Assinatura obrigatória</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isPending || !signature || selectedLoanIds.length === 0}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isPartialReturn
                ? `Devolver ${selectedLoanIds.length} de ${itemNames?.length} itens`
                : 'Confirmar Devolução'
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
