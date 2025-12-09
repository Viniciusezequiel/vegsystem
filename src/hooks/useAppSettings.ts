import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface BlockedPeriod {
  id: string;
  start_date: string;
  end_date: string;
  room_ids: string[]; // empty means all rooms
  message: string;
}

export interface ExternalBookingSettings {
  blocked: boolean;
  blocked_until: string | null;
  message: string;
  blocked_periods: BlockedPeriod[];
}

export interface AppSetting {
  id: string;
  key: string;
  value: ExternalBookingSettings | Record<string, unknown>;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export function useAppSettings() {
  return useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*');
      
      if (error) throw error;
      return data as AppSetting[];
    },
  });
}

export function useExternalBookingSettings() {
  return useQuery({
    queryKey: ['external-booking-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'external_booking_blocked')
        .maybeSingle();
      
      if (error) throw error;
      
      const defaultSettings: ExternalBookingSettings = {
        blocked: false,
        blocked_until: null,
        message: '',
        blocked_periods: [],
      };
      
      if (!data) return defaultSettings;
      
      const value = data.value as unknown as ExternalBookingSettings;
      return {
        ...defaultSettings,
        ...value,
        blocked_periods: value.blocked_periods || [],
      };
    },
  });
}

export function useUpdateExternalBookingSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (settings: ExternalBookingSettings) => {
      // Try to update first
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'external_booking_blocked')
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('app_settings')
          .update({ value: settings as unknown as Record<string, never> })
          .eq('key', 'external_booking_blocked')
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('app_settings')
          .insert({
            key: 'external_booking_blocked',
            value: settings as unknown as Record<string, never>,
            description: 'Configurações de bloqueio de reservas externas',
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      queryClient.invalidateQueries({ queryKey: ['external-booking-settings'] });
      toast({
        title: 'Configurações atualizadas',
        description: 'As configurações foram salvas com sucesso.',
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
