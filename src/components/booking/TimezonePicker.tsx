import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Globe } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { timeZoneOptions, zoneCityLabel, zoneOffsetLabel } from '@/lib/timezoneFormat';

interface TimezonePickerProps {
  value: string;
  onChange: (timezone: string) => void;
  /** The browser-detected zone — marked as "Detected" in the list. */
  detected?: string;
  className?: string;
}

export function TimezonePicker({ value, onChange, detected, className }: TimezonePickerProps) {
  const [open, setOpen] = useState(false);

  const options = useMemo(() => timeZoneOptions(value), [value]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof options>();
    options.forEach((opt) => {
      if (!map.has(opt.region)) map.set(opt.region, []);
      map.get(opt.region)!.push(opt);
    });
    return Array.from(map.entries());
  }, [options]);

  const triggerLabel = value
    ? `${zoneCityLabel(value)} · ${zoneOffsetLabel(value) || 'GMT'}`
    : 'Select timezone';

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label="Time zone"
          className={cn(
            'w-full h-9 px-3 rounded-lg border border-virgilio-border bg-white',
            'inline-flex items-center gap-1.5 text-[12.5px] text-virgilio-text',
            'hover:border-virgilio-purple/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30',
            className,
          )}
        >
          <Globe className="h-3.5 w-3.5 text-virgilio-muted shrink-0" />
          <span className="truncate flex-1 text-left">{triggerLabel}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search city or region..." className="h-9 text-[12.5px]" />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>No timezone found.</CommandEmpty>
            {grouped.map(([region, items]) => (
              <CommandGroup key={region} heading={region}>
                {items.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={`${opt.city} ${opt.value} ${opt.offset}`}
                    onSelect={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className="text-[12.5px]"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-3.5 w-3.5',
                        opt.value === value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="flex-1 truncate">{opt.city}</span>
                    {opt.value === detected && (
                      <span className="ml-2 shrink-0 text-[10px] font-poppins font-semibold uppercase tracking-[0.06em] text-virgilio-purple">
                        Detected
                      </span>
                    )}
                    <span className="ml-2 shrink-0 text-[11px] text-virgilio-muted">
                      {opt.offset}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
