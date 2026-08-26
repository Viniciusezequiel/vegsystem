import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SystemHealthStatus = 'healthy' | 'warning' | 'critical';

export interface SystemHealthData {
  generated_at: string;
  status: SystemHealthStatus;
  issues: string[];
  database: { size_bytes: number; size_pretty: string; public_tables: number };
  counts: Record<string, number>;
  lost_items: {
    current: number;
    available: number;
    delivered: number;
    archived: number;
    base64_active: number;
    base64_archive: number;
    base64_total: number;
  };
  storage: Array<{
    bucket: 'lost-items' | 'task-attachments';
    objects: number;
    size_bytes: number;
    size_pretty: string;
    latest_object_at: string | null;
  }>;
  cron: Array<{
    jobname: string;
    schedule: string | null;
    active: boolean;
    last_started_at: string | null;
    last_finished_at: string | null;
    last_status: string | null;
    recent_error: string | null;
  }>;
  users: {
    profiles: number;
    active_profiles: number;
    by_role: Record<string, number>;
  };
  largest_tables: Array<{
    table: string;
    data_bytes: number;
    data_pretty: string;
    index_bytes: number;
    index_pretty: string;
    total_bytes: number;
    total_pretty: string;
  }>;
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_system_health');
      if (error) throw error;
      return data as unknown as SystemHealthData;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });
}
