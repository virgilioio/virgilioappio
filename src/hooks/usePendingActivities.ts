import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { isRestrictedRole, fetchAssignedJobIds } from '@/utils/jobScoping';

export type ActivityType = 'scorecard' | 'decision' | 'email' | 'offer_approval';

export interface PendingActivity {
  type: ActivityType;
  id: string;
  candidateId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  stageName?: string;
  timestamp: string;
  stageInstanceId?: string;
  associationId?: string;
  emailId?: string;
  emailSubject?: string;
  emailSnippet?: string;
  interviewerId?: string;
  interviewerName?: string;
  isOwnTask?: boolean;
}

export function usePendingActivities() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  
  const isAdmin = permissions.isAdmin || permissions.isWorkspaceOwner || permissions.isPlatformAdmin;
  const restricted = isRestrictedRole(permissions);

  const query = useQuery({
    queryKey: ['pending-activities', user?.id, isAdmin, restricted],
    queryFn: async (): Promise<PendingActivity[]> => {
      if (!user?.id) return [];

      // For restricted roles, fetch assigned job IDs once for all sub-queries
      let assignedJobIds: string[] | null = null;
      if (restricted) {
        assignedJobIds = await fetchAssignedJobIds(user.id);
        if (assignedJobIds.length === 0) return [];
      }

      const activities: PendingActivity[] = [];

      // 1. Fetch pending scorecards (already filtered by interviewer_id for non-admins)
      const scorecardActivities = await fetchPendingScorecards(user.id, isAdmin);
      activities.push(...scorecardActivities);

      // 2. Fetch candidates needing decision
      const decisionActivities = await fetchNeedsDecision(user.id, isAdmin, assignedJobIds);
      activities.push(...decisionActivities);

      // 3. Fetch unread email replies
      const emailActivities = await fetchUnreadEmails(user.id, isAdmin, assignedJobIds);
      activities.push(...emailActivities);

      // Sort all activities by timestamp (oldest/most urgent first)
      return activities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const markEmailAsRead = useMutation({
    mutationFn: async (emailId: string) => {
      const { error } = await supabase
        .from('email_logs')
        .update({ is_read: true })
        .eq('id', emailId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-activities'] });
    },
  });

  return {
    ...query,
    markEmailAsRead,
  };
}

async function fetchPendingScorecards(userId: string, isAdmin: boolean): Promise<PendingActivity[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let bookingsQuery = supabase
    .from('scheduled_bookings')
    .select(`
      id,
      scheduled_start,
      scheduled_end,
      status,
      interviewer_id,
      job_hiring_stage_id,
      job_candidate_association_id,
      job_candidate_associations!inner(
        id,
        candidate_id,
        job_id,
        status,
        candidates(id, candidate_name),
        jobs(id, title)
      ),
      job_hiring_stages!inner(
        id,
        job_stages(stage_name)
      )
    `)
    .lt('scheduled_start', new Date().toISOString())
    .gte('scheduled_start', thirtyDaysAgo.toISOString())
    .not('status', 'eq', 'cancelled')
    .order('scheduled_start', { ascending: false });

  if (!isAdmin) {
    bookingsQuery = bookingsQuery.eq('interviewer_id', userId);
  }

  const { data: bookings, error: bookingsError } = await bookingsQuery;

  if (bookingsError || !bookings || bookings.length === 0) return [];

  // Get association IDs from past bookings
  const associationIds = [...new Set(
    bookings.map(b => (b.job_candidate_associations as any)?.id).filter(Boolean)
  )];

  // Fetch future bookings for rescheduled detection
  const { data: futureBookings } = await supabase
    .from('scheduled_bookings')
    .select('job_candidate_association_id, job_hiring_stage_id, interviewer_id')
    .in('job_candidate_association_id', associationIds)
    .gte('scheduled_start', new Date().toISOString())
    .not('status', 'eq', 'cancelled');

  const futureBookingKeys = new Set(
    (futureBookings || []).map(fb => 
      `${fb.job_candidate_association_id}:${fb.job_hiring_stage_id}:${fb.interviewer_id}`
    )
  );

  // Fetch interviewer profiles
  const interviewerIds = [...new Set(bookings.map(b => b.interviewer_id).filter(Boolean))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name')
    .in('user_id', interviewerIds);

  const profileMap = new Map(
    (profiles || []).map(p => [p.user_id, p])
  );

  // Fetch scorecards
  let scorecardsQuery = supabase
    .from('job_stage_scorecards')
    .select('id, association_id, stage_instance_id, created_by');
  
  if (!isAdmin) {
    scorecardsQuery = scorecardsQuery.eq('created_by', userId);
  }

  const { data: scorecards } = await scorecardsQuery;

  const scorecardKeys = new Set(
    (scorecards || []).map(sc => `${sc.association_id}:${sc.stage_instance_id}:${sc.created_by}`)
  );

  const activities: PendingActivity[] = [];
  
  for (const booking of bookings) {
    const association = booking.job_candidate_associations as any;
    const stage = booking.job_hiring_stages as any;
    
    if (!association || !stage) continue;
    if (association.status !== 'active' && association.status !== 'offer') continue;
    
    const key = `${association.id}:${booking.job_hiring_stage_id}:${booking.interviewer_id}`;
    if (scorecardKeys.has(key)) continue;

    const rescheduledKey = `${association.id}:${booking.job_hiring_stage_id}:${booking.interviewer_id}`;
    if (futureBookingKeys.has(rescheduledKey)) continue;
    
    const profile = profileMap.get(booking.interviewer_id);
    const interviewerName = profile 
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown'
      : 'Unknown';
    
    activities.push({
      type: 'scorecard',
      id: booking.id,
      candidateId: association.candidates?.id || association.candidate_id,
      candidateName: association.candidates?.candidate_name || 'Unknown',
      jobId: association.jobs?.id || association.job_id,
      jobTitle: association.jobs?.title || 'Unknown Job',
      stageName: stage.job_stages?.stage_name || 'Interview',
      stageInstanceId: booking.job_hiring_stage_id,
      associationId: association.id,
      timestamp: booking.scheduled_start,
      interviewerId: booking.interviewer_id,
      interviewerName,
      isOwnTask: booking.interviewer_id === userId,
    });
  }

  return activities;
}

async function fetchNeedsDecision(userId: string, isAdmin: boolean, assignedJobIds: string[] | null): Promise<PendingActivity[]> {
  // Fetch active candidates that have scorecards submitted for their current stage
  
  let query = supabase
    .from('job_candidate_associations')
    .select(`
      id,
      candidate_id,
      job_id,
      current_stage_id,
      entered_stage_at,
      candidates(id, candidate_name),
      jobs!inner(id, title, organization_id),
      job_hiring_stages!job_candidate_associations_current_stage_id_fkey(
        id,
        job_stages(stage_name)
      )
    `)
    .eq('status', 'active')
    .not('current_stage_id', 'is', null);

  // Apply job-scoping for restricted roles
  if (assignedJobIds) {
    query = query.in('job_id', assignedJobIds);
  }

  const { data: associations, error } = await query;

  if (error || !associations || associations.length === 0) return [];

  // Get association IDs to check for scorecards
  const associationIds = associations.map(a => a.id);

  // Fetch human scorecards for these associations at their current stage
  const { data: scorecards } = await supabase
    .from('job_stage_scorecards')
    .select('id, association_id, stage_instance_id, created_at, is_ai_draft')
    .in('association_id', associationIds)
    .eq('is_ai_draft', false);

  if (!scorecards || scorecards.length === 0) return [];

  // Create map of association+stage -> latest scorecard date
  const scorecardMap = new Map<string, string>();
  for (const sc of scorecards) {
    const key = `${sc.association_id}:${sc.stage_instance_id}`;
    const existing = scorecardMap.get(key);
    if (!existing || new Date(sc.created_at) > new Date(existing)) {
      scorecardMap.set(key, sc.created_at);
    }
  }

  const activities: PendingActivity[] = [];

  for (const assoc of associations) {
    const stage = assoc.job_hiring_stages as any;
    if (!stage) continue;

    const key = `${assoc.id}:${assoc.current_stage_id}`;
    const scorecardDate = scorecardMap.get(key);
    
    // Only include if there's a scorecard for this stage
    if (!scorecardDate) continue;

    activities.push({
      type: 'decision',
      id: `decision-${assoc.id}`,
      candidateId: assoc.candidates?.id || assoc.candidate_id,
      candidateName: assoc.candidates?.candidate_name || 'Unknown',
      jobId: assoc.jobs?.id || assoc.job_id,
      jobTitle: assoc.jobs?.title || 'Unknown Job',
      stageName: stage.job_stages?.stage_name || 'Stage',
      stageInstanceId: assoc.current_stage_id || undefined,
      associationId: assoc.id,
      timestamp: scorecardDate,
    });
  }

  return activities;
}

async function fetchUnreadEmails(userId: string, isAdmin: boolean, assignedJobIds: string[] | null): Promise<PendingActivity[]> {
  // Fetch unread emails received from candidates
  let query = supabase
    .from('email_logs')
    .select(`
      id,
      candidate_id,
      job_id,
      subject,
      snippet,
      received_at,
      rfc822_message_id,
      candidates(id, candidate_name),
      jobs(id, title)
    `)
    .eq('direction', 'received')
    .eq('is_read', false)
    .not('candidate_id', 'is', null)
    .order('received_at', { ascending: false })
    .limit(50);

  // Apply job-scoping for restricted roles
  if (assignedJobIds) {
    query = query.in('job_id', assignedJobIds);
  }

  const { data: emails, error } = await query;

  if (error || !emails || emails.length === 0) return [];

  // Deduplicate by rfc822_message_id (Gmail sync + inbound webhook can create two records)
  const seen = new Set<string>();
  const dedupedEmails = emails.filter(email => {
    const msgId = (email as any).rfc822_message_id;
    if (!msgId) return true;
    if (seen.has(msgId)) return false;
    seen.add(msgId);
    return true;
  });

  return dedupedEmails.map(email => ({
    type: 'email' as const,
    id: email.id,
    emailId: email.id,
    candidateId: email.candidate_id!,
    candidateName: (email.candidates as any)?.candidate_name || 'Unknown',
    jobId: email.job_id || '',
    jobTitle: (email.jobs as any)?.title || 'Unknown Job',
    emailSubject: email.subject || 'No subject',
    emailSnippet: email.snippet || '',
    timestamp: email.received_at || new Date().toISOString(),
  }));
}
