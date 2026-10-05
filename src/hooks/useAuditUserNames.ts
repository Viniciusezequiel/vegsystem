import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AuditUserNames = Record<string, string>;

export function useAuditUserNames(userIds: Array<string | null | undefined>) {
  const ids = useMemo(
    () => Array.from(new Set(userIds.filter((value): value is string => Boolean(value)))).sort(),
    [userIds.join('|')]
  );

  return useQuery({
    queryKey: ['audit-user-names', ids.join('|')],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id,full_name,email')
        .in('user_id', ids);

      if (error) throw error;

      return Object.fromEntries(
        (data || []).map((profile: any) => [
          String(profile.user_id),
          String(profile.full_name || profile.email || 'Usuário não identificado'),
        ])
      ) as AuditUserNames;
    },
  });
}

export function auditUserName(
  users: AuditUserNames | undefined,
  userId: string | null | undefined,
  fallback = 'Registro legado / usuário não identificado'
) {
  if (!userId) return fallback;
  return users?.[userId] || 'Usuário não identificado';
}
