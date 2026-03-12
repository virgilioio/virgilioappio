import { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { CheckCircle2, Calendar, Clock, MapPin, Download, ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface BookingState {
  booking: {
    id: string;
    scheduled_start: string;
    scheduled_end: string;
    duration_minutes: number;
    candidate_email: string;
    candidate_name: string;
    candidate_timezone: string;
    meeting_location?: string;
    ics_uid?: string;
  };
  config: {
    display_name: string;
    description?: string;
  };
  interviewerName: string;
}

export default function BookingConfirmed() {
  const location = useLocation();
  const state = location.state as BookingState | null;

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
          y += vy + 0.5;
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

  // Generic fallback for direct URL visits (no state)
  if (!state) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-8 space-y-6">
          <div className="flex justify-center">
            <CheckCircle2 className="w-16 h-16 text-primary animate-in zoom-in duration-500" />
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Booking Confirmed!</h1>
            <p className="text-muted-foreground">
              Your interview has been successfully scheduled. A confirmation email has been sent to your inbox.
            </p>
          </div>
          <div className="text-center text-sm text-muted-foreground border-t pt-4">
            <p>📧 A calendar invitation has been sent to your email</p>
          </div>
        </Card>
      </div>
    );
  }

  const { booking, config, interviewerName } = state;
  const startTime = new Date(booking.scheduled_start);
  const endTime = new Date(booking.scheduled_end);

  const downloadICS = () => {
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//GoGio//Interview Scheduler//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${booking.ics_uid || booking.id}
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${startTime.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTEND:${endTime.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
SUMMARY:Interview with ${interviewerName}
DESCRIPTION:Scheduled via GoGio
LOCATION:${booking.meeting_location || ''}
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
        <div className="flex justify-center">
          <CheckCircle2 className="w-16 h-16 text-primary animate-in zoom-in duration-500" />
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Booking Confirmed!</h1>
          <p className="text-muted-foreground">
            Your interview has been successfully scheduled. A confirmation email has been sent to {booking.candidate_email}.
          </p>
        </div>

        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <Avatar className="w-12 h-12">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {interviewerName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-foreground">{interviewerName}</p>
            {config.description && (
              <p className="text-sm text-muted-foreground">{config.description}</p>
            )}
          </div>
        </div>

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

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button onClick={downloadICS} className="flex-1" variant="default">
            <Download className="w-4 h-4 mr-2" />
            Download Calendar Invite
          </Button>
        </div>

        <div className="text-center text-sm text-muted-foreground border-t pt-4">
          <p>📧 A calendar invitation has been sent to your email</p>
          <p className="mt-1">You can also add it to your calendar using the button above</p>
        </div>
      </Card>
    </div>
  );
}
