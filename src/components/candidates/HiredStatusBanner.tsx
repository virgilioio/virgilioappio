import { format } from 'date-fns';
import { CheckCircle2 } from 'lucide-react';

interface HiredStatusBannerProps {
  hiredAt: string | null;
  hiredByName?: string;
  jobTitle?: string;
  candidateSource?: string;
}

export function HiredStatusBanner({
  hiredAt,
  hiredByName,
  jobTitle,
  candidateSource,
}: HiredStatusBannerProps) {
  return (
    <div 
      className="rounded-lg p-4 flex items-center gap-3"
      style={{ backgroundColor: 'hsl(152, 57%, 28%)' }}
    >
      <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-white">Candidate Hired</p>
        <p className="text-xs text-white/80">
          {jobTitle || 'Unknown position'}
          {hiredAt && ` • ${format(new Date(hiredAt), 'MMM d, yyyy')}`}
        </p>
        <p className="text-xs text-white/70">
          {candidateSource ? `Source: ${candidateSource}` : 'Source: Unknown'}
          {hiredByName && ` • Recruiter: ${hiredByName}`}
        </p>
      </div>
    </div>
  );
}
