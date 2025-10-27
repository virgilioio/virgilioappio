import { format } from 'date-fns';
import { Calendar, CalendarIcon, Eye, MoreVertical, User, Video, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useStageBookings } from '@/hooks/useStageBookings';

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
      
      {bookings.map((booking) => (
        <Card key={booking.id} className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2 text-sm">
                <CalendarIcon className="h-4 w-4 text-text-tertiary" />
                <span className="font-medium">
                  {format(new Date(booking.scheduled_start), 'MMM d, yyyy')}
                </span>
                <span className="text-text-secondary">at</span>
                <span className="font-medium">
                  {format(new Date(booking.scheduled_start), 'h:mm a')}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <User className="h-4 w-4" />
                <span>
                  {booking.interviewer_profile?.first_name} {booking.interviewer_profile?.last_name}
                </span>
              </div>
              
              {booking.google_meet_link && (
                <div className="flex items-center gap-2 text-sm">
                  <Video className="h-4 w-4 text-text-tertiary" />
                  <a 
                    href={booking.google_meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Join Google Meet
                  </a>
                </div>
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
            <div className="mt-2 pt-2 border-t text-xs text-text-secondary">
              <span className="font-medium">Notes:</span> {booking.notes}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
