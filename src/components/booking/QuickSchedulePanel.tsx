import { format, parseISO } from 'date-fns';
import { Zap } from 'lucide-react';

interface TimeSlot {
  start: string;
  end: string;
}

interface QuickSchedulePanelProps {
  availableSlots: TimeSlot[];
  onQuickSelect: (slot: TimeSlot) => void;
  maxSlots?: number;
}

export function QuickSchedulePanel({ 
  availableSlots, 
  onQuickSelect, 
  maxSlots = 5 
}: QuickSchedulePanelProps) {
  // Take the first N slots across all dates
  const quickSlots = availableSlots.slice(0, maxSlots);

  if (quickSlots.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-virgilio-purple" />
        <h3 className="text-sm font-semibold text-virgilio-text">Quick Schedule</h3>
      </div>
      <p className="text-xs text-virgilio-muted">
        Pick one of the next available slots to skip ahead.
      </p>
      <div className="space-y-2">
        {quickSlots.map((slot, idx) => {
          const startDate = parseISO(slot.start);
          return (
            <button
              key={idx}
              onClick={() => onQuickSelect(slot)}
              className="
                w-full flex items-center justify-between p-3 rounded-lg
                border border-virgilio-border bg-white
                hover:border-virgilio-purple/50 hover:bg-virgilio-purple/5
                hover:-translate-y-0.5 hover:shadow-sm
                transition-all duration-200 ease-out
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple focus-visible:ring-offset-2
                group
              "
            >
              <div className="text-left">
                <p className="text-sm font-semibold text-virgilio-text">
                  {format(startDate, 'EEE, MMM d')}
                </p>
                <p className="text-xs text-virgilio-muted">
                  {format(startDate, 'h:mm a')}
                </p>
              </div>
              <div className="text-xs font-medium text-virgilio-purple opacity-0 group-hover:opacity-100 transition-opacity">
                Select →
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
