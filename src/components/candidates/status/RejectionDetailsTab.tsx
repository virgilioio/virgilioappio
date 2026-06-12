import { format } from 'date-fns';
import { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';

interface RejectionDetailsTabProps {
  rejectedAt: string | null;
  rejectedByName: string | null;
  stageName?: string | null;
  notifiedCandidate?: boolean;
  notifyChannel?: string | null;
  rejectionReason: { id: string; name: string; category: string } | null;
  secondaryReasons?: Array<{ id: string; name: string }>;
  rejectionNotes: string | null;
  rejectionEmailSentAt?: string | null;
  rejectionEmailSubject?: string | null;
  rejectionEmailBody?: string | null;
}

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p
        className="font-inter uppercase mb-1"
        style={{ fontSize: 10.5, letterSpacing: '0.06em', color: '#8B8F9E' }}
      >
        {label}
      </p>
      <p className="font-inter" style={{ fontSize: 13, color: '#1F2230' }}>
        {value || '—'}
      </p>
    </div>
  );
}

function Card({ children, title, subtitle, header }: { children: ReactNode; title: string; subtitle?: string; header?: ReactNode }) {
  return (
    <section className="bg-white rounded-[14px] border" style={{ borderColor: '#E7E8EE' }}>
      <header
        className="flex items-start justify-between gap-3 px-5 py-4 border-b"
        style={{ borderColor: '#F1F0EC' }}
      >
        <div>
          <h3 className="font-poppins font-semibold text-[#0d0d09]" style={{ fontSize: 15, letterSpacing: '-0.02em' }}>
            {title}
          </h3>
          {subtitle && (
            <p className="font-inter mt-0.5" style={{ fontSize: 12, color: '#5A6072' }}>{subtitle}</p>
          )}
        </div>
        {header}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function RejectionDetailsTab({
  rejectedAt,
  rejectedByName,
  stageName,
  notifiedCandidate,
  notifyChannel,
  rejectionReason,
  secondaryReasons = [],
  rejectionNotes,
  rejectionEmailSentAt,
  rejectionEmailSubject,
  rejectionEmailBody,
}: RejectionDetailsTabProps) {
  return (
    <div className="space-y-5">
      <Card
        title="Rejection details"
        subtitle={rejectedByName && rejectedAt ? `Rejected by ${rejectedByName} · ${format(new Date(rejectedAt), 'MMM d, yyyy')}` : undefined}
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <MetaRow label="Rejected by" value={rejectedByName} />
          <MetaRow label="When" value={rejectedAt ? format(new Date(rejectedAt), "MMM d, yyyy · h:mm a") : null} />
          <MetaRow label="Stage" value={stageName} />
          <MetaRow
            label="Notified candidate"
            value={notifiedCandidate ? `Yes${notifyChannel ? ` · ${notifyChannel}` : ''}` : 'No'}
          />
        </div>

        {(rejectionReason || secondaryReasons.length > 0) && (
          <div className="mt-6 pt-5 border-t" style={{ borderColor: '#F1F0EC' }}>
            <p
              className="font-inter uppercase mb-2"
              style={{ fontSize: 10.5, letterSpacing: '0.06em', color: '#8B8F9E' }}
            >
              Reason category
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {rejectionReason && (
                <Badge tone="red" dot>
                  {rejectionReason.name}
                </Badge>
              )}
              {secondaryReasons.map((r) => (
                <Badge key={r.id} tone="neutral">{r.name}</Badge>
              ))}
            </div>
          </div>
        )}

        {rejectionNotes && (
          <div className="mt-6 pt-5 border-t" style={{ borderColor: '#F1F0EC' }}>
            <p
              className="font-inter uppercase mb-2"
              style={{ fontSize: 10.5, letterSpacing: '0.06em', color: '#8B8F9E' }}
            >
              Internal notes
            </p>
            <div
              className="font-inter rounded-[10px] p-4"
              style={{ fontSize: 13, color: '#1F2230', backgroundColor: '#FAFAF7', lineHeight: 1.55 }}
            >
              {rejectionNotes}
            </div>
          </div>
        )}
      </Card>

      {rejectionEmailSentAt && (
        <Card
          title="Rejection email"
          subtitle={`Sent ${format(new Date(rejectionEmailSentAt), "MMM d, yyyy · h:mm a")}`}
        >
          {rejectionEmailSubject && (
            <p className="font-poppins font-semibold mb-3" style={{ fontSize: 13.5, color: '#0d0d09' }}>
              {rejectionEmailSubject}
            </p>
          )}
          <div
            className="font-inter rounded-[10px] p-4 border"
            style={{ fontSize: 13, color: '#1F2230', backgroundColor: '#FAFAF7', borderColor: '#F1F0EC', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}
            dangerouslySetInnerHTML={rejectionEmailBody ? { __html: rejectionEmailBody } : undefined}
          >
            {!rejectionEmailBody ? '—' : null}
          </div>
        </Card>
      )}
    </div>
  );
}
