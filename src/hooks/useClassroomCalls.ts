import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export interface ClassroomCall {
  id: string;
  room_name: string;
  reason: string;
  status: 'pending' | 'accepted' | 'resolved';
  accepted_by?: string;
  accepted_by_name?: string;
  accepted_at?: string;
  created_at: string;
  resolved_at?: string;
  is_valid?: boolean;
  validation_reason?: string;
  treatment?: string;
  response_message?: string;
}

export function useClassroomCalls(status?: string) {
  const queryClient = useQueryClient();
  
  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('classroom-calls-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'classroom_calls'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['classroom-calls'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['classroom-calls', status],
    queryFn: async () => {
      let query = supabase
        .from('classroom_calls')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as ClassroomCall[];
    },
  });
}

export function usePendingCallsCount() {
  const queryClient = useQueryClient();
  
  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('pending-calls-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'classroom_calls'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['pending-calls-count'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['pending-calls-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('classroom_calls')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      if (error) throw error;
      return count || 0;
    },
    staleTime: 2000,
    refetchInterval: 2000, // Poll every 2s as fallback for realtime
  });
}

export function useCreateClassroomCall() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: { room_name: string; reason: string }) => {
      const { error } = await supabase
        .from('classroom_calls')
        .insert({
          room_name: data.room_name,
          reason: data.reason,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Chamado enviado',
        description: 'Um colaborador será notificado em breve.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useAcceptClassroomCall() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, responseMessage }: { id: string; responseMessage?: string }) => {
      // Only accept if still pending
      const { data, error } = await supabase
        .from('classroom_calls')
        .update({
          status: 'accepted',
          accepted_by: user?.id,
          accepted_by_name: profile?.full_name,
          accepted_at: new Date().toISOString(),
          response_message: responseMessage ?? null,
        })
        .eq('id', id)
        .eq('status', 'pending')
        .select()
        .single();
      
      if (error) throw error;
      if (!data) throw new Error('Chamado já foi aceito por outro colaborador');
      return data;
    },
    onSuccess: () => {
      // Force immediate refetch
      queryClient.invalidateQueries({ queryKey: ['classroom-calls'] });
      queryClient.invalidateQueries({ queryKey: ['pending-calls-count'] });
      queryClient.refetchQueries({ queryKey: ['classroom-calls'] });
      toast({
        title: 'Chamado aceito',
        description: 'Você aceitou o chamado.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useResolveClassroomCall() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ id, treatment }: { id: string; treatment?: string }) => {
      const { error } = await supabase
        .from('classroom_calls')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          treatment: treatment ?? null,
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-calls'] });
      queryClient.invalidateQueries({ queryKey: ['pending-calls-count'] });
      toast({
        title: 'Chamado resolvido',
        description: 'O chamado foi marcado como resolvido.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteClassroomCall() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('classroom_calls')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-calls'] });
      queryClient.invalidateQueries({ queryKey: ['pending-calls-count'] });
      toast({
        title: 'Chamado excluído',
        description: 'O chamado foi removido.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
