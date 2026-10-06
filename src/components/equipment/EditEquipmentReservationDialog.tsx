import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import type { GroupedReservation } from '@/hooks/useEquipmentReservations';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: GroupedReservation | null;
}

const overlapWithOneDayBuffer = (
  newPickup: string,
  newReturn: string,
  existingPickup: string,
  existingReturn: string,
) => {
  const start = new Date(`${newPickup}T12:00:00`);
  const end = new Date(`${newReturn}T12:00:00`);
  const existingStart = new Date(`${existingPickup}T12:00:00`);
  const existingEndPlusBuffer = new Date(`${existingReturn}T12:00:00`);
  existingEndPlusBuffer.setDate(existingEndPlusBuffer.getDate() + 1);
  const endPlusBuffer = new Date(end);
  endPlusBuffer.setDate(endPlusBuffer.getDate() + 1);
  return start < existingEndPlusBuffer && endPlusBuffer > existingStart;
};

export function EditEquipmentReservationDialog({ open, onOpenChange, group }: Props) {
  const queryClient = useQueryClient();
  const [requesterName, setRequesterName] = useState('');
  const [requesterPhone, setRequesterPhone] = useState('');
  const [requesterSector, setRequesterSector] = useState('');
  const [requesterType, setRequesterType] = useState('aluno');
  const [purpose, setPurpose] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open || !group) return;
    setRequesterName(group.requester_name || '');
    setRequesterPhone(group.requester_phone || '');
    setRequesterSector(group.requester_sector || '');
    setRequesterType(group.requester_type || 'aluno');
    setPurpose(group.purpose || '');
    setScheduledDate(group.scheduled_pickup_date || '');
    setExpectedReturnDate(group.expected_return_date || '');
    setNotes(group.notes || '');
  }, [open, group]);

  const updateReservation = useMutation({
    mutationFn: async () => {
      if (!group) throw new Error('Pré-reserva não encontrada.');
      if (!requesterName.trim() || !requesterPhone.trim() || !requesterSector.trim() || !scheduledDate || !expectedReturnDate) {
        throw new Error('Preencha nome, telefone, setor/curso, retirada e devolução.');
      }
      if (new Date(`${expectedReturnDate}T12:00:00`) < new Date(`${scheduledDate}T12:00:00`)) {
        throw new Error('A devolução não pode ser anterior à retirada.');
      }

      const reservationIds = group.reservations.map((reservation) => reservation.id);

      for (const reservation of group.reservations) {
        const { data: otherReservations, error: reservationError } = await supabase
          .from('equipment_reservations')
          .select('id,scheduled_pickup_date,expected_return_date')
          .eq('equipment_id', reservation.equipment_id)
          .eq('status', 'awaiting_pickup');
        if (reservationError) throw reservationError;

        for (const other of otherReservations || []) {
          if (reservationIds.includes(other.id) || !other.expected_return_date) continue;
          if (overlapWithOneDayBuffer(
            scheduledDate,
            expectedReturnDate,
            other.scheduled_pickup_date,
            other.expected_return_date,
          )) {
            throw new Error(`Conflito de data para ${reservation.equipment?.name || 'um dos equipamentos'} com outra pré-reserva.`);
          }
        }

        const { data: activeLoans, error: loanError } = await supabase
          .from('equipment_loans')
          .select('expected_return_date')
          .eq('equipment_id', reservation.equipment_id)
          .eq('status', 'active');
        if (loanError) throw loanError;

        for (const loan of activeLoans || []) {
          if (!loan.expected_return_date) continue;
          const availableFrom = new Date(`${loan.expected_return_date}T12:00:00`);
          availableFrom.setDate(availableFrom.getDate() + 1);
          const pickup = new Date(`${scheduledDate}T12:00:00`);
          if (pickup < availableFrom) {
            throw new Error(`O equipamento ${reservation.equipment?.name || ''} está emprestado e só poderá ser reservado após ${availableFrom.toLocaleDateString('pt-BR')}.`);
          }
        }
      }

      const { error } = await supabase
        .from('equipment_reservations')
        .update({
          requester_name: requesterName.trim(),
          requester_phone: requesterPhone.trim(),
          requester_sector: requesterSector.trim(),
          requester_type: requesterType,
          purpose: purpose.trim() || null,
          scheduled_pickup_date: scheduledDate,
          expected_return_date: expectedReturnDate,
          notes: notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .in('id', reservationIds)
        .eq('status', 'awaiting_pickup');

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['equipment-reservations'] });
      toast.success('Pré-reserva atualizada com sucesso!');
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!group) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Pré-Reserva</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border/45 bg-muted/20 p-3">
            <p className="text-xs font-semibold">Equipamentos reservados</p>
            <div className="mt-2 space-y-1.5">
              {group.reservations.map((reservation) => (
                <div key={reservation.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/35 bg-background/20 px-3 py-2 text-xs">
                  <span className="min-w-0 truncate font-medium">{reservation.equipment?.name || 'Equipamento'}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">Qtd. {reservation.quantity_reserved}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">Para preservar o estoque já reservado, os equipamentos e quantidades não são alterados nesta edição.</p>
          </div>

          <div className="space-y-2">
            <Label>Tipo de solicitante *</Label>
            <Select value={requesterType} onValueChange={setRequesterType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aluno">Aluno</SelectItem>
                <SelectItem value="professor">Professor</SelectItem>
                <SelectItem value="funcionario">Funcionário</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome do solicitante *</Label>
              <Input value={requesterName} onChange={(event) => setRequesterName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Setor / curso *</Label>
              <Input value={requesterSector} onChange={(event) => setRequesterSector(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Telefone *</Label>
              <Input value={requesterPhone} onChange={(event) => setRequesterPhone(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Finalidade</Label>
              <Input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="Aula, evento, projeto..." />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Data prevista para retirada *</Label>
              <DatePickerInput value={scheduledDate} onChange={setScheduledDate} placeholder="Selecionar data" />
            </div>
            <div className="space-y-2">
              <Label>Data prevista para devolução *</Label>
              <DatePickerInput value={expectedReturnDate} onChange={setExpectedReturnDate} placeholder="Selecionar data" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={updateReservation.isPending}>Cancelar</Button>
          <Button type="button" onClick={() => updateReservation.mutate()} disabled={updateReservation.isPending}>
            {updateReservation.isPending ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
