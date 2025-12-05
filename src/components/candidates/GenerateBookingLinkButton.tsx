import { Button } from '@/components/ui/button';
import { useContextualBookingLink } from '@/hooks/useContextualBookingLink';
import { Link2, Loader2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Link } from 'react-router-dom';

interface GenerateBookingLinkButtonProps {
  jobId: string;
  candidateId: string;
  jhsId: string;
  associationId: string;
  candidateName?: string;
  candidateEmail?: string;
  jobTitle?: string;
  stageName?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

export function GenerateBookingLinkButton({
  jobId,
  candidateId,
  jhsId,
  associationId,
  candidateName,
  candidateEmail,
  jobTitle,
  stageName,
  variant = 'outline',
  size = 'sm',
  showLabel = true,
}: GenerateBookingLinkButtonProps) {
  const {
    copyToClipboard,
    hasBookingConfig,
    isLoading,
    linkOwnerName,
    usingAssignedInterviewer,
  } = useContextualBookingLink({
    jobId,
    candidateId,
    jhsId,
    associationId,
    candidateName,
    candidateEmail,
    jobTitle,
    stageName,
  });

  const linkOwnerLabel = usingAssignedInterviewer ? linkOwnerName || 'assigned interviewer' : 'your';
  const buttonLabel = usingAssignedInterviewer
    ? `Copy ${linkOwnerName ? `${linkOwnerName}'s` : 'Interviewer'} Link`
    : 'Copy Your Link';
  const tooltipCopyMessage = usingAssignedInterviewer
    ? `Copy ${linkOwnerLabel}'s self-scheduling link for this candidate`
    : 'Copy your self-scheduling link for this candidate';

  if (isLoading) {
    return (
      <Button variant={variant} size={size} disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        {showLabel && <span className="ml-2">Loading...</span>}
      </Button>
    );
  }

  if (!hasBookingConfig) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Link to="/settings?tab=booking">
                <Button variant={variant} size={size} className="opacity-60">
                  <Link2 className="h-4 w-4" />
                  {showLabel && <span className="ml-2">Set up booking link</span>}
                </Button>
              </Link>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              Neither the assigned interviewer nor you have an active booking link. Configure your booking settings first.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant={variant} size={size} onClick={copyToClipboard}>
            <Link2 className="h-4 w-4" />
            {showLabel && <span className="ml-2">{buttonLabel}</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipCopyMessage}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
