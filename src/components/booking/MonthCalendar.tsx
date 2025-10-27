import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';

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
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePreviousMonth}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextMonth}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Week day headers */}
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-text-secondary py-2"
          >
            {day}
          </div>
        ))}
        
        {/* Date cells */}
        {days.map((day, idx) => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isAvailable = isDateAvailable(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));

          return (
            <button
              key={idx}
              onClick={() => isAvailable && isCurrentMonth && !isPast && onDateSelect(day)}
              disabled={!isAvailable || !isCurrentMonth || isPast}
              style={{
                backgroundColor: isSelected ? '#7e3eff' : 'transparent',
                color: isSelected ? '#ffffff' : isCurrentMonth && isAvailable ? '#7e3eff' : '',
              }}
              className={`
                aspect-square p-2 rounded-lg text-sm font-medium transition-all
                ${!isCurrentMonth ? 'text-text-tertiary' : ''}
                ${isCurrentMonth && !isAvailable ? 'text-text-tertiary cursor-not-allowed' : ''}
                ${isCurrentMonth && isAvailable && !isSelected ? 'hover:bg-[#d7c5fb] cursor-pointer' : ''}
                ${isPast ? 'opacity-40 cursor-not-allowed' : ''}
              `}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
