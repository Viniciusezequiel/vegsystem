import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface ClassroomCall {
  id: string;
  room_name: string;
  reason: string;
  status: 'pending' | 'accepted' | 'resolved';
  campus?: string;
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

const CLASSROOM_CALL_SELECT = 'id,room_name,reason,status,campus,accepted_by,accepted_by_name,accepted_at,created_at,resolved_at,is_valid,validation_reason,treatment,response_message';

function matchesClassroomCallQuery(call: ClassroomCall, queryKey: readonly unknown[]) {
  const status = typeof queryKey[1] === 'string' ? queryKey[1] : undefined;
  const campus = typeof queryKey[2] === 'string' ? queryKey[2] : undefined;
  if (status && call.status !== status) return false;
  if (campus && call.campus !== campus) return false;
  return true;
}

function applyClassroomCallToCache(queryClient: QueryClient, call: ClassroomCall) {
  const queries = queryClient.getQueryCache().findAll({ queryKey: ['classroom-calls'] });

  for (const query of queries) {
    const current = query.state.data;
    if (!Array.isArray(current)) continue;

    queryClient.setQueryData<ClassroomCall[]>(query.queryKey, (existing = []) => {
      const withoutCurrent = existing.filter((item) => item.id !== call.id);
      if (!matchesClassroomCallQuery(call, query.queryKey)) return withoutCurrent;
      return [call, ...withoutCurrent].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    });
  }
}

function removeClassroomCallFromCache(queryClient: QueryClient, id: string) {
  const queries = queryClient.getQueryCache().findAll({ queryKey: ['classroom-calls'] });
  for (const query of queries) {
    if (!Array.isArray(query.state.data)) continue;
    queryClient.setQueryData<ClassroomCall[]>(query.queryKey, (existing = []) =>
      existing.filter((item) => item.id !== id),
    );
  }
}

function incrementPendingCallCounts(queryClient: QueryClient, call: ClassroomCall) {
  if (call.status !== 'pending') return;
  const queries = queryClient.getQueryCache().findAll({ queryKey: ['pending-calls-count'] });

  for (const query of queries) {
    const campus = typeof query.queryKey[1] === 'string' ? query.queryKey[1] : undefined;
    if (campus && campus !== call.campus) continue;
    queryClient.setQueryData<number>(query.queryKey, (current) =>
      typeof current === 'number' ? current + 1 : current,
    );
  }
}

let classroomCallsChannel: ReturnType<typeof supabase.channel> | null = null;
let classroomCallsRealtimeConsumers = 0;

/**
 * Canal dedicado aos chamados. Mantém uma única assinatura enquanto houver
 * alguma tela interna montada e aplica INSERT/UPDATE diretamente no cache.
 * Isso evita polling e o debounce de 800 ms usado pelo Realtime genérico.
 */
export function useClassroomCallsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    classroomCallsRealtimeConsumers += 1;

    if (!classroomCallsChannel) {
      let subscribedOnce = false;
      const channel = supabase
        .channel('classroom-calls-live')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'classroom_calls' },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              const id = String((payload.old as { id?: string } | null)?.id || '');
              if (id) removeClassroomCallFromCache(queryClient, id);
              void queryClient.invalidateQueries({ queryKey: ['pending-calls-count'], refetchType: 'active' });
              return;
            }

            const call = payload.new as ClassroomCall;
            if (!call?.id) return;

            applyClassroomCallToCache(queryClient, call);

            if (payload.eventType === 'INSERT') {
              // O badge muda no mesmo ciclo do evento, sem uma nova consulta ao banco.
              incrementPendingCallCounts(queryClient, call);
            } else {
              // UPDATE pode mudar pending -> accepted/resolved; uma HEAD query pequena
              // reconcilia a contagem sem baixar novamente a lista de chamados.
              void queryClient.invalidateQueries({ queryKey: ['pending-calls-count'], refetchType: 'active' });
            }
          },
        )
        .subscribe((status) => {
          if (status !== 'SUBSCRIBED') return;

          // Fecha a pequena janela entre a carga inicial e a assinatura do socket.
          // Em reconexões, faz uma única reconciliação das consultas que estiverem ativas.
          void queryClient.invalidateQueries({ queryKey: ['classroom-calls'], refetchType: 'active' });
          void queryClient.invalidateQueries({ queryKey: ['pending-calls-count'], refetchType: 'active' });
          subscribedOnce = true;
        });

      // Mantém a variável para evitar um segundo websocket quando o painel também
      // usa usePendingCallsCount com filtro de campus.
      classroomCallsChannel = channel;
      void subscribedOnce;
    }

    return () => {
      classroomCallsRealtimeConsumers = Math.max(0, classroomCallsRealtimeConsumers - 1);
      if (classroomCallsRealtimeConsumers === 0 && classroomCallsChannel) {
        const channel = classroomCallsChannel;
        classroomCallsChannel = null;
        void supabase.removeChannel(channel);
      }
    };
  }, [queryClient]);
}

export function useClassroomCalls(status?: string, campus?: string) {
  return useQuery({
    queryKey: ['classroom-calls', status, campus],
    queryFn: async () => {
      let query = supabase
        .from('classroom_calls')
        .select(CLASSROOM_CALL_SELECT)
        .order('created_at', { ascending: false });
      
      if (status) {
        query = query.eq('status', status);
      }

      if (campus) {
        query = query.eq('campus', campus);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as ClassroomCall[];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function usePendingCallsCount(campus?: string) {
  // MainLayout mantém este hook montado durante toda a sessão; por isso o canal
  // de chamados permanece ativo mesmo quando o usuário navega para outro módulo.
  useClassroomCallsRealtime();

  return useQuery({
    queryKey: ['pending-calls-count', campus],
    queryFn: async () => {
      let query = supabase
        .from('classroom_calls')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (campus) {
        query = query.eq('campus', campus);
      }
      
      const { count, error } = await query;
      
      if (error) throw error;
      return count || 0;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
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
      queryClient.invalidateQueries({ queryKey: ['classroom-calls'] });
      queryClient.invalidateQueries({ queryKey: ['pending-calls-count'] });
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
