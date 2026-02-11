import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar, Clock, MapPin, Download, RefreshCw, X, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';

export interface ExistingBookingData {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  duration_minutes: number;
  candidate_name: string;
  candidate_email: string;
  candidate_phone?: string;
  candidate_timezone: string;
  meeting_location?: string;
  meeting_type?: string;
  google_meet_link?: string;
  notes?: string;
  ics_uid?: string;
  interviewer_profile?: {
    first_name: string;
    last_name: string;
    avatar_url?: string;
    email?: string;
  };
  booking_config?: {
    display_name: string;
    description?: string;
  };
}

interface ExistingBookingViewProps {
  booking: ExistingBookingData;
  token: string;
  onReschedule: () => void;
  onCancelled: () => void;
  jobTitle?: string;
  stageName?: string;
}

export function ExistingBookingView({
  booking,
  token,
  onReschedule,
  onCancelled,
  jobTitle,
  stageName,
}: ExistingBookingViewProps) {
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  const startTime = new Date(booking.scheduled_start);
  const endTime = new Date(booking.scheduled_end);
  const interviewerName = booking.interviewer_profile
    ? `${booking.interviewer_profile.first_name} ${booking.interviewer_profile.last_name}`
    : booking.booking_config?.display_name || 'Your interviewer';

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const response = await fetch(
        `https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/cancel-booking-public`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cnhqeHN0amZjb3pkanVtZnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MzM3MjMsImV4cCI6MjA2NTEwOTcyM30.xhhEmT2ikIqFO9IiZZC22zhWlSTC-ytBxP6EGGXtC44',
          },
          body: JSON.stringify({
            token,
            booking_id: booking.id,
            reason: cancellationReason || undefined,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel');
      }

      toast({ title: 'Interview Cancelled', description: 'Your interview has been cancelled successfully.' });
      onCancelled();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message || 'Failed to cancel interview.' });
    } finally {
      setIsCancelling(false);
    }
  };

  const downloadICS = () => {
    const formatDateForICS = (date: Date) =>
      date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//GoGio//Interview Scheduler//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${booking.ics_uid || `booking-${booking.id}@gogio.io`}
DTSTAMP:${formatDateForICS(new Date())}
DTSTART:${formatDateForICS(startTime)}
DTEND:${formatDateForICS(endTime)}
SUMMARY:Interview with ${interviewerName}
DESCRIPTION:Scheduled via GoGio
LOCATION:${booking.meeting_location || ''}
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
    <div className="max-w-2xl mx-auto">
      {/* Context header */}
      {(jobTitle || stageName) && (
        <div className="mb-6 p-4 bg-virgilio-purple/10 border border-virgilio-purple/25 rounded-lg">
          <p className="text-sm text-virgilio-purple">Your upcoming interview</p>
          <p className="font-medium text-virgilio-text">
            {jobTitle}
            {stageName && <span className="text-virgilio-purple"> · {stageName}</span>}
          </p>
        </div>
      )}

      <Card className="shadow-calendly border-virgilio-border">
        <CardContent className="p-6 md:p-8 space-y-6">
          {/* Status badge */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              ✓ Confirmed
            </span>
          </div>

          {/* Interviewer info */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <Avatar className="w-12 h-12">
              {booking.interviewer_profile?.avatar_url && (
                <AvatarImage src={booking.interviewer_profile.avatar_url} alt={interviewerName} />
              )}
              <AvatarFallback className="bg-virgilio-purple text-white">
                {interviewerName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-virgilio-text">{interviewerName}</p>
              {booking.booking_config?.description && (
                <p className="text-sm text-virgilio-muted">{booking.booking_config.description}</p>
              )}
            </div>
          </div>

          {/* Meeting details */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-virgilio-muted mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-virgilio-text">
                  {format(startTime, 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="text-sm text-virgilio-muted">
                  {format(startTime, 'h:mm a')} – {format(endTime, 'h:mm a')}{' '}
                  ({booking.candidate_timezone?.replace(/_/g, ' ')})
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-virgilio-muted mt-0.5 shrink-0" />
              <p className="font-medium text-virgilio-text">{booking.duration_minutes} minutes</p>
            </div>

            {(booking.google_meet_link || booking.meeting_location) && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-virgilio-muted mt-0.5 shrink-0" />
                <div>
                  {booking.google_meet_link ? (
                    <a
                      href={booking.google_meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-virgilio-purple hover:underline"
                    >
                      Join via Google Meet
                    </a>
                  ) : booking.meeting_location?.startsWith('http') ? (
                    <a
                      href={booking.meeting_location}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-virgilio-purple hover:underline break-all"
                    >
                      {booking.meeting_location}
                    </a>
                  ) : (
                    <p className="font-medium text-virgilio-text">{booking.meeting_location}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-virgilio-border">
            <Button onClick={downloadICS} variant="outline" className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Download Calendar Invite
            </Button>
            <Button onClick={onReschedule} variant="default" className="flex-1">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reschedule
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10">
                  <X className="w-4 h-4 mr-2" />
                  Cancel Interview
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-destructive" />
                    Cancel Interview?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will cancel your interview on{' '}
                    <strong>{format(startTime, 'MMMM d')} at {format(startTime, 'h:mm a')}</strong>.
                    The interviewer will be notified. You can rebook using the same link afterwards.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea
                  placeholder="Reason for cancellation (optional)"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="mt-2"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Interview</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    disabled={isCancelling}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isCancelling ? 'Cancelling...' : 'Yes, Cancel'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
