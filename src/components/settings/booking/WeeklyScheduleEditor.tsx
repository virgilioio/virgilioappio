import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Copy, CopyCheck, Clock } from 'lucide-react';
import { WeeklySchedule } from '@/hooks/useBookingConfig';
import { TimePickerVirgilio } from '@/components/ui/time-picker-virgilio';

interface WeeklyScheduleEditorProps {
  schedule: WeeklySchedule;
  onChange: (schedule: WeeklySchedule) => void;
}

const DAYS = [
  { key: 'monday' as const, label: 'Monday', short: 'Mon' },
  { key: 'tuesday' as const, label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday' as const, label: 'Wednesday', short: 'Wed' },
  { key: 'thursday' as const, label: 'Thursday', short: 'Thu' },
  { key: 'friday' as const, label: 'Friday', short: 'Fri' },
  { key: 'saturday' as const, label: 'Saturday', short: 'Sat' },
  { key: 'sunday' as const, label: 'Sunday', short: 'Sun' },
];

export function WeeklyScheduleEditor({ schedule, onChange }: WeeklyScheduleEditorProps) {
  const handleDayToggle = (day: keyof WeeklySchedule, checked: boolean) => {
    onChange({ ...schedule, [day]: { ...schedule[day], enabled: checked } });
  };

  const handleTimeChange = (
    day: keyof WeeklySchedule,
    field: 'start' | 'end',
    value: string
  ) => {
    onChange({ ...schedule, [day]: { ...schedule[day], [field]: value } });
  };

  const copyMondayToWeekdays = () => {
    const m = schedule.monday;
    onChange({
      ...schedule,
      tuesday: { ...m },
      wednesday: { ...m },
      thursday: { ...m },
      friday: { ...m },
    });
  };

  const applySameHoursToAll = () => {
    const m = schedule.monday;
    const next = { ...schedule };
    DAYS.forEach(({ key }) => {
      next[key] = { ...m, enabled: next[key].enabled };
    });
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          icon={Copy}
          onClick={copyMondayToWeekdays}
        >
          Copy Monday
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          icon={CopyCheck}
          onClick={applySameHoursToAll}
        >
          Apply to all
        </Button>
      </div>

      <div className="divide-y divide-[#F1F0EC]">
        {DAYS.map(({ key, label }) => {
          const day = schedule[key];
          return (
            <div key={key} className="flex items-center gap-3 py-2.5">
              <div className="flex items-center gap-2.5 w-[130px] shrink-0">
                <Checkbox
                  checked={day.enabled}
                  onCheckedChange={(c) => handleDayToggle(key, c as boolean)}
                  className="h-[18px] w-[18px] rounded-[6px] border-[#E0DDD3] data-[state=checked]:bg-[#0d0d09] data-[state=checked]:border-[#0d0d09]"
                />
                <span
                  className="font-inter text-[12.5px] font-medium text-[#1F2230]"
                >
                  {label}
                </span>
              </div>

              {day.enabled ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="relative">
                    <Clock className="w-3 h-3 text-[#8B8F9E] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                    <TimePickerVirgilio
                      value={day.start}
                      onChange={(t) => handleTimeChange(key, 'start', t)}
                      className="w-[120px] [&_input]:pl-7 [&_button]:pl-7"
                    />
                  </div>
                  <span className="font-inter text-[11.5px] text-[#8B8F9E]">to</span>
                  <div className="relative">
                    <Clock className="w-3 h-3 text-[#8B8F9E] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                    <TimePickerVirgilio
                      value={day.end}
                      onChange={(t) => handleTimeChange(key, 'end', t)}
                      className="w-[120px] [&_input]:pl-7 [&_button]:pl-7"
                    />
                  </div>
                </div>
              ) : (
                <span className="font-inter text-[12px] italic text-[#8B8F9E]">
                  Unavailable
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
