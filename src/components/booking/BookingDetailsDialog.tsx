import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Calendar,
  Clock,
  MapPin,
  Mail,
  Phone,
  ExternalLink,
  Download,
  Send,
  AlertTriangle,
  User,
  Briefcase,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { MinimizableEmailComposer } from '@/components/candidates/MinimizableEmailComposer'
import { generateICS } from '@/utils/icsGenerator'

interface BookingDetailsDialogProps {
  bookingId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onBookingUpdated?: () => void
}

export function BookingDetailsDialog({
  bookingId,
  open,
  onOpenChange,
  onBookingUpdated,
}: BookingDetailsDialogProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showEmailComposer, setShowEmailComposer] = useState(false)

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking-details', bookingId],
    queryFn: async () => {
      if (!bookingId) return null
      
      const { data, error } = await supabase
        .from('scheduled_bookings')
        .select(`
          *,
          candidates(id, candidate_name, linkedin_url, email, phone),
          jobs(id, title),
          job_hiring_stages(id, job_stages(stage_name))
        `)
        .eq('id', bookingId)
        .single()

      if (error) throw error
      if (!data) return null

      // Fetch interviewer profile separately
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, avatar_url')
        .eq('user_id', data.interviewer_id)
        .single()

      return {
        ...data,
        interviewer_profile: profile || undefined,
        candidate: data.candidates || undefined,
        job: data.jobs || undefined,
        stage: data.job_hiring_stages?.job_stages ? {
          id: data.job_hiring_stages.id,
          stage_name: data.job_hiring_stages.job_stages.stage_name,
        } : undefined,
      }
    },
    enabled: !!bookingId && open,
  })

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!bookingId) return
      const { error } = await supabase.functions.invoke('cancel-booking', {
        body: { booking_id: bookingId },
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['booking-details'] })
      queryClient.invalidateQueries({ queryKey: ['next-interview'] })
      queryClient.invalidateQueries({ queryKey: ['candidate-all-bookings'] })
      toast({
        title: 'Booking cancelled',
        description: 'The booking has been cancelled and notifications sent.',
      })
      onOpenChange(false)
      onBookingUpdated?.()
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to cancel booking'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    },
  })

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

  const handleDownloadICS = () => {
    if (!booking) return

    const interviewerName = booking.interviewer_profile?.first_name && booking.interviewer_profile?.last_name
      ? `${booking.interviewer_profile.first_name} ${booking.interviewer_profile.last_name}`
      : booking.interviewer_profile?.email || 'Interviewer'

    const icsContent = generateICS({
      uid: booking.id,
      summary: `Interview with ${booking.candidate_name}`,
      description: booking.notes || 'Scheduled interview',
      location: booking.meeting_location || '',
      startTime: new Date(booking.scheduled_start),
      endTime: new Date(booking.scheduled_end),
      organizerEmail: booking.interviewer_profile?.email || '',
      organizerName: interviewerName,
      attendeeEmail: booking.candidate_email,
      attendeeName: booking.candidate_name,
      status: 'CONFIRMED',
      method: 'REQUEST',
    })

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `interview-${booking.candidate_name.replace(/\s+/g, '-')}.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Calendar invite downloaded',
      description: 'The .ics file has been downloaded to your device.',
    })
  }

  const handleCopyMeetingLink = () => {
    if (!booking?.meeting_location) return
    navigator.clipboard.writeText(booking.meeting_location)
    toast({
      title: 'Link copied',
      description: 'Meeting link copied to clipboard.',
    })
  }

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!booking) return null

  const interviewerName = booking.interviewer_profile?.first_name && booking.interviewer_profile?.last_name
    ? `${booking.interviewer_profile.first_name} ${booking.interviewer_profile.last_name}`
    : booking.interviewer_profile?.email

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {/* Simple booking = Meeting, Pipeline booking = Interview */}
              {!booking.job && !booking.candidate ? 'Meeting' : 'Interview'} with {booking.candidate_name}
              <Badge variant={getStatusBadgeVariant(booking.status)}>
                {booking.status}
              </Badge>
              {/* Show "Meeting" badge for simple bookings */}
              {!booking.job && !booking.candidate && (
                <Badge variant="secondary">Meeting</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Scheduled for {format(parseISO(booking.scheduled_start), 'PPpp')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Meeting Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Meeting Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Date & Time</p>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(booking.scheduled_start), 'PPPP')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(booking.scheduled_start), 'p')} - {format(parseISO(booking.scheduled_end), 'p')}
                      {booking.candidate_timezone && ` (${booking.candidate_timezone})`}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Duration</p>
                    <p className="text-sm text-muted-foreground">{booking.duration_minutes} minutes</p>
                  </div>
                </div>

                {booking.meeting_location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Meeting Location</p>
                      <a
                        href={booking.meeting_location}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        {booking.meeting_location}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}

                {booking.notes && (
                  <div className="flex items-start gap-3">
                    <User className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Notes</p>
                      <p className="text-sm text-muted-foreground">{booking.notes}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Candidate Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Candidate Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Name</p>
                    <p className="text-sm text-muted-foreground">{booking.candidate_name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <a
                      href={`mailto:${booking.candidate_email}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {booking.candidate_email}
                    </a>
                  </div>
                </div>

                {booking.candidate?.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Phone</p>
                      <a
                        href={`tel:${booking.candidate.phone}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {booking.candidate.phone}
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* System Integration */}
            {(booking.candidate_id || booking.job_id) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">System Integration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {booking.candidate_id && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Linked to candidate profile</span>
                      </div>
                      <Link to={booking.job?.id 
                        ? `/jobs/${booking.job.id}?candidate=${booking.candidate_id}`
                        : `/candidates?openCandidate=${booking.candidate_id}`
                      }>
                        <Button variant="outline" size="sm">
                          Open Profile
                        </Button>
                      </Link>
                    </div>
                  )}

                  {booking.job && (
                    <div className="flex items-start gap-3">
                      <Briefcase className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Job</p>
                        <p className="text-sm text-muted-foreground">{booking.job.title}</p>
                        {booking.stage && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Stage: {booking.stage.stage_name}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {!booking.candidate_id && (
                <Button
                  variant="outline"
                  onClick={() => {
                    navigate(`/candidates?create=true&email=${booking.candidate_email}&name=${booking.candidate_name}`)
                    onOpenChange(false)
                  }}
                >
                  <User className="h-4 w-4 mr-2" />
                  Create Candidate Profile
                </Button>
              )}

              <Button variant="outline" onClick={handleDownloadICS}>
                <Download className="h-4 w-4 mr-2" />
                Download .ics
              </Button>

              <Button
                variant="outline"
                onClick={() => setShowEmailComposer(true)}
              >
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </Button>

              {booking.meeting_location && (
                <Button variant="outline" onClick={handleCopyMeetingLink}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Copy Meeting Link
                </Button>
              )}

              {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                <Button
                  variant="destructive"
                  onClick={() => setShowCancelDialog(true)}
                  disabled={cancelMutation.isPending}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Cancel Booking
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
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
              onClick={() => {
                cancelMutation.mutate()
                setShowCancelDialog(false)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, cancel interview
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email Composer */}
      {showEmailComposer && (
        <MinimizableEmailComposer
          isOpen={showEmailComposer}
          onOpenChange={setShowEmailComposer}
          candidateId={booking.candidate_id || undefined}
          defaultTo={booking.candidate_email}
          candidateName={booking.candidate_name}
        />
      )}
    </>
  )
}
