import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

type TableName = 
  | 'equipment'
  | 'equipment_loans'
  | 'external_equipment_requests'
  | 'lockers'
  | 'locker_loans'
  | 'lost_items'
  | 'material_requests'
  | 'classroom_calls'
  | 'profiles'
  | 'tasks'
  | 'user_roles'
  | 'role_permissions';

const tableToQueryKeyMap: Record<TableName, string[]> = {
  equipment: ['equipment'],
  equipment_loans: ['equipment-loans'],
  external_equipment_requests: ['external-equipment-requests'],
  lockers: ['lockers'],
  locker_loans: ['locker-loans'],
  lost_items: ['lost-items', 'lost-item', 'lost-items-counts'],
  material_requests: ['material-requests'],
  classroom_calls: ['classroom-calls'],
  profiles: ['profiles', 'users'],
  tasks: ['tasks', 'my-tasks', 'task'],
  user_roles: ['users', 'user-permissions'],
  role_permissions: ['role-permissions', 'user-permissions'],
};

export function useRealtimeSubscription(tables: TableName[] = []) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (tables.length === 0) return;

    const channels: RealtimeChannel[] = [];

    tables.forEach((table) => {
      const channel = supabase
        .channel(`realtime-${table}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
          },
          (payload) => {
            console.log(`Realtime update on ${table}:`, payload.eventType);
            
            // Invalidate all related queries
            const queryKeys = tableToQueryKeyMap[table] || [table];
            queryKeys.forEach((key) => {
              queryClient.invalidateQueries({ queryKey: [key] });
            });
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`Subscribed to realtime updates for ${table}`);
          }
        });

      channels.push(channel);
    });

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [tables.join(','), queryClient]);
}

// Hook for subscribing to all main tables
export function useGlobalRealtimeSubscription() {
  const allTables: TableName[] = [
    'equipment',
    'equipment_loans',
    'external_equipment_requests',
    'lockers',
    'locker_loans',
    'lost_items',
    'material_requests',
    'classroom_calls',
    'profiles',
    'tasks',
    'user_roles',
    'role_permissions',
  ];

  useRealtimeSubscription(allTables);
}