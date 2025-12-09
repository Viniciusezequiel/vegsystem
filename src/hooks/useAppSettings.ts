import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ExternalBookingSettings {
  blocked: boolean;
  blocked_until: string | null;
  message: string;
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
        .single();
      
      if (error) throw error;
      return data?.value as unknown as ExternalBookingSettings;
    },
  });
}

export function useUpdateExternalBookingSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (settings: ExternalBookingSettings) => {
      const { data, error } = await supabase
        .from('app_settings')
        .update({ value: settings as unknown as Record<string, never> })
        .eq('key', 'external_booking_blocked')
        .select()
        .single();

      if (error) throw error;
      return data;
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
