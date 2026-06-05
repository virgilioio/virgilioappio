import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { Check, Clock, Video, Download, RefreshCw } from 'lucide-react';
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

  useEffect(() => {
    // Confetti
    const duration = 2500;
    const end = Date.now() + duration;
    const colors = ['#6F3FF5', '#10B981', '#FFD700'];
    (function frame() {
      if (Date.now() > end) return;
      for (let i = 0; i < 2; i++) {
        const p = document.createElement('div');
        const angle = Math.random() * 360;
        const v = Math.random() * 5 + 5;
        Object.assign(p.style, {
          position: 'fixed', width: '8px', height: '8px',
          background: colors[Math.floor(Math.random() * colors.length)],
          borderRadius: '50%', pointerEvents: 'none', zIndex: '9999',
          left: '50%', top: '25%',
        });
        document.body.appendChild(p);
        const rad = (angle + i * 30) * Math.PI / 180;
        const vx = Math.cos(rad) * v;
        const vy = Math.sin(rad) * v;
        let x = 0, y = 0;
        const tick = () => {
          x += vx; y += vy + 0.5;
          p.style.transform = `translate(${x}px, ${y}px)`;
          p.style.opacity = String(Math.max(0, 1 - y / 200));
          if (y < 200) requestAnimationFrame(tick); else p.remove();
        };
        tick();
      }
      requestAnimationFrame(frame);
    })();
  }, []);

  const firstName = state?.booking.candidate_name?.split(' ')[0] || 'there';
  const startTime = state ? new Date(state.booking.scheduled_start) : null;
  const endTime = state ? new Date(state.booking.scheduled_end) : null;
  const tzAbbr = startTime
    ? new Intl.DateTimeFormat('en-US', { timeZoneName: 'short', timeZone: state?.booking.candidate_timezone }).formatToParts(startTime).find(p => p.type === 'timeZoneName')?.value
    : '';

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
SUMMARY:Interview with ${interviewerName}
LOCATION:${booking.meeting_location || ''}
END:VEVENT
END:VCALENDAR`;
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'interview.ics';
    document.body.appendChild(a); a.click(); a.remove();
    window.URL.revokeObjectURL(url);
  };

  if (!state || !startTime || !endTime) {
    return (
      <div className="min-h-screen bg-[#FAF8F2] flex flex-col">
        <PublicBookingHeader workspaceName="Scheduling" />
        <main className="flex-1 container mx-auto px-4 py-16 max-w-xl text-center space-y-4">
          <div className="h-20 w-20 rounded-full bg-emerald-100 mx-auto flex items-center justify-center">
            <Check className="h-9 w-9 text-emerald-700" strokeWidth={2.5} />
          </div>
          <h1 className="font-poppins font-bold text-virgilio-text text-3xl tracking-[-0.02em]">
            Booking Confirmed<span className="text-virgilio-purple">.</span>
          </h1>
          <p className="text-virgilio-muted">
            Your interview has been scheduled. A calendar invitation is on its way to your inbox.
          </p>
        </main>
        <PublicBookingFooter />
      </div>
    );
  }

  const panelists = [{ name: state.interviewerName }];

  return (
    <div className="min-h-screen bg-[#FAF8F2] flex flex-col">
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

        {/* Stacked card: dark top + white bottom */}
        <div className="rounded-2xl overflow-hidden border border-virgilio-border shadow-[0_24px_60px_-30px_rgba(13,13,9,0.18)]">
          {/* Dark detail */}
          <div className="bg-[#0d0d09] text-white p-5 md:p-6 flex items-start gap-5">
            <div className="leading-tight text-center flex-shrink-0">
              <div className="text-[10.5px] font-poppins font-semibold tracking-[0.08em] text-white/60 uppercase">
                {format(startTime, 'EEE')}
              </div>
              <div className="font-poppins font-bold text-[34px] leading-none mt-1">
                {format(startTime, 'd')}
              </div>
              <div className="text-[11.5px] text-white/60 mt-1">
                {format(startTime, 'MMM')}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-poppins font-bold text-[17px] tracking-[-0.01em]">
                {state.config.display_name}
              </div>
              <div className="flex items-center gap-3 mt-2 text-[12.5px] text-white/70 flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {format(startTime, 'h:mm')} – {format(endTime, 'h:mm a')} {tzAbbr}
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
              <button
                onClick={downloadICS}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-[#0d0d09] text-white font-poppins font-semibold text-[13px]"
              >
                <Download className="h-3.5 w-3.5" />
                Add to calendar
              </button>
              <button
                disabled
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-white border border-virgilio-border text-virgilio-text font-poppins font-semibold text-[13px] opacity-60 cursor-not-allowed"
                title="Use your booking link to reschedule"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reschedule
              </button>
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
