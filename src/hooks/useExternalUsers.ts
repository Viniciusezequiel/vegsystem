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
  user_type?: 'professor' | 'colaborador';
  sector?: string;
  created_at: string;
  updated_at: string;
}

export function useExternalUserProfile() {
  return useQuery({
    queryKey: ['external-user-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('external_users')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as ExternalUser | null;
    },
  });
}

export function useExternalUsers() {
  return useQuery({
    queryKey: ['external-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('external_users')
        .select('*')
        .order('full_name');

      if (error) throw error;
      return data as ExternalUser[];
    },
  });
}

export function useSearchExternalUsers(searchTerm: string) {
  return useQuery({
    queryKey: ['external-users-search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 3) return [];
      
      const cleanedTerm = searchTerm.replace(/\D/g, '');
      
      // Build query that searches all relevant fields
      const { data, error } = await supabase
        .from('external_users')
        .select('*')
        .or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,cpf.ilike.%${cleanedTerm}%`)
        .limit(10);
      
      if (error) throw error;
      return data as ExternalUser[];
    },
    enabled: searchTerm.length >= 3,
  });
}

export function useCreateExternalUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { full_name: string; email: string; cpf: string; phone?: string; user_type?: 'professor' | 'colaborador'; sector?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: externalUser, error } = await supabase
        .from('external_users')
        .insert({
          user_id: user.id,
          full_name: data.full_name,
          email: data.email,
          cpf: data.cpf,
          phone: data.phone,
          user_type: data.user_type || 'professor',
          sector: data.sector,
        })
        .select()
        .single();

      if (error) throw error;
      return externalUser as ExternalUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['external-users'] });
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

export function useCreateExternalUserAdmin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { full_name: string; email: string; cpf: string; phone?: string; user_type?: 'professor' | 'colaborador'; sector?: string }) => {
      // Generate a placeholder UUID for external users created by admin
      // This uses a combination of timestamp and random values for uniqueness
      const placeholderUserId = crypto.randomUUID ? crypto.randomUUID() : 
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      
      const { data: externalUser, error } = await supabase
        .from('external_users')
        .insert({
          user_id: placeholderUserId,
          full_name: data.full_name,
          email: data.email,
          cpf: data.cpf.replace(/\D/g, ''),
          phone: data.phone,
          user_type: data.user_type || 'professor',
          sector: data.sector,
        })
        .select()
        .single();

      if (error) throw error;
      return externalUser as ExternalUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-users'] });
      toast({
        title: 'Usuário externo criado',
        description: 'O usuário foi cadastrado com sucesso.',
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
    mutationFn: async (data: { id: string; full_name?: string; phone?: string; cpf?: string; user_type?: 'professor' | 'colaborador'; sector?: string }) => {
      const { id, ...updateData } = data;
      const { error } = await supabase
        .from('external_users')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['external-users'] });
      toast({
        title: 'Perfil atualizado',
        description: 'As informações foram atualizadas.',
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

export function useDeleteExternalUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('external_users')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-users'] });
      toast({
        title: 'Usuário removido',
        description: 'O usuário externo foi removido.',
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
