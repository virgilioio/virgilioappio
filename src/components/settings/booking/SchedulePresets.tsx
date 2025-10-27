import { Card, CardContent } from '@/components/ui/card';
import { SCHEDULE_PRESETS, WeeklySchedule } from '@/hooks/useBookingConfig';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SchedulePresetsProps {
  onSelectPreset: (schedule: WeeklySchedule) => void;
  currentSchedule: WeeklySchedule;
}

export function SchedulePresets({ onSelectPreset, currentSchedule }: SchedulePresetsProps) {
  const isPresetActive = (presetSchedule: WeeklySchedule): boolean => {
    return JSON.stringify(presetSchedule) === JSON.stringify(currentSchedule);
  };

  const presets = [
    {
      key: 'standardBusiness',
      ...SCHEDULE_PRESETS.standardBusiness,
    },
    {
      key: 'morningPerson',
      ...SCHEDULE_PRESETS.morningPerson,
    },
    {
      key: 'afternoonOnly',
      ...SCHEDULE_PRESETS.afternoonOnly,
    },
    {
      key: 'weekendsToo',
      ...SCHEDULE_PRESETS.weekendsToo,
    },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-text-primary">Quick Presets</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {presets.map((preset) => {
          const isActive = isPresetActive(preset.schedule);
          return (
            <Card
              key={preset.key}
              className={cn(
                'cursor-pointer transition-all hover:border-primary',
                isActive && 'border-primary bg-primary/5'
              )}
              onClick={() => onSelectPreset(preset.schedule)}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <h4 className="text-sm font-semibold text-text-primary">{preset.name}</h4>
                  {isActive && <Check className="w-4 h-4 text-primary" />}
                </div>
                <p className="text-xs text-text-secondary">{preset.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
