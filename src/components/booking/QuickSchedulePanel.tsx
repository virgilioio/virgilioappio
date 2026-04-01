import { format, parseISO, getHours } from 'date-fns';
import { Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TimeSlot {
  start: string;
  end: string;
}

interface SmartSlot extends TimeSlot {
  label?: string;
}

interface QuickSchedulePanelProps {
  availableSlots: TimeSlot[];
  onQuickSelect: (slot: TimeSlot) => void;
  maxSlots?: number;
}

function scoreSlotHour(hour: number): number {
  // Golden hours: 10-11 AM, 2-3 PM
  if (hour === 10 || hour === 11 || hour === 14 || hour === 15) return 3;
  // Good hours: 9 AM-12 PM, 1-5 PM
  if ((hour >= 9 && hour <= 12) || (hour >= 13 && hour <= 17)) return 2;
  // Edge hours
  return 1;
}

function selectSmartSlots(slots: TimeSlot[], max: number): SmartSlot[] {
  if (slots.length === 0) return [];

  const result: SmartSlot[] = [{ ...slots[0], label: 'Earliest available' }];
  if (slots.length === 1 || max <= 1) return result;

  const firstDay = slots[0].start.slice(0, 10);

  // Group remaining slots by day
  const dayMap = new Map<string, TimeSlot[]>();
  for (const slot of slots) {
    const day = slot.start.slice(0, 10);
    if (day === firstDay) continue;
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day)!.push(slot);
  }

  // Sort days chronologically, pick best slot per day
  const sortedDays = [...dayMap.keys()].sort();
  for (const day of sortedDays) {
    if (result.length >= max) break;
    const daySlots = dayMap.get(day)!;
    const best = daySlots.reduce((a, b) => {
      const scoreA = scoreSlotHour(getHours(parseISO(a.start)));
      const scoreB = scoreSlotHour(getHours(parseISO(b.start)));
      return scoreB > scoreA ? b : a;
    });
    result.push(best);
  }

  return result;
}

export function QuickSchedulePanel({ 
  availableSlots, 
  onQuickSelect, 
  maxSlots = 5 
}: QuickSchedulePanelProps) {
  const quickSlots = selectSmartSlots(availableSlots, maxSlots);

  if (quickSlots.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-virgilio-purple" />
        <h3 className="text-sm font-semibold text-virgilio-text">Quick Schedule</h3>
      </div>
      <p className="text-xs text-virgilio-muted">
        Smart suggestions based on optimal interview times.
      </p>
      <div className="space-y-2">
        {quickSlots.map((slot, idx) => {
          const startDate = parseISO(slot.start);
          return (
            <button
              key={idx}
              onClick={() => onQuickSelect(slot)}
              className="
                w-full flex items-center justify-between p-3 rounded-lg
                border border-virgilio-border bg-white
                hover:border-virgilio-purple/50 hover:bg-virgilio-purple/5
                hover:-translate-y-0.5 hover:shadow-sm
                transition-all duration-200 ease-out
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple focus-visible:ring-offset-2
                group
              "
            >
              <div className="text-left">
                {slot.label && (
                  <Badge variant="default" className="mb-1 bg-virgilio-purple/10 text-virgilio-purple border-0 text-[10px] px-1.5 py-0">
                    {slot.label}
                  </Badge>
                )}
                <p className="text-sm font-semibold text-virgilio-text">
                  {format(startDate, 'EEE, MMM d')}
                </p>
                <p className="text-xs text-virgilio-muted">
                  {format(startDate, 'h:mm a')}
                </p>
              </div>
              <div className="text-xs font-medium text-virgilio-purple opacity-0 group-hover:opacity-100 transition-opacity">
                Select →
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
