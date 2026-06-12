import { format, differenceInCalendarDays } from 'date-fns';
import { CheckCircle2, Circle, Clock, FileText, Send, Pen, AlertTriangle, CalendarClock } from 'lucide-react';
import { useOfferLetters } from '@/hooks/useOfferLetters';
import { useOfferApprovalRequest } from '@/hooks/useOfferApprovalRequest';

interface OfferTimelineCardProps {
  candidateId: string;
  jobId: string;
  offeredAt?: string | null;
}

type Tone = 'done' | 'active' | 'pending' | 'warn';

interface Milestone {
  label: string;
  at?: string | null;
  meta?: string;
  tone: Tone;
  icon: typeof CheckCircle2;
}

function fmt(d?: string | null) {
  if (!d) return null;
  try { return format(new Date(d), 'MMM d'); } catch { return null; }
}

export function OfferTimelineCard({ candidateId, jobId, offeredAt }: OfferTimelineCardProps) {
  const { offerLetters } = useOfferLetters(candidateId);
  const offer = offerLetters.find((ol) => ol.job_id === jobId);
  const { approvalRequest } = useOfferApprovalRequest(offer?.id, jobId);

  const milestones: Milestone[] = [];

  if (offeredAt) {
    milestones.push({
      label: 'Moved to Offer stage',
      at: offeredAt,
      tone: 'done',
      icon: CheckCircle2,
    });
  }

  if (offer) {
    milestones.push({
      label: 'Offer drafted',
      at: offer.created_at,
      tone: 'done',
      icon: FileText,
    });

    const steps = approvalRequest?.steps || [];
    const approvedCount = steps.filter((s) => s.status === 'approved').length;
    const total = steps.length;

    if (total > 0) {
      if (approvedCount === total) {
        milestones.push({
          label: 'All approvals complete',
          meta: `${approvedCount}/${total}`,
          tone: 'done',
          icon: CheckCircle2,
        });
      } else if (approvedCount > 0 || offer.status === 'pending_approval') {
        milestones.push({
          label: 'Approvals in progress',
          meta: `${approvedCount}/${total}`,
          tone: 'active',
          icon: Clock,
        });
      } else {
        milestones.push({
          label: 'Approvals',
          meta: `0/${total}`,
          tone: 'pending',
          icon: Circle,
        });
      }
    }

    const isSent = ['sent', 'accepted', 'finalized'].includes(offer.status || '');
    const sentAt = (offer as any).sent_at || (isSent ? offer.updated_at : null);
    milestones.push({
      label: 'Offer sent to candidate',
      at: sentAt,
      tone: isSent ? 'done' : 'pending',
      icon: Send,
    });

    if (offer.status === 'accepted') {
      milestones.push({
        label: 'Offer signed',
        at: offer.updated_at,
        tone: 'done',
        icon: Pen,
      });
    } else if (offer.status === 'declined') {
      milestones.push({
        label: 'Offer declined',
        at: offer.updated_at,
        tone: 'warn',
        icon: AlertTriangle,
      });
    } else if (isSent) {
      milestones.push({
        label: 'Awaiting signature',
        tone: 'active',
        icon: Pen,
      });
    }

    // Offer expiry — only show if explicitly set and offer is still open
    const expiresAt = offer.expires_at;
    const isOpen = !['accepted', 'declined'].includes(offer.status || '');
    if (expiresAt && isOpen) {
      const daysLeft = differenceInCalendarDays(new Date(expiresAt), new Date());
      const overdue = daysLeft < 0;
      const dueSoon = daysLeft >= 0 && daysLeft <= 2;
      milestones.push({
        label: overdue
          ? 'Offer expired'
          : daysLeft === 0
            ? 'Offer expires today'
            : `Offer expires in ${daysLeft}d`,
        at: expiresAt,
        meta: overdue ? `${Math.abs(daysLeft)}d overdue` : undefined,
        tone: overdue ? 'warn' : dueSoon ? 'active' : 'pending',
        icon: overdue ? AlertTriangle : CalendarClock,
      });
    }
  }

  if (!milestones.length) return null;

  const toneStyle = (t: Tone) => {
    switch (t) {
      case 'done':
        return { bg: '#E8F5EE', fg: '#0B6E4F', ring: '#C8E9D6' };
      case 'active':
        return { bg: '#FAF8FF', fg: '#6F3FF5', ring: '#EDE4FF' };
      case 'warn':
        return { bg: '#FDECEE', fg: '#B42318', ring: '#F7D1D4' };
      default:
        return { bg: '#F1F0EC', fg: '#8B8F9E', ring: '#E7E8EE' };
    }
  };

  return (
    <section className="bg-white rounded-[14px] border" style={{ borderColor: '#E7E8EE' }}>
      <header className="px-5 pt-4 pb-3">
        <h3 className="font-poppins font-semibold text-[#0d0d09]" style={{ fontSize: 13, letterSpacing: '-0.02em' }}>
          Offer timeline
        </h3>
      </header>
      <ol className="px-5 pb-4 space-y-0">
        {milestones.map((m, i) => {
          const s = toneStyle(m.tone);
          const Icon = m.icon;
          const isLast = i === milestones.length - 1;
          return (
            <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
              {!isLast && (
                <span
                  aria-hidden
                  className="absolute left-[13px] top-7 bottom-0 w-px"
                  style={{ backgroundColor: '#F1F0EC' }}
                />
              )}
              <span
                className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: s.bg, boxShadow: `inset 0 0 0 1px ${s.ring}` }}
              >
                <Icon className="h-3.5 w-3.5" style={{ color: s.fg }} strokeWidth={2} />
              </span>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="font-inter" style={{ fontSize: 12.5, color: '#1F2230' }}>
                  {m.label}
                </p>
                {(fmt(m.at) || m.meta) && (
                  <p className="font-inter mt-0.5" style={{ fontSize: 11.5, color: '#8B8F9E' }}>
                    {[fmt(m.at), m.meta].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default OfferTimelineCard;
