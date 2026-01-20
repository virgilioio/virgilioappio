import { format } from 'date-fns';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OfferStatusBannerProps {
  offeredAt: string | null;
  offeredByName?: string;
  onCreateOffer: () => void;
}

export function OfferStatusBanner({
  offeredAt,
  offeredByName,
  onCreateOffer,
}: OfferStatusBannerProps) {
  return (
    <div 
      className="rounded-lg p-4 flex items-center justify-between"
      style={{ backgroundColor: '#2a3f66' }}
    >
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-white">Candidate at Offer Stage</p>
        <p className="text-xs text-white/80">
          {offeredAt 
            ? `Moved to offer on ${format(new Date(offeredAt), 'MMM d, yyyy')}`
            : 'Currently in offer stage'}
          {offeredByName && ` • By ${offeredByName}`}
        </p>
      </div>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={onCreateOffer}
        className="bg-white hover:bg-white/90 text-foreground border-0"
      >
        <FileText className="h-4 w-4 mr-2" />
        Create Offer
      </Button>
    </div>
  );
}
