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

      // Check existing reservations for same equipment on same date
      const { data: existingReservations } = await supabase
        .from('equipment_reservations')
        .select('quantity_reserved')
        .eq('equipment_id', reservation.equipment_id)
        .eq('status', 'awaiting_pickup');

      const totalReserved = existingReservations?.reduce((sum, r) => sum + r.quantity_reserved, 0) || 0;
      const effectiveAvailable = equipment.available_quantity - totalReserved;

      if (effectiveAvailable < reservation.quantity_reserved) {
        throw new Error(`Quantidade indisponível. Disponível real: ${effectiveAvailable} (${totalReserved} já reservado(s))`);
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

export function useUpdateReservationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('equipment_reservations')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success('Status da reserva atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar status: ' + error.message);
    },
  });
}
