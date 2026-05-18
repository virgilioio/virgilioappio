import { format } from 'date-fns';
import { XCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMovedHere } from './statusBannerUtils';

interface RejectionStatusBannerProps {
  rejectedAt: string | null;
  rejectedByName?: string;
  rejectionReason?: { id: string; name: string; category: string } | null;
  rejectionNotes?: string | null;
  rejectionEmailScheduledFor?: string | null;
  rejectionEmailSentAt?: string | null;
  onReactivate: () => void;
}

export function RejectionStatusBanner({
  rejectedAt,
  rejectedByName,
  rejectionReason,
  rejectionNotes,
  rejectionEmailScheduledFor,
  rejectionEmailSentAt,
  onReactivate,
}: RejectionStatusBannerProps) {
  if (!rejectedAt) return null;

  const subParts: string[] = [];
  subParts.push(rejectionReason?.name || 'No reason specified');
  subParts.push(format(new Date(rejectedAt), 'MMM d, yyyy'));
  if (rejectedByName) subParts.push(`By ${rejectedByName}`);
  if (rejectionNotes) subParts.push(`"${rejectionNotes}"`);
  else if (rejectionEmailSentAt) subParts.push(`Email sent ${format(new Date(rejectionEmailSentAt), 'MMM d')}`);
  else if (rejectionEmailScheduledFor) subParts.push(`Email scheduled ${format(new Date(rejectionEmailScheduledFor), 'MMM d')}`);

  return (
    <div className="rounded-2xl bg-virgilio-rejected text-white px-5 py-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
          <XCircle className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-poppins font-semibold uppercase text-[10.5px] tracking-[0.06em] text-white/80">
            Rejected
            <span className="text-white/50 normal-case tracking-normal font-normal"> · Moved here {formatMovedHere(rejectedAt)}</span>
          </p>
          <p className="font-poppins font-semibold text-[15px] tracking-[-0.01em] text-white mt-0.5 truncate">
            Candidate rejected.
          </p>
          <p className="font-inter text-[12.5px] text-white/70 truncate">
            {subParts.join(' · ')}
          </p>
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={onReactivate} icon={RotateCcw} className="shrink-0">
        Reactivate
      </Button>
    </div>
  );
}
