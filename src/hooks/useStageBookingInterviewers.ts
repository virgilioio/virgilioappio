// @ts-nocheck - Supabase type instantiation depth issue with stage_interviewer_assignments
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { createShortBookingToken, generateShortBookingLink, generateContextualBookingLink, BookingContext } from '@/lib/bookingLinkUtils';
import { useCallback, useState } from 'react';
import { copyToClipboardSilent } from '@/utils/clipboard';

export interface InterviewerBookingInfo {
  memberId: string;
  userId: string;
  fullName: string;
  assignmentType: 'required' | 'optional' | 'manual' | 'backup';
  bookingConfig: {
    id: string;
    short_code: string;
    is_active: boolean;
  };
}

interface UseStageBookingInterviewersParams {
  jhsId: string;
  jobId: string;
  candidateId: string;
  associationId: string;
  candidateName?: string;
  candidateEmail?: string;
  jobTitle?: string;
  stageName?: string;
}

const ASSIGNMENT_PRIORITY: Record<string, number> = {
  required: 1,
  optional: 2,
  manual: 3,
  backup: 4,
};

interface AssignmentRow {
  id: string;
  member_id: string;
  assignment_type: string;
}

interface MemberRow {
  id: string;
  user_id: string | null;
}

interface BookingConfigRow {
  id: string;
  user_id: string;
  short_code: string;
  is_active: boolean;
}

interface ProfileRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
}

async function fetchStageInterviewers(jhsId: string): Promise<InterviewerBookingInfo[]> {
  // Get all stage interviewer assignments
  // @ts-ignore - Supabase type instantiation issue
  const { data: assignmentsData, error: assignmentsError } = await supabase
    .from('stage_interviewer_assignments')
    .select('id, member_id, assignment_type')
    .eq('job_hiring_stage_id', jhsId);

  const assignments = assignmentsData as AssignmentRow[] | null;

  if (assignmentsError || !assignments?.length) {
    if (assignmentsError) console.error('Error fetching stage assignments:', assignmentsError);
    return [];
  }

  const memberIds = assignments.map(a => a.member_id);

  // Get members
  const { data: membersData, error: membersError } = await supabase
    .from('members')
    .select('id, user_id')
    .in('id', memberIds);

  const members = membersData as MemberRow[] | null;

  if (membersError || !members?.length) {
    if (membersError) console.error('Error fetching members:', membersError);
    return [];
  }

  // Filter out members without user_id (invited but not yet registered)
  const validMembers = members.filter(m => m.user_id != null) as { id: string; user_id: string }[];
  if (!validMembers.length) return [];

  const userIds = validMembers.map(m => m.user_id);

  // Get active booking configurations for these users
  const { data: bookingConfigsData, error: configsError } = await supabase
    .from('booking_configurations')
    .select('id, user_id, short_code, is_active')
    .in('user_id', userIds)
    .eq('is_active', true);

  const bookingConfigs = bookingConfigsData as BookingConfigRow[] | null;

  if (configsError) {
    console.error('Error fetching booking configs:', configsError);
    return [];
  }

  // Get profiles for names
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name')
    .in('user_id', userIds);

  const profiles = profilesData as ProfileRow[] | null;

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
  }

  // Build the result by combining all data
  const interviewersWithBooking: InterviewerBookingInfo[] = [];

  for (const assignment of assignments) {
    const member = validMembers.find(m => m.id === assignment.member_id);
    if (!member) continue;

    const config = bookingConfigs?.find(c => c.user_id === member.user_id);
    if (!config) continue; // Skip members without active booking config

    const profile = profiles?.find(p => p.user_id === member.user_id);
    const fullName = profile 
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown' 
      : 'Unknown';

    interviewersWithBooking.push({
      memberId: member.id,
      userId: member.user_id,
      fullName,
      assignmentType: assignment.assignment_type as InterviewerBookingInfo['assignmentType'],
      bookingConfig: {
        id: config.id,
        short_code: config.short_code,
        is_active: config.is_active,
      },
    });
  }

  // Sort by assignment priority
  return interviewersWithBooking.sort(
    (a, b) => (ASSIGNMENT_PRIORITY[a.assignmentType] || 99) - (ASSIGNMENT_PRIORITY[b.assignmentType] || 99)
  );
}

export function useStageBookingInterviewers(params: UseStageBookingInterviewersParams | null) {
  const { toast } = useToast();
  const [copyingInterviewerId, setCopyingInterviewerId] = useState<string | null>(null);

  const { data: interviewers = [], isLoading } = useQuery<InterviewerBookingInfo[]>({
    queryKey: ['stage-booking-interviewers', params?.jhsId],
    queryFn: () => params?.jhsId ? fetchStageInterviewers(params.jhsId) : Promise.resolve([]),
    enabled: !!params?.jhsId,
  });

  const copyLinkForInterviewer = useCallback(async (interviewer: InterviewerBookingInfo) => {
    if (!params) return;

    setCopyingInterviewerId(interviewer.memberId);

    try {
      const context: BookingContext = {
        jobId: params.jobId,
        candidateId: params.candidateId,
        jhsId: params.jhsId,
        associationId: params.associationId,
        candidateName: params.candidateName,
        candidateEmail: params.candidateEmail,
        jobTitle: params.jobTitle,
        stageName: params.stageName,
      };

      // Create token for this specific interviewer
      const token = await createShortBookingToken({
        shortCode: interviewer.bookingConfig.short_code,
        context,
      });

      // Generate link
      const link = token
        ? generateShortBookingLink({ shortCode: interviewer.bookingConfig.short_code, token })
        : generateContextualBookingLink({ shortCode: interviewer.bookingConfig.short_code, context });

      // Copy to clipboard
      const success = await copyToClipboardSilent(link);
      if (!success) throw new Error('Clipboard copy failed');

      const name = interviewer.fullName;
      toast({
        title: 'Link Copied',
        description: `Booking link for ${name} copied to clipboard.`,
      });
    } catch (error) {
      console.error('Error copying booking link:', error);
      toast({
        title: 'Error',
        description: 'Failed to copy booking link. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setCopyingInterviewerId(null);
    }
  }, [params, toast]);

  return {
    interviewers,
    isLoading,
    copyLinkForInterviewer,
    copyingInterviewerId,
  };
}
