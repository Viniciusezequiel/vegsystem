import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;
const missingV2 = (error: any) => error?.code === '42P01' || String(error?.message || '').includes('ps_v2_');

const countTable = async (table: string) => {
  const result = await db.from(table).select('id', { count: 'exact', head: true });
  if (result.error) throw result.error;
  return Number(result.count || 0);
};

export function usePsV2FoundationStatus() {
  return useQuery({
    queryKey: ['ps-v2', 'foundation-status'],
    staleTime: 60_000,
    queryFn: async () => {
      try {
        const [locations, requirements, eligibilityRules, allocationRuns] = await Promise.all([
          countTable('ps_v2_locations'),
          countTable('ps_v2_staff_requirements'),
          countTable('ps_v2_role_eligibility'),
          countTable('ps_v2_allocation_runs'),
        ]);
        return {
          schemaReady: true,
          locations,
          requirements,
          eligibilityRules,
          allocationRuns,
        };
      } catch (error: any) {
        if (missingV2(error)) {
          return { schemaReady: false, locations: 0, requirements: 0, eligibilityRules: 0, allocationRuns: 0 };
        }
        throw error;
      }
    },
  });
}
