import { useLocation } from 'react-router-dom';
import {
  detectTimeZone,
  formatInTimeZone,
  formatZoneTime,
  formatZoneTimeShort,
  isValidTimeZone,
  zoneAbbr,
} from '@/lib/timezoneFormat';
import { Check, Clock, Video, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicBookingHeader } from '@/components/booking/PublicBookingHeader';
import { PublicBookingFooter } from '@/components/booking/PublicBookingFooter';

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
    guest_emails?: string[];
    event_title?: string;
  };
  config: {
    display_name: string;
    description?: string;
  };
  interviewerName: string;
}

const AVATAR_COLORS = ['#6F3FF5', '#06B6D4', '#F59E0B', '#10B981', '#EC4899'];

function initials(name: string) {
  return name.split(/\s+/).map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

export default function BookingConfirmed() {
  const location = useLocation();
  const state = location.state as BookingState | null;

  const firstName = state?.booking.candidate_name?.split(' ')[0] || 'there';
  const startTime = state ? new Date(state.booking.scheduled_start) : null;
  const endTime = state ? new Date(state.booking.scheduled_end) : null;
  const displayTz = isValidTimeZone(state?.booking.candidate_timezone)
    ? (state!.booking.candidate_timezone as string)
    : detectTimeZone();
  const tzAbbr = startTime ? zoneAbbr(displayTz, startTime) : '';

  const downloadICS = () => {
    if (!state || !startTime || !endTime) return;
    const { booking, interviewerName } = state;
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//GoGio//Interview Scheduler//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${booking.ics_uid || booking.id}
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${startTime.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTEND:${endTime.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
SUMMARY:${booking.event_title || `Meeting with ${interviewerName}`}
LOCATION:${booking.meeting_location || ''}
END:VEVENT
END:VCALENDAR`;
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'invite.ics';
    document.body.appendChild(a); a.click(); a.remove();
    window.URL.revokeObjectURL(url);
  };

  if (!state || !startTime || !endTime) {
    return (
      <div className="min-h-screen bg-virgilio-cream flex flex-col">
        <PublicBookingHeader workspaceName="Scheduling" />
        <main className="flex-1 container mx-auto px-4 py-16 max-w-xl text-center space-y-4">
          <div className="h-20 w-20 rounded-full bg-emerald-100 mx-auto flex items-center justify-center">
            <Check className="h-9 w-9 text-emerald-700" strokeWidth={2.5} />
          </div>
          <h1 className="font-poppins font-bold text-virgilio-text text-3xl tracking-[-0.02em]">
            Booking Confirmed<span className="text-virgilio-purple">.</span>
          </h1>
          <p className="text-virgilio-muted">
            You’re booked. A calendar invitation is on its way to your inbox.
          </p>
        </main>
        <PublicBookingFooter />
      </div>
    );
  }

  const panelists = [{ name: state.interviewerName }];

  return (
    <div className="min-h-screen bg-virgilio-cream flex flex-col">
      <PublicBookingHeader workspaceName={state.config.display_name} />

      <main className="flex-1 container mx-auto px-4 md:px-6 lg:px-8 py-10 md:py-16 max-w-2xl">
        {/* Check circle */}
        <div className="flex justify-center mb-6">
          <div className="h-24 w-24 rounded-full bg-emerald-100 flex items-center justify-center">
            <Check className="h-12 w-12 text-emerald-700" strokeWidth={2.5} />
          </div>
        </div>

        <h1 className="font-poppins font-bold text-virgilio-text text-3xl md:text-[40px] leading-[1.1] tracking-[-0.03em] text-center">
          You're booked, {firstName}<span className="text-virgilio-purple">.</span>
        </h1>
        <p className="text-virgilio-muted text-center mt-3 mb-10 max-w-md mx-auto">
          A calendar invite with the video link is on its way to{' '}
          <span className="font-poppins font-semibold text-virgilio-text">{state.booking.candidate_email}</span>.
        </p>
        {!!state.booking.guest_emails?.length && (
          <div className="-mt-6 mb-10 flex flex-wrap items-center justify-center gap-1.5 text-sm text-virgilio-muted">
            <span>Also invited:</span>
            {state.booking.guest_emails.map((g) => (
              <span key={g} className="rounded-md bg-muted px-2 py-0.5 text-xs text-virgilio-text">{g}</span>
            ))}
          </div>
        )}

        {/* Stacked card: dark top + white bottom */}
        <div className="rounded-2xl overflow-hidden border border-virgilio-border shadow-[0_24px_60px_-30px_rgba(13,13,9,0.18)]">
          {/* Dark detail */}
          <div className="bg-[#0d0d09] text-white p-5 md:p-6 flex items-start gap-5">
            <div className="leading-tight text-center flex-shrink-0">
              <div className="text-[10.5px] font-poppins font-semibold tracking-[0.08em] text-white/60 uppercase">
                {formatInTimeZone(startTime, displayTz, { weekday: 'short' })}
              </div>
              <div className="font-poppins font-bold text-[34px] leading-none mt-1">
                {formatInTimeZone(startTime, displayTz, { day: 'numeric' })}
              </div>
              <div className="text-[11.5px] text-white/60 mt-1">
                {formatInTimeZone(startTime, displayTz, { month: 'short' })}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-poppins font-bold text-[17px] tracking-[-0.01em]">
                {state.config.display_name}
              </div>
              <div className="flex items-center gap-3 mt-2 text-[12.5px] text-white/70 flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {formatZoneTimeShort(startTime, displayTz)} – {formatZoneTime(endTime, displayTz)} {tzAbbr}
                </span>
                <span className="opacity-50">•</span>
                <span className="inline-flex items-center gap-1.5">
                  <Video className="h-3.5 w-3.5" />
                  Google Meet
                </span>
              </div>
            </div>
          </div>

          {/* White panel */}
          <div className="bg-white p-5 md:p-6 space-y-5">
            <div>
              <div className="text-[10.5px] font-poppins font-semibold tracking-[0.08em] text-virgilio-muted uppercase mb-3">
                Your panel
              </div>
              <div className="flex flex-wrap gap-3">
                {panelists.map((p, i) => (
                  <div key={i} className="inline-flex items-center gap-2">
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[11px] font-poppins font-semibold"
                      style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                    >
                      {initials(p.name)}
                    </div>
                    <span className="text-[13px] font-poppins font-semibold text-virgilio-text">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button variant="primary" size="lg" icon={Download} onClick={downloadICS} className="font-semibold text-[13px]">
                Add to calendar
              </Button>
            </div>
          </div>
        </div>

        <p className="text-center text-[12.5px] text-virgilio-muted mt-8">
          Need to bring something up beforehand?{' '}
          <a href={`mailto:${state.booking.candidate_email}`} className="font-poppins font-semibold text-virgilio-text underline underline-offset-2">
            Reply to your confirmation email
          </a>
          .
        </p>
      </main>

      <PublicBookingFooter />
    </div>
  );
}
