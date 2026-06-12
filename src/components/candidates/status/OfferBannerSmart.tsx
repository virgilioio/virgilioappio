import { Hourglass, Plus, Bell, CheckCircle2 } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { StatusBanner } from './StatusBanner';
import { formatMovedHere } from '../statusBannerUtils';
import { useOfferLetters } from '@/hooks/useOfferLetters';
import { useOfferApprovalRequest } from '@/hooks/useOfferApprovalRequest';
import { useOfferFormFields } from '@/hooks/useOfferFormFields';

interface OfferBannerSmartProps {
  candidateId: string;
  jobId: string;
  candidateFirstName?: string;
  offeredAt: string | null;
  onCreateOffer: () => void;
  onSendReminder?: () => void;
  onMarkHired?: () => void;
}

function fmtMoney(v: any): string | null {
  if (v == null) return null;
  let parsed: any = v;
  if (typeof v === 'string') {
    try { parsed = JSON.parse(v); } catch { return v; }
  }
  const amount = parsed?.amount ?? parsed;
  const currency = parsed?.currency || 'USD';
  if (typeof amount === 'number' || (!isNaN(Number(amount)) && amount !== '')) {
    return `${currency} ${Number(amount).toLocaleString()}`;
  }
  return null;
}

export function OfferBannerSmart({
  candidateId,
  jobId,
  candidateFirstName,
  offeredAt,
  onCreateOffer,
  onSendReminder,
  onMarkHired,
}: OfferBannerSmartProps) {
  const { offerLetters } = useOfferLetters(candidateId);
  const offerLetter = offerLetters.find((ol) => ol.job_id === jobId);
  const { fields } = useOfferFormFields(offerLetter?.form_id || undefined);
  const { approvalRequest } = useOfferApprovalRequest(offerLetter?.id, jobId);

  // No offer drafted yet — "Ready to send" state
  if (!offerLetter) {
    return (
      <StatusBanner
        tone="offer"
        icon={Hourglass}
        eyebrow="Offer stage"
        meta={offeredAt ? `Moved here ${formatMovedHere(offeredAt)}` : undefined}
        title="Ready to send an offer"
        sub="The team has aligned. Build the offer once and we'll route approvals automatically."
        actions={
          <Button
            variant="secondary"
            size="md"
            icon={Plus}
            onClick={onCreateOffer}
            style={{
              backgroundColor: '#fffcf9',
              color: '#0d0d09',
              border: 'none',
            }}
          >
            Create offer
          </Button>
        }
      />
    );
  }

  const isSent = ['sent', 'accepted', 'finalized'].includes(offerLetter.status || '');
  const sentAt = (offerLetter as any).sent_at || (offerLetter as any).updated_at;
  const sentDays = sentAt ? differenceInDays(new Date(), new Date(sentAt)) : null;

  // Compose comp fragment from currency-type fields in the form
  const fv = offerLetter.field_values || {};
  const currencyFields = fields.filter((f) => f.field_type === 'currency' || f.field_type === 'salary');
  const compFragments: string[] = [];
  for (const f of currencyFields.slice(0, 3)) {
    const money = fmtMoney(fv[f.field_name]);
    if (money) compFragments.push(`${money} ${f.label?.toLowerCase() || ''}`.trim());
  }

  // Approval progress
  const steps = approvalRequest?.steps || [];
  const approvedCount = steps.filter((s) => s.status === 'approved').length;
  const totalSteps = steps.length;
  const allApproved = totalSteps > 0 && approvedCount === totalSteps;

  if (isSent) {
    const metaParts: string[] = [];
    if (sentDays != null) metaParts.push(sentDays === 0 ? 'Sent today' : `Sent ${sentDays}d ago`);
    if (allApproved) metaParts.push('all approvals in');
    else if (totalSteps > 0) metaParts.push(`${approvedCount}/${totalSteps} approvals`);

    const subParts: string[] = [];
    if (compFragments.length) subParts.push(compFragments.join(' · '));
    subParts.push('built from your Offer Form');
    if (totalSteps > 0) subParts.push(`approved ${approvedCount} of ${totalSteps}`);

    return (
      <StatusBanner
        tone="offer"
        icon={Hourglass}
        eyebrow="Offer"
        meta={metaParts.join(' · ') || undefined}
        title={<>Offer is out — awaiting <strong className="font-semibold">{candidateFirstName || 'candidate'}</strong>'s response</>}
        sub={subParts.join(' · ')}
        actions={
          <>
            {onSendReminder && (
              <Button
                variant="secondary"
                size="md"
                icon={Bell}
                onClick={onSendReminder}
                style={{
                  backgroundColor: 'rgba(255,252,249,0.12)',
                  color: '#fffcf9',
                  border: '1px solid rgba(255,252,249,0.22)',
                }}
              >
                Send reminder
              </Button>
            )}
            {onMarkHired && (
              <Button
                variant="secondary"
                size="md"
                icon={CheckCircle2}
                onClick={onMarkHired}
                style={{ backgroundColor: '#fffcf9', color: '#0d0d09', border: 'none' }}
              >
                Mark hired
              </Button>
            )}
          </>
        }
      />
    );
  }

  // Draft / pending approval
  const isPending = offerLetter.status === 'pending_approval';
  return (
    <StatusBanner
      tone="offer"
      icon={Hourglass}
      eyebrow="Offer"
      meta={isPending ? `In approval · ${approvedCount}/${totalSteps}` : 'Draft'}
      title={isPending ? 'Awaiting internal approvals' : 'Offer drafted — review and submit'}
      sub={
        compFragments.length
          ? `${compFragments.join(' · ')} · built from your Offer Form`
          : 'Built from your Offer Form'
      }
      actions={
        <Button
          variant="secondary"
          size="md"
          onClick={onCreateOffer}
          style={{
            backgroundColor: 'rgba(255,252,249,0.12)',
            color: '#fffcf9',
            border: '1px solid rgba(255,252,249,0.22)',
          }}
        >
          Open offer
        </Button>
      }
    />
  );
}
