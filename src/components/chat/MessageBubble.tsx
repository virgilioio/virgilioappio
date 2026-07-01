import { format } from 'date-fns'
import { Lock, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMessageRow } from '@/hooks/chat/useChatMessages'
import { BookingLinkCard, type BookingCardData } from './BookingLinkCard'

interface MessageBubbleProps {
  message: ChatMessageRow
  authorName?: string | null
  isCandidateView?: boolean
}

/**
 * MessageBubble — spec-exact bubbles for inbound / outbound / internal note.
 *
 * Inbound: left-aligned #F1F0EC bubble, bottom-left corner tightened to 5px.
 * Outbound: right-aligned #0d0d09 bubble, cream text, bottom-right tightened,
 * meta line ends with a purple check-check read receipt.
 * Internal note: centered amber card with a header row and body.
 */
export function MessageBubble({ message, authorName, isCandidateView }: MessageBubbleProps) {
  const isNote = message.direction === 'note'
  const isOutbound = message.direction === 'out'
  const time = message.created_at ? format(new Date(message.created_at), 'h:mm a') : ''
  const isRead = Boolean(message.read_by_recipient_at) && !message._optimistic
  const bookingCard =
    message.parts && typeof message.parts === 'object' && (message.parts as any).kind === 'booking_link'
      ? (message.parts as BookingCardData)
      : null

  if (bookingCard) {
    return (
      <div
        className={cn('flex w-full', isOutbound ? 'justify-end' : 'justify-start')}
        style={{ marginBottom: 16 }}
      >
        <div className={cn('flex flex-col', isOutbound ? 'items-end' : 'items-start')}>
          <BookingLinkCard data={bookingCard} isOutbound={isOutbound} isCandidateView={isCandidateView} />
          <div
            className={cn(
              'flex items-center font-inter',
              isOutbound ? 'justify-end' : 'justify-start',
            )}
            style={{ marginTop: 5, gap: 5, fontSize: 10.5, color: '#8B8F9E' }}
          >
            <span>{message._optimistic ? 'Sending…' : time}</span>
            {isOutbound && !message._optimistic && (
              <CheckCheck
                style={{ height: 13, width: 13, color: isRead ? '#6F3FF5' : '#8B8F9E' }}
                strokeWidth={2}
                aria-label={isRead ? 'Read' : 'Sent'}
              />
            )}
          </div>
        </div>
      </div>
    )
  }

  if (isNote) {
    return (
      <div className="flex justify-center" style={{ margin: '4px 0 18px' }}>
        <div
          style={{
            maxWidth: '82%',
            background: '#FEF8E7',
            border: '1px solid #FDE9B8',
            borderRadius: 12,
            padding: '11px 14px',
          }}
        >
          <div className="flex items-center" style={{ gap: 6, marginBottom: 5 }}>
            <Lock style={{ height: 12, width: 12, color: '#B45309' }} strokeWidth={2} />
            <span
              className="font-inter"
              style={{ fontSize: 11, fontWeight: 600, color: '#B45309' }}
            >
              Internal note · your team only
            </span>
            <span
              className="ml-auto font-inter"
              style={{ fontSize: 10.5, color: '#A98321' }}
            >
              {authorName ? `${authorName} · ${time}` : time}
            </span>
          </div>
          <p
            className="font-inter whitespace-pre-wrap break-words"
            style={{ fontSize: 13, lineHeight: 1.5, color: '#1F2230', margin: 0 }}
          >
            {message.body}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn('flex w-full', isOutbound ? 'justify-end' : 'justify-start')}
      style={{ marginBottom: 16 }}
    >
      <div
        className={cn('flex flex-col', isOutbound ? 'items-end' : 'items-start')}
        style={{ maxWidth: '62%' }}
      >
        <div
          className={cn(
            'font-inter whitespace-pre-wrap break-words',
            message._optimistic && 'opacity-70',
          )}
          style={{
            padding: '11px 15px',
            fontSize: 13.5,
            lineHeight: 1.55,
            borderRadius: 16,
            borderBottomLeftRadius: isOutbound ? 16 : 5,
            borderBottomRightRadius: isOutbound ? 5 : 16,
            background: isOutbound ? '#0d0d09' : '#F1F0EC',
            color: isOutbound ? '#fffcf9' : '#1F2230',
          }}
        >
          {message.body}
        </div>
        <div
          className={cn(
            'flex items-center font-inter',
            isOutbound ? 'justify-end' : 'justify-start',
          )}
          style={{ marginTop: 5, gap: 5, fontSize: 10.5, color: '#8B8F9E' }}
        >
          <span>{message._optimistic ? 'Sending…' : time}</span>
          {isOutbound && !message._optimistic && (
            <CheckCheck
              style={{
                height: 13,
                width: 13,
                color: isRead ? '#6F3FF5' : '#8B8F9E',
              }}
              strokeWidth={2}
              aria-label={isRead ? 'Read' : 'Sent'}
            />
          )}
        </div>
      </div>
    </div>
  )
}
