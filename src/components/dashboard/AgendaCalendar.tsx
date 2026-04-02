import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface AgendaCalendarProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  /** Set of YYYY-MM-DD strings that have activities */
  activityDates: Set<string>;
  /** When true, the built-in month header (label + nav arrows) is hidden */
  hideHeader?: boolean;
}

export function AgendaCalendar({
  selectedDate,
  onDateSelect,
  currentMonth,
  onMonthChange,
  activityDates,
}: AgendaCalendarProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-3">
      {/* Month header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-foreground">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMonthChange(subMonths(currentMonth, 1))}
            className="h-7 w-7 p-0"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
            className="h-7 w-7 p-0"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday row */}
      <div className="grid grid-cols-7 gap-0.5">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-medium text-muted-foreground py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, idx) => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);
          const dateKey = format(day, 'yyyy-MM-dd');
          const hasActivity = activityDates.has(dateKey);

          return (
            <button
              key={idx}
              onClick={() => isCurrentMonth && onDateSelect(day)}
              disabled={!isCurrentMonth}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-md text-xs font-medium transition-all",
                "min-h-[36px] w-full",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                !isCurrentMonth && "text-muted-foreground/30 cursor-default",
                isCurrentMonth && !isSelected && "text-foreground hover:bg-accent cursor-pointer",
                isCurrentMonth && hasActivity && !isSelected && "text-primary font-semibold bg-primary/8 hover:bg-primary/15",
                isSelected && "bg-primary text-primary-foreground shadow-sm hover:bg-primary",
                isTodayDate && !isSelected && isCurrentMonth && "ring-1 ring-primary/40",
              )}
              aria-label={format(day, 'MMMM d, yyyy')}
              aria-pressed={!!isSelected}
            >
              <span>{format(day, 'd')}</span>
              {/* Activity dot */}
              {hasActivity && !isSelected && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />
              )}
              {hasActivity && isSelected && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary-foreground" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
