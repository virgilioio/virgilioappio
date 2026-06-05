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
  isToday,
} from 'date-fns';

interface MonthCalendarProps {
  availableDates: Date[];
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  allowAllDates?: boolean;
  noAvailabilityInMonth?: boolean;
}

export function MonthCalendar({
  availableDates,
  selectedDate,
  onDateSelect,
  currentMonth,
  onMonthChange,
  allowAllDates = false,
  noAvailabilityInMonth = false,
}: MonthCalendarProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  const isDateAvailable = (date: Date) =>
    availableDates.some((d) => isSameDay(d, date));

  return (
    <div className="space-y-5">
      {/* Month header */}
      <div className="flex items-center justify-between">
        <h3 className="font-poppins font-bold text-virgilio-text text-[18px] tracking-[-0.02em]">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <div className="flex gap-1 rounded-lg border border-virgilio-border p-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMonthChange(subMonths(currentMonth, 1))}
            className="h-7 w-7 p-0 hover:bg-virgilio-border/40 rounded-md"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4 text-virgilio-text" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
            className="h-7 w-7 p-0 hover:bg-virgilio-border/40 rounded-md"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4 text-virgilio-text" />
          </Button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((d) => (
          <div
            key={d}
            className="text-center text-[10.5px] font-poppins font-semibold text-virgilio-muted tracking-[0.08em] py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, idx) => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isAvailable = isDateAvailable(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
          const isTodayDate = isToday(day);

          const isSelectable = allowAllDates
            ? isCurrentMonth && !isPast
            : isAvailable && isCurrentMonth && !isPast;

          return (
            <button
              key={idx}
              onClick={() => isSelectable && onDateSelect(day)}
              disabled={!isSelectable}
              className={`
                relative aspect-square w-full rounded-lg text-[13px] font-poppins font-semibold
                transition-all duration-150
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple
                ${!isCurrentMonth ? 'text-transparent cursor-default' : ''}
                ${isCurrentMonth && isPast ? 'text-virgilio-muted/30 cursor-not-allowed' : ''}
                ${isCurrentMonth && !isPast && !isSelectable && !isAvailable ? 'text-virgilio-muted/40 cursor-not-allowed' : ''}
                ${isCurrentMonth && isSelectable && !isSelected && isAvailable ? 'text-virgilio-text bg-virgilio-purple/10 hover:bg-virgilio-purple/20 cursor-pointer' : ''}
                ${isCurrentMonth && isSelectable && !isSelected && !isAvailable && allowAllDates ? 'text-virgilio-text hover:bg-virgilio-border/40 cursor-pointer' : ''}
                ${isSelected ? 'bg-[#0d0d09] text-white shadow-sm' : ''}
                ${isTodayDate && !isSelected && isCurrentMonth ? 'ring-1 ring-virgilio-purple/40' : ''}
              `}
              aria-label={format(day, 'MMMM d, yyyy')}
              aria-pressed={!!isSelected}
            >
              <span className="relative">
                {format(day, 'd')}
                {isAvailable && !isSelected && isCurrentMonth && (
                  <span className="absolute left-1/2 -translate-x-1/2 top-full mt-0.5 h-1 w-1 rounded-full bg-virgilio-purple" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[11.5px] text-virgilio-muted pt-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-virgilio-purple/30" />
          Available
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#0d0d09]" />
          Selected
        </span>
      </div>

      {noAvailabilityInMonth && (
        <div className="mt-2 p-3 bg-virgilio-purple/5 border border-virgilio-border rounded-lg text-center">
          <p className="text-sm text-virgilio-muted">
            No available times this month. Use the arrows to check other months.
          </p>
        </div>
      )}
    </div>
  );
}
