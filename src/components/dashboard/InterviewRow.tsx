import { format, parseISO, isToday, isTomorrow } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Clock,
  MoreVertical,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScheduledBooking } from '@/hooks/useScheduledBookings'

interface InterviewRowProps {
  booking: ScheduledBooking
  currentUserId?: string
  showInterviewer: boolean
  isPastTab?: boolean
  onViewDetails: (bookingId: string) => void
  onNavigate?: (jobId: string, candidateId: string) => void
  onCopyMeetingLink?: (booking: ScheduledBooking) => void
  onMarkCompleted?: (bookingId: string) => void
  onMarkNoShow?: (bookingId: string) => void
  onCancel?: (bookingId: string) => void
  isUpdating?: boolean
  isCancelling?: boolean
}

const formatInterviewDate = (dateString: string) => {
  const date = parseISO(dateString)
  const time = format(date, 'h:mm a')

  if (isToday(date)) return `Today at ${time}`
  if (isTomorrow(date)) return `Tomorrow at ${time}`

  return `${format(date, 'MMM d')} at ${time}`
}

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'default'
    case 'rescheduled':
      return 'secondary'
    case 'completed':
      return 'outline'
    case 'cancelled':
      return 'destructive'
    case 'no_show':
      return 'outline'
    default:
      return 'outline'
  }
}

export function InterviewRow({
  booking,
  currentUserId,
  showInterviewer,
  isPastTab = false,
  onViewDetails,
  onNavigate,
  onCopyMeetingLink,
  onMarkCompleted,
  onMarkNoShow,
  onCancel,
  isUpdating,
  isCancelling,
}: InterviewRowProps) {
  const interviewerName = booking.interviewer_profile
    ? `${booking.interviewer_profile.first_name} ${booking.interviewer_profile.last_name}`
    : null
  const isOwnInterview = booking.interviewer_id === currentUserId
  const candidateName = booking.candidate?.candidate_name || booking.candidate_name
  const jobTitle = booking.job?.title || 'Unknown Job'

  const handleRowClick = () => {
    if (onNavigate && booking.job?.id && booking.candidate_id) {
      onNavigate(booking.job.id, booking.candidate_id)
    } else {
      onViewDetails(booking.id)
    }
  }

  return (
    <div
      className={cn(
        "group w-full text-left p-3 rounded-lg border transition-all",
        "hover:bg-accent hover:border-accent-foreground/20",
        "border-border bg-card"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={handleRowClick}
          className="flex-1 min-w-0 text-left focus:outline-none"
        >
          {/* Line 1: Candidate name + Status badge + Sync icons */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {candidateName}
            </span>
            <Badge variant={getStatusBadgeVariant(booking.status)} className="text-xs shrink-0">
              {booking.status}
            </Badge>
            {booking.sync_source === 'google_calendar' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <RefreshCw className="h-3 w-3 text-muted-foreground shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Synced from Google Calendar</p>
                    <p className="text-xs text-muted-foreground">
                      Last synced: {booking.last_synced_at ? format(parseISO(booking.last_synced_at), 'MMM d, h:mm a') : 'Never'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {booking.sync_errors && Array.isArray(booking.sync_errors) && booking.sync_errors.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Sync issues detected</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* Line 2: Interviewer (if applicable) • Job title */}
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
            {showInterviewer && interviewerName && (
              <>
                <span className="truncate">
                  {isOwnInterview ? 'You' : interviewerName}
                </span>
                <span>•</span>
              </>
            )}
            <span className="truncate">{jobTitle}</span>
          </div>

          {/* Line 3: Date/time • Duration */}
          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span>{formatInterviewDate(booking.scheduled_start)}</span>
            <span>•</span>
            <span>{booking.duration_minutes} min</span>
          </div>
        </button>

        {/* Right side: Dropdown menu + Chevron */}
        <div className="flex items-center gap-1 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewDetails(booking.id)}>
                View Details
              </DropdownMenuItem>
              {!isPastTab && (
                <>
                  {booking.meeting_location && onCopyMeetingLink && (
                    <DropdownMenuItem onClick={() => onCopyMeetingLink(booking)}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Copy Meeting Link
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {onMarkCompleted && (
                    <DropdownMenuItem
                      onClick={() => onMarkCompleted(booking.id)}
                      disabled={isUpdating}
                    >
                      Mark as Completed
                    </DropdownMenuItem>
                  )}
                  {onMarkNoShow && (
                    <DropdownMenuItem
                      onClick={() => onMarkNoShow(booking.id)}
                      disabled={isUpdating}
                    >
                      Mark as No-Show
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {onCancel && (
                    <DropdownMenuItem
                      onClick={() => onCancel(booking.id)}
                      disabled={isCancelling}
                      className="text-destructive"
                    >
                      Cancel Booking
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </div>
  )
}
