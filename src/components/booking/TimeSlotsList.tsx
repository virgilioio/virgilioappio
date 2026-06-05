import { format, parseISO } from 'date-fns';
import { ArrowRight } from 'lucide-react';

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
}

export function TimeSlotsList({
  selectedDate,
  timeSlots,
  selectedSlot,
  onSlotSelect,
  isLoading,
  onConfirm,
  showHeader = true,
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
          <div key={i} className="h-11 bg-virgilio-border/30 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showHeader && (
        <div className="flex items-center justify-between">
          <h4 className="font-poppins font-bold text-virgilio-text text-[15px] tracking-[-0.02em]">
            {format(selectedDate, 'EEEE, MMMM d')}
          </h4>
          <span className="text-[11.5px] text-virgilio-muted">
            {timeSlots.length} {timeSlots.length === 1 ? 'time' : 'times'}
          </span>
        </div>
      )}

      {timeSlots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-[13px] font-medium text-virgilio-text mb-1">No available times</p>
          <p className="text-[11.5px] text-virgilio-muted">Please select another date</p>
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
                    className="flex-1 h-11 rounded-lg bg-[#0d0d09] text-white font-poppins font-semibold text-[13px]"
                  >
                    {format(parseISO(slot.start), 'h:mm a')}
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    className="flex-1 h-11 rounded-lg bg-virgilio-purple hover:bg-virgilio-purple/90 text-white font-poppins font-semibold text-[13px] inline-flex items-center justify-center gap-1.5"
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
                className={`w-full h-11 rounded-lg border font-poppins font-semibold text-[13px] transition-all
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30
                  ${isSelected
                    ? 'bg-[#0d0d09] text-white border-[#0d0d09]'
                    : 'bg-white text-virgilio-text border-virgilio-border hover:border-virgilio-purple/40 hover:bg-virgilio-purple/5'}
                `}
                aria-pressed={!!isSelected}
              >
                {format(parseISO(slot.start), 'h:mm a')}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
