import { format } from 'date-fns';
import { ThumbsDown, Mail, RotateCcw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RejectionStatusBannerProps {
  rejectedAt: string | null;
  rejectedByName?: string;
  rejectionReason?: { id: string; name: string; category: string } | null;
  rejectionEmailSentAt?: string | null;
  rejectionEmailScheduledFor?: string | null;
  onReactivate: () => void;
}

export function RejectionStatusBanner({
  rejectedAt,
  rejectedByName,
  rejectionReason,
  rejectionEmailSentAt,
  rejectionEmailScheduledFor,
  onReactivate,
}: RejectionStatusBannerProps) {
  if (!rejectedAt) return null;

  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-3">
      <ThumbsDown className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium text-destructive">Candidate Rejected</p>
        <p className="text-xs text-muted-foreground">
          {rejectionReason?.name || 'No reason specified'} • {format(new Date(rejectedAt), 'MMM d, yyyy')}
          {rejectedByName && ` • By ${rejectedByName}`}
        </p>
        {rejectionEmailSentAt && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Mail className="h-3 w-3" /> Rejection email sent on {format(new Date(rejectionEmailSentAt), 'MMM d, yyyy h:mm a')}
          </p>
        )}
        {!rejectionEmailSentAt && rejectionEmailScheduledFor && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Rejection email scheduled for {format(new Date(rejectionEmailScheduledFor), 'MMM d, yyyy h:mm a')}
          </p>
        )}
        {!rejectionEmailSentAt && !rejectionEmailScheduledFor && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Mail className="h-3 w-3 opacity-50" /> No rejection email sent
          </p>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={onReactivate}>
        <RotateCcw className="h-4 w-4 mr-2" /> Reactivate
      </Button>
    </div>
  );
}
