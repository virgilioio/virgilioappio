import { SearchableSelect } from '@/components/ui/searchable-select';
import { useEffect, useMemo, useState } from 'react';
import { Globe, Clock } from 'lucide-react';

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
      { value: 'America/Mexico_City', label: 'Mexico City (CST)' },
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
  { label: 'Other', options: [{ value: 'UTC', label: 'UTC (Coordinated Universal Time)' }] },
];

const ALL_TIMEZONE_OPTIONS = TIMEZONE_GROUPS.flatMap((group) =>
  group.options.map((option) => ({ ...option, group: group.label }))
);

export function TimezoneSelector({ value, onChange }: TimezoneSelectorProps) {
  const [currentTime, setCurrentTime] = useState<string>('');

  const browserTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return '';
    }
  }, []);

  const showMismatch = !!browserTz && !!value && browserTz !== value;

  useEffect(() => {
    const updateTime = () => {
      try {
        const timeString = new Intl.DateTimeFormat('en-US', {
          timeZone: value,
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).format(new Date());
        setCurrentTime(timeString);
      } catch {
        setCurrentTime('');
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [value]);

  return (
    <div className="space-y-3">
      {showMismatch && (
        <div
          className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5"
          style={{ background: '#FAF8FF', border: '1px solid #EDE4FF' }}
        >
          <Globe className="w-4 h-4 text-[#6F3FF5] shrink-0" />
          <p className="flex-1 font-inter text-[12px] text-[#1F2230]">
            Your browser is set to{' '}
            <strong className="font-semibold text-[#0d0d09]">{browserTz}</strong>.
          </p>
          <button
            type="button"
            onClick={() => onChange(browserTz)}
            className="shrink-0 font-poppins font-medium text-[11.5px] text-[#6F3FF5] hover:text-[#5B21B6] transition-colors"
          >
            Use this
          </button>
        </div>
      )}
      <div>
        <label className="block font-inter text-[11.5px] font-medium text-[#5A6072] mb-1.5">
          Timezone
        </label>
        <SearchableSelect
          options={ALL_TIMEZONE_OPTIONS}
          value={value}
          onValueChange={onChange}
          placeholder="Select timezone..."
          emptyMessage="No timezone found"
        />
        {currentTime && (
          <p className="mt-1.5 font-inter text-[11px] text-[#8B8F9E] flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Current time · {currentTime}
          </p>
        )}
      </div>
    </div>
  );
}
