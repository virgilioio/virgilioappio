import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { useBookingConfig, type BookingConfig } from './useBookingConfig';
import { 
  BookingContext, 
  createShortBookingToken, 
  generateShortBookingLink,
  generateContextualBookingLink 
} from '@/lib/bookingLinkUtils';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { copyToClipboardSilent } from '@/utils/clipboard';

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
  const [shortToken, setShortToken] = useState<string | null>(null);
  const [isCreatingToken, setIsCreatingToken] = useState(false);

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

  // Get the active config (assigned interviewer's or user's)
  const activeConfig = useMemo(() => {
    return assignedInterviewer?.bookingConfig?.short_code
      ? assignedInterviewer.bookingConfig
      : config;
  }, [assignedInterviewer?.bookingConfig, config]);

  // Build the context object - use primitive values to prevent infinite loop
  const context = useMemo<BookingContext | null>(() => {
    if (!params || !activeConfig?.short_code) return null;
    
    return {
      jobId: params.jobId,
      candidateId: params.candidateId,
      jhsId: params.jhsId,
      associationId: params.associationId,
      candidateName: params.candidateName,
      candidateEmail: params.candidateEmail,
      jobTitle: params.jobTitle,
      stageName: params.stageName,
    };
  }, [
    params?.jobId,
    params?.candidateId,
    params?.jhsId,
    params?.associationId,
    params?.candidateName,
    params?.candidateEmail,
    params?.jobTitle,
    params?.stageName,
    activeConfig?.short_code,
  ]);

  // Ref to track which context we're currently creating a token for
  const tokenContextKeyRef = useRef<string | null>(null);

  // Create short token when context is ready
  useEffect(() => {
    if (!context || !activeConfig?.short_code) {
      setShortToken(null);
      tokenContextKeyRef.current = null;
      return;
    }

    // Create a unique key for this context to prevent duplicate calls
    const contextKey = `${context.jobId}-${context.candidateId}-${context.jhsId}-${activeConfig.short_code}`;
    
    // Skip if we're already processing this exact context
    if (tokenContextKeyRef.current === contextKey) {
      return;
    }
    
    tokenContextKeyRef.current = contextKey;

    // Create the short token
    const createToken = async () => {
      setIsCreatingToken(true);
      try {
        const token = await createShortBookingToken({
          shortCode: activeConfig.short_code,
          context,
        });
        setShortToken(token);
      } catch (e) {
        console.error('Failed to create short token:', e);
        setShortToken(null);
      } finally {
        setIsCreatingToken(false);
      }
    };

    createToken();
  }, [context, activeConfig?.short_code]);

  // Generate the contextual link (short if available, fallback to base64)
  const contextualLink = useMemo(() => {
    if (!activeConfig?.short_code) return null;

    // If we have a short token, use it
    if (shortToken) {
      return generateShortBookingLink({
        shortCode: activeConfig.short_code,
        token: shortToken,
      });
    }

    // Fallback to legacy base64 encoding while token is being created
    if (context) {
      return generateContextualBookingLink({
        shortCode: activeConfig.short_code,
        context,
      });
    }

    return null;
  }, [activeConfig?.short_code, shortToken, context]);

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
      const success = await copyToClipboardSilent(contextualLink);
      if (!success) throw new Error('Clipboard copy failed');
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
    isLoading: isLoadingUserConfig || isLoadingAssignedInterviewer || isCreatingToken,
  };
}
