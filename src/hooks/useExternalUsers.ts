import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ExternalUser {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  cpf: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export function useExternalUserProfile() {
  return useQuery({
    queryKey: ['external-user-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Cast to any to handle new table not in types yet
      const { data, error } = await (supabase as any)
        .from('external_users')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as ExternalUser | null;
    },
  });
}

export function useCreateExternalUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { full_name: string; email: string; cpf: string; phone?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Cast to any to handle new table not in types yet
      const { data: externalUser, error } = await (supabase as any)
        .from('external_users')
        .insert({
          user_id: user.id,
          full_name: data.full_name,
          email: data.email,
          cpf: data.cpf,
          phone: data.phone,
        })
        .select()
        .single();

      if (error) throw error;
      return externalUser as ExternalUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-user-profile'] });
      toast({
        title: 'Perfil criado',
        description: 'Seu perfil foi criado com sucesso.',
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

export function useUpdateExternalUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { full_name?: string; phone?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Cast to any to handle new table not in types yet
      const { error } = await (supabase as any)
        .from('external_users')
        .update(data)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-user-profile'] });
      toast({
        title: 'Perfil atualizado',
        description: 'Suas informações foram atualizadas.',
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
