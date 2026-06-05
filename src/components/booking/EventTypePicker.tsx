import { Clock, Phone, Coffee, Users, Code2, Video, MapPin, ArrowRight, HelpCircle, Globe, Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface EventTypeOption {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  color: string;
  meeting_location?: string | null;
}

interface EventTypePickerProps {
  eventTypes: EventTypeOption[];
  onSelect: (eventType: EventTypeOption) => void;
  selectedId?: string | null;
  interviewerName?: string;
  interviewerFirstName?: string;
  interviewerRole?: string | null;
  interviewerAvatarUrl?: string | null;
  interviewerInitials?: string;
  workspaceName?: string;
  timezoneLabel?: string;
  variant?: 'inline' | 'standalone';
}

type Tone = 'blue' | 'purple' | 'green' | 'orange' | 'neutral';

function pickToneAndIcon(et: EventTypeOption): { Icon: typeof Phone; tone: Tone } {
  const t = `${et.title} ${et.slug}`.toLowerCase();
  const loc = (et.meeting_location || '').toLowerCase();
  if (t.includes('coffee')) return { Icon: Coffee, tone: 'orange' };
  if (t.includes('tech') || t.includes('code') || t.includes('working')) return { Icon: Code2, tone: 'green' };
  if (t.includes('panel') || t.includes('team') || t.includes('onsite')) return { Icon: Users, tone: 'purple' };
  if (t.includes('recruiter') || t.includes('screen')) return { Icon: Users, tone: 'purple' };
  if (t.includes('intro') || t.includes('call') || loc.includes('phone')) return { Icon: Phone, tone: 'blue' };
  return { Icon: Phone, tone: 'neutral' };
}

const TONE_CLASSES: Record<Tone, { bg: string; fg: string }> = {
  blue: { bg: 'bg-blue-50', fg: 'text-blue-600' },
  purple: { bg: 'bg-virgilio-purple/10', fg: 'text-virgilio-purple' },
  green: { bg: 'bg-emerald-50', fg: 'text-emerald-600' },
  orange: { bg: 'bg-orange-50', fg: 'text-orange-500' },
  neutral: { bg: 'bg-virgilio-border/40', fg: 'text-virgilio-muted' },
};

function locationMeta(et: EventTypeOption) {
  const loc = (et.meeting_location || '').trim();
  if (!loc) return { Icon: Video, label: 'Google Meet' };
  const l = loc.toLowerCase();
  if (l.includes('phone')) return { Icon: Phone, label: loc };
  if (l.includes('meet') || l.includes('zoom') || l.includes('teams') || l.includes('video')) return { Icon: Video, label: loc };
  if (l.includes('person') || l.includes('office')) return { Icon: MapPin, label: loc };
  return { Icon: Video, label: loc };
}

export function EventTypePicker({
  eventTypes,
  onSelect,
  selectedId,
  interviewerName,
  interviewerFirstName,
  interviewerRole,
  interviewerAvatarUrl,
  interviewerInitials,
  workspaceName,
  timezoneLabel,
  variant = 'inline',
}: EventTypePickerProps) {
  if (variant === 'standalone') {
    const firstName = interviewerFirstName || interviewerName?.split(' ')[0] || 'us';
    const initials = (interviewerInitials || interviewerName || firstName)
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const introEvent = eventTypes.find((et) =>
      `${et.title} ${et.slug}`.toLowerCase().includes('intro')
    );

    return (
      <div className="max-w-2xl mx-auto">
        {/* Hero */}
        <div className="flex flex-col items-center text-center">
          <Avatar className="h-20 w-20 mb-6">
            <AvatarImage src={interviewerAvatarUrl || undefined} alt={interviewerName || firstName} />
            <AvatarFallback className="bg-virgilio-purple text-white font-poppins font-semibold text-xl">
              {initials}
            </AvatarFallback>
          </Avatar>

          <h1 className="font-poppins font-bold text-virgilio-text text-3xl md:text-[40px] leading-[1.1] tracking-[-0.03em]">
            Book time with {firstName}<span className="text-virgilio-purple">.</span>
          </h1>

          {(interviewerRole || workspaceName) && (
            <p className="text-virgilio-muted mt-3 text-[14px]">
              {[interviewerRole, workspaceName].filter(Boolean).join(' · ')}
            </p>
          )}

          <p className="text-virgilio-muted mt-3 max-w-xl text-[14px] md:text-[15px] leading-relaxed">
            Choose what you'd like to book below. Each one shows how long it takes and where it happens — pick a time on the next step.
          </p>

          {(timezoneLabel || true) && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-5 text-[12.5px] text-virgilio-muted">
              {timezoneLabel && (
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  {timezoneLabel}
                </span>
              )}
              <span className="opacity-50">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                Usually replies within a day
              </span>
            </div>
          )}
        </div>

        {/* Section label */}
        <div className="mt-10 mb-4 text-[10.5px] font-poppins font-semibold tracking-[0.08em] text-virgilio-muted uppercase">
          Choose what to book
        </div>

        {/* Event cards */}
        <div className="space-y-3">
          {eventTypes.map((et) => {
            const { Icon, tone } = pickToneAndIcon(et);
            const toneCls = TONE_CLASSES[tone];
            const { Icon: LocIcon, label: locLabel } = locationMeta(et);
            const isSelected = selectedId === et.id;
            return (
              <button
                key={et.id}
                type="button"
                onClick={() => onSelect(et)}
                className={`group w-full text-left rounded-2xl border bg-white p-5 transition-all flex items-center gap-5 ${
                  isSelected
                    ? 'border-virgilio-purple/40 shadow-sm'
                    : 'border-virgilio-border hover:border-virgilio-purple/30 hover:shadow-sm'
                }`}
              >
                <div className={`h-14 w-14 rounded-xl flex items-center justify-center flex-shrink-0 ${toneCls.bg} ${toneCls.fg}`}>
                  <Icon className="h-6 w-6" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-poppins font-bold text-virgilio-text text-[16px] tracking-[-0.01em]">
                      {et.title}
                    </span>
                  </div>
                  {et.description && (
                    <p className="text-[13px] text-virgilio-muted mt-1 leading-snug line-clamp-2">
                      {et.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2.5 text-[12.5px] text-virgilio-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {et.duration_minutes} min
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <LocIcon className="h-3.5 w-3.5" />
                      {locLabel}
                    </span>
                  </div>
                </div>

                <div className="h-9 w-9 rounded-full border border-virgilio-border flex items-center justify-center text-virgilio-muted group-hover:bg-virgilio-purple group-hover:border-virgilio-purple group-hover:text-white transition-colors flex-shrink-0">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </button>
            );
          })}
        </div>

        {introEvent && eventTypes.length > 1 && (
          <div className="mt-6 text-center text-[13px] text-virgilio-muted inline-flex items-center justify-center gap-1.5 w-full">
            <HelpCircle className="h-3.5 w-3.5" />
            Not sure which to pick?{' '}
            <button
              type="button"
              onClick={() => onSelect(introEvent)}
              className="font-poppins font-semibold text-virgilio-text underline underline-offset-2 hover:text-virgilio-purple transition-colors"
            >
              Start with an {introEvent.title.toLowerCase()}
            </button>
            .
          </div>
        )}
      </div>
    );
  }

  // Inline variant (used inside left sidebar of 3-col layout)
  return (
    <div className="space-y-3">
      <div className="text-[10.5px] font-poppins font-semibold tracking-[0.08em] text-virgilio-muted uppercase">
        Choose a meeting type
      </div>

      <div className="space-y-2.5">
        {eventTypes.map((et) => {
          const { Icon, tone } = pickToneAndIcon(et);
          const toneCls = TONE_CLASSES[tone];
          const isSelected = selectedId === et.id;
          return (
            <button
              key={et.id}
              type="button"
              onClick={() => onSelect(et)}
              className={`w-full text-left rounded-xl border p-3.5 transition-all flex items-start gap-3 ${
                isSelected
                  ? 'bg-virgilio-purple/8 border-virgilio-purple/40 shadow-sm'
                  : 'bg-white border-virgilio-border hover:border-virgilio-purple/30 hover:bg-virgilio-purple/5'
              }`}
            >
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${toneCls.bg} ${toneCls.fg}`}>
                <Icon className="h-4 w-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-poppins font-semibold text-virgilio-text text-[13.5px]">
                    {et.title}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11.5px] text-virgilio-muted">
                    <Clock className="h-3 w-3" />
                    {et.duration_minutes} min
                  </span>
                </div>
                {et.description && (
                  <p className="text-[12px] text-virgilio-muted mt-1 leading-snug">{et.description}</p>
                )}
              </div>

              <div
                className={`h-4 w-4 rounded-full border-2 flex-shrink-0 mt-1 transition-colors ${
                  isSelected ? 'border-virgilio-purple bg-virgilio-purple ring-2 ring-virgilio-purple/20' : 'border-virgilio-border'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
