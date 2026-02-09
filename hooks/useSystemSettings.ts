import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ModuleSettings {
  enabled: boolean;
  allowCollaboratorCreate: boolean;
  allowCollaboratorEdit: boolean;
  allowCollaboratorDelete: boolean;
  allowCollaboratorExport: boolean;
}

export interface SystemSettings {
  // Módulos principais
  modules: {
    lostItems: ModuleSettings;
    equipment: ModuleSettings;
    lockers: ModuleSettings;
    reservations: ModuleSettings;
    rooms: ModuleSettings;
    checklists: ModuleSettings;
  };
  
  // Configurações gerais
  general: {
    itemCodePrefix: string;
    itemRetentionDays: number;
    showOnlineUsers: boolean;
    allowExternalReservations: boolean;
    requireApprovalForReservations: boolean;
    maxReservationDaysAhead: number;
    maxReservationDuration: number; // em horas
    defaultCampus: string;
  };
  
  // Notificações
  notifications: {
    emailOnNewItem: boolean;
    emailOnItemDelivered: boolean;
    emailOnReservationCreated: boolean;
    emailOnReservationApproved: boolean;
    weeklyReport: boolean;
  };
  
  // Relatórios
  reports: {
    allowCollaboratorExport: boolean;
    includeDeletedRecords: boolean;
    defaultDateRange: 'week' | 'month' | 'quarter' | 'year';
  };
}

const defaultSettings: SystemSettings = {
  modules: {
    lostItems: { enabled: true, allowCollaboratorCreate: true, allowCollaboratorEdit: true, allowCollaboratorDelete: false, allowCollaboratorExport: true },
    equipment: { enabled: true, allowCollaboratorCreate: true, allowCollaboratorEdit: true, allowCollaboratorDelete: false, allowCollaboratorExport: true },
    lockers: { enabled: true, allowCollaboratorCreate: true, allowCollaboratorEdit: true, allowCollaboratorDelete: false, allowCollaboratorExport: true },
    reservations: { enabled: true, allowCollaboratorCreate: true, allowCollaboratorEdit: true, allowCollaboratorDelete: false, allowCollaboratorExport: true },
    rooms: { enabled: true, allowCollaboratorCreate: true, allowCollaboratorEdit: true, allowCollaboratorDelete: false, allowCollaboratorExport: true },
    checklists: { enabled: true, allowCollaboratorCreate: true, allowCollaboratorEdit: false, allowCollaboratorDelete: false, allowCollaboratorExport: true },
  },
  general: {
    itemCodePrefix: 'AP',
    itemRetentionDays: 90,
    showOnlineUsers: true,
    allowExternalReservations: true,
    requireApprovalForReservations: false,
    maxReservationDaysAhead: 90,
    maxReservationDuration: 8,
    defaultCampus: 'Campus I',
  },
  notifications: {
    emailOnNewItem: true,
    emailOnItemDelivered: true,
    emailOnReservationCreated: true,
    emailOnReservationApproved: true,
    weeklyReport: false,
  },
  reports: {
    allowCollaboratorExport: true,
    includeDeletedRecords: false,
    defaultDateRange: 'month',
  },
};

export function useSystemSettings() {
  return useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'system_settings')
        .maybeSingle();
      
      if (error) throw error;
      
      if (!data) return defaultSettings;
      
      const value = data.value as unknown as SystemSettings;
      return {
        ...defaultSettings,
        ...value,
        modules: { ...defaultSettings.modules, ...value.modules },
        general: { ...defaultSettings.general, ...value.general },
        notifications: { ...defaultSettings.notifications, ...value.notifications },
        reports: { ...defaultSettings.reports, ...value.reports },
      };
    },
  });
}

export function useUpdateSystemSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (settings: SystemSettings) => {
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'system_settings')
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('app_settings')
          .update({ value: settings as unknown as Record<string, never> })
          .eq('key', 'system_settings')
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('app_settings')
          .insert({
            key: 'system_settings',
            value: settings as unknown as Record<string, never>,
            description: 'Configurações gerais do sistema',
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      toast({
        title: 'Configurações salvas',
        description: 'As configurações do sistema foram atualizadas.',
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
