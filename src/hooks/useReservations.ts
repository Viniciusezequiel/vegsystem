import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type CampusEnum = Database['public']['Enums']['campus_enum'];

export interface ReservationRoom {
  id: string;
  name: string;
  code: string;
  capacity: number;
  description: string | null;
  location: string | null;
  campus: CampusEnum;
  is_active: boolean;
  auto_confirm: boolean;
  created_at: string;
  updated_at: string;
}

export interface Reservation {
  id: string;
  room_id: string;
  title: string;
  description: string | null;
  requester_name: string;
  requester_email: string;
  requester_phone: string | null;
  attendees_count: number;
  start_datetime: string;
  end_datetime: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  is_external: boolean;
  is_fixed: boolean;
  created_by: string | null;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  reservation_rooms?: ReservationRoom;
}

export interface ReservationLog {
  id: string;
  reservation_id: string | null;
  room_id: string | null;
  action: string;
  details: string | null;
  performed_by: string | null;
  performer_name: string | null;
  created_at: string;
}

export function useReservationRooms() {
  return useQuery({
    queryKey: ['reservation-rooms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservation_rooms')
        .select('*')
        .order('code');
      
      if (error) throw error;
      return data as ReservationRoom[];
    },
  });
}

export function useUpdateReservationRoom() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ReservationRoom> & { id: string }) => {
      const { data: room, error } = await supabase
        .from('reservation_rooms')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return room;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservation-rooms'] });
      toast({
        title: 'Ambiente atualizado',
        description: 'O ambiente foi atualizado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteReservationRoom() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reservation_rooms')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservation-rooms'] });
      toast({
        title: 'Ambiente excluído',
        description: 'O ambiente foi excluído com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useReservations(filters?: { roomId?: string; status?: string; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['reservations', filters],
    queryFn: async () => {
      let query = supabase
        .from('reservations')
        .select('*, reservation_rooms(*)');
      
      if (filters?.roomId) {
        query = query.eq('room_id', filters.roomId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.dateFrom) {
        query = query.gte('start_datetime', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('end_datetime', filters.dateTo);
      }
      
      const { data, error } = await query.order('start_datetime', { ascending: false });
      
      if (error) throw error;
      return data as Reservation[];
    },
  });
}

export function useReservationLogs() {
  return useQuery({
    queryKey: ['reservation-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as ReservationLog[];
    },
  });
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      room_id: string;
      title: string;
      description?: string;
      requester_name: string;
      requester_email: string;
      requester_phone?: string;
      attendees_count: number;
      start_datetime: string;
      end_datetime: string;
      is_external?: boolean;
      is_fixed?: boolean;
      notes?: string;
    }) => {
      // Check for conflicts first
      const { data: hasConflict, error: conflictError } = await supabase
        .rpc('check_reservation_conflict', {
          p_room_id: data.room_id,
          p_start_datetime: data.start_datetime,
          p_end_datetime: data.end_datetime,
        });

      if (conflictError) throw conflictError;
      if (hasConflict) {
        throw new Error('Já existe uma reserva para este horário nesta sala.');
      }

      // Fetch room to check auto_confirm setting
      const { data: roomData } = await supabase
        .from('reservation_rooms')
        .select('auto_confirm')
        .eq('id', data.room_id)
        .single();

      // Determine status: if room requires manual confirmation or is external, set to pending
      const requiresManualConfirmation = roomData?.auto_confirm === false;
      const initialStatus = (data.is_external || requiresManualConfirmation) ? 'pending' : 'confirmed';

      const { data: reservation, error } = await supabase
        .from('reservations')
        .insert({
          ...data,
          status: initialStatus,
        })
        .select()
        .single();

      if (error) throw error;

      // Log the action
      await supabase.from('reservation_logs').insert({
        reservation_id: reservation.id,
        room_id: data.room_id,
        action: 'Reserva criada',
        details: `${data.title} - ${data.requester_name}`,
        performer_name: data.requester_name,
      });

      return reservation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['reservation-logs'] });
      toast({
        title: 'Reserva criada',
        description: 'A reserva foi criada com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateReservation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Reservation> & { id: string }) => {
      const { data: reservation, error } = await supabase
        .from('reservations')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log the action
      await supabase.from('reservation_logs').insert({
        reservation_id: id,
        action: 'Reserva atualizada',
        details: data.status ? `Status alterado para ${data.status}` : 'Dados atualizados',
      });

      return reservation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['reservation-logs'] });
      toast({
        title: 'Reserva atualizada',
        description: 'A reserva foi atualizada com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteReservation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // Log before delete
      await supabase.from('reservation_logs').insert({
        reservation_id: id,
        action: 'Reserva excluída',
        details: 'Reserva removida do sistema',
      });

      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['reservation-logs'] });
      toast({
        title: 'Reserva excluída',
        description: 'A reserva foi excluída com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useFindAvailableRooms() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      start_datetime: string;
      end_datetime: string;
      attendees_count: number;
      campus?: Database['public']['Enums']['campus_enum'];
    }) => {
      const { data, error } = await supabase.rpc('find_available_rooms', {
        p_start_datetime: params.start_datetime,
        p_end_datetime: params.end_datetime,
        p_attendees_count: params.attendees_count,
        p_campus: params.campus ?? null,
      });

      if (error) throw error;
      return data as ReservationRoom[];
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
