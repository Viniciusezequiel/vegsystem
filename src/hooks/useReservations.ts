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
  max_advance_days: number | null;
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
      requester_cpf?: string;
      attendees_count: number;
      start_datetime: string;
      end_datetime: string;
      is_external?: boolean;
      is_fixed?: boolean;
      notes?: string;
      external_user_id?: string;
    }) => {
      // Check for conflicts first - pass all parameters to avoid function overload ambiguity
      const { data: hasConflict, error: conflictError } = await supabase
        .rpc('check_reservation_conflict', {
          p_room_id: data.room_id,
          p_start_datetime: data.start_datetime,
          p_end_datetime: data.end_datetime,
          p_exclude_reservation_id: null,
          p_is_external: data.is_external ?? false,
        });

      if (conflictError) throw conflictError;
      if (hasConflict) {
        throw new Error('Já existe uma reserva para este horário nesta sala.');
      }

      // Fetch room to check auto_confirm and max_advance_days settings
      const { data: roomData } = await supabase
        .from('reservation_rooms')
        .select('auto_confirm, max_advance_days')
        .eq('id', data.room_id)
        .single();

      // Check max advance days if configured
      if (roomData?.max_advance_days !== null && roomData?.max_advance_days !== undefined) {
        const startDate = new Date(data.start_datetime);
        const now = new Date();
        const diffDays = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays > roomData.max_advance_days) {
          throw new Error(`Este ambiente só pode ser reservado com até ${roomData.max_advance_days} dias de antecedência.`);
        }
      }

      // Determine status: 
      // - External reservations always need approval (pending)
      // - Internal reservations by collaborators are auto-confirmed (unless room requires manual confirmation)
      const requiresManualConfirmation = roomData?.auto_confirm === false;
      const initialStatus = data.is_external ? 'pending' : (requiresManualConfirmation ? 'pending' : 'confirmed');

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
      is_external?: boolean;
    }) => {
      const { data, error } = await supabase.rpc('find_available_rooms', {
        p_start_datetime: params.start_datetime,
        p_end_datetime: params.end_datetime,
        p_attendees_count: params.attendees_count,
        p_campus: params.campus ?? null,
        p_is_external: params.is_external ?? false,
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

export function usePendingReservationsCount() {
  return useQuery({
    queryKey: ['pending-reservations-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      if (error) throw error;
      return count || 0;
    },
    staleTime: 30000,
  });
}

export function useCancelExternalReservation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, requesterEmail }: { id: string; requesterEmail: string }) => {
      // Get current user's email from auth
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user?.email) {
        throw new Error('Você precisa estar logado para cancelar uma reserva.');
      }

      // Verify the reservation belongs to this user
      const { data: reservation, error: fetchError } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', id)
        .eq('requester_email', user.email)
        .single();

      if (fetchError || !reservation) {
        throw new Error('Reserva não encontrada ou você não tem permissão para cancelá-la.');
      }

      if (!['pending', 'confirmed'].includes(reservation.status)) {
        throw new Error('Esta reserva não pode ser cancelada.');
      }

      // Update the reservation status to cancelled
      const { data, error } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('requester_email', user.email)
        .select()
        .single();

      if (error) {
        console.error('Error cancelling reservation:', error);
        throw new Error('Erro ao cancelar reserva. Tente novamente.');
      }

      if (!data) {
        throw new Error('Não foi possível cancelar a reserva. Verifique suas permissões.');
      }

      // Log the cancellation
      await supabase.from('reservation_logs').insert({
        reservation_id: id,
        action: 'Reserva cancelada pelo usuário',
        details: `Cancelada por ${user.email}`,
        performer_name: reservation.requester_name,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['pending-reservations-count'] });
      queryClient.invalidateQueries({ queryKey: ['reservation-logs'] });
      toast({
        title: 'Reserva cancelada',
        description: 'Sua reserva foi cancelada com sucesso.',
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
