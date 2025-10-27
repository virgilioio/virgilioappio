import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { WeeklySchedule } from '@/hooks/useBookingConfig';

interface WeeklyScheduleEditorProps {
  schedule: WeeklySchedule;
  onChange: (schedule: WeeklySchedule) => void;
}

const DAYS = [
  { key: 'monday' as const, label: 'Monday' },
  { key: 'tuesday' as const, label: 'Tuesday' },
  { key: 'wednesday' as const, label: 'Wednesday' },
  { key: 'thursday' as const, label: 'Thursday' },
  { key: 'friday' as const, label: 'Friday' },
  { key: 'saturday' as const, label: 'Saturday' },
  { key: 'sunday' as const, label: 'Sunday' },
];

export function WeeklyScheduleEditor({ schedule, onChange }: WeeklyScheduleEditorProps) {
  const handleDayToggle = (day: keyof WeeklySchedule, checked: boolean) => {
    onChange({
      ...schedule,
      [day]: { ...schedule[day], enabled: checked },
    });
  };

  const handleTimeChange = (
    day: keyof WeeklySchedule,
    field: 'start' | 'end',
    value: string
  ) => {
    onChange({
      ...schedule,
      [day]: { ...schedule[day], [field]: value },
    });
  };

  const copyMondayToWeekdays = () => {
    const mondaySchedule = schedule.monday;
    onChange({
      ...schedule,
      tuesday: { ...mondaySchedule },
      wednesday: { ...mondaySchedule },
      thursday: { ...mondaySchedule },
      friday: { ...mondaySchedule },
    });
  };

  const applySameHoursToAll = () => {
    const mondaySchedule = schedule.monday;
    const newSchedule = { ...schedule };
    DAYS.forEach(({ key }) => {
      newSchedule[key] = { ...mondaySchedule, enabled: newSchedule[key].enabled };
    });
    onChange(newSchedule);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {DAYS.map(({ key, label }) => (
          <div
            key={key}
            className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card"
          >
            <div className="flex items-center gap-3 min-w-[140px]">
              <Checkbox
                checked={schedule[key].enabled}
                onCheckedChange={(checked) =>
                  handleDayToggle(key, checked as boolean)
                }
              />
              <Label className="text-sm font-medium text-text-primary cursor-pointer">
                {label}
              </Label>
            </div>

            {schedule[key].enabled ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  type="time"
                  value={schedule[key].start}
                  onChange={(e) => handleTimeChange(key, 'start', e.target.value)}
                  className="max-w-[120px]"
                />
                <span className="text-sm text-text-secondary">to</span>
                <Input
                  type="time"
                  value={schedule[key].end}
                  onChange={(e) => handleTimeChange(key, 'end', e.target.value)}
                  className="max-w-[120px]"
                />
              </div>
            ) : (
              <span className="text-sm text-text-muted italic">Unavailable</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={copyMondayToWeekdays}
          className="flex items-center gap-2"
        >
          <Copy className="w-3 h-3" />
          Copy Monday to all weekdays
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={applySameHoursToAll}
          className="flex items-center gap-2"
        >
          <Copy className="w-3 h-3" />
          Apply same hours to all days
        </Button>
      </div>
    </div>
  );
}
