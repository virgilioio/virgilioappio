import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { format } from 'date-fns';
import { CheckCircle2, Calendar, Clock, MapPin, Download, ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function BookingConfirmed() {
  const { bookingId } = useParams<{ bookingId: string }>();

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking-confirmation', bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_bookings')
        .select(`
          *,
          booking_configurations (
            display_name,
            description,
            user_id
          )
        `)
        .eq('id', bookingId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!bookingId,
  });

  const { data: interviewerProfile } = useQuery({
    queryKey: ['interviewer-profile', booking?.booking_configurations?.user_id],
    queryFn: async () => {
      if (!booking?.booking_configurations?.user_id) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, avatar_url')
        .eq('user_id', booking.booking_configurations.user_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!booking?.booking_configurations?.user_id,
  });

  useEffect(() => {
    // Confetti effect on mount
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const colors = ['hsl(var(--primary))', 'hsl(var(--accent))', '#FFD700'];

    (function frame() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) return;

      const particleCount = 2;
      const angle = Math.random() * 360;
      const velocity = Math.random() * 5 + 5;

      // Create confetti particles
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'fixed';
        particle.style.width = '10px';
        particle.style.height = '10px';
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        particle.style.borderRadius = '50%';
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '9999';
        particle.style.left = '50%';
        particle.style.top = '30%';
        
        document.body.appendChild(particle);

        const radian = (angle + i * 30) * Math.PI / 180;
        const vx = Math.cos(radian) * velocity;
        const vy = Math.sin(radian) * velocity;

        let x = 0, y = 0;
        const animation = () => {
          x += vx;
          y += vy + 0.5; // gravity
          particle.style.transform = `translate(${x}px, ${y}px)`;
          particle.style.opacity = String(Math.max(0, 1 - y / 200));

          if (y < 200) {
            requestAnimationFrame(animation);
          } else {
            particle.remove();
          }
        };
        animation();
      }

      requestAnimationFrame(frame);
    })();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-8 space-y-6">
          <Skeleton className="h-16 w-16 rounded-full mx-auto" />
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-24 w-full" />
        </Card>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <p className="text-muted-foreground">Booking not found</p>
        </Card>
      </div>
    );
  }

  const startTime = new Date(booking.scheduled_start);
  const endTime = new Date(booking.scheduled_end);
  const interviewerName = interviewerProfile
    ? `${interviewerProfile.first_name} ${interviewerProfile.last_name}`
    : booking.booking_configurations?.display_name || 'Your interviewer';

  const downloadICS = () => {
    // Generate ICS file and trigger download
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Virgilio//Interview Scheduler//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${booking.ics_uid}
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${startTime.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTEND:${endTime.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
SUMMARY:Interview with ${interviewerName}
DESCRIPTION:Scheduled via Virgilio
LOCATION:${booking.meeting_location || ''}
ORGANIZER;CN=${interviewerName}:mailto:${interviewerProfile?.email || ''}
ATTENDEE;CN=${booking.candidate_name};RSVP=TRUE:mailto:${booking.candidate_email}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'interview.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8 space-y-6">
        {/* Success Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <CheckCircle2 className="w-16 h-16 text-primary animate-in zoom-in duration-500" />
          </div>
        </div>

        {/* Success Message */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Booking Confirmed!</h1>
          <p className="text-muted-foreground">
            Your interview has been successfully scheduled. A confirmation email has been sent to {booking.candidate_email}.
          </p>
        </div>

        {/* Interviewer Info */}
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <Avatar className="w-12 h-12">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {interviewerName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-foreground">{interviewerName}</p>
            {booking.booking_configurations?.description && (
              <p className="text-sm text-muted-foreground">{booking.booking_configurations.description}</p>
            )}
          </div>
        </div>

        {/* Meeting Details */}
        <div className="space-y-3 border-t pt-6">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium text-foreground">
                {format(startTime, 'EEEE, MMMM d, yyyy')}
              </p>
              <p className="text-sm text-muted-foreground">
                {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')} ({booking.candidate_timezone})
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium text-foreground">{booking.duration_minutes} minutes</p>
            </div>
          </div>

          {booking.meeting_location && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground break-all">
                  {booking.meeting_location.startsWith('http') ? (
                    <a 
                      href={booking.meeting_location} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {booking.meeting_location}
                    </a>
                  ) : (
                    booking.meeting_location
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button onClick={downloadICS} className="flex-1" variant="default">
            <Download className="w-4 h-4 mr-2" />
            Download Calendar Invite
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link to={`/schedule/${booking.booking_configurations?.user_id}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Booking Page
            </Link>
          </Button>
        </div>

        {/* Email Reminder */}
        <div className="text-center text-sm text-muted-foreground border-t pt-4">
          <p>📧 A calendar invitation has been sent to your email</p>
          <p className="mt-1">You can also add it to your calendar using the button above</p>
        </div>
      </Card>
    </div>
  );
}
