import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ActivityLog {
  id: string;
  user_id: string | null;
  user_name: string;
  module: string;
  action: string;
  entity_id: string | null;
  entity_description: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export type ActivityModule = 
  | 'lost-items'
  | 'reservations'
  | 'equipment'
  | 'lockers'
  | 'materials'
  | 'users'
  | 'rooms'
  | 'tasks'
  | 'settings';

export type ActivityAction = 
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'return'
  | 'deliver'
  | 'import'
  | 'export';

export function useActivityLogs(filters?: {
  module?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['activity-logs', filters],
    queryFn: async () => {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (filters?.module) {
        query = query.eq('module', filters.module);
      }

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo + 'T23:59:59');
      }

      if (filters?.search) {
        query = query.or(`user_name.ilike.%${filters.search}%,entity_description.ilike.%${filters.search}%,details.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ActivityLog[];
    },
  });
}

export function useLogActivity() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  return useMutation({
    mutationFn: async (logData: {
      module: ActivityModule;
      action: ActivityAction;
      entityId?: string;
      entityDescription?: string;
      details?: string;
    }) => {
      const { data, error } = await supabase
        .from('activity_logs')
        .insert({
          user_id: user?.id || null,
          user_name: profile?.full_name || user?.email || 'Sistema',
          module: logData.module,
          action: logData.action,
          entity_id: logData.entityId || null,
          entity_description: logData.entityDescription || null,
          details: logData.details || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
  });
}

// Helper to get action label in Portuguese
export function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    create: 'Criou',
    update: 'Atualizou',
    delete: 'Excluiu',
    approve: 'Aprovou',
    reject: 'Rejeitou',
    return: 'Devolveu',
    deliver: 'Entregou',
    import: 'Importou',
    export: 'Exportou',
  };
  return labels[action] || action;
}

// Helper to get module label in Portuguese
export function getModuleLabel(module: string): string {
  const labels: Record<string, string> = {
    'lost-items': 'Achados e Perdidos',
    'reservations': 'Reservas',
    'equipment': 'Equipamentos',
    'lockers': 'Escaninhos',
    'materials': 'Materiais',
    'users': 'Usuários',
    'rooms': 'Salas',
    'tasks': 'Demandas',
    'settings': 'Configurações',
  };
  return labels[module] || module;
}
