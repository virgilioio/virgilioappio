import { ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedEmpty } from '@/components/empty/AnimatedEmpty';
import { formatZoneDayHeading, formatZoneTime, zoneAbbr } from '@/lib/timezoneFormat';

interface TimeSlot {
  start: string;
  end: string;
}

interface TimeSlotsListProps {
  selectedDate: Date | null;
  timeSlots: TimeSlot[];
  selectedSlot: TimeSlot | null;
  onSlotSelect: (slot: TimeSlot) => void;
  isLoading?: boolean;
  onConfirm?: () => void;
  showHeader?: boolean;
  candidateTimezone: string;
}

export function TimeSlotsList({
  selectedDate,
  timeSlots,
  selectedSlot,
  onSlotSelect,
  isLoading,
  onConfirm,
  showHeader = true,
  candidateTimezone,
}: TimeSlotsListProps) {
  if (!selectedDate) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <p className="text-[13px] text-virgilio-muted">Pick a date to see available times.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-11 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showHeader && (
        <div className="flex items-center justify-between">
          <h4 className="font-poppins font-bold text-virgilio-text text-[15px] tracking-[-0.02em]">
            {formatZoneDayHeading(selectedDate, candidateTimezone)}
          </h4>
          <span className="text-[11.5px] text-virgilio-muted">
            {timeSlots.length} {timeSlots.length === 1 ? 'time' : 'times'}
            {zoneAbbr(candidateTimezone) ? ` · ${zoneAbbr(candidateTimezone)}` : ''}
          </span>
        </div>
      )}

      {timeSlots.length === 0 ? (
        <div className="py-4">
          <AnimatedEmpty
            scene="scheduling"
            size="compact"
            onceKey="booking-no-times"
            title="No times left on this day"
            body="Pick another date in the calendar."
          />
        </div>
      ) : (
        <div className="space-y-2">
          {timeSlots.map((slot, idx) => {
            const isSelected =
              selectedSlot && selectedSlot.start === slot.start && selectedSlot.end === slot.end;

            if (isSelected && onConfirm) {
              return (
                <div key={idx} className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onSlotSelect(slot)}
                    className="gio-pressable flex-1 h-11 rounded-lg bg-[#0d0d09] text-white font-poppins font-semibold text-[13px]"
                  >
                    {formatZoneTime(slot.start, candidateTimezone)}
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    className="gio-pressable flex-1 h-11 rounded-lg bg-virgilio-purple transition-colors duration-hover hover:bg-virgilio-purple/90 text-white font-poppins font-semibold text-[13px] inline-flex items-center justify-center gap-1.5"
                  >
                    Confirm <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSlotSelect(slot)}
                className={`gio-pressable w-full h-11 rounded-lg border font-poppins font-semibold text-[13px] tabular-nums transition-colors duration-hover
                  ${isSelected
                    ? 'bg-[#0d0d09] text-white border-[#0d0d09]'
                    : 'bg-white text-virgilio-text border-virgilio-border hover:border-virgilio-purple/40 hover:bg-virgilio-purple/5'}
                `}
                aria-pressed={!!isSelected}
              >
                {formatZoneTime(slot.start, candidateTimezone)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
