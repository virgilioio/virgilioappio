import { format } from 'date-fns';
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
      <div className="flex items-center justify-center h-64 text-text-secondary">
        <p className="text-sm">Select a date to view available times</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-accent animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (timeSlots.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary">
        <div className="text-center">
          <p className="text-sm font-medium">No available times</p>
          <p className="text-xs mt-1">Please select another date</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-text-primary">
        {format(selectedDate, 'EEEE, MMMM d')}
      </h4>
      
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-2">
          {timeSlots.map((slot, idx) => {
            const isSelected = selectedSlot && 
              selectedSlot.start === slot.start && 
              selectedSlot.end === slot.end;
            
            return (
              <Button
                key={idx}
                variant={isSelected ? "default" : "outline"}
                onClick={() => onSlotSelect(slot)}
                className="w-full justify-start text-left h-auto py-3 px-4"
              >
                <span className="text-base font-medium">
                  {format(new Date(slot.start), 'h:mm a')}
                </span>
              </Button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
