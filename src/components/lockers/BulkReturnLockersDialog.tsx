import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search } from 'lucide-react';
import { LockerLoan } from '@/hooks/useLockers';

interface BulkReturnLockersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loans: LockerLoan[];
  onConfirm: (loanIds: string[]) => void;
  isPending?: boolean;
}

export function BulkReturnLockersDialog({
  open,
  onOpenChange,
  loans,
  onConfirm,
  isPending = false,
}: BulkReturnLockersDialogProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) {
      setSelected(loans.map((l) => l.id));
      setQuery('');
    }
  }, [open, loans]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return loans;
    return loans.filter(
      (l) =>
        l.locker?.code?.toLowerCase().includes(q) ||
        l.borrower_name.toLowerCase().includes(q) ||
        (l.borrower_sector || '').toLowerCase().includes(q),
    );
  }, [loans, query]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const allFilteredSelected = filtered.length > 0 && filtered.every((l) => selected.includes(l.id));

  const toggleAllFiltered = () => {
    const ids = filtered.map((l) => l.id);
    setSelected((prev) =>
      allFilteredSelected ? prev.filter((i) => !ids.includes(i)) : Array.from(new Set([...prev, ...ids])),
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) onOpenChange(v); }}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Liberar escaninhos em massa</DialogTitle>
          <DialogDescription>
            Todos os escaninhos ativos vêm marcados. Desmarque os de colaboradores do setor que devem
            continuar ocupados e confirme para liberar os demais.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por escaninho, nome ou setor..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <Button type="button" variant="outline" size="sm" onClick={toggleAllFiltered}>
            {allFilteredSelected ? 'Desmarcar todos' : 'Marcar todos'}
          </Button>
          <span className="text-muted-foreground">
            {selected.length} de {loans.length} selecionados
          </span>
        </div>

        <ScrollArea className="flex-1 max-h-[45vh] pr-3">
          <div className="space-y-2">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma locação ativa encontrada.
              </p>
            )}
            {filtered.map((loan) => (
              <label
                key={loan.id}
                htmlFor={`bulk-${loan.id}`}
                className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50"
              >
                <Checkbox
                  id={`bulk-${loan.id}`}
                  checked={selected.includes(loan.id)}
                  onCheckedChange={() => toggle(loan.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{loan.locker?.code || 'N/A'}</span>
                    <Badge variant="outline">{loan.locker?.campus}</Badge>
                    {loan.borrower_sector && (
                      <Badge variant="secondary">{loan.borrower_sector}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {loan.borrower_name} • {loan.borrower_phone}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </ScrollArea>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Os escaninhos selecionados serão marcados como devolvidos e ficarão disponíveis.
          </Label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(selected)}
            disabled={isPending || selected.length === 0}
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Liberar {selected.length} escaninho(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
