import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

type TableName = 
  | 'equipment'
  | 'equipment_loans'
  | 'equipment_reservations'
  | 'external_equipment_requests'
  | 'lockers'
  | 'locker_loans'
  | 'locker_exchanges'
  | 'lost_items'
  | 'lost_items_archive'
  | 'material_requests'
  | 'classroom_calls'
  | 'classroom_call_rooms'
  | 'classroom_call_responses'
  | 'classroom_call_room_issues'
  | 'profiles'
  | 'tasks'
  | 'task_comments'
  | 'task_team_members'
  | 'task_history'
  | 'user_roles'
  | 'role_permissions'
  | 'rooms'
  | 'room_checklists'
  | 'checklist_questions'
  | 'checklist_answers'
  | 'shift_handovers'
  | 'shift_handover_tasks'
  | 'shift_handover_incidents'
  | 'reservations'
  | 'reservation_rooms'
  | 'inventory_movements'
  | 'activity_logs'
  | 'app_settings';

const tableToQueryKeyMap: Record<TableName, string[]> = {
  equipment: ['equipment'],
  equipment_loans: ['equipment-loans'],
  equipment_reservations: ['equipment-reservations'],
  external_equipment_requests: ['external-equipment-requests'],
  lockers: ['lockers'],
  locker_loans: ['locker-loans'],
  locker_exchanges: ['locker-exchanges'],
  lost_items: ['lost-items', 'lost-item', 'lost-items-counts'],
  lost_items_archive: ['archived-items'],
  material_requests: ['material-requests'],
  classroom_calls: ['classroom-calls'],
  classroom_call_rooms: ['classroom-call-rooms'],
  classroom_call_responses: ['classroom-call-responses'],
  classroom_call_room_issues: ['classroom-call-room-issues'],
  profiles: ['profiles', 'users'],
  tasks: ['tasks', 'my-tasks', 'task', 'pending-tasks-count'],
  task_comments: ['task-comments'],
  task_team_members: ['task-team-members', 'my-tasks'],
  task_history: ['task-history'],
  user_roles: ['users', 'user-permissions'],
  role_permissions: ['role-permissions', 'user-permissions'],
  rooms: ['rooms'],
  room_checklists: ['room-checklists'],
  checklist_questions: ['checklist-questions'],
  checklist_answers: ['checklist-answers'],
  shift_handovers: ['shift-handovers'],
  shift_handover_tasks: ['shift-handover-tasks'],
  shift_handover_incidents: ['shift-handover-incidents'],
  reservations: ['reservations'],
  reservation_rooms: ['reservation-rooms'],
  inventory_movements: ['inventory-movements'],
  activity_logs: ['activity-logs'],
  app_settings: ['app-settings'],
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
    'equipment_reservations',
    'external_equipment_requests',
    'lockers',
    'locker_loans',
    'locker_exchanges',
    'lost_items',
    'lost_items_archive',
    'material_requests',
    'classroom_calls',
    'classroom_call_rooms',
    'classroom_call_responses',
    'classroom_call_room_issues',
    'profiles',
    'tasks',
    'task_comments',
    'task_team_members',
    'task_history',
    'user_roles',
    'role_permissions',
    'rooms',
    'room_checklists',
    'checklist_questions',
    'checklist_answers',
    'shift_handovers',
    'shift_handover_tasks',
    'shift_handover_incidents',
    'reservations',
    'reservation_rooms',
    'inventory_movements',
    'activity_logs',
    'app_settings',
  ];

  useRealtimeSubscription(allTables);
}