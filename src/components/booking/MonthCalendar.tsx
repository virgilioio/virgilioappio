import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  format, 
  isSameDay, 
  isSameMonth, 
  addMonths, 
  subMonths, 
  startOfWeek, 
  endOfWeek,
  isToday 
} from 'date-fns';

interface MonthCalendarProps {
  availableDates: Date[];
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
}

export function MonthCalendar({ 
  availableDates, 
  selectedDate, 
  onDateSelect,
  currentMonth,
  onMonthChange
}: MonthCalendarProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const isDateAvailable = (date: Date) => {
    return availableDates.some(availableDate => isSameDay(availableDate, date));
  };

  const handlePreviousMonth = () => {
    onMonthChange(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    onMonthChange(addMonths(currentMonth, 1));
  };

  return (
    <div className="space-y-6">
      {/* Month header with chevrons */}
      <div className="flex items-center justify-between px-2">
        <h3 className="text-h4-mobile md:text-h4-desktop font-poppins font-bold text-virgilio-text">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePreviousMonth}
            className="h-9 w-9 p-0 hover:bg-virgilio-border/50 rounded-lg transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5 text-virgilio-text" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextMonth}
            className="h-9 w-9 p-0 hover:bg-virgilio-border/50 rounded-lg transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5 text-virgilio-text" />
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="space-y-2">
        {/* Weekday row */}
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-semibold text-virgilio-muted py-2"
            >
              {day}
            </div>
          ))}
        </div>
        
        {/* Date cells */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isAvailable = isDateAvailable(day);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
            const isTodayDate = isToday(day);

            return (
              <button
                key={idx}
                onClick={() => isAvailable && isCurrentMonth && !isPast && onDateSelect(day)}
                disabled={!isAvailable || !isCurrentMonth || isPast}
                className={`
                  relative min-h-[44px] w-full rounded-lg text-sm font-semibold
                  transition-all duration-200 ease-out
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple focus-visible:ring-offset-2
                  ${!isCurrentMonth ? 'text-virgilio-border cursor-default' : ''}
                  ${isPast ? 'opacity-30 cursor-not-allowed' : ''}
                  ${isCurrentMonth && !isAvailable && !isPast ? 'text-virgilio-muted/30 cursor-not-allowed' : ''}
                  ${isCurrentMonth && isAvailable && !isSelected && !isPast ? 
                    'text-virgilio-text hover:bg-virgilio-purple/10 hover:-translate-y-0.5 hover:shadow-sm cursor-pointer' : ''}
                  ${isSelected ? 'bg-virgilio-purple text-white shadow-md' : ''}
                  ${isTodayDate && !isSelected && isCurrentMonth ? 'ring-1 ring-virgilio-purple/30' : ''}
                `}
                aria-label={format(day, 'MMMM d, yyyy')}
                aria-pressed={isSelected}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
