import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export type BookingTokenStatus = 'none' | 'active' | 'expired';

export interface TokenStatusEntry {
  status: BookingTokenStatus;
  expiresAt: string | null;
  token: string | null;
}

export interface LatestTokenStatusMap {
  byShortCode: Record<string, TokenStatusEntry>;
  /** Latest across all short_codes for this context */
  latest: TokenStatusEntry;
}

interface Params {
  jobId?: string;
  candidateId?: string;
  associationId?: string;
}

const emptyEntry: TokenStatusEntry = { status: 'none', expiresAt: null, token: null };

export function latestTokenStatusKey(p: Params) {
  return ['latest-booking-token-status', p.jobId, p.candidateId, p.associationId];
}

export function useLatestBookingTokenStatus(params: Params) {
  const enabled = !!params.jobId && !!params.candidateId && !!params.associationId;

  return useQuery<LatestTokenStatusMap>({
    queryKey: latestTokenStatusKey(params),
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<LatestTokenStatusMap> => {
      const { data, error } = await supabase
        .from('booking_link_tokens')
        .select('token, short_code, expires_at, created_at')
        .eq('job_id', params.jobId!)
        .eq('candidate_id', params.candidateId!)
        .eq('association_id', params.associationId!)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Failed to load booking token status:', error);
        return { byShortCode: {}, latest: emptyEntry };
      }

      const now = Date.now();
      const byShortCode: Record<string, TokenStatusEntry> = {};
      let latest: TokenStatusEntry = emptyEntry;

      for (const row of data ?? []) {
        const sc = (row as any).short_code as string | null;
        if (!sc) continue;
        if (byShortCode[sc]) continue; // first (latest by created_at desc) wins

        const expiresAt = (row as any).expires_at as string | null;
        const expired = expiresAt ? new Date(expiresAt).getTime() <= now : false;
        const entry: TokenStatusEntry = {
          status: expired ? 'expired' : 'active',
          expiresAt,
          token: (row as any).token ?? null,
        };
        byShortCode[sc] = entry;
        if (latest === emptyEntry) latest = entry;
      }

      return { byShortCode, latest };
    },
  });
}
