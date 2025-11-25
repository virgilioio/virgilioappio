import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface InterviewDurationSelectorProps {
  value: number;
  onChange: (duration: number) => void;
}

export function InterviewDurationSelector({ value, onChange }: InterviewDurationSelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="duration-select">Interview Duration</Label>
      <Select value={value.toString()} onValueChange={(v) => onChange(parseInt(v))}>
        <SelectTrigger id="duration-select" className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="15">15 minutes</SelectItem>
          <SelectItem value="30">30 minutes</SelectItem>
          <SelectItem value="60">60 minutes</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
