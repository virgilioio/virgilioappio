import { useState } from 'react'
import { format, parseISO, isToday, isTomorrow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  Calendar,
  Clock,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react'
import { useScheduledBookings, type ScheduledBooking } from '@/hooks/useScheduledBookings'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/contexts/AuthContext'
import { BookingDetailsDialog } from '@/components/booking/BookingDetailsDialog'
import { toast } from '@/hooks/use-toast'

export function MyInterviews() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null)
  const [statusUpdateBooking, setStatusUpdateBooking] = useState<{ id: string; status: string } | null>(null)

  const permissions = usePermissions()
  const { user } = useAuth()
  
  const { bookings, isLoading, cancelBooking, updateStatus, isCancelling, isUpdating } =
    useScheduledBookings(activeTab, permissions)

  const displayedBookings = isExpanded ? bookings : bookings.slice(0, 5)

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

  const EmptyState = ({ type }: { type: 'upcoming' | 'past' }) => (
    <div className="text-center py-8 text-muted-foreground">
      <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
      <p className="text-sm">
        {type === 'upcoming' ? 'No upcoming interviews scheduled' : 'No past interviews yet'}
      </p>
      <p className="text-xs mt-1">
        {type === 'upcoming'
          ? 'Interviews will appear here once candidates book time with you'
          : 'Completed and cancelled interviews will appear here'}
      </p>
    </div>
  )

  const LoadingState = () => (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            My Interviews
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
              ) : bookings.length === 0 ? (
                <EmptyState type="upcoming" />
              ) : (
                <div className={isExpanded ? 'max-h-[400px] overflow-y-auto' : ''}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Candidate</TableHead>
                        {(permissions.isRecruiter || permissions.isHiringManager || permissions.isAdmin || permissions.isWorkspaceOwner || permissions.isPlatformAdmin) && (
                          <TableHead>Interviewer</TableHead>
                        )}
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedBookings.map((booking) => (
                        <TableRow
                          key={booking.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleViewDetails(booking.id)}
                        >
                          <TableCell className="font-medium">
                            {booking.candidate?.candidate_name || booking.candidate_name}
                          </TableCell>
                          {(permissions.isRecruiter || permissions.isHiringManager || permissions.isAdmin || permissions.isWorkspaceOwner || permissions.isPlatformAdmin) && (
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {booking.interviewer_profile ? (
                                  <>
                                    <span className="text-sm">
                                      {booking.interviewer_profile.first_name} {booking.interviewer_profile.last_name}
                                    </span>
                                    {booking.interviewer_id !== user?.id && (
                                      <Badge variant="outline" className="text-xs">Team</Badge>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-sm text-muted-foreground">Unknown</span>
                                )}
                              </div>
                            </TableCell>
                          )}
                          <TableCell>{formatInterviewDate(booking.scheduled_start)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              <Clock className="h-3 w-3" />
                              {booking.duration_minutes} min
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(booking.status)}>
                              {booking.status}
                            </Badge>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewDetails(booking.id)}>
                                  View Details
                                </DropdownMenuItem>
                                {booking.meeting_location && (
                                  <DropdownMenuItem onClick={() => handleCopyMeetingLink(booking)}>
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Copy Meeting Link
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleStatusUpdate(booking.id, 'completed')}
                                  disabled={isUpdating}
                                >
                                  Mark as Completed
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleStatusUpdate(booking.id, 'no_show')}
                                  disabled={isUpdating}
                                >
                                  Mark as No-Show
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleCancelBooking(booking.id)}
                                  disabled={isCancelling}
                                  className="text-destructive"
                                >
                                  Cancel Booking
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {!isLoading && bookings.length > 5 && (
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
                        Show More ({bookings.length - 5} more) <ChevronDown className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="past" className="mt-0">
              {isLoading ? (
                <LoadingState />
              ) : bookings.length === 0 ? (
                <EmptyState type="past" />
              ) : (
                <div className={isExpanded ? 'max-h-[400px] overflow-y-auto' : ''}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Candidate</TableHead>
                        {(permissions.isRecruiter || permissions.isHiringManager || permissions.isAdmin || permissions.isWorkspaceOwner || permissions.isPlatformAdmin) && (
                          <TableHead>Interviewer</TableHead>
                        )}
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedBookings.map((booking) => (
                        <TableRow
                          key={booking.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleViewDetails(booking.id)}
                        >
                          <TableCell className="font-medium">
                            {booking.candidate?.candidate_name || booking.candidate_name}
                          </TableCell>
                          {(permissions.isRecruiter || permissions.isHiringManager || permissions.isAdmin || permissions.isWorkspaceOwner || permissions.isPlatformAdmin) && (
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {booking.interviewer_profile ? (
                                  <>
                                    <span className="text-sm">
                                      {booking.interviewer_profile.first_name} {booking.interviewer_profile.last_name}
                                    </span>
                                    {booking.interviewer_id !== user?.id && (
                                      <Badge variant="outline" className="text-xs">Team</Badge>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-sm text-muted-foreground">Unknown</span>
                                )}
                              </div>
                            </TableCell>
                          )}
                          <TableCell>{format(parseISO(booking.scheduled_start), 'MMM d, h:mm a')}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              <Clock className="h-3 w-3" />
                              {booking.duration_minutes} min
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(booking.status)}>
                              {booking.status}
                            </Badge>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewDetails(booking.id)}>
                                  View Details
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {!isLoading && bookings.length > 5 && (
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
                        Show More ({bookings.length - 5} more) <ChevronDown className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              )}
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
