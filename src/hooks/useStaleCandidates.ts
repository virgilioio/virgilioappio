import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { isRestrictedRole, fetchAssignedJobIds } from '@/utils/jobScoping';

export interface StaleCandidate {
  associationId: string;
  candidateId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  stageId: string;
  stageName: string;
  enteredStageAt: string;
  daysInStage: number;
  daysSinceLastActivity: number;
  lastActivityAt: string;
}

const STALE_THRESHOLD_DAYS = 7;

/** Return the latest non-null date from a list of ISO strings or null values */
function latestDate(...dates: (string | null | undefined)[]): Date | null {
  let max: Date | null = null;
  for (const d of dates) {
    if (!d) continue;
    const parsed = new Date(d);
    if (!max || parsed > max) max = parsed;
  }
  return max;
}

export function useStaleCandidates() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const restricted = isRestrictedRole(permissions);

  return useQuery({
    queryKey: ['stale-candidates', user?.id, restricted],
    queryFn: async (): Promise<StaleCandidate[]> => {
      if (!user?.id) return [];

      // For restricted roles, fetch assigned job IDs first
      let assignedJobIds: string[] | null = null;
      if (restricted) {
        assignedJobIds = await fetchAssignedJobIds(user.id);
        if (assignedJobIds.length === 0) return [];
      }

      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - STALE_THRESHOLD_DAYS);
      const now = new Date().toISOString();

      // Step 1: Get potential stale candidates (by entered_stage_at)
      // Also fetch booking_link_sent_at and whatsapp_template_sent_at from the association
      let query = supabase
        .from('job_candidate_associations')
        .select(`
          id,
          candidate_id,
          job_id,
          current_stage_id,
          entered_stage_at,
          booking_link_sent_at,
          whatsapp_template_sent_at,
          candidates!inner(candidate_name),
          jobs!inner(id, title, deleted_at),
          job_hiring_stages!inner(
            id,
            job_stages!inner(stage_name, stage_type)
          )
        `)
        .eq('status', 'active')
        .is('jobs.deleted_at', null)
        .not('current_stage_id', 'is', null)
        .not('entered_stage_at', 'is', null)
        .lt('entered_stage_at', thresholdDate.toISOString())
        .order('entered_stage_at', { ascending: true })
        .limit(100);

      if (assignedJobIds) {
        query = query.in('job_id', assignedJobIds);
      }

      const { data: potentialStale, error } = await query;

      if (error) {
        console.error('Error fetching stale candidates:', error);
        throw error;
      }

      if (!potentialStale || potentialStale.length === 0) return [];

      const candidateIds = potentialStale.map(r => r.candidate_id);
      const jobIds = potentialStale.map(r => r.job_id);
      const associationIds = potentialStale.map(r => r.id);

      // Step 2: Batch fetch activity signals in parallel
      const [
        { data: upcomingBookings },
        { data: pendingReminders },
        { data: recentScorecards },
        { data: recentEmails },
        { data: recentBookings },
      ] = await Promise.all([
        // Upcoming confirmed bookings (existing exclusion)
        supabase
          .from('scheduled_bookings')
          .select('candidate_id, job_id')
          .in('candidate_id', candidateIds)
          .in('job_id', jobIds)
          .eq('status', 'confirmed')
          .gte('scheduled_start', now),
        // Pending reminders (existing exclusion)
        supabase
          .from('candidate_reminders')
          .select('candidate_id, job_id')
          .in('candidate_id', candidateIds)
          .is('completed_at', null),
        // Recent scorecards by association
        supabase
          .from('job_stage_scorecards')
          .select('association_id, created_at')
          .in('association_id', associationIds)
          .order('created_at', { ascending: false }),
        // Recent emails by candidate+job
        supabase
          .from('email_logs')
          .select('candidate_id, job_id, sent_at, received_at')
          .in('candidate_id', candidateIds)
          .in('job_id', jobIds)
          .order('created_at', { ascending: false }),
        // Recent bookings (any status) by candidate+job
        supabase
          .from('scheduled_bookings')
          .select('candidate_id, job_id, created_at')
          .in('candidate_id', candidateIds)
          .in('job_id', jobIds)
          .order('created_at', { ascending: false }),
      ]);

      // Build lookup maps
      const candidatesWithBookings = new Set(
        upcomingBookings?.map(b => `${b.candidate_id}-${b.job_id}`) || []
      );
      const candidatesWithReminders = new Set(
        pendingReminders?.map(r => `${r.candidate_id}-${r.job_id}`) || []
      );

      // Latest scorecard per association
      const latestScorecardByAssoc = new Map<string, string>();
      for (const sc of recentScorecards || []) {
        if (!latestScorecardByAssoc.has(sc.association_id)) {
          latestScorecardByAssoc.set(sc.association_id, sc.created_at);
        }
      }

      // Latest email per candidate+job
      const latestEmailByKey = new Map<string, string>();
      for (const e of recentEmails || []) {
        if (!e.candidate_id || !e.job_id) continue;
        const key = `${e.candidate_id}-${e.job_id}`;
        if (!latestEmailByKey.has(key)) {
          const latest = latestDate(e.sent_at, e.received_at);
          if (latest) latestEmailByKey.set(key, latest.toISOString());
        }
      }

      // Latest booking per candidate+job
      const latestBookingByKey = new Map<string, string>();
      for (const b of recentBookings || []) {
        if (!b.candidate_id || !b.job_id) continue;
        const key = `${b.candidate_id}-${b.job_id}`;
        if (!latestBookingByKey.has(key)) {
          latestBookingByKey.set(key, b.created_at);
        }
      }

      // Step 3: Filter and map
      const staleCandidates: StaleCandidate[] = [];
      const thresholdMs = thresholdDate.getTime();

      for (const row of potentialStale) {
        const stage = row.job_hiring_stages as any;
        const stageInfo = stage?.job_stages;

        // Skip terminal stages
        if (!stageInfo || ['offer', 'onboarding'].includes(stageInfo.stage_type)) {
          continue;
        }

        // Skip if has upcoming confirmed booking
        if (candidatesWithBookings.has(`${row.candidate_id}-${row.job_id}`)) {
          continue;
        }

        // Skip if has pending reminder
        if (candidatesWithReminders.has(`${row.candidate_id}-${row.job_id}`)) {
          continue;
        }

        const candidate = row.candidates as any;
        const job = row.jobs as any;
        if (!candidate || !job) continue;

        // Compute last activity date from all signals
        const key = `${row.candidate_id}-${row.job_id}`;
        const lastActivity = latestDate(
          row.entered_stage_at,
          (row as any).booking_link_sent_at,
          (row as any).whatsapp_template_sent_at,
          latestScorecardByAssoc.get(row.id) ?? null,
          latestEmailByKey.get(key) ?? null,
          latestBookingByKey.get(key) ?? null,
        );

        // If last activity is within threshold, candidate is NOT stale
        if (lastActivity && lastActivity.getTime() > thresholdMs) {
          continue;
        }

        const enteredAt = new Date(row.entered_stage_at!);
        const daysInStage = differenceInDays(new Date(), enteredAt);
        const daysSinceLastActivity = lastActivity
          ? differenceInDays(new Date(), lastActivity)
          : daysInStage;

        staleCandidates.push({
          associationId: row.id,
          candidateId: row.candidate_id,
          candidateName: candidate.candidate_name || 'Unknown',
          jobId: row.job_id,
          jobTitle: job.title || 'Unknown Job',
          stageId: stage.id,
          stageName: stageInfo.stage_name || 'Unknown Stage',
          enteredStageAt: row.entered_stage_at!,
          daysInStage,
          daysSinceLastActivity,
          lastActivityAt: lastActivity?.toISOString() || row.entered_stage_at!,
        });

        if (staleCandidates.length >= 50) break;
      }

      return staleCandidates;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!user?.id,
  });
}
