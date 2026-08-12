import { Hourglass, Plus, Bell, CheckCircle2, Lock } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { StatusBanner } from './StatusBanner';
import { formatMovedHere } from '../statusBannerUtils';
import { useOfferFormFields } from '@/hooks/useOfferFormFields';
import { useOfferApprovalSummary } from '@/hooks/useOfferApprovalSummary';

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
  const summary = useOfferApprovalSummary(candidateId, jobId);
  const offerLetter = summary.offerLetter;
  const { fields } = useOfferFormFields(offerLetter?.form_id || undefined);
  const noApprovalChain = !summary.chainConfigured;
  const canMarkHired = summary.canMarkHired;
  const gated = summary.gated;

  const markHiredButton = onMarkHired ? (
    <Button
      variant="secondary"
      size="md"
      icon={canMarkHired ? CheckCircle2 : Lock}
      onClick={canMarkHired ? onMarkHired : undefined}
      disabled={!canMarkHired}
      style={
        canMarkHired
          ? { backgroundColor: '#fffcf9', color: '#0d0d09', border: 'none' }
          : {
              backgroundColor: '#fffcf9',
              color: '#0d0d09',
              border: 'none',
              opacity: 0.45,
              cursor: 'not-allowed',
              boxShadow: 'none',
            }
      }
    >
      Mark hired
    </Button>
  ) : null;

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
          <>
            <Button
              variant="secondary"
              size="md"
              icon={Plus}
              onClick={onCreateOffer}
              style={
                noApprovalChain
                  ? {
                      backgroundColor: 'rgba(255,252,249,0.12)',
                      color: '#fffcf9',
                      border: '1px solid rgba(255,252,249,0.22)',
                    }
                  : { backgroundColor: '#fffcf9', color: '#0d0d09', border: 'none' }
              }
            >
              Create offer
            </Button>
            {noApprovalChain && markHiredButton}
          </>
        }
      />
    );
  }

  const isSent = ['sent', 'accepted', 'finalized'].includes(offerLetter.status || '');
  const sentAt = (offerLetter as any).sent_at || (offerLetter as any).updated_at;
  const sentDays = sentAt ? differenceInDays(new Date(), new Date(sentAt)) : null;

  // Compose comp fragment from currency-type fields in the form
  const fv = offerLetter.field_values || {};
  const currencyFields = fields.filter((f) => f.field_type === 'salary');
  const compFragments: string[] = [];
  for (const f of currencyFields.slice(0, 3)) {
    const money = fmtMoney(fv[f.field_name]);
    if (money) compFragments.push(`${money} ${f.field_label?.toLowerCase() || ''}`.trim());
  }

  // Approval progress
  const approvedCount = summary.approved;
  const totalSteps = summary.total;
  const allApproved = totalSteps > 0 && approvedCount === totalSteps;

  if (isSent) {
    const metaParts: string[] = [];
    if (sentDays != null) metaParts.push(sentDays === 0 ? 'Sent today' : `Sent ${sentDays}d ago`);
    if (noApprovalChain) metaParts.push('no approval needed');
    else if (allApproved) metaParts.push('all approvals in');
    else metaParts.push(`${approvedCount}/${totalSteps} approvals`);

    const subParts: string[] = [];
    if (compFragments.length) subParts.push(compFragments.join(' · '));
    subParts.push('built from your Offer Form');
    if (noApprovalChain) subParts.push('this job has no approval chain');
    else subParts.push(`approved ${approvedCount} of ${totalSteps}`);

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
            {markHiredButton}
          </>
        }
      />
    );
  }

  // Draft / pending approval
  const isPending = offerLetter.status === 'pending_approval';
  const compSub = compFragments.length
    ? `${compFragments.join(' · ')} · built from your Offer Form`
    : 'Built from your Offer Form';
  return (
    <StatusBanner
      tone="offer"
      icon={Hourglass}
      eyebrow={gated ? 'Offer · pending approval' : 'Offer'}
      meta={
        gated
          ? `Requested ${summary.approvalRequest?.created_at ? formatMovedHere(summary.approvalRequest.created_at) : 'recently'} · ${approvedCount} of ${totalSteps} approvals in`
          : isPending
            ? `In approval · ${approvedCount}/${totalSteps}`
            : 'Draft'
      }
      title={
        gated
          ? `Offer is drafted — waiting on ${summary.waitingOnName || 'an approver'}`
          : isPending
            ? 'Awaiting internal approvals'
            : 'Offer drafted — review and submit'
      }
      sub={
        gated
          ? `${compSub} · it can't go out until this job's approval chain clears`
          : compSub
      }
      actions={
        <>
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
          {markHiredButton}
        </>
      }
    />
  );
}
