import { useMemo, useCallback } from 'react';
import { useBookingConfig, type BookingConfig } from './useBookingConfig';
import { generateContextualBookingLink, BookingContext } from '@/lib/bookingLinkUtils';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { useQuery } from '@tanstack/react-query';

interface UseContextualBookingLinkParams {
  jobId: string;
  candidateId: string;
  jhsId: string;
  associationId: string;
  candidateName?: string;
  candidateEmail?: string;
  jobTitle?: string;
  stageName?: string;
}

type AssignedInterviewerBooking = {
  bookingConfig: BookingConfig;
  fullName: string | null;
  displayName: string | null;
};

export function useContextualBookingLink(params: UseContextualBookingLinkParams | null) {
  const { config, isLoading: isLoadingUserConfig } = useBookingConfig();

  const { data: assignedInterviewer, isLoading: isLoadingAssignedInterviewer } = useQuery({
    queryKey: ['assigned-interviewer-booking-config', params?.jhsId],
    enabled: !!params?.jhsId,
    queryFn: async (): Promise<AssignedInterviewerBooking | null> => {
      if (!params?.jhsId) return null;

      const { data: assignments, error: assignmentsError } = await supabase
        .from('stage_interviewer_assignments')
        .select('member_id, assignment_type')
        .eq('job_hiring_stage_id', params.jhsId);

      if (assignmentsError) throw assignmentsError;
      if (!assignments || assignments.length === 0) return null;

      const memberIds = assignments.map((assignment) => assignment.member_id);
      const { data: members, error: membersError } = await supabase
        .from('members')
        .select('id, user_id')
        .in('id', memberIds);

      if (membersError) throw membersError;

      const userIds = members?.map((member) => member.user_id).filter(Boolean) as string[];
      if (!userIds || userIds.length === 0) return null;

      const { data: bookingConfigs, error: bookingError } = await supabase
        .from('booking_configurations')
        .select('id, user_id, short_code, display_name, is_active')
        .in('user_id', userIds)
        .eq('is_active', true);

      if (bookingError) throw bookingError;
      if (!bookingConfigs || bookingConfigs.length === 0) return null;

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const priorityMap: Record<string, number> = {
        required: 1,
        optional: 2,
        manual: 3,
        backup: 4,
      };

      const prioritized = assignments
        .map((assignment) => {
          const member = members?.find((m) => m.id === assignment.member_id);
          const bookingConfig = bookingConfigs?.find((item) => item.user_id === member?.user_id);
          const profile = profiles?.find((p) => p.user_id === member?.user_id);

          if (!bookingConfig) return null;

          const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();

          return {
            bookingConfig: bookingConfig as BookingConfig,
            fullName: fullName || null,
            displayName: bookingConfig.display_name || null,
            priority: priorityMap[assignment.assignment_type] || 99,
          };
        })
        .filter(Boolean)
        .sort((a, b) => (a!.priority || 99) - (b!.priority || 99));

      return prioritized[0] as AssignedInterviewerBooking | null;
    },
  });

  const contextualLink = useMemo(() => {
    const activeConfig = assignedInterviewer?.bookingConfig?.short_code
      ? assignedInterviewer.bookingConfig
      : config;

    if (!params || !activeConfig?.short_code) return null;

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

    return generateContextualBookingLink({
      shortCode: activeConfig.short_code,
      context,
    });
  }, [assignedInterviewer?.bookingConfig, config, params]);

  const copyToClipboard = useCallback(async () => {
    if (!contextualLink) {
      toast({
        title: 'Error',
        description:
          'No booking link available for the assigned interviewer or your account. Please configure booking settings first.',
        variant: 'destructive',
      });
      return false;
    }

    try {
      await navigator.clipboard.writeText(contextualLink);
      toast({
        title: 'Link Copied',
        description: assignedInterviewer?.displayName || assignedInterviewer?.fullName
          ? `Booking link for ${assignedInterviewer.displayName || assignedInterviewer.fullName} copied to clipboard.`
          : 'Booking link copied to clipboard. Share it with the candidate.',
      });
      return true;
    } catch (e) {
      toast({
        title: 'Error',
        description: 'Failed to copy link to clipboard',
        variant: 'destructive',
      });
      return false;
    }
  }, [assignedInterviewer?.displayName, assignedInterviewer?.fullName, contextualLink]);

  return {
    contextualLink,
    copyToClipboard,
    hasBookingConfig:
      (!!assignedInterviewer?.bookingConfig?.short_code && assignedInterviewer.bookingConfig.is_active) ||
      (!!config?.short_code && config?.is_active),
    hasAssignedBookingConfig: !!assignedInterviewer?.bookingConfig?.short_code,
    hasUserBookingConfig: !!config?.short_code && config?.is_active,
    linkOwnerName: assignedInterviewer?.displayName || assignedInterviewer?.fullName || null,
    usingAssignedInterviewer: !!assignedInterviewer?.bookingConfig?.short_code,
    isLoading: isLoadingUserConfig || isLoadingAssignedInterviewer,
  };
}
