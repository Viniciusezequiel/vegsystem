import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AppRole = 'admin' | 'supervisor' | 'analista' | 'assistente';

export type UserProfile = {
  id: string;
  user_id: string;
  full_name: string;
  position: string;
  department: string;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  role?: AppRole;
};

export function useUsersList() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });
      
      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');
      
      if (rolesError) throw rolesError;

      // Merge profiles with roles
      const usersWithRoles = profiles.map(profile => {
        const userRole = roles.find(r => r.user_id === profile.user_id);
        return {
          ...profile,
          role: userRole?.role || 'assistente',
        };
      });

      return usersWithRoles as UserProfile[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - user list doesn't change frequently
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      role, 
      ...profileData 
    }: Partial<UserProfile> & { id: string }) => {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', id);
      
      if (profileError) throw profileError;

      // If role is provided, update user_roles
      if (role) {
        // Get user_id from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('id', id)
          .single();
        
        if (profile) {
          // Check if role exists
          const { data: existingRole } = await supabase
            .from('user_roles')
            .select('id')
            .eq('user_id', profile.user_id)
            .maybeSingle();

          if (existingRole) {
            await supabase
              .from('user_roles')
              .update({ role })
              .eq('user_id', profile.user_id);
          } else {
            await supabase
              .from('user_roles')
              .insert({ user_id: profile.user_id, role });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar usuário: ' + error.message);
    },
  });
}

export function useToggleUserActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(is_active ? 'Usuário ativado!' : 'Usuário desativado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar status: ' + error.message);
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: userId },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário excluído com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir usuário: ' + error.message);
    },
  });
}
