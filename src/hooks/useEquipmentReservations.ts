import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Equipment } from '@/hooks/useEquipment';

export type EquipmentReservation = {
  id: string;
  equipment_id: string;
  quantity_reserved: number;
  requester_name: string;
  requester_phone: string;
  requester_sector: string;
  requester_type: string;
  purpose: string | null;
  scheduled_pickup_date: string;
  expected_return_date: string;
  status: 'awaiting_pickup' | 'picked_up' | 'cancelled';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  reservation_group_id: string | null;
  equipment?: Equipment;
};

export type GroupedReservation = {
  groupId: string;
  reservations: EquipmentReservation[];
  requester_name: string;
  requester_phone: string;
  requester_sector: string;
  requester_type: string;
  scheduled_pickup_date: string;
  expected_return_date: string;
  status: string;
  purpose: string | null;
  notes: string | null;
};

export function useEquipmentReservations(status?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('equipment-reservations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'equipment_reservations' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['equipment-reservations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['equipment-reservations', status],
    queryFn: async () => {
      let query = supabase
        .from('equipment_reservations')
        .select('*, equipment(*)')
        .order('scheduled_pickup_date', { ascending: true });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EquipmentReservation[];
    },
  });
}

/**
 * Verifica se há conflito de datas para o mesmo equipamento.
 * Regra: Se o item será devolvido no dia X, a próxima reserva só pode começar no dia X+1 (buffer de 24h).
 * Verifica sobreposição entre [pickup, return] considerando o buffer.
 */
async function checkDateConflict(
  equipmentId: string,
  scheduledPickupDate: string,
  expectedReturnDate: string,
  quantityRequested: number,
  excludeReservationId?: string
): Promise<{ hasConflict: boolean; message: string }> {
  // Buscar todas as reservas ativas (awaiting_pickup) para este equipamento
  let query = supabase
    .from('equipment_reservations')
    .select('id, scheduled_pickup_date, expected_return_date, quantity_reserved')
    .eq('equipment_id', equipmentId)
    .eq('status', 'awaiting_pickup');

  if (excludeReservationId) {
    query = query.neq('id', excludeReservationId);
  }

  const { data: existingReservations, error } = await query;
  if (error) throw error;

  // Buscar empréstimos ativos para este equipamento
  const { data: activeLoans, error: loansError } = await supabase
    .from('equipment_loans')
    .select('id, expected_return_date, quantity_borrowed')
    .eq('equipment_id', equipmentId)
    .eq('status', 'active');

  if (loansError) throw loansError;

  // Para cada reserva/empréstimo existente, verificar sobreposição com buffer de 24h
  const newPickup = new Date(scheduledPickupDate);
  const newReturn = new Date(expectedReturnDate);

  // Check against existing reservations
  for (const res of (existingReservations || [])) {
    if (!res.expected_return_date) continue;

    const existingPickup = new Date(res.scheduled_pickup_date);
    const existingReturn = new Date(res.expected_return_date);

    // Add 1 day buffer after existing return
    const existingReturnPlusBuffer = new Date(existingReturn);
    existingReturnPlusBuffer.setDate(existingReturnPlusBuffer.getDate() + 1);

    // Add 1 day buffer after new return
    const newReturnPlusBuffer = new Date(newReturn);
    newReturnPlusBuffer.setDate(newReturnPlusBuffer.getDate() + 1);

    // Check overlap with buffer:
    // New reservation starts before existing return+buffer AND new return+buffer is after existing pickup
    const hasOverlap = newPickup < existingReturnPlusBuffer && newReturnPlusBuffer > existingPickup;

    if (hasOverlap) {
      const returnDateFormatted = existingReturn.toLocaleDateString('pt-BR');
      const nextAvailable = existingReturnPlusBuffer.toLocaleDateString('pt-BR');
      return {
        hasConflict: true,
        message: `Este equipamento já possui uma pré-reserva para esse período (devolução em ${returnDateFormatted}). A próxima data disponível para retirada é ${nextAvailable}.`,
      };
    }
  }

  // Check against active loans
  for (const loan of (activeLoans || [])) {
    if (!loan.expected_return_date) continue;

    const loanReturn = new Date(loan.expected_return_date);

    // Add 1 day buffer after loan return
    const loanReturnPlusBuffer = new Date(loanReturn);
    loanReturnPlusBuffer.setDate(loanReturnPlusBuffer.getDate() + 1);

    // New reservation pickup must be after loan return + buffer
    if (newPickup < loanReturnPlusBuffer) {
      const returnDateFormatted = loanReturn.toLocaleDateString('pt-BR');
      const nextAvailable = loanReturnPlusBuffer.toLocaleDateString('pt-BR');
      return {
        hasConflict: true,
        message: `Este equipamento está emprestado com devolução prevista em ${returnDateFormatted}. A próxima data disponível para retirada é ${nextAvailable}.`,
      };
    }
  }

  return { hasConflict: false, message: '' };
}

export function useCreateEquipmentReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reservation: {
      equipment_id: string;
      quantity_reserved: number;
      requester_name: string;
      requester_phone: string;
      requester_sector: string;
      requester_type: string;
      purpose?: string;
      scheduled_pickup_date: string;
      expected_return_date: string;
      notes?: string;
    }) => {
      // Validar data de devolução
      if (!reservation.expected_return_date) {
        throw new Error('A data prevista para devolução é obrigatória');
      }

      // Verificar estoque disponível antes de criar
      const { data: currentEquipment, error: equipError } = await supabase
        .from('equipment')
        .select('available_quantity, name')
        .eq('id', reservation.equipment_id)
        .single();

      if (equipError) throw equipError;

      if (currentEquipment.available_quantity < reservation.quantity_reserved) {
        throw new Error(`Estoque insuficiente para "${currentEquipment.name}". Disponível: ${currentEquipment.available_quantity}, Solicitado: ${reservation.quantity_reserved}`);
      }

      // Verificar conflito de datas com buffer de 24h
      const conflict = await checkDateConflict(
        reservation.equipment_id,
        reservation.scheduled_pickup_date,
        reservation.expected_return_date,
        reservation.quantity_reserved
      );

      if (conflict.hasConflict) {
        throw new Error(conflict.message);
      }

      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('equipment_reservations')
        .insert({
          ...reservation,
          created_by: user?.id,
        })
        .select('*, equipment(*)')
        .single();

      if (error) throw error;

      // Deduzir do estoque ao criar pré-reserva (usar valor já validado)
      const newAvailable = currentEquipment.available_quantity - reservation.quantity_reserved;
      const { error: stockError } = await supabase
        .from('equipment')
        .update({
          available_quantity: newAvailable,
        })
        .eq('id', reservation.equipment_id);

      if (stockError) {
        // Rollback: remover a reserva
        await supabase.from('equipment_reservations').delete().eq('id', data.id);
        throw new Error('Erro ao atualizar estoque: ' + stockError.message);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success('Pré-reserva registrada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useCancelReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Buscar reserva para restaurar estoque
      const { data: reservation, error: fetchError } = await supabase
        .from('equipment_reservations')
        .select('*, equipment(*)')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      if (reservation.status !== 'awaiting_pickup') {
        throw new Error('Apenas reservas aguardando retirada podem ser canceladas');
      }

      // Cancelar reserva
      const { error } = await supabase
        .from('equipment_reservations')
        .update({ status: 'cancelled' })
        .eq('id', id);
      if (error) throw error;

      // Restaurar estoque
      const currentAvailable = (reservation.equipment as any)?.available_quantity ?? 0;
      const { error: stockError } = await supabase
        .from('equipment')
        .update({
          available_quantity: currentAvailable + reservation.quantity_reserved,
        })
        .eq('id', reservation.equipment_id);

      if (stockError) {
        console.error('Erro ao restaurar estoque:', stockError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success('Reserva cancelada e estoque restaurado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao cancelar reserva: ' + error.message);
    },
  });
}

export function useMarkReservationPickedUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('equipment_reservations')
        .update({ status: 'picked_up' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success('Reserva marcada como retirada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar reserva: ' + error.message);
    },
  });
}
