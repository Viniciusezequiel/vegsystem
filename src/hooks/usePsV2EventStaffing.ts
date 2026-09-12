import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;
const isMissingV2Schema = (error: any) =>
  error?.code === '42P01' || String(error?.message || '').includes('ps_v2_');

const unique = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.filter(Boolean) as string[]));

export type PsV2StaffingScope = {
  id: string;
  name: string;
  scopeType: 'location' | 'building' | 'floor' | 'area' | 'environment';
};

export function usePsV2EventStaffing(eventId?: string) {
  return useQuery({
    queryKey: ['ps-v2', 'event-staffing', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const requirementsResult = await db
        .from('ps_v2_staff_requirements')
        .select('*')
        .eq('event_id', eventId)
        .eq('active', true)
        .order('priority')
        .order('created_at');

      if (requirementsResult.error && isMissingV2Schema(requirementsResult.error)) {
        return {
          schemaReady: false,
          requirements: [] as any[],
          scopes: {} as Record<string, PsV2StaffingScope>,
        };
      }
      if (requirementsResult.error) throw requirementsResult.error;

      const requirements = requirementsResult.data || [];
      const definitions = [
        {
          type: 'location' as const,
          table: 'ps_v2_locations',
          ids: unique(requirements.map((item: any) => item.location_id)),
        },
        {
          type: 'building' as const,
          table: 'ps_v2_buildings',
          ids: unique(requirements.map((item: any) => item.building_id)),
        },
        {
          type: 'floor' as const,
          table: 'ps_v2_floors',
          ids: unique(requirements.map((item: any) => item.floor_id)),
        },
        {
          type: 'area' as const,
          table: 'ps_v2_areas',
          ids: unique(requirements.map((item: any) => item.area_id)),
        },
        {
          type: 'environment' as const,
          table: 'ps_v2_environments',
          ids: unique(requirements.map((item: any) => item.environment_id)),
        },
      ];

      const scopes: Record<string, PsV2StaffingScope> = {};

      await Promise.all(
        definitions.map(async (definition) => {
          if (!definition.ids.length) return;
          const result = await db
            .from(definition.table)
            .select('id,name')
            .in('id', definition.ids);
          if (result.error) throw result.error;
          for (const row of result.data || []) {
            scopes[`${definition.type}:${row.id}`] = {
              id: row.id,
              name: row.name,
              scopeType: definition.type,
            };
          }
        }),
      );

      return { schemaReady: true, requirements, scopes };
    },
  });
}
