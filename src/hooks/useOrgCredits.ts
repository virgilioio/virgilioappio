import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrgContext } from '@/contexts/OrgContext';

export interface OrgCredits {
  search: {
    remaining: number;
    limit: number;
  };
  collect: {
    remaining: number;
    limit: number;
  };
  lastRefill: string | null;
  nextRefill: string | null;
}

export function useOrgCredits() {
  const { organizationId } = useOrgContext();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['org-credits', organizationId],
    queryFn: async () => {
      if (!organizationId) {
        throw new Error('No organization selected');
      }

      const { data, error } = await supabase.rpc('get_org_credits', {
        org_id: organizationId
      });

      if (error) {
        console.error('Error fetching org credits:', error);
        throw error;
      }

      // RPC returns an array of rows (or empty array if no credits allocated)
      const row = data?.[0];
      
      if (!row) {
        // No credits allocated yet - return zeros
        return {
          search: { remaining: 0, limit: 0 },
          collect: { remaining: 0, limit: 0 },
          lastRefill: null,
          nextRefill: null
        } as OrgCredits;
      }

      return {
        search: {
          remaining: row.search_remaining ?? 0,
          limit: row.search_limit ?? 0
        },
        collect: {
          remaining: row.collect_remaining ?? 0,
          limit: row.collect_limit ?? 0
        },
        lastRefill: row.last_refill_at,
        nextRefill: row.next_refill_at
      } as OrgCredits;
    },
    enabled: !!organizationId,
    staleTime: 30_000, // 30 seconds
    refetchInterval: 60_000, // Refetch every minute to catch updates
  });

  return {
    credits: data,
    isLoading,
    error,
    refetch
  };
}
