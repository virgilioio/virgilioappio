import { CheckCircle2, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { formatMovedHere } from './statusBannerUtils';

interface HiredStatusBannerProps {
  hiredAt: string | null;
  hiredByName?: string;
  jobTitle?: string;
  candidateSource?: string;
  onUnhire?: () => void;
}

export function HiredStatusBanner({
  hiredAt,
  hiredByName,
  jobTitle,
  candidateSource,
  onUnhire,
}: HiredStatusBannerProps) {
  return (
    <div
      className="rounded-2xl text-white px-5 py-4 flex items-center justify-between gap-3"
      style={{ backgroundColor: 'hsl(152, 57%, 28%)' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-poppins font-semibold uppercase text-[10.5px] tracking-[0.06em] text-white/80">
            Hired
            {hiredAt && <span className="text-white/50 normal-case tracking-normal font-normal"> · Moved here {formatMovedHere(hiredAt)}</span>}
          </p>
          <p className="font-poppins font-semibold text-[15px] tracking-[-0.01em] text-white mt-0.5 truncate">
            Candidate hired.
          </p>
          <p className="font-inter text-[12.5px] text-white/70 truncate">
            {jobTitle || 'Position'}
            {hiredAt && ` · ${format(new Date(hiredAt), 'MMM d, yyyy')}`}
            {candidateSource && ` · Source: ${candidateSource}`}
            {hiredByName && ` · Recruiter: ${hiredByName}`}
          </p>
        </div>
      </div>
      {onUnhire && (
        <Button variant="secondary" size="sm" onClick={onUnhire} icon={Undo2} className="shrink-0">
          Unhire
        </Button>
      )}
    </div>
  );
}
