import { Clock, Phone, Coffee, Users } from 'lucide-react';

interface EventTypeOption {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  color: string;
}

interface EventTypePickerProps {
  eventTypes: EventTypeOption[];
  onSelect: (eventType: EventTypeOption) => void;
  selectedId?: string | null;
  interviewerName?: string;
  variant?: 'inline' | 'standalone';
}

function pickIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes('coffee')) return Coffee;
  if (t.includes('call') || t.includes('intro')) return Phone;
  if (t.includes('panel') || t.includes('team')) return Users;
  return Phone;
}

export function EventTypePicker({
  eventTypes,
  onSelect,
  selectedId,
  interviewerName,
  variant = 'inline',
}: EventTypePickerProps) {
  return (
    <div className={variant === 'standalone' ? 'max-w-lg mx-auto space-y-4' : 'space-y-3'}>
      {variant === 'standalone' && interviewerName && (
        <div className="text-center space-y-2 mb-6">
          <h2 className="text-2xl font-poppins font-bold text-virgilio-text">{interviewerName}</h2>
          <p className="text-virgilio-muted">Select an event type to schedule</p>
        </div>
      )}

      {variant === 'inline' && (
        <div className="text-[10.5px] font-poppins font-semibold tracking-[0.08em] text-virgilio-muted uppercase">
          Choose a meeting type
        </div>
      )}

      <div className="space-y-2.5">
        {eventTypes.map((et) => {
          const Icon = pickIcon(et.title);
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
              <div
                className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'bg-virgilio-purple text-white' : 'bg-virgilio-border/40 text-virgilio-muted'
                }`}
                style={isSelected ? undefined : { color: et.color }}
              >
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
