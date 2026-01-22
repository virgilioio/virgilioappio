import { Button } from '@/components/ui/button';
import { useContextualBookingLink } from '@/hooks/useContextualBookingLink';
import { useStageBookingInterviewers } from '@/hooks/useStageBookingInterviewers';
import { Link2, Loader2, ChevronDown, User } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  // Fetch all interviewers with active booking configs for the stage
  const {
    interviewers,
    isLoading: isLoadingInterviewers,
    copyLinkForInterviewer,
    copyingInterviewerId,
  } = useStageBookingInterviewers({
    jhsId,
    jobId,
    candidateId,
    associationId,
    candidateName,
    candidateEmail,
    jobTitle,
    stageName,
  });

  // Fallback to user's own booking config
  const {
    copyToClipboard: copyUserLink,
    hasBookingConfig: hasUserBookingConfig,
    isLoading: isLoadingUserConfig,
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

  const isLoading = isLoadingInterviewers || isLoadingUserConfig;
  const hasMultipleInterviewers = interviewers.length > 1;
  const hasSingleInterviewer = interviewers.length === 1;
  const hasAnyBookingConfig = interviewers.length > 0 || hasUserBookingConfig;

  if (isLoading) {
    return (
      <Button variant={variant} size={size} disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        {showLabel && <span className="ml-2">Loading...</span>}
      </Button>
    );
  }

  if (!hasAnyBookingConfig) {
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

  // Multiple interviewers: show dropdown
  if (hasMultipleInterviewers) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={size}>
            <Link2 className="h-4 w-4" />
            {showLabel && <span className="ml-2">Copy Booking Link</span>}
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-50">
          {interviewers.map((interviewer) => {
            const name = interviewer.fullName;
            const isCopying = copyingInterviewerId === interviewer.memberId;
            return (
              <DropdownMenuItem
                key={interviewer.memberId}
                onClick={() => copyLinkForInterviewer(interviewer)}
                disabled={isCopying}
                className="cursor-pointer"
              >
                {isCopying ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <User className="h-4 w-4 mr-2" />
                )}
                Copy {name}'s Link
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Single interviewer: show single button
  if (hasSingleInterviewer) {
    const interviewer = interviewers[0];
    const name = interviewer.fullName;
    const isCopying = copyingInterviewerId === interviewer.memberId;
    const tooltipMessage = `Copy ${name}'s self-scheduling link for this candidate`;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              onClick={() => copyLinkForInterviewer(interviewer)}
              disabled={isCopying}
            >
              {isCopying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {showLabel && <span className="ml-2">Copy {name}'s Link</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Fallback: user's own booking config
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant={variant} size={size} onClick={copyUserLink}>
            <Link2 className="h-4 w-4" />
            {showLabel && <span className="ml-2">Copy Your Link</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Copy your self-scheduling link for this candidate</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
