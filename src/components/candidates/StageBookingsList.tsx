import { format } from 'date-fns';
import { Calendar, CalendarIcon, Eye, MoreVertical, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useStageBookings } from '@/hooks/useStageBookings';
import { GoogleMeetLogo } from '@/components/icons/GoogleMeetLogo';

interface StageBookingsListProps {
  jhsId: string;
  candidateId: string;
}

export function StageBookingsList({ jhsId, candidateId }: StageBookingsListProps) {
  const { data: bookings, isLoading } = useStageBookings(jhsId, candidateId);
  
  if (isLoading) return <Skeleton className="h-20" />;
  if (!bookings || bookings.length === 0) return null;
  
  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs font-medium text-text-secondary">
        Scheduled Interviews ({bookings.length})
      </div>
      
      {bookings.map((booking) => {
        const interviewerInitials = `${booking.interviewer_profile?.first_name?.[0] || ''}${booking.interviewer_profile?.last_name?.[0] || ''}`;
        
        return (
          <Card key={booking.id} className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-3 flex-1">
                {/* Interviewer Info */}
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={booking.interviewer_profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">{interviewerInitials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium">
                      {booking.interviewer_profile?.first_name} {booking.interviewer_profile?.last_name}
                    </div>
                    <div className="text-xs text-text-tertiary">Interviewer</div>
                  </div>
                </div>
                
                {/* Date & Time */}
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <CalendarIcon className="h-4 w-4 text-text-tertiary" />
                  <span className="font-medium">
                    {format(new Date(booking.scheduled_start), 'MMM d, yyyy')}
                  </span>
                  <span>at</span>
                  <span className="font-medium">
                    {format(new Date(booking.scheduled_start), 'h:mm a')}
                  </span>
                </div>
                
                {/* Google Meet Button */}
                {booking.google_meet_link && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                    asChild
                  >
                    <a 
                      href={booking.google_meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <GoogleMeetLogo size={16} />
                      Join Google Meet
                    </a>
                  </Button>
                )}
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Calendar className="h-4 w-4 mr-2" />
                    Reschedule
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Interview
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {booking.notes && (
              <div className="mt-3 pt-3 border-t text-xs text-text-secondary">
                <span className="font-medium">Notes:</span> {booking.notes}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
