import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';

interface TimezoneSelectorProps {
  value: string;
  onChange: (timezone: string) => void;
}

const TIMEZONE_GROUPS = [
  {
    label: 'North America',
    options: [
      { value: 'America/New_York', label: 'Eastern Time (ET)' },
      { value: 'America/Chicago', label: 'Central Time (CT)' },
      { value: 'America/Denver', label: 'Mountain Time (MT)' },
      { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
      { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
      { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
    ],
  },
  {
    label: 'Europe',
    options: [
      { value: 'Europe/London', label: 'London (GMT)' },
      { value: 'Europe/Paris', label: 'Paris/Berlin (CET)' },
      { value: 'Europe/Athens', label: 'Athens (EET)' },
      { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
    ],
  },
  {
    label: 'Asia',
    options: [
      { value: 'Asia/Dubai', label: 'Dubai (GST)' },
      { value: 'Asia/Kolkata', label: 'India (IST)' },
      { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
      { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
      { value: 'Asia/Seoul', label: 'Seoul (KST)' },
    ],
  },
  {
    label: 'Australia & Pacific',
    options: [
      { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
      { value: 'Australia/Perth', label: 'Perth (AWST)' },
      { value: 'Pacific/Auckland', label: 'Auckland (NZDT)' },
    ],
  },
  {
    label: 'Other',
    options: [
      { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    ],
  },
];

// Flatten all options for searchable select
const ALL_TIMEZONE_OPTIONS = TIMEZONE_GROUPS.flatMap((group) =>
  group.options.map((option) => ({
    ...option,
    group: group.label,
  }))
);

export function TimezoneSelector({ value, onChange }: TimezoneSelectorProps) {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const timeString = new Intl.DateTimeFormat('en-US', {
          timeZone: value,
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).format(now);
        setCurrentTime(timeString);
      } catch (error) {
        setCurrentTime('');
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [value]);

  return (
    <div className="space-y-2">
      <Label htmlFor="timezone">Timezone</Label>
      <SearchableSelect
        options={ALL_TIMEZONE_OPTIONS}
        value={value}
        onValueChange={onChange}
        placeholder="Select timezone..."
        emptyMessage="No timezone found"
      />
      {currentTime && (
        <p className="text-xs text-text-secondary">
          Current time: {currentTime}
        </p>
      )}
    </div>
  );
}
