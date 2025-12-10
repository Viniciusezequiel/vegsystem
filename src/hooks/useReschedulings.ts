import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Rescheduling {
  id: string;
  reservation_id: string;
  original_room_id: string;
  new_room_id: string;
  original_start_datetime: string;
  original_end_datetime: string;
  new_start_datetime: string;
  new_end_datetime: string;
  reason: string | null;
  rescheduled_by: string | null;
  rescheduled_by_name: string | null;
  is_recurring_update: boolean;
  affected_reservations_count: number;
  created_at: string;
  reservations?: {
    id: string;
    title: string;
    requester_name: string;
    requester_email: string;
  };
  original_room?: {
    id: string;
    name: string;
    code: string;
    campus: string;
  };
  new_room?: {
    id: string;
    name: string;
    code: string;
    campus: string;
  };
}

interface ReschedulingFilters {
  dateFrom?: string;
  dateTo?: string;
  roomId?: string;
  isRecurring?: boolean;
}

export function useReschedulings(filters?: ReschedulingFilters) {
  return useQuery({
    queryKey: ['reschedulings', filters],
    queryFn: async () => {
      let query = supabase
        .from('reservation_reschedulings')
        .select(`
          *,
          reservations (
            id,
            title,
            requester_name,
            requester_email
          ),
          original_room:reservation_rooms!reservation_reschedulings_original_room_id_fkey (
            id,
            name,
            code,
            campus
          ),
          new_room:reservation_rooms!reservation_reschedulings_new_room_id_fkey (
            id,
            name,
            code,
            campus
          )
        `)
        .order('created_at', { ascending: false });

      if (filters?.dateFrom) {
        query = query.gte('new_start_datetime', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('new_start_datetime', filters.dateTo);
      }
      if (filters?.roomId) {
        query = query.or(`original_room_id.eq.${filters.roomId},new_room_id.eq.${filters.roomId}`);
      }
      if (filters?.isRecurring !== undefined) {
        query = query.eq('is_recurring_update', filters.isRecurring);
      }

      const { data, error } = await query.limit(200);
      
      if (error) throw error;
      return data as Rescheduling[];
    },
  });
}

export function useTodayReschedulings() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return useReschedulings({
    dateFrom: today.toISOString(),
    dateTo: tomorrow.toISOString(),
  });
}

interface CreateReschedulingData {
  reservation_id: string;
  original_room_id: string;
  new_room_id: string;
  original_start_datetime: string;
  original_end_datetime: string;
  new_start_datetime: string;
  new_end_datetime: string;
  reason?: string;
  is_recurring_update?: boolean;
  affected_reservations_count?: number;
}

export function useCreateRescheduling() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateReschedulingData) => {
      const { data: result, error } = await supabase
        .from('reservation_reschedulings')
        .insert({
          ...data,
          rescheduled_by: (await supabase.auth.getUser()).data.user?.id,
          rescheduled_by_name: profile?.full_name || 'Usuário',
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reschedulings'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      toast.success('Remanejamento registrado com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating rescheduling:', error);
      toast.error('Erro ao registrar remanejamento');
    },
  });
}
