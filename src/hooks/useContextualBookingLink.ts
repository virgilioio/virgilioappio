import { useMemo, useCallback } from 'react';
import { useBookingConfig } from './useBookingConfig';
import { generateContextualBookingLink, BookingContext } from '@/lib/bookingLinkUtils';
import { toast } from '@/hooks/use-toast';

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

export function useContextualBookingLink(params: UseContextualBookingLinkParams | null) {
  const { config, isLoading } = useBookingConfig();

  const contextualLink = useMemo(() => {
    if (!params || !config?.short_code) return null;
    
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
      shortCode: config.short_code,
      context,
    });
  }, [params, config?.short_code]);

  const copyToClipboard = useCallback(async () => {
    if (!contextualLink) {
      toast({
        title: 'Error',
        description: 'No booking link available. Please configure your booking settings first.',
        variant: 'destructive',
      });
      return false;
    }

    try {
      await navigator.clipboard.writeText(contextualLink);
      toast({
        title: 'Link Copied',
        description: 'Booking link copied to clipboard. Share it with the candidate.',
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
  }, [contextualLink]);

  return {
    contextualLink,
    copyToClipboard,
    hasBookingConfig: !!config?.short_code && config?.is_active,
    isLoading,
  };
}
