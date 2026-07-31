import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type UberStatus =
  | 'registrada'
  | 'solicitado'
  | 'em_andamento'
  | 'concluida'
  | 'cancelada';

export const UBER_STATUS_LABELS: Record<UberStatus, string> = {
  registrada: 'Solicitação registrada',
  solicitado: 'Uber solicitado',
  em_andamento: 'Viagem em andamento',
  concluida: 'Viagem concluída',
  cancelada: 'Solicitação cancelada',
};

export const UBER_STATUS_ORDER: UberStatus[] = [
  'registrada',
  'solicitado',
  'em_andamento',
  'concluida',
  'cancelada',
];

export interface UberRequest {
  id: string;
  code: string;
  requester_name: string;
  origin: string;
  destination: string;
  trip_date: string;
  trip_time: string;
  reason: string;
  notes: string | null;
  status: UberStatus;
  created_at: string;
  updated_at: string;
}

export interface UberRequestInput {
  requester_name: string;
  origin: string;
  destination: string;
  trip_date: string;
  trip_time: string;
  reason: string;
  notes?: string | null;
}

export function generateUberCode() {
  const now = new Date();
  const y = now.getFullYear();
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `UBR-${y}-${rand}`;
}

export function useUberRequests() {
  return useQuery({
    queryKey: ['uber-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uber_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as UberRequest[];
    },
  });
}

export function useCreateUberRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UberRequestInput) => {
      const code = generateUberCode();
      const payload = {
        ...input,
        notes: input.notes || null,
        code,
        status: 'registrada' as const,
      };
      const { error } = await supabase.from('uber_requests').insert(payload);
      if (error) throw error;
      return { ...payload, created_at: new Date().toISOString() };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uber-requests'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar solicitação: ' + error.message);
    },
  });
}

export function useUpdateUberRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<UberRequest> & { id: string }) => {
      const { error } = await supabase.from('uber_requests').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uber-requests'] });
      toast.success('Solicitação atualizada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });
}

export function useDeleteUberRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('uber_requests').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uber-requests'] });
      toast.success('Solicitação excluída.');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir: ' + error.message);
    },
  });
}
