import { format } from 'date-fns';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RejectionStatusBannerProps {
  rejectedAt: string | null;
  rejectedByName?: string;
  rejectionReason?: { id: string; name: string; category: string } | null;
  rejectionNotes?: string | null;
  onReactivate: () => void;
}

export function RejectionStatusBanner({
  rejectedAt,
  rejectedByName,
  rejectionReason,
  rejectionNotes,
  onReactivate,
}: RejectionStatusBannerProps) {
  if (!rejectedAt) return null;

  return (
    <div className="rounded-lg p-4 flex items-center justify-between" style={{ backgroundColor: '#ff4040' }}>
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-white">Candidate Rejected</p>
        <p className="text-xs text-white/80">
          {rejectionReason?.name || 'No reason specified'} • {format(new Date(rejectedAt), 'MMM d, yyyy')}
          {rejectedByName && ` • By ${rejectedByName}`}
        </p>
        {rejectionNotes && (
          <p className="text-xs text-white/70 italic mt-1">"{rejectionNotes}"</p>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={onReactivate} className="bg-white hover:bg-white/90 text-foreground border-0">
        <RotateCcw className="h-4 w-4 mr-2" /> Reactivate
      </Button>
    </div>
  );
}
