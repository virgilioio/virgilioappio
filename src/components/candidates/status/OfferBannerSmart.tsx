import { Hourglass, Plus, Bell, CheckCircle2, Lock, PenLine, TriangleAlert } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { StatusBanner } from './StatusBanner';
import { formatMovedHere } from '../statusBannerUtils';
import { useOfferFormFields } from '@/hooks/useOfferFormFields';
import { useOfferApprovalSummary } from '@/hooks/useOfferApprovalSummary';
import { formatOfferValue } from '@/lib/offerValues';
import { offerSendRefusal } from '@/lib/sign/send';
import { signersOf } from '@/lib/sign/status';

interface OfferBannerSmartProps {
  candidateId: string;
  jobId: string;
  candidateFirstName?: string;
  offeredAt: string | null;
  onCreateOffer: () => void;
  onSendReminder?: () => void;
  onMarkHired?: () => void;
  /** Open the Send for signature sheet for this offer (Gio Sign). */
  onSendOffer?: () => void;
}

export function OfferBannerSmart({
  candidateId,
  jobId,
  candidateFirstName,
  offeredAt,
  onCreateOffer,
  onSendReminder,
  onMarkHired,
  onSendOffer,
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
    const money = formatOfferValue(fv[f.field_name], 'salary', { config: f.field_config as Record<string, unknown> | null });
    if (money) compFragments.push(`${money} ${f.field_label?.toLowerCase() || ''}`.trim());
  }

  // Gio Sign: what the offer's envelope says, and whether it can go out.
  const env = summary.offerEnvelope;
  const lightBtn = { backgroundColor: '#fffcf9', color: '#0d0d09', border: 'none' } as const;
  const ghostBtn = { backgroundColor: 'rgba(255,252,249,0.12)', color: '#fffcf9', border: '1px solid rgba(255,252,249,0.22)' } as const;
  const openOfferButton = (
    <Button variant="secondary" size="md" onClick={onCreateOffer} style={ghostBtn}>
      Open offer
    </Button>
  );
  const sendOfferButton = onSendOffer ? (
    <Button
      variant="secondary"
      size="md"
      icon={summary.canSend ? PenLine : Lock}
      onClick={summary.canSend ? onSendOffer : undefined}
      disabled={!summary.canSend}
      title={summary.canSend ? undefined : offerSendRefusal(summary.gate?.reason)}
      style={summary.canSend ? lightBtn : { ...lightBtn, opacity: 0.45, cursor: 'not-allowed', boxShadow: 'none' }}
    >
      Send for signature
    </Button>
  ) : null;

  // Out for signature, or signed by everyone.
  if (env && ['queued', 'scheduled', 'sent', 'completed'].includes(env.status)) {
    const signers = signersOf(env);
    const done = signers.filter((r) => r.status === 'signed').length;
    const next = signers.find((r) => r.status !== 'signed');
    const signedAll = env.status === 'completed';
    const metaParts: string[] = [];
    if (env.status === 'scheduled' && env.scheduled_at) metaParts.push(`Sends ${formatMovedHere(env.scheduled_at)}`);
    else if (env.sent_at) {
      const dd = differenceInDays(new Date(), new Date(env.sent_at));
      metaParts.push(dd === 0 ? 'Sent today' : `Sent ${dd}d ago`);
    } else if (signedAll && env.completed_at) metaParts.push(`Signed ${formatMovedHere(env.completed_at)}`);
    metaParts.push(signedAll ? `${signers.length} of ${signers.length} signed` : `${done} of ${signers.length} signed`);
    const subParts: string[] = [];
    if (compFragments.length) subParts.push(compFragments.join(' · '));
    subParts.push(env.title);
    if (env.out_of_date) subParts.push('the offer changed after it went out');
    return (
      <StatusBanner
        tone="offer"
        icon={signedAll ? CheckCircle2 : env.out_of_date ? TriangleAlert : Hourglass}
        eyebrow={signedAll ? 'Offer · signed' : env.out_of_date ? 'Offer · out of date' : 'Offer · out for signature'}
        meta={metaParts.join(' · ')}
        title={
          signedAll ? (
            <>Offer signed by everyone — <strong className="font-semibold">{candidateFirstName || 'the candidate'}</strong> is ready to hire</>
          ) : env.out_of_date ? (
            'The offer changed after it was sent — void it and send the new one'
          ) : (
            <>Offer is out for signature — waiting for <strong className="font-semibold">{next?.name || candidateFirstName || 'the candidate'}</strong></>
          )
        }
        sub={subParts.join(' · ')}
        actions={
          <>
            {openOfferButton}
            {markHiredButton}
          </>
        }
      />
    );
  }

  // Declined by a signer.
  if (env?.status === 'declined' || offerLetter.status === 'declined') {
    return (
      <StatusBanner
        tone="offer"
        icon={TriangleAlert}
        eyebrow="Offer · declined"
        meta={env ? `Declined ${formatMovedHere(env.updated_at)}` : undefined}
        title={<><strong className="font-semibold">{candidateFirstName || 'The candidate'}</strong> declined the offer</>}
        sub={compFragments.length ? `${compFragments.join(' · ')} · edit the offer and send it again, or create a new one` : 'Edit the offer and send it again, or create a new one'}
        actions={openOfferButton}
      />
    );
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

  // Ready: the database says it can go out (no chain, or every approver approved).
  if (summary.canSend && onSendOffer) {
    return (
      <StatusBanner
        tone="offer"
        icon={noApprovalChain ? Hourglass : CheckCircle2}
        eyebrow={noApprovalChain ? 'Offer · ready' : 'Offer · approved'}
        meta={noApprovalChain ? 'No approval needed on this job' : totalSteps === 1 ? 'Approved' : `All ${totalSteps} approvals in`}
        title="Offer is ready — send it for signature"
        sub={compSub}
        actions={
          <>
            {sendOfferButton}
            {openOfferButton}
            {markHiredButton}
          </>
        }
      />
    );
  }

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
          {openOfferButton}
          {sendOfferButton}
          {markHiredButton}
        </>
      }
    />
  );
}
