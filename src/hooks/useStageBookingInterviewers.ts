// @ts-nocheck - Supabase type instantiation depth issue with stage_interviewer_assignments
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { createShortBookingToken, generateShortBookingLink, generateContextualBookingLink, createGroupBookingToken, generateGroupBookingLink, BookingContext } from '@/lib/bookingLinkUtils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { primeClipboard, copyToClipboardSilent } from '@/utils/clipboard';
import { useLatestBookingTokenStatus, latestTokenStatusKey, type TokenStatusEntry } from './useLatestBookingTokenStatus';

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

  const { data: membersData, error: membersError } = await supabase
    .from('members')
    .select('id, user_id')
    .in('id', memberIds);

  const members = membersData as MemberRow[] | null;

  if (membersError || !members?.length) {
    if (membersError) console.error('Error fetching members:', membersError);
    return [];
  }

  const validMembers = members.filter(m => m.user_id != null) as { id: string; user_id: string }[];
  if (!validMembers.length) return [];

  const userIds = validMembers.map(m => m.user_id);

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

  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name')
    .in('user_id', userIds);

  const profiles = profilesData as ProfileRow[] | null;

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
  }

  const interviewersWithBooking: InterviewerBookingInfo[] = [];

  for (const assignment of assignments) {
    const member = validMembers.find(m => m.id === assignment.member_id);
    if (!member) continue;

    const config = bookingConfigs?.find(c => c.user_id === member.user_id);
    if (!config) continue;

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

  return interviewersWithBooking.sort(
    (a, b) => (ASSIGNMENT_PRIORITY[a.assignmentType] || 99) - (ASSIGNMENT_PRIORITY[b.assignmentType] || 99)
  );
}

export function useStageBookingInterviewers(params: UseStageBookingInterviewersParams | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copyingInterviewerId, setCopyingInterviewerId] = useState<string | null>(null);
  // Pre-built links: memberId → ready-to-copy URL
  const [prebuiltLinks, setPrebuiltLinks] = useState<Record<string, string>>({});
  const prebuiltAbortRef = useRef<AbortController | null>(null);

  const { data: interviewers = [], isLoading } = useQuery<InterviewerBookingInfo[]>({
    queryKey: ['stage-booking-interviewers', params?.jhsId],
    queryFn: () => params?.jhsId ? fetchStageInterviewers(params.jhsId) : Promise.resolve([]),
    enabled: !!params?.jhsId,
  });

  const { data: tokenStatusMap } = useLatestBookingTokenStatus({
    jobId: params?.jobId,
    candidateId: params?.candidateId,
    associationId: params?.associationId,
    jhsId: params?.jhsId,
  });

  const invalidateTokenStatus = useCallback(() => {
    if (!params) return;
    queryClient.invalidateQueries({
      queryKey: latestTokenStatusKey({
        jobId: params.jobId,
        candidateId: params.candidateId,
        associationId: params.associationId,
        jhsId: params.jhsId,
      }),
    });
  }, [queryClient, params?.jobId, params?.candidateId, params?.associationId, params?.jhsId]);

  const tokenStatusByMember = useMemo<Record<string, TokenStatusEntry>>(() => {
    const map: Record<string, TokenStatusEntry> = {};
    const hasPast = !!tokenStatusMap?.hasPastBooking;
    for (const i of interviewers) {
      const entry = tokenStatusMap?.byShortCode[i.bookingConfig.short_code];
      // If a past booking exists and we don't have a fresher token cached, surface as expired.
      const fallback: TokenStatusEntry = hasPast
        ? { status: 'expired', expiresAt: tokenStatusMap?.pastBookingEndsAt ?? null, token: null }
        : { status: 'none', expiresAt: null, token: null };
      map[i.memberId] = entry ?? fallback;
    }
    return map;
  }, [interviewers, tokenStatusMap]);

  const groupTokenStatus: TokenStatusEntry = useMemo(() => {
    if (!interviewers.length || !tokenStatusMap) return { status: 'none', expiresAt: null, token: null };
    const eligible = interviewers.filter(i => i.assignmentType !== 'backup');
    const primary = eligible[0];
    if (!primary) return { status: 'none', expiresAt: null, token: null };
    const entry = tokenStatusMap.byShortCode[primary.bookingConfig.short_code];
    if (entry) return entry;
    if (tokenStatusMap.hasPastBooking) {
      return { status: 'expired', expiresAt: tokenStatusMap.pastBookingEndsAt, token: null };
    }
    return { status: 'none', expiresAt: null, token: null };
  }, [interviewers, tokenStatusMap]);


  // Pre-create tokens for all interviewers when data is ready
  useEffect(() => {
    if (!params || interviewers.length === 0) {
      setPrebuiltLinks({});
      return;
    }

    // Abort any in-flight pre-creation from a previous render
    prebuiltAbortRef.current?.abort();
    const controller = new AbortController();
    prebuiltAbortRef.current = controller;

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

    // Fire all token creations in parallel
    Promise.all(
      interviewers.map(async (interviewer) => {
        try {
          const token = await createShortBookingToken({
            shortCode: interviewer.bookingConfig.short_code,
            context,
          });

          const link = token
            ? generateShortBookingLink({ shortCode: interviewer.bookingConfig.short_code, token })
            : generateContextualBookingLink({ shortCode: interviewer.bookingConfig.short_code, context });

          return { memberId: interviewer.memberId, link };
        } catch {
          // Fallback to base64 link if token creation fails
          const link = generateContextualBookingLink({ shortCode: interviewer.bookingConfig.short_code, context });
          return { memberId: interviewer.memberId, link };
        }
      })
    ).then((results) => {
      if (controller.signal.aborted) return;
      const linksMap: Record<string, string> = {};
      for (const r of results) {
        linksMap[r.memberId] = r.link;
      }
      setPrebuiltLinks(linksMap);
    });

    return () => {
      controller.abort();
    };
  }, [interviewers, params?.jobId, params?.candidateId, params?.jhsId, params?.associationId, params?.candidateName, params?.candidateEmail, params?.jobTitle, params?.stageName]);

  const copyLinkForInterviewer = useCallback(async (interviewer: InterviewerBookingInfo) => {
    if (!params) return;

    setCopyingInterviewerId(interviewer.memberId);

    try {
      const memberStatus = tokenStatusByMember?.[interviewer.memberId]?.status;
      const mustRenew = memberStatus === 'expired';
      const prebuiltLink = mustRenew ? undefined : prebuiltLinks[interviewer.memberId];

      if (prebuiltLink) {

        // Happy path: link is pre-built, copy immediately within user gesture
        await primeClipboard();
        const success = await copyToClipboardSilent(prebuiltLink);
        const name = interviewer.fullName;

        if (success) {
          toast({
            title: 'Link Copied',
            description: `Booking link for ${name} copied to clipboard.`,
          });
        } else {
          toast({
            title: 'Copy the link manually',
            description: prebuiltLink,
            duration: 15000,
          });
        }
      } else {
        // Fallback: link not ready yet, use async path (may trigger manual copy)
        await primeClipboard();

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

        const token = await createShortBookingToken({
          shortCode: interviewer.bookingConfig.short_code,
          context,
        });

        const link = token
          ? generateShortBookingLink({ shortCode: interviewer.bookingConfig.short_code, token })
          : generateContextualBookingLink({ shortCode: interviewer.bookingConfig.short_code, context });

        const success = await copyToClipboardSilent(link);
        const name = interviewer.fullName;

        if (success) {
          toast({
            title: 'Link Copied',
            description: `Booking link for ${name} copied to clipboard.`,
          });
        } else {
          toast({
            title: 'Copy the link manually',
            description: link,
            duration: 15000,
          });
        }
      }
    } catch (error) {
      console.error('Error copying booking link:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate booking link. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setCopyingInterviewerId(null);
      invalidateTokenStatus();
    }
  }, [params, toast, prebuiltLinks, invalidateTokenStatus]);

  const [isCopyingGroup, setIsCopyingGroup] = useState(false);

  const copyGroupLink = useCallback(async (eligibleInterviewers: InterviewerBookingInfo[]) => {
    if (!params || eligibleInterviewers.length < 2) return;

    setIsCopyingGroup(true);
    try {
      await primeClipboard();

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

      // Stable order: by assignment priority then memberId
      const ordered = [...eligibleInterviewers].sort((a, b) => {
        const pa = ASSIGNMENT_PRIORITY[a.assignmentType] || 99;
        const pb = ASSIGNMENT_PRIORITY[b.assignmentType] || 99;
        if (pa !== pb) return pa - pb;
        return a.memberId.localeCompare(b.memberId);
      });

      const primary = ordered[0];
      const bookingConfigIds = ordered.map(i => i.bookingConfig.id);

      const token = await createGroupBookingToken({
        context,
        bookingConfigIds,
        primaryShortCode: primary.bookingConfig.short_code,
      });

      if (!token) {
        toast({
          title: 'Error',
          description: 'Failed to create group booking link.',
          variant: 'destructive',
        });
        return;
      }

      const link = generateGroupBookingLink({
        primaryShortCode: primary.bookingConfig.short_code,
        token,
      });

      const success = await copyToClipboardSilent(link);
      const names = ordered.map(i => i.fullName).join(', ');

      if (success) {
        toast({
          title: 'Group Link Copied',
          description: `Booking link for ${names} copied to clipboard.`,
        });
      } else {
        toast({
          title: 'Copy the link manually',
          description: link,
          duration: 15000,
        });
      }
    } catch (error) {
      console.error('Error copying group booking link:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate group booking link. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCopyingGroup(false);
      invalidateTokenStatus();
    }
  }, [params, toast, invalidateTokenStatus]);

  return {
    interviewers,
    isLoading,
    copyLinkForInterviewer,
    copyingInterviewerId,
    copyGroupLink,
    isCopyingGroup,
    tokenStatusByMember,
    groupTokenStatus,
  };
}
