import { CalendarClock, CalendarCheck, Send, Check, ExternalLink } from 'lucide-react'

export interface BookingCardData {
  kind: 'booking_link'
  variant: 'job' | 'personal' | 'custom'
  url: string
  title: string
  meta: string
  status?: 'awaiting' | 'booked'
  bookedAt?: string | null
  bookedSlotLabel?: string | null
}

interface Props {
  data: BookingCardData
  isOutbound: boolean
  isCandidateView?: boolean
}

/**
 * BookingLinkCard — a distinct message type inserted into the thread when a
 * recruiter sends a booking link. Two states: Awaiting (default) and Booked.
 */
export function BookingLinkCard({ data, isOutbound, isCandidateView }: Props) {
  const booked = data.status === 'booked'
  const tileBg = booked ? '#D1FAE5' : '#EDE4FF'
  const tileFg = booked ? '#0F8A5B' : '#6F3FF5'
  const Icon = booked ? CalendarCheck : CalendarClock

  const displayMeta =
    booked && data.bookedSlotLabel ? `Confirmed · ${data.bookedSlotLabel}` : data.meta

  return (
    <div
      style={{
        width: 300,
        maxWidth: '72%',
        background: '#FFFFFF',
        border: '1px solid #E7E8EE',
        borderRadius: 16,
        borderBottomRightRadius: isOutbound ? 5 : 16,
        borderBottomLeftRadius: isOutbound ? 16 : 5,
        boxShadow: '0 1px 2px rgba(15,18,34,0.04)',
        overflow: 'hidden',
      }}
    >
      {/* Body */}
      <div className="flex items-center" style={{ padding: '13px 14px', gap: 11 }}>
        <span
          className="flex items-center justify-center shrink-0"
          style={{ height: 38, width: 38, borderRadius: 10, background: tileBg, color: tileFg }}
        >
          <Icon style={{ height: 19, width: 19 }} strokeWidth={2} />
        </span>
        <div className="flex-1 min-w-0">
          <div
            className="font-poppins truncate"
            style={{ fontSize: 13, fontWeight: 600, color: '#0d0d09' }}
          >
            {data.title}
          </div>
          <div
            className="font-inter truncate"
            style={{ marginTop: 2, fontSize: 11, color: '#8B8F9E' }}
          >
            {displayMeta}
          </div>
        </div>
      </div>

      {/* Book a time — candidate view only, Awaiting */}
      {isCandidateView && !booked && data.url && (
        <a
          href={data.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center font-poppins"
          style={{
            margin: '0 14px 12px',
            height: 34,
            borderRadius: 8,
            background: '#0d0d09',
            color: '#fffcf9',
            fontSize: 12.5,
            fontWeight: 600,
            gap: 6,
            textDecoration: 'none',
          }}
        >
          <ExternalLink style={{ height: 13, width: 13 }} strokeWidth={2} />
          Book a time
        </a>
      )}

      {/* Footer */}
      <div
        className="flex items-center"
        style={{
          borderTop: '1px solid #F1F0EC',
          padding: '9px 14px',
          gap: 7,
        }}
      >
        {booked ? (
          <>
            <Check style={{ height: 13, width: 13, color: '#0F8A5B' }} strokeWidth={2.25} />
            <span
              className="font-inter"
              style={{ fontSize: 11.5, color: '#0F8A5B', fontWeight: 500 }}
            >
              Booked — added to the pipeline
            </span>
          </>
        ) : (
          <>
            <Send style={{ height: 13, width: 13, color: '#5A6072' }} strokeWidth={2} />
            <span className="font-inter" style={{ fontSize: 11.5, color: '#5A6072' }}>
              {isCandidateView
                ? 'Pick a time that works for you'
                : 'Sent · waiting for the candidate to pick a time'}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
