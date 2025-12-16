import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type Module = 
  | 'lostAndFound' 
  | 'equipment' 
  | 'reservations' 
  | 'lockers' 
  | 'rooms' 
  | 'materials' 
  | 'users' 
  | 'settings' 
  | 'classroomCalls'
  | 'tasks'
  | 'activityHistory';

export type Action = 'view' | 'create' | 'edit' | 'delete' | 'approve';

export type AppRole = 'admin' | 'supervisor' | 'analista' | 'assistente';

export interface RolePermission {
  id: string;
  role: AppRole;
  module: string;
  action: string;
  allowed: boolean;
  created_at: string;
  updated_at: string;
}

export const MODULE_LABELS: Record<Module, string> = {
  lostAndFound: 'Achados e Perdidos',
  equipment: 'Equipamentos',
  reservations: 'Reservas',
  lockers: 'Escaninhos',
  rooms: 'Salas (Checklist)',
  materials: 'Materiais',
  users: 'Usuários',
  settings: 'Configurações',
  classroomCalls: 'Chamados de Sala',
  tasks: 'Demandas',
  activityHistory: 'Histórico de Atividades',
};

export const ACTION_LABELS: Record<Action, string> = {
  view: 'Visualizar',
  create: 'Criar',
  edit: 'Editar',
  delete: 'Excluir',
  approve: 'Aprovar',
};

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  analista: 'Analista',
  assistente: 'Assistente',
};

export function useRolePermissions() {
  return useQuery({
    queryKey: ['role-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .order('module')
        .order('action');
      
      if (error) throw error;
      return data as RolePermission[];
    },
  });
}

export function useUpdatePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, allowed }: { id: string; allowed: boolean }) => {
      const { error } = await supabase
        .from('role_permissions')
        .update({ allowed })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
      toast.success('Permissão atualizada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar permissão: ' + error.message);
    },
  });
}

export function useBulkUpdatePermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { id: string; allowed: boolean }[]) => {
      for (const update of updates) {
        const { error } = await supabase
          .from('role_permissions')
          .update({ allowed: update.allowed })
          .eq('id', update.id);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
      toast.success('Permissões atualizadas!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar permissões: ' + error.message);
    },
  });
}

export function useUserPermissions() {
  const { user, role } = useAuth();

  const { data: permissions, isLoading } = useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role', role || 'assistente');
      
      if (error) throw error;
      return data as RolePermission[];
    },
    enabled: !!user,
  });

  const hasPermission = (module: Module, action: Action): boolean => {
    if (role === 'admin') return true;
    if (!permissions) return false;
    
    const permission = permissions.find(
      p => p.module === module && p.action === action
    );
    
    return permission?.allowed ?? false;
  };

  const canView = (module: Module) => hasPermission(module, 'view');
  const canCreate = (module: Module) => hasPermission(module, 'create');
  const canEdit = (module: Module) => hasPermission(module, 'edit');
  const canDelete = (module: Module) => hasPermission(module, 'delete');
  const canApprove = (module: Module) => hasPermission(module, 'approve');

  return {
    permissions,
    isLoading,
    hasPermission,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canApprove,
  };
}
