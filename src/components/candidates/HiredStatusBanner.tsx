import { format } from 'date-fns';
import { CheckCircle2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
      className="rounded-lg p-4 flex items-center justify-between"
      style={{ backgroundColor: 'hsl(152, 57%, 28%)' }}
    >
      <div className="flex items-center gap-3">
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
      {onUnhire && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onUnhire}
          className="bg-white hover:bg-white/90 text-foreground border-0"
        >
          <Undo2 className="h-4 w-4 mr-2" />
          Unhire
        </Button>
      )}
    </div>
  );
}
