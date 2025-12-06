import { useRejectionReasons, RejectionReason } from '@/hooks/useRejectionReasons';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface RejectionReasonSelectorProps {
  value: string | undefined;
  onValueChange: (value: string) => void;
}

export function RejectionReasonSelector({ value, onValueChange }: RejectionReasonSelectorProps) {
  const { reasons, isLoading } = useRejectionReasons('organization');

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  // Group reasons by category
  const recruiterRejected = reasons.filter(r => r.category === 'recruiter_rejected');
  const candidateDeclined = reasons.filter(r => r.category === 'candidate_declined');

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select a reason..." />
      </SelectTrigger>
      <SelectContent>
        {recruiterRejected.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              We Rejected Them
            </SelectLabel>
            {recruiterRejected.map((reason) => (
              <SelectItem key={reason.id} value={reason.id}>
                {reason.name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        
        {candidateDeclined.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">
              They Declined
            </SelectLabel>
            {candidateDeclined.map((reason) => (
              <SelectItem key={reason.id} value={reason.id}>
                {reason.name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        
        {reasons.length === 0 && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            No rejection reasons configured
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
