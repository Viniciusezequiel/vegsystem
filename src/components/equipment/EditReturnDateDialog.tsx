import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpdateLoanReturnDate } from '@/hooks/useEquipment';
import { GroupedLoan } from '@/pages/equipment/EquipmentLoans';

interface EditReturnDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: GroupedLoan | null;
}

export function EditReturnDateDialog({
  open,
  onOpenChange,
  group,
}: EditReturnDateDialogProps) {
  const [date, setDate] = useState<Date | undefined>(
    group ? parseISO(group.expected_return_date) : undefined
  );
  const updateReturnDate = useUpdateLoanReturnDate();

  const handleSave = () => {
    if (!group || !date) return;
    const formatted = format(date, 'yyyy-MM-dd');
    updateReturnDate.mutate(
      {
        loanIds: group.loans.map((l) => l.id),
        expected_return_date: formatted,
      },
      {
        onSuccess: () => onOpenChange(false),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4" />
            Alterar Data de Devolução
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nova data de devolução prevista</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione uma data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          {group && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
              <p className="font-medium text-foreground">{group.borrower_name}</p>
              <p>
                {group.loans.length} equipamento(s) — devolução atual:{' '}
                {format(parseISO(group.expected_return_date), 'dd/MM/yyyy')}
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!date || updateReturnDate.isPending}>
              {updateReturnDate.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
