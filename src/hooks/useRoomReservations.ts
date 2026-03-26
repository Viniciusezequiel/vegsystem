import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type CampusEnum = Database['public']['Enums']['campus_enum'];

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

export interface AvailableRoom {
  id: string;
  name: string;
  code: string;
  capacity: number;
  description: string | null;
  location: string | null;
  campus: CampusEnum;
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
        query = query.gte('start_datetime', `${filters.startDate}T00:00:00`);
      }
      if (filters?.endDate) {
        query = query.lte('start_datetime', `${filters.endDate}T23:59:59`);
      }
      if (filters?.search) {
        const q = filters.search;
        query = query.or(`title.ilike.%${q}%,requester_name.ilike.%${q}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      let results = (data || []) as unknown as RoomReservation[];
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
        query = query.eq('campus', campus as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ReservationRoom[];
    },
  });
}

export function useFindAvailableRooms(params: {
  startDatetime: string;
  endDatetime: string;
  attendeesCount: number;
  campus?: CampusEnum;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['available-rooms', params.startDatetime, params.endDatetime, params.attendeesCount, params.campus],
    queryFn: async () => {
      const rpcParams: any = {
        p_start_datetime: params.startDatetime,
        p_end_datetime: params.endDatetime,
        p_attendees_count: params.attendeesCount,
        p_is_external: false,
      };
      if (params.campus) {
        rpcParams.p_campus = params.campus;
      }

      const { data, error } = await supabase.rpc('find_available_rooms', rpcParams);
      if (error) throw error;
      return (data || []) as AvailableRoom[];
    },
    enabled: params.enabled !== false && !!params.startDatetime && !!params.endDatetime,
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
      is_fixed?: boolean;
    }) => {
      // Check conflict
      const { data: hasConflict, error: conflictError } = await supabase.rpc(
        'check_reservation_conflict',
        {
          p_room_id: data.room_id,
          p_start_datetime: data.start_datetime,
          p_end_datetime: data.end_datetime,
          p_is_external: false,
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
          title: data.title,
          description: data.description || null,
          room_id: data.room_id,
          start_datetime: data.start_datetime,
          end_datetime: data.end_datetime,
          attendees_count: data.attendees_count,
          notes: data.notes || null,
          requester_name: profile?.full_name || 'Sistema',
          requester_email: '',
          status,
          is_external: false,
          is_fixed: data.is_fixed || false,
          created_by: profile?.user_id,
        })
        .select()
        .single();

      if (error) throw error;
      return reservation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['available-rooms'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar reserva');
    },
  });
}

export function useCreateRecurringReservations() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      room_id: string;
      date: string; // YYYY-MM-DD
      start_time: string; // HH:mm
      end_time: string; // HH:mm
      attendees_count: number;
      notes?: string;
      repeatWeeks: number; // how many weeks to repeat
    }) => {
      const results: { date: string; success: boolean; error?: string }[] = [];

      for (let week = 0; week < data.repeatWeeks; week++) {
        const baseDate = new Date(data.date + 'T00:00:00');
        baseDate.setDate(baseDate.getDate() + week * 7);
        const dateStr = baseDate.toISOString().split('T')[0];
        const startDt = `${dateStr}T${data.start_time}:00`;
        const endDt = `${dateStr}T${data.end_time}:00`;

        // Check conflict
        const { data: hasConflict } = await supabase.rpc('check_reservation_conflict', {
          p_room_id: data.room_id,
          p_start_datetime: startDt,
          p_end_datetime: endDt,
          p_is_external: false,
        });

        if (hasConflict) {
          results.push({ date: dateStr, success: false, error: 'Conflito de horário' });
          continue;
        }

        const { data: room } = await supabase
          .from('reservation_rooms')
          .select('auto_confirm')
          .eq('id', data.room_id)
          .single();

        const { error } = await supabase.from('reservations').insert({
          title: data.title,
          description: data.description || null,
          room_id: data.room_id,
          start_datetime: startDt,
          end_datetime: endDt,
          attendees_count: data.attendees_count,
          notes: data.notes || null,
          requester_name: profile?.full_name || 'Sistema',
          requester_email: '',
          status: room?.auto_confirm ? 'confirmed' : 'pending',
          is_external: false,
          is_fixed: true,
          created_by: profile?.user_id,
        });

        results.push({ date: dateStr, success: !error, error: error?.message });
      }

      const successes = results.filter(r => r.success).length;
      const failures = results.filter(r => !r.success).length;

      if (successes > 0) {
        toast.success(`${successes} reserva(s) criada(s) com sucesso!${failures > 0 ? ` ${failures} com conflito.` : ''}`);
      } else {
        throw new Error('Nenhuma reserva pôde ser criada. Todos os horários têm conflito.');
      }

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['available-rooms'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useRescheduleReservation() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      reservationId: string;
      newRoomId: string;
      newStartDatetime: string;
      newEndDatetime: string;
      originalRoomId: string;
      originalStartDatetime: string;
      originalEndDatetime: string;
      reason?: string;
    }) => {
      // Check conflict on new room/time
      const { data: hasConflict } = await supabase.rpc('check_reservation_conflict', {
        p_room_id: data.newRoomId,
        p_start_datetime: data.newStartDatetime,
        p_end_datetime: data.newEndDatetime,
        p_exclude_reservation_id: data.reservationId,
        p_is_external: false,
      });

      if (hasConflict) throw new Error('A nova sala/horário possui conflito.');

      // Update reservation
      const { error: updateError } = await supabase
        .from('reservations')
        .update({
          room_id: data.newRoomId,
          start_datetime: data.newStartDatetime,
          end_datetime: data.newEndDatetime,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.reservationId);

      if (updateError) throw updateError;

      // Log rescheduling
      await supabase.from('reservation_reschedulings').insert({
        reservation_id: data.reservationId,
        original_room_id: data.originalRoomId,
        new_room_id: data.newRoomId,
        original_start_datetime: data.originalStartDatetime,
        original_end_datetime: data.originalEndDatetime,
        new_start_datetime: data.newStartDatetime,
        new_end_datetime: data.newEndDatetime,
        rescheduled_by: profile?.user_id || null,
        rescheduled_by_name: profile?.full_name || 'Sistema',
        reason: data.reason || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['available-rooms'] });
      toast.success('Reserva remanejada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao remanejar reserva');
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
    onError: () => toast.error('Erro ao atualizar status'),
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
    onError: () => toast.error('Erro ao excluir reserva'),
  });
}
