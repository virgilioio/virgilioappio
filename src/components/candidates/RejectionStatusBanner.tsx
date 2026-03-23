import { format } from 'date-fns';
import { RotateCcw, Clock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

  return (
    <div className="rounded-lg p-4 flex items-center justify-between bg-virgilio-rejected">
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-white">Candidate Rejected</p>
        <p className="text-xs text-white/80">
          {rejectionReason?.name || 'No reason specified'} • {format(new Date(rejectedAt), 'MMM d, yyyy')}
          {rejectedByName && ` • By ${rejectedByName}`}
        </p>
        {rejectionNotes && (
          <p className="text-xs text-white/70 italic mt-1">"{rejectionNotes}"</p>
        )}
        {rejectionEmailSentAt && (
          <p className="text-xs text-green-200 flex items-center gap-1 mt-1">
            <Mail className="h-3 w-3" />
            Rejection email sent on {format(new Date(rejectionEmailSentAt), 'MMM d, yyyy')}
          </p>
        )}
        {!rejectionEmailSentAt && rejectionEmailScheduledFor && (
          <p className="text-xs text-amber-200 flex items-center gap-1 mt-1">
            <Clock className="h-3 w-3" />
            Rejection email scheduled for {format(new Date(rejectionEmailScheduledFor), "MMM d, yyyy 'at' h:mm a")}
          </p>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={onReactivate} className="bg-white hover:bg-white/90 text-foreground border-0">
        <RotateCcw className="h-4 w-4 mr-2" /> Reactivate
      </Button>
    </div>
  );
}
