import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

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
}

export function TimeSlotsList({ 
  selectedDate, 
  timeSlots, 
  selectedSlot, 
  onSlotSelect,
  isLoading 
}: TimeSlotsListProps) {
  if (!selectedDate) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-center px-4">
        <p className="text-sm text-virgilio-muted font-medium">
          Select a date to view available times
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div 
            key={i} 
            className="h-10 bg-virgilio-border/30 animate-pulse rounded-lg" 
          />
        ))}
      </div>
    );
  }

  if (timeSlots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-center px-4">
        <p className="text-sm font-semibold text-virgilio-text mb-1">
          No available times
        </p>
        <p className="text-xs text-virgilio-muted">
          Please select another date
        </p>
      </div>
    );
  }

  // Group slots by time of day
  const morningSlots = timeSlots.filter(slot => {
    const hour = parseISO(slot.start).getHours();
    return hour < 12;
  });

  const afternoonSlots = timeSlots.filter(slot => {
    const hour = parseISO(slot.start).getHours();
    return hour >= 12 && hour < 17;
  });

  const eveningSlots = timeSlots.filter(slot => {
    const hour = parseISO(slot.start).getHours();
    return hour >= 17;
  });

  const renderSlots = (slots: TimeSlot[], label: string) => {
    if (slots.length === 0) return null;
    
    return (
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-virgilio-muted uppercase tracking-wide">
          {label}
        </h4>
        <div className="space-y-2">
          {slots.map((slot, idx) => {
            const isSelected = selectedSlot && 
              selectedSlot.start === slot.start && 
              selectedSlot.end === slot.end;
            
            return (
              <Button
                key={idx}
                variant="outline"
                onClick={() => onSlotSelect(slot)}
                className={`
                  w-full h-10 justify-center text-center font-semibold text-sm
                  border-virgilio-border rounded-lg
                  transition-all duration-200 ease-out
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple focus-visible:ring-offset-2
                  ${isSelected 
                    ? 'bg-virgilio-purple text-white border-virgilio-purple shadow-md' 
                    : 'bg-white text-virgilio-text hover:bg-virgilio-purple/10 hover:-translate-y-0.5 hover:shadow-sm hover:border-virgilio-purple/50'
                  }
                `}
                aria-label={`Select time slot ${format(parseISO(slot.start), 'h:mm a')}`}
                aria-pressed={isSelected}
              >
                {format(parseISO(slot.start), 'h:mm a')}
              </Button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-6 pb-4 border-b border-virgilio-border">
        <h4 className="text-base font-semibold text-virgilio-text">
          {format(selectedDate, 'EEEE, MMMM d')}
        </h4>
      </div>
      
      <ScrollArea className="h-[500px] pr-4">
        <div className="space-y-6">
          {renderSlots(morningSlots, 'Morning')}
          {renderSlots(afternoonSlots, 'Afternoon')}
          {renderSlots(eveningSlots, 'Evening')}
        </div>
      </ScrollArea>
    </div>
  );
}
