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
  /** True when a past confirmed booking exists for this candidate+stage,
   * which causes the public page to render as expired regardless of token TTL. */
  hasPastBooking: boolean;
  pastBookingEndsAt: string | null;
}

interface Params {
  jobId?: string;
  candidateId?: string;
  associationId?: string;
  jhsId?: string;
}

const emptyEntry: TokenStatusEntry = { status: 'none', expiresAt: null, token: null };

export function latestTokenStatusKey(p: Params) {
  return ['latest-booking-token-status', p.jobId, p.candidateId, p.jhsId];
}

export function useLatestBookingTokenStatus(params: Params) {
  const enabled = !!params.jobId && !!params.candidateId && !!params.jhsId;

  return useQuery<LatestTokenStatusMap>({
    queryKey: latestTokenStatusKey(params),
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<LatestTokenStatusMap> => {
      // Look up tokens by job+candidate (associationId can change across stage moves)
      const { data: tokens, error } = await supabase
        .from('booking_link_tokens')
        .select('token, short_code, expires_at, created_at, jhs_id')
        .eq('job_id', params.jobId!)
        .eq('candidate_id', params.candidateId!)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Failed to load booking token status:', error);
      }

      // Check for a past confirmed booking at this stage — the public page
      // treats this as expired unless the token was created AFTER the booking ended.
      let pastBookingEndsAt: string | null = null;
      if (params.jhsId) {
        const { data: bookings } = await supabase
          .from('scheduled_bookings')
          .select('scheduled_end, status')
          .eq('candidate_id', params.candidateId!)
          .eq('job_hiring_stage_id', params.jhsId)
          .eq('status', 'confirmed')
          .order('scheduled_start', { ascending: false })
          .limit(1);
        const b = bookings?.[0];
        if (b && new Date(b.scheduled_end).getTime() <= Date.now()) {
          pastBookingEndsAt = b.scheduled_end as unknown as string;
        }
      }

      const now = Date.now();
      const pastEndMs = pastBookingEndsAt ? new Date(pastBookingEndsAt).getTime() : null;
      const byShortCode: Record<string, TokenStatusEntry> = {};
      let latest: TokenStatusEntry = emptyEntry;

      for (const row of tokens ?? []) {
        const sc = (row as any).short_code as string | null;
        if (!sc) continue;
        if (byShortCode[sc]) continue; // first (latest by created_at desc) wins

        const expiresAt = (row as any).expires_at as string | null;
        const createdAtMs = (row as any).created_at ? new Date((row as any).created_at).getTime() : 0;
        const ttlExpired = expiresAt ? new Date(expiresAt).getTime() <= now : false;
        // Past-booking expiry only applies to tokens created at-or-before the booking end
        const pastBookingExpired = pastEndMs !== null && createdAtMs <= pastEndMs;
        const expired = ttlExpired || pastBookingExpired;
        const entry: TokenStatusEntry = {
          status: expired ? 'expired' : 'active',
          expiresAt,
          token: (row as any).token ?? null,
        };
        byShortCode[sc] = entry;
        if (latest === emptyEntry) latest = entry;
      }

      return {
        byShortCode,
        latest,
        hasPastBooking: pastEndMs !== null,
        pastBookingEndsAt,
      };
    },
  });
}
