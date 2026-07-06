import { SCHEDULE_PRESETS, WeeklySchedule } from '@/hooks/useBookingConfig';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SchedulePresetsProps {
  onSelectPreset: (schedule: WeeklySchedule) => void;
  currentSchedule: WeeklySchedule;
}

export function SchedulePresets({ onSelectPreset, currentSchedule }: SchedulePresetsProps) {
  const isPresetActive = (presetSchedule: WeeklySchedule): boolean =>
    JSON.stringify(presetSchedule) === JSON.stringify(currentSchedule);

  const presets = [
    { key: 'standardBusiness', ...SCHEDULE_PRESETS.standardBusiness },
    { key: 'morningPerson', ...SCHEDULE_PRESETS.morningPerson },
    { key: 'afternoonOnly', ...SCHEDULE_PRESETS.afternoonOnly },
    { key: 'weekendsToo', ...SCHEDULE_PRESETS.weekendsToo },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {presets.map((preset) => {
        const active = isPresetActive(preset.schedule);
        return (
          <button
            key={preset.key}
            type="button"
            onClick={() => onSelectPreset(preset.schedule)}
            className={cn(
              'group text-left rounded-[10px] border bg-white px-3.5 py-3 transition-all',
              active
                ? 'border-[#6F3FF5] bg-[#FAF8FF] shadow-[0_0_0_3px_rgba(111,63,245,0.08)]'
                : 'border-[#E7E8EE] hover:border-[#D7C5FB] hover:bg-[#FAFAF7]'
            )}
            style={active ? { borderWidth: 1.5 } : undefined}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p
                  className="font-poppins font-semibold text-[12.5px] text-[#0d0d09] leading-tight"
                  style={{ letterSpacing: '-0.01em' }}
                >
                  {preset.name}
                </p>
                <p className="font-inter text-[11px] text-[#8B8F9E] mt-0.5 leading-snug">
                  {preset.description}
                </p>
              </div>
              {active && (
                <span className="shrink-0 w-4 h-4 rounded-full bg-[#6F3FF5] flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
