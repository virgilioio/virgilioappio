import { Button } from '@/components/ui/button';
import { useContextualBookingLink } from '@/hooks/useContextualBookingLink';
import { useStageBookingInterviewers } from '@/hooks/useStageBookingInterviewers';
import { useStageInterviewerAssignments } from '@/hooks/useStageInterviewerAssignments';
import { Link2, Loader2, ChevronDown, User, Users, RefreshCw } from 'lucide-react';
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

function formatExpiredAt(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
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
  const { schedulingMode } = useStageInterviewerAssignments(jhsId);

  const {
    interviewers,
    isLoading: isLoadingInterviewers,
    copyLinkForInterviewer,
    copyingInterviewerId,
    copyGroupLink,
    isCopyingGroup,
    tokenStatusByMember,
    groupTokenStatus,
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

  const {
    copyToClipboard: copyUserLink,
    hasBookingConfig: hasUserBookingConfig,
    isLoading: isLoadingUserConfig,
    tokenStatus: userTokenStatus,
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
  const groupEligible = interviewers.filter(i => i.assignmentType !== 'backup');
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

  // AND mode: single group link if eligible
  if (schedulingMode === 'all') {
    if (groupEligible.length < 2) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant={variant} size={size} disabled className="opacity-60">
                  <Users className="h-4 w-4" />
                  {showLabel && <span className="ml-2">Group link unavailable</span>}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Group availability requires at least 2 interviewers with active booking links.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    const names = groupEligible.map(i => i.fullName).join(', ');
    const groupExpired = groupTokenStatus?.status === 'expired';
    const label = groupExpired ? 'Renew Group Booking Link' : 'Copy Group Booking Link';
    const tooltipMsg = groupExpired
      ? `The previous group link expired${groupTokenStatus?.expiresAt ? ' on ' + formatExpiredAt(groupTokenStatus.expiresAt) : ''}. Click to generate a fresh link and copy it.`
      : `Shows times that work for ${names}`;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              onClick={() => copyGroupLink(groupEligible)}
              disabled={isCopyingGroup}
            >
              {isCopyingGroup ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : groupExpired ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              {showLabel && <span className="ml-2">{label}</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipMsg}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Multiple interviewers: show dropdown
  if (hasMultipleInterviewers) {
    const anyExpired = interviewers.some(i => tokenStatusByMember?.[i.memberId]?.status === 'expired');
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={size}>
            {anyExpired ? <RefreshCw className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            {showLabel && <span className="ml-2">{anyExpired ? 'Renew Booking Link' : 'Copy Booking Link'}</span>}
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-50">
          {interviewers.map((interviewer) => {
            const name = interviewer.fullName;
            const isCopying = copyingInterviewerId === interviewer.memberId;
            const expired = tokenStatusByMember?.[interviewer.memberId]?.status === 'expired';
            return (
              <DropdownMenuItem
                key={interviewer.memberId}
                onClick={() => copyLinkForInterviewer(interviewer)}
                disabled={isCopying}
                className="cursor-pointer"
              >
                {isCopying ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : expired ? (
                  <RefreshCw className="h-4 w-4 mr-2" />
                ) : (
                  <User className="h-4 w-4 mr-2" />
                )}
                {expired ? `Renew ${name}'s Link` : `Copy ${name}'s Link`}
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
    const expired = tokenStatusByMember?.[interviewer.memberId]?.status === 'expired';
    const expiresAt = tokenStatusByMember?.[interviewer.memberId]?.expiresAt ?? null;
    const tooltipMessage = expired
      ? `The previous link expired${expiresAt ? ' on ' + formatExpiredAt(expiresAt) : ''}. Click to generate a fresh link and copy it.`
      : `Copy ${name}'s self-scheduling link for this candidate`;
    const label = expired ? `Renew ${name}'s Link` : `Copy ${name}'s Link`;

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
              ) : expired ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {showLabel && <span className="ml-2">{label}</span>}
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
  const userExpired = userTokenStatus?.status === 'expired';
  const userLabel = userExpired ? 'Renew Your Link' : 'Copy Your Link';
  const userTooltip = userExpired
    ? `The previous link expired${userTokenStatus?.expiresAt ? ' on ' + formatExpiredAt(userTokenStatus.expiresAt) : ''}. Click to generate a fresh link and copy it.`
    : 'Copy your self-scheduling link for this candidate';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant={variant} size={size} onClick={copyUserLink}>
            {userExpired ? <RefreshCw className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            {showLabel && <span className="ml-2">{userLabel}</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{userTooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
