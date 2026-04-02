import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useScheduledBookings, type ScheduledBooking } from '@/hooks/useScheduledBookings'
import { useDashboardReminders } from '@/hooks/useCandidateReminders'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/contexts/AuthContext'
import { BookingDetailsDialog } from '@/components/booking/BookingDetailsDialog'
import { ActivityRow } from './ActivityRow'
import { toast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import type { UnifiedActivity } from '@/types/activity'
import { format, parseISO, isToday, isTomorrow, startOfDay, isSameDay, startOfMonth, addMonths, subMonths } from 'date-fns'
import { cn } from '@/lib/utils'
import { AgendaCalendar } from './AgendaCalendar'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { PageTitle } from '@/components/ui/page-title'
import { useIsMobile } from '@/hooks/use-mobile'

// ── Day Group Header ────────────────────────────────────────────

function DayGroupHeader({ date }: { date: Date }) {
  const label = isToday(date)
    ? `Today, ${format(date, 'MMMM d, yyyy')}`
    : isTomorrow(date)
      ? `Tomorrow, ${format(date, 'MMMM d, yyyy')}`
      : format(date, 'EEE, MMMM d, yyyy')

  return (
    <div className={cn(
      "flex items-center gap-2 py-1.5 px-1",
      "border-l-2",
      isToday(date) ? "border-l-primary" : "border-l-muted-foreground/20"
    )}>
      <span className={cn(
        "text-xs font-semibold uppercase tracking-wide",
        isToday(date) ? "text-primary" : "text-muted-foreground"
      )}>
        {label}
      </span>
    </div>
  )
}

// ── Timeline Activity Row ──────────────────────────────────────

function TimelineActivityRow({
  activity,
  isLast,
  ...rowProps
}: {
  activity: UnifiedActivity
  isLast: boolean
} & Omit<React.ComponentProps<typeof ActivityRow>, 'activity'>) {
  const time = format(parseISO(activity.dateTime), 'h:mm a')

  return (
    <div className="flex gap-3">
      {/* Timeline column */}
      <div className="flex flex-col items-center w-[52px] shrink-0">
        <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
          {time}
        </span>
        {!isLast && (
          <div className="flex-1 w-px bg-border mt-1" />
        )}
      </div>
      {/* Activity content */}
      <div className="flex-1 min-w-0 pb-2">
        <ActivityRow activity={activity} {...rowProps} />
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────

export function UpcomingActivities() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null)
  const [statusUpdateBooking, setStatusUpdateBooking] = useState<{ id: string; status: string } | null>(null)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()))
  const [calendarOpen, setCalendarOpen] = useState(false)

  const isMobile = useIsMobile()
  const permissions = usePermissions()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { bookings, isLoading: isLoadingBookings, cancelBooking, updateStatus, isCancelling, isUpdating } =
    useScheduledBookings(activeTab, permissions)

  const { reminders, isLoading: isLoadingReminders, completeReminder, isCompleting } =
    useDashboardReminders(activeTab)

  const isLoading = isLoadingBookings || isLoadingReminders

  // Merge and sort activities
  const activities = useMemo<UnifiedActivity[]>(() => {
    const interviewActivities: UnifiedActivity[] = bookings.map(b => ({
      type: 'interview' as const,
      id: b.id,
      candidateId: b.candidate_id,
      candidateName: b.candidate?.candidate_name || b.candidate_name || 'Unknown',
      jobId: b.job?.id || null,
      jobTitle: b.job?.title || (b.job_id ? 'Unknown Job' : null),
      dateTime: b.scheduled_start,
      interview: b
    }))

    const reminderActivities: UnifiedActivity[] = reminders.map(r => ({
      type: 'reminder' as const,
      id: r.id,
      candidateId: r.candidate_id,
      candidateName: r.candidate?.candidate_name || 'Unknown',
      jobId: r.job?.id || null,
      jobTitle: r.job?.title || null,
      dateTime: r.due_at,
      reminder: r
    }))

    const merged = [...interviewActivities, ...reminderActivities]
    if (activeTab === 'past') {
      return merged.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())
    }
    return merged.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
  }, [bookings, reminders, activeTab])

  // Activity dates for week strip dots
  const activityDates = useMemo(() => {
    const set = new Set<string>()
    activities.forEach(a => set.add(format(parseISO(a.dateTime), 'yyyy-MM-dd')))
    return set
  }, [activities])

  // Filter activities by selected day (only in upcoming tab)
  const filteredActivities = useMemo(() => {
    if (!selectedDay || activeTab === 'past') return activities
    return activities.filter(a => isSameDay(parseISO(a.dateTime), selectedDay))
  }, [activities, selectedDay, activeTab])

  // Group activities by day
  const groupedActivities = useMemo(() => {
    const groups: { date: Date; items: UnifiedActivity[] }[] = []
    const source = filteredActivities

    for (const activity of source) {
      const actDate = startOfDay(parseISO(activity.dateTime))
      const lastGroup = groups[groups.length - 1]
      if (lastGroup && isSameDay(lastGroup.date, actDate)) {
        lastGroup.items.push(activity)
      } else {
        groups.push({ date: actDate, items: [activity] })
      }
    }
    return groups
  }, [filteredActivities])

  // Set up realtime listener for Google Calendar sync updates
  useEffect(() => {
    if (!user?.id) return;

    const channelName = `booking-sync-${crypto.randomUUID()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scheduled_bookings',
          filter: `interviewer_id=eq.${user.id}`
        },
        (payload) => {
          const newBooking = payload.new as ScheduledBooking;
          const oldBooking = payload.old as ScheduledBooking;

          if (newBooking.sync_source === 'google_calendar') {
            if (newBooking.status === 'cancelled' && oldBooking.status !== 'cancelled') {
              toast({
                title: "Interview Cancelled",
                description: `Your interview with ${newBooking.candidate_name} was cancelled in Google Calendar.`,
                variant: "destructive"
              });
            } else if (newBooking.scheduled_start !== oldBooking.scheduled_start) {
              toast({
                title: "Interview Rescheduled",
                description: `Your interview with ${newBooking.candidate_name} was rescheduled in Google Calendar.`,
              });
            }

            queryClient.invalidateQueries({ queryKey: ['scheduled-bookings'] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // For show more: limit to 5 groups worth of items when collapsed
  const displayedGroups = useMemo(() => {
    if (isExpanded) return groupedActivities
    let count = 0
    const result: typeof groupedActivities = []
    for (const group of groupedActivities) {
      if (count >= 5) break
      const remaining = 5 - count
      if (group.items.length <= remaining) {
        result.push(group)
        count += group.items.length
      } else {
        result.push({ ...group, items: group.items.slice(0, remaining) })
        count += remaining
      }
    }
    return result
  }, [groupedActivities, isExpanded])

  const totalActivities = filteredActivities.length
  const displayedCount = displayedGroups.reduce((sum, g) => sum + g.items.length, 0)

  const showInterviewer = permissions.isMember ||
    permissions.isAdmin || permissions.isWorkspaceOwner || permissions.isPlatformAdmin

  const handleViewDetails = (bookingId: string) => {
    setSelectedBookingId(bookingId)
    setDialogOpen(true)
  }

  const handleCancelBooking = (bookingId: string) => {
    setBookingToCancel(bookingId)
    setCancelDialogOpen(true)
  }

  const confirmCancel = () => {
    if (bookingToCancel) {
      cancelBooking(bookingToCancel)
      setCancelDialogOpen(false)
      setBookingToCancel(null)
    }
  }

  const handleStatusUpdate = (bookingId: string, status: string) => {
    setStatusUpdateBooking({ id: bookingId, status })
  }

  const confirmStatusUpdate = () => {
    if (statusUpdateBooking) {
      updateStatus({ bookingId: statusUpdateBooking.id, status: statusUpdateBooking.status })
      setStatusUpdateBooking(null)
    }
  }

  const handleCopyMeetingLink = (booking: ScheduledBooking) => {
    if (booking.meeting_location) {
      navigator.clipboard.writeText(booking.meeting_location)
      toast({
        title: 'Link copied',
        description: 'Meeting link copied to clipboard.',
      })
    } else {
      toast({
        title: 'No meeting link',
        description: 'This booking does not have a meeting link.',
        variant: 'destructive',
      })
    }
  }

  const handleNavigateToCandidate = (jobId: string, candidateId: string) => {
    window.open(`/jobs/${jobId}?candidate=${candidateId}`, '_blank')
  }

  const handleDaySelect = (date: Date) => {
    if (selectedDay && isSameDay(selectedDay, date)) {
      setSelectedDay(null) // deselect = show all
    } else {
      setSelectedDay(date)
    }
  }

  const isPastTab = activeTab === 'past'

  const sharedRowProps = isPastTab
    ? { currentUserId: user?.id, showInterviewer, isPastTab: true as const, onViewDetails: handleViewDetails, onNavigate: handleNavigateToCandidate }
    : {
        currentUserId: user?.id,
        showInterviewer,
        isPastTab: false as const,
        onViewDetails: handleViewDetails,
        onNavigate: handleNavigateToCandidate,
        onCopyMeetingLink: handleCopyMeetingLink,
        onMarkInterviewCompleted: (id: string) => handleStatusUpdate(id, 'completed'),
        onMarkNoShow: (id: string) => handleStatusUpdate(id, 'no_show'),
        onCancelInterview: handleCancelBooking,
        onCompleteReminder: completeReminder,
        isUpdating,
        isCancelling,
        isCompletingReminder: isCompleting,
      }

  const EmptyState = ({ type }: { type: 'upcoming' | 'past' }) => (
    <div className="text-center py-8 text-muted-foreground">
      <CalendarCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
      <p className="text-sm">
        {type === 'upcoming'
          ? selectedDay
            ? 'No activities on this day'
            : 'No upcoming activities'
          : 'No past activities yet'}
      </p>
      <p className="text-xs mt-1">
        {type === 'upcoming'
          ? selectedDay
            ? 'Try selecting a different day or view all'
            : 'Scheduled interviews and reminders will appear here'
          : 'Completed interviews and reminders will appear here'}
      </p>
      {selectedDay && type === 'upcoming' && (
        <Button variant="link" size="sm" className="mt-2 text-xs" onClick={() => setSelectedDay(null)}>
          View all upcoming
        </Button>
      )}
    </div>
  )

  const LoadingState = () => (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-[72px] w-full rounded-lg border bg-card" />
      ))}
    </div>
  )

  const ShowMoreButton = () => (
    totalActivities > 5 ? (
      <div className="mt-4 flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="gap-2"
        >
          {isExpanded ? (
            <>
              Show Less <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              Show More ({totalActivities - displayedCount} more) <ChevronDown className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    ) : null
  )

  const renderAgenda = (type: 'upcoming' | 'past') => {
    if (isLoading) return <LoadingState />
    if (displayedGroups.length === 0) return <EmptyState type={type} />

    return (
      <>
        <div className={isExpanded ? 'max-h-[400px] overflow-y-auto' : ''}>
          <div className="space-y-3">
            {displayedGroups.map((group) => (
              <div key={format(group.date, 'yyyy-MM-dd')}>
                <DayGroupHeader date={group.date} />
                <div className="mt-1 ml-1">
                  {group.items.map((activity, idx) => (
                    <TimelineActivityRow
                      key={`${activity.type}-${activity.id}`}
                      activity={activity}
                      isLast={idx === group.items.length - 1}
                      {...sharedRowProps}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <ShowMoreButton />
      </>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5" />
            Agenda
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isMobile && (
            <Collapsible open={calendarOpen} onOpenChange={setCalendarOpen}>
              <div className="flex items-center justify-between mb-3">
                <div className={cn(
                  "transition-transform duration-300 ease-out origin-left",
                  calendarOpen ? "scale-100" : "scale-[1.15]"
                )}>
                  <PageTitle as="h4">
                    {format(currentMonth, 'MMMM d, yyyy')}
                  </PageTitle>
                </div>
                <div className="flex items-center gap-1">
                  {calendarOpen && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setCurrentMonth(subMonths(currentMonth, 1)) }}
                        className="h-7 w-7 p-0"
                        aria-label="Previous month"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setCurrentMonth(addMonths(currentMonth, 1)) }}
                        className="h-7 w-7 p-0"
                        aria-label="Next month"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Toggle calendar">
                      <ChevronDown className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform duration-200",
                        calendarOpen && "rotate-180"
                      )} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>
              <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                <AgendaCalendar
                  selectedDate={selectedDay}
                  onDateSelect={handleDaySelect}
                  currentMonth={currentMonth}
                  onMonthChange={setCurrentMonth}
                  activityDates={activityDates}
                  hideHeader
                />
              </CollapsibleContent>
            </Collapsible>
          )}

          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'upcoming' | 'past'); setSelectedDay(null) }}>
            <TabsList className="grid w-full grid-cols-2 my-4">
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="mt-0">
              {renderAgenda('upcoming')}
            </TabsContent>

            <TabsContent value="past" className="mt-0">
              {renderAgenda('past')}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Booking Details Dialog */}
      <BookingDetailsDialog
        bookingId={selectedBookingId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onBookingUpdated={() => {}}
      />

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Interview?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this interview? Both you and the candidate will
              receive cancellation emails with updated calendar events.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, cancel interview
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Update Confirmation Dialog */}
      <AlertDialog open={!!statusUpdateBooking} onOpenChange={() => setStatusUpdateBooking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Booking Status?</AlertDialogTitle>
            <AlertDialogDescription>
              {statusUpdateBooking?.status === 'completed'
                ? 'Mark this interview as completed?'
                : 'Mark candidate as no-show for this interview?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusUpdate}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
