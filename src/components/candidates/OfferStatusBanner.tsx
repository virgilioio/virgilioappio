import { Hourglass, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMovedHere } from './statusBannerUtils';

interface OfferStatusBannerProps {
  offeredAt: string | null;
  offeredByName?: string;
  onCreateOffer: () => void;
}

export function OfferStatusBanner({ offeredAt, onCreateOffer }: OfferStatusBannerProps) {
  return (
    <div className="rounded-2xl bg-text-primary text-white px-5 py-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
          <Hourglass className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-poppins font-semibold uppercase text-[10.5px] tracking-[0.06em] text-virgilio-purple/80">
            Offer stage
            {offeredAt && <span className="text-white/40 normal-case tracking-normal font-normal"> · Moved here {formatMovedHere(offeredAt)}</span>}
          </p>
          <p className="font-poppins font-semibold text-[15px] tracking-[-0.01em] text-white mt-0.5 truncate">
            Ready to send an offer.
          </p>
          <p className="font-inter text-[12.5px] text-white/70 truncate">
            The team has aligned. Build the offer once and we'll route approvals automatically.
          </p>
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={onCreateOffer} icon={Plus} className="shrink-0">
        Create offer
      </Button>
    </div>
  );
}
