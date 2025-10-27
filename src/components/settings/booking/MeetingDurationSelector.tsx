import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';

interface MeetingDurationSelectorProps {
  value: number;
  onChange: (minutes: number) => void;
}

const COMMON_DURATIONS = [15, 30, 45, 60];

export function MeetingDurationSelector({ value, onChange }: MeetingDurationSelectorProps) {
  const [customValue, setCustomValue] = useState<string>('');
  const isCustom = !COMMON_DURATIONS.includes(value);

  useEffect(() => {
    if (isCustom) {
      setCustomValue(value.toString());
    }
  }, [value, isCustom]);

  const handleRadioChange = (selectedValue: string) => {
    if (selectedValue === 'custom') {
      // If switching to custom, use current custom value or default to 90
      const customMinutes = customValue ? parseInt(customValue) : 90;
      onChange(customMinutes);
    } else {
      onChange(parseInt(selectedValue));
    }
  };

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setCustomValue(newValue);
    
    const minutes = parseInt(newValue);
    if (!isNaN(minutes) && minutes > 0 && minutes <= 480) {
      onChange(minutes);
    }
  };

  const currentSelection = isCustom ? 'custom' : value.toString();

  return (
    <div className="space-y-3">
      <Label>Meeting Duration</Label>
      <RadioGroup value={currentSelection} onValueChange={handleRadioChange}>
        <div className="flex flex-wrap gap-4">
          {COMMON_DURATIONS.map((duration) => (
            <div key={duration} className="flex items-center space-x-2">
              <RadioGroupItem value={duration.toString()} id={`duration-${duration}`} />
              <Label
                htmlFor={`duration-${duration}`}
                className="text-sm font-normal cursor-pointer"
              >
                {duration} min
              </Label>
            </div>
          ))}
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="custom" id="duration-custom" />
            <Label htmlFor="duration-custom" className="text-sm font-normal cursor-pointer">
              Custom:
            </Label>
            <Input
              type="number"
              min="1"
              max="480"
              value={customValue}
              onChange={handleCustomInputChange}
              onFocus={() => {
                if (!isCustom) {
                  handleRadioChange('custom');
                }
              }}
              className="w-20 h-8"
              placeholder="90"
            />
            <span className="text-sm text-text-secondary">min</span>
          </div>
        </div>
      </RadioGroup>
    </div>
  );
}
