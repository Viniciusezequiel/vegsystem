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
  expected_return_date: string | null;
  status: 'awaiting_pickup' | 'picked_up' | 'cancelled';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  equipment?: Equipment;
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
      expected_return_date?: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Check availability
      const { data: equipment, error: eqError } = await supabase
        .from('equipment')
        .select('available_quantity')
        .eq('id', reservation.equipment_id)
        .single();

      if (eqError) throw eqError;

      if (equipment.available_quantity < reservation.quantity_reserved) {
        throw new Error(`Quantidade indisponível. Disponível: ${equipment.available_quantity}`);
      }

      const { data, error } = await supabase
        .from('equipment_reservations')
        .insert({
          ...reservation,
          created_by: user?.id,
        })
        .select('*, equipment(*)')
        .single();

      if (error) throw error;

      // Deduzir do estoque imediatamente
      const newAvailable = equipment.available_quantity - reservation.quantity_reserved;
      await supabase
        .from('equipment')
        .update({
          available_quantity: newAvailable,
          status: newAvailable === 0 ? 'borrowed' : 'available',
        })
        .eq('id', reservation.equipment_id);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success('Pré-reserva registrada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar pré-reserva: ' + error.message);
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
      const equip = reservation.equipment as any;
      await supabase
        .from('equipment')
        .update({
          available_quantity: equip.available_quantity + reservation.quantity_reserved,
          status: 'available',
        })
        .eq('id', reservation.equipment_id);
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
