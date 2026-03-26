import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface RoomReservation {
  id: string;
  title: string;
  description: string | null;
  requester_name: string;
  requester_email: string;
  requester_phone: string | null;
  room_id: string;
  start_datetime: string;
  end_datetime: string;
  attendees_count: number;
  status: string;
  notes: string | null;
  is_external: boolean;
  is_fixed: boolean;
  created_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  room?: {
    id: string;
    name: string;
    code: string;
    campus: string;
    capacity: number;
    location: string | null;
  };
}

export interface ReservationRoom {
  id: string;
  name: string;
  code: string;
  campus: string;
  capacity: number;
  description: string | null;
  location: string | null;
  is_active: boolean;
  auto_confirm: boolean;
  max_advance_days: number | null;
}

export function useRoomReservations(filters?: {
  status?: string;
  campus?: string;
  roomId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['room-reservations', filters],
    queryFn: async () => {
      let query = supabase
        .from('reservations')
        .select('*, room:reservation_rooms!reservations_room_id_fkey(id, name, code, campus, capacity, location)')
        .order('start_datetime', { ascending: true });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.roomId) {
        query = query.eq('room_id', filters.roomId);
      }

      if (filters?.startDate) {
        query = query.gte('start_datetime', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('end_datetime', filters.endDate);
      }

      if (filters?.search) {
        const q = filters.search;
        query = query.or(`title.ilike.%${q}%,requester_name.ilike.%${q}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      let results = (data || []) as unknown as RoomReservation[];

      // Client-side campus filter (through room relation)
      if (filters?.campus) {
        results = results.filter(r => r.room?.campus === filters.campus);
      }

      return results;
    },
  });
}

export function useReservationRooms(campus?: string) {
  return useQuery({
    queryKey: ['reservation-rooms', campus],
    queryFn: async () => {
      let query = supabase
        .from('reservation_rooms')
        .select('*')
        .order('code');

      if (campus) {
        query = query.eq('campus', campus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ReservationRoom[];
    },
  });
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      room_id: string;
      start_datetime: string;
      end_datetime: string;
      attendees_count: number;
      notes?: string;
    }) => {
      // Check conflict
      const { data: hasConflict, error: conflictError } = await supabase.rpc(
        'check_reservation_conflict',
        {
          p_room_id: data.room_id,
          p_start_datetime: data.start_datetime,
          p_end_datetime: data.end_datetime,
        }
      );

      if (conflictError) throw conflictError;
      if (hasConflict) throw new Error('Já existe uma reserva neste horário para esta sala.');

      // Check if room auto-confirms
      const { data: room } = await supabase
        .from('reservation_rooms')
        .select('auto_confirm')
        .eq('id', data.room_id)
        .single();

      const status = room?.auto_confirm ? 'confirmed' : 'pending';

      const { data: reservation, error } = await supabase
        .from('reservations')
        .insert({
          ...data,
          requester_name: profile?.full_name || 'Sistema',
          requester_email: profile?.email || '',
          status,
          is_external: false,
          created_by: profile?.user_id,
        })
        .select()
        .single();

      if (error) throw error;
      return reservation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-reservations'] });
      toast.success('Reserva criada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar reserva');
    },
  });
}

export function useUpdateReservationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('reservations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-reservations'] });
      toast.success('Status da reserva atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });
}

export function useDeleteReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reservations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-reservations'] });
      toast.success('Reserva excluída!');
    },
    onError: () => {
      toast.error('Erro ao excluir reserva');
    },
  });
}
