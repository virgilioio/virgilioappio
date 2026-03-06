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

export function UpcomingActivities() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null)
  const [statusUpdateBooking, setStatusUpdateBooking] = useState<{ id: string; status: string } | null>(null)

  const permissions = usePermissions()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  
  // Fetch bookings
  const { bookings, isLoading: isLoadingBookings, cancelBooking, updateStatus, isCancelling, isUpdating } =
    useScheduledBookings(activeTab, permissions)

  // Fetch reminders
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

  // Set up realtime listener for Google Calendar sync updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('booking-sync-notifications')
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

  const displayedActivities = isExpanded ? activities : activities.slice(0, 5)

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

  const EmptyState = ({ type }: { type: 'upcoming' | 'past' }) => (
    <div className="text-center py-8 text-muted-foreground">
      <CalendarCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
      <p className="text-sm">
        {type === 'upcoming' ? 'No upcoming activities' : 'No past activities yet'}
      </p>
      <p className="text-xs mt-1">
        {type === 'upcoming'
          ? 'Scheduled interviews and reminders will appear here'
          : 'Completed interviews and reminders will appear here'}
      </p>
    </div>
  )

  const LoadingState = () => (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
      ))}
    </div>
  )

  const ShowMoreButton = () => (
    activities.length > 5 && (
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
              Show More ({activities.length - 5} more) <ChevronDown className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    )
  )

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5" />
            Upcoming Activities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upcoming' | 'past')}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="mt-0">
              {isLoading ? (
                <LoadingState />
              ) : activities.length === 0 ? (
                <EmptyState type="upcoming" />
              ) : (
                <div className={isExpanded ? 'max-h-[400px] overflow-y-auto' : ''}>
                  <div className="space-y-2">
                    {displayedActivities.map((activity) => (
                      <ActivityRow
                        key={`${activity.type}-${activity.id}`}
                        activity={activity}
                        currentUserId={user?.id}
                        showInterviewer={showInterviewer}
                        isPastTab={false}
                        onViewDetails={handleViewDetails}
                        onNavigate={handleNavigateToCandidate}
                        onCopyMeetingLink={handleCopyMeetingLink}
                        onMarkInterviewCompleted={(id) => handleStatusUpdate(id, 'completed')}
                        onMarkNoShow={(id) => handleStatusUpdate(id, 'no_show')}
                        onCancelInterview={handleCancelBooking}
                        onCompleteReminder={completeReminder}
                        isUpdating={isUpdating}
                        isCancelling={isCancelling}
                        isCompletingReminder={isCompleting}
                      />
                    ))}
                  </div>
                </div>
              )}
              {!isLoading && <ShowMoreButton />}
            </TabsContent>

            <TabsContent value="past" className="mt-0">
              {isLoading ? (
                <LoadingState />
              ) : activities.length === 0 ? (
                <EmptyState type="past" />
              ) : (
                <div className={isExpanded ? 'max-h-[400px] overflow-y-auto' : ''}>
                  <div className="space-y-2">
                    {displayedActivities.map((activity) => (
                      <ActivityRow
                        key={`${activity.type}-${activity.id}`}
                        activity={activity}
                        currentUserId={user?.id}
                        showInterviewer={showInterviewer}
                        isPastTab={true}
                        onViewDetails={handleViewDetails}
                        onNavigate={handleNavigateToCandidate}
                      />
                    ))}
                  </div>
                </div>
              )}
              {!isLoading && <ShowMoreButton />}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Booking Details Dialog */}
      <BookingDetailsDialog
        bookingId={selectedBookingId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onBookingUpdated={() => {
          // Refresh handled by query invalidation
        }}
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
