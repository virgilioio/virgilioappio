import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Button } from '@/components/ui/button';
import { useEffect, useMemo, useState } from 'react';
import { Globe, X } from 'lucide-react';

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
  const [dismissed, setDismissed] = useState<boolean>(false);

  const browserTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return '';
    }
  }, []);

  const showMismatch =
    !!browserTz && !!value && browserTz !== value && !dismissed;

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
      {showMismatch && (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <Globe className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <p className="text-foreground">
              Your browser is set to <strong>{browserTz}</strong>.
            </p>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-primary"
              onClick={() => onChange(browserTz)}
            >
              Use this timezone
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
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
