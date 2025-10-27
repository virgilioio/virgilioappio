import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBookingAvailability } from '@/hooks/useBookingAvailability';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, isSameDay } from 'date-fns';

interface AvailabilityCalendarProps {
  bookingConfigId: string;
  durationMinutes: number;
  candidateTimezone: string;
  onSlotSelect: (slot: { start: Date; end: Date }) => void;
  selectedSlot?: { start: Date; end: Date } | null;
}

export function AvailabilityCalendar({
  bookingConfigId,
  durationMinutes,
  candidateTimezone,
  onSlotSelect,
  selectedSlot,
}: AvailabilityCalendarProps) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const { data, isLoading, error } = useBookingAvailability(
    bookingConfigId,
    weekStart,
    weekEnd,
    durationMinutes,
    candidateTimezone
  );

  const handlePreviousWeek = () => {
    setWeekStart(prev => addDays(prev, -7));
  };

  const handleNextWeek = () => {
    setWeekStart(prev => addDays(prev, 7));
  };

  // Group slots by day
  const slotsByDay = new Map<string, Array<{ start: Date; end: Date }>>();
  if (data?.available_slots) {
    data.available_slots.forEach(slot => {
      const startDate = new Date(slot.start);
      const dayKey = format(startDate, 'yyyy-MM-dd');
      if (!slotsByDay.has(dayKey)) {
        slotsByDay.set(dayKey, []);
      }
      slotsByDay.get(dayKey)!.push({
        start: startDate,
        end: new Date(slot.end),
      });
    });
  }

  // Generate week days
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive text-center">Failed to load availability. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousWeek}
            disabled={isLoading}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <CardTitle className="text-lg">
            {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextWeek}
            disabled={isLoading}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const daySlots = slotsByDay.get(dayKey) || [];

            return (
              <div key={dayKey} className="flex flex-col space-y-2">
                <div className="text-center pb-2 border-b border-border">
                  <div className="text-xs font-medium text-text-secondary">
                    {format(day, 'EEE')}
                  </div>
                  <div className="text-sm font-semibold text-text-primary">
                    {format(day, 'd')}
                  </div>
                </div>

                <div className="flex flex-col gap-1 min-h-[200px]">
                  {isLoading ? (
                    <>
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </>
                  ) : daySlots.length > 0 ? (
                    daySlots.map((slot, idx) => {
                      const isSelected = selectedSlot &&
                        isSameDay(slot.start, selectedSlot.start) &&
                        slot.start.getTime() === selectedSlot.start.getTime();

                      return (
                        <Button
                          key={idx}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className="text-xs h-8"
                          onClick={() => onSlotSelect(slot)}
                        >
                          {format(slot.start, 'h:mm a')}
                        </Button>
                      );
                    })
                  ) : (
                    <p className="text-xs text-text-secondary text-center pt-4">
                      No slots
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!isLoading && data && data.total_slots === 0 && (
          <div className="text-center py-8 text-text-secondary">
            <p>No available time slots for this week.</p>
            <p className="text-sm mt-2">Try selecting a different week.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
