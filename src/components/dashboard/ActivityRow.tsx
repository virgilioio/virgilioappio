import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns'
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
  Calendar,
  Bell,
  Lock,
  Users,
  CheckCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UnifiedActivity } from '@/types/activity'
import type { ScheduledBooking } from '@/hooks/useScheduledBookings'

interface ActivityRowProps {
  activity: UnifiedActivity
  currentUserId?: string
  showInterviewer: boolean
  isPastTab?: boolean
  // Interview actions
  onViewDetails?: (bookingId: string) => void
  onNavigate?: (jobId: string, candidateId: string) => void
  onCopyMeetingLink?: (booking: ScheduledBooking) => void
  onMarkInterviewCompleted?: (bookingId: string) => void
  onMarkNoShow?: (bookingId: string) => void
  onCancelInterview?: (bookingId: string) => void
  // Reminder actions
  onCompleteReminder?: (reminderId: string) => void
  // Loading states
  isUpdating?: boolean
  isCancelling?: boolean
  isCompletingReminder?: boolean
}

const formatActivityDate = (dateString: string) => {
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

export function ActivityRow({
  activity,
  currentUserId,
  showInterviewer,
  isPastTab = false,
  onViewDetails,
  onNavigate,
  onCopyMeetingLink,
  onMarkInterviewCompleted,
  onMarkNoShow,
  onCancelInterview,
  onCompleteReminder,
  isUpdating,
  isCancelling,
  isCompletingReminder,
}: ActivityRowProps) {
  const isInterview = activity.type === 'interview'
  const isReminder = activity.type === 'reminder'

  // Interview-specific data
  const booking = activity.interview
  const interviewerName = booking?.interviewer_profile
    ? `${booking.interviewer_profile.first_name} ${booking.interviewer_profile.last_name}`
    : null
  const isOwnInterview = booking?.interviewer_id === currentUserId

  // Reminder-specific data
  const reminder = activity.reminder
  const isPastDue = isReminder && reminder && !reminder.completed_at && isPast(parseISO(reminder.due_at))

  const handleRowClick = () => {
    if (isInterview && onNavigate && activity.jobId && activity.candidateId) {
      onNavigate(activity.jobId, activity.candidateId)
    } else if (isInterview && onViewDetails && booking) {
      onViewDetails(booking.id)
    } else if (isReminder && onNavigate && activity.jobId && activity.candidateId) {
      window.open(`/jobs/${activity.jobId}?candidate=${activity.candidateId}`, '_blank')
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
          {/* Line 1: Activity type icon + Candidate name + Status/Past Due badge */}
          <div className="flex items-center gap-2">
            {isInterview ? (
              <Calendar className="h-4 w-4 text-primary shrink-0" />
            ) : (
              <Bell className="h-4 w-4 text-amber-500 shrink-0" />
            )}
            <span className="text-sm font-medium truncate">
              {activity.candidateName}
            </span>
            
            {/* Status badges */}
            {isInterview && booking && (
              <Badge variant={getStatusBadgeVariant(booking.status)} className="text-xs shrink-0">
                {booking.status}
              </Badge>
            )}
            {isReminder && isPastDue && (
              <Badge variant="destructive" className="text-xs shrink-0">
                Past Due
              </Badge>
            )}
            
            {/* Sync icons for interviews */}
            {isInterview && booking?.sync_source === 'google_calendar' && (
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
            {isInterview && booking?.sync_errors && Array.isArray(booking.sync_errors) && booking.sync_errors.length > 0 && (
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

          {/* Line 2: Context info */}
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
            {isInterview && (
              <>
                {showInterviewer && interviewerName && (
                  <>
                    <span className="truncate">
                      {isOwnInterview ? 'You' : interviewerName}
                    </span>
                    <span>•</span>
                  </>
                )}
                <span className="truncate">{activity.jobTitle || 'Unknown Job'}</span>
              </>
            )}
            {isReminder && reminder && (
              <span className="truncate">{reminder.subject}</span>
            )}
          </div>

          {/* Line 3: Date/time + Duration/Visibility */}
          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span>{formatActivityDate(activity.dateTime)}</span>
            <span>•</span>
            {isInterview && booking && (
              <span>{booking.duration_minutes} min</span>
            )}
            {isReminder && reminder && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1">
                      {reminder.is_team_visible ? (
                        <Users className="h-3 w-3" />
                      ) : (
                        <Lock className="h-3 w-3" />
                      )}
                      <span>{reminder.is_team_visible ? 'Team' : 'Personal'}</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{reminder.is_team_visible ? 'Visible to your team' : 'Only visible to you'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
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
              {/* Interview actions */}
              {isInterview && booking && (
                <>
                  <DropdownMenuItem onClick={() => onViewDetails?.(booking.id)}>
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
                      {onMarkInterviewCompleted && (
                        <DropdownMenuItem
                          onClick={() => onMarkInterviewCompleted(booking.id)}
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
                      {onCancelInterview && (
                        <DropdownMenuItem
                          onClick={() => onCancelInterview(booking.id)}
                          disabled={isCancelling}
                          className="text-destructive"
                        >
                          Cancel Booking
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Reminder actions */}
              {isReminder && reminder && (
                <>
                  {activity.jobId && activity.candidateId && (
                    <DropdownMenuItem onClick={() => window.open(`/jobs/${activity.jobId}?candidate=${activity.candidateId}`, '_blank')}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Candidate
                    </DropdownMenuItem>
                  )}
                  {!isPastTab && onCompleteReminder && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onCompleteReminder(reminder.id)}
                        disabled={isCompletingReminder}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark Complete
                      </DropdownMenuItem>
                    </>
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
