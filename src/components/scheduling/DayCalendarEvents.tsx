import { useMemo } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock } from 'lucide-react';

interface BusyEvent {
  start: string;
  end: string;
}

interface DayCalendarEventsProps {
  selectedDate: Date | null;
  busyEvents: BusyEvent[];
  isLoading?: boolean;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM

export function DayCalendarEvents({ selectedDate, busyEvents, isLoading }: DayCalendarEventsProps) {
  // Filter busy events for the selected date
  const dayEvents = useMemo(() => {
    if (!selectedDate || !busyEvents?.length) return [];
    return busyEvents
      .filter(event => {
        const eventDate = parseISO(event.start);
        return isSameDay(eventDate, selectedDate);
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [selectedDate, busyEvents]);

  if (!selectedDate) {
    return (
      <div className="flex items-center justify-center h-full text-center px-4">
        <p className="text-sm text-muted-foreground">
          Select a date to see calendar events
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-muted-foreground mb-3">Calendar</h4>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-8 bg-muted/30 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  // Calculate position and height for busy blocks
  const getEventStyle = (event: BusyEvent) => {
    const start = parseISO(event.start);
    const end = parseISO(event.end);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    const top = ((startHour - 8) / 12) * 100; // 12 hours range (8-20)
    const height = ((endHour - startHour) / 12) * 100;
    return {
      top: `${Math.max(0, top)}%`,
      height: `${Math.min(100 - Math.max(0, top), Math.max(height, 2))}%`,
    };
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold text-foreground">
          {format(selectedDate, 'EEE, MMM d')}
        </h4>
      </div>

      {dayEvents.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No calendar events</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''} on this day
        </p>
      )}

      <ScrollArea className="h-[400px]">
        <div className="relative" style={{ height: '480px' }}>
          {/* Hour lines */}
          {HOURS.map(hour => {
            const top = ((hour - 8) / 12) * 100;
            return (
              <div
                key={hour}
                className="absolute left-0 right-0 flex items-start"
                style={{ top: `${top}%` }}
              >
                <span className="text-[10px] text-muted-foreground w-10 shrink-0 -mt-1.5 text-right pr-2">
                  {format(new Date(2000, 0, 1, hour), 'h a')}
                </span>
                <div className="flex-1 border-t border-border/50" />
              </div>
            );
          })}

          {/* Busy event blocks */}
          {dayEvents.map((event, idx) => {
            const style = getEventStyle(event);
            const start = parseISO(event.start);
            const end = parseISO(event.end);
            return (
              <div
                key={idx}
                className="absolute left-11 right-1 bg-destructive/15 border-l-2 border-destructive/60 rounded-r px-2 py-0.5 overflow-hidden"
                style={style}
              >
                <span className="text-[10px] font-medium text-destructive-foreground/80 whitespace-nowrap">
                  {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
                </span>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
