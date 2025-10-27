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
    <div className="border rounded-lg p-4 max-w-xs mx-auto" style={{ borderColor: '#d7c5fb' }}>
      <h4 className="text-sm font-semibold text-text-primary text-center mb-3">
        {format(selectedDate, 'EEEE, MMMM d')}
      </h4>
      
      <ScrollArea className="h-[400px]">
        <div className="space-y-2 pr-2">
          {timeSlots.map((slot, idx) => {
            const isSelected = selectedSlot && 
              selectedSlot.start === slot.start && 
              selectedSlot.end === slot.end;
            
            return (
              <Button
                key={idx}
                variant="outline"
                onClick={() => onSlotSelect(slot)}
                style={{
                  backgroundColor: isSelected ? '#7e3eff' : 'transparent',
                  color: isSelected ? '#ffffff' : 'inherit',
                  borderColor: '#d7c5fb',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = '#d7c5fb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
                className="w-full justify-center text-center h-auto py-3 px-4"
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
