/**
 * The unactioned call to action from a shared dossier — first element in Job
 * Overview, above the stage card, in the exact anatomy of "Scorecard required to
 * advance" so recruiters already know how to read it.
 *
 * It retires the moment the verdict is resolved. A "Schedule" banner still sitting
 * there after the interview is booked teaches recruiters to ignore banners.
 */
import { CalendarCheck, Eye, MessageSquareQuote, Send, X } from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'

import { Button } from '@/components/ui/button'
import type { ClientVerdict } from '@/hooks/useClientVerdict'

interface ClientVerdictBannerProps {
  verdict: ClientVerdict
  onFollowUp?: () => void
  onSchedule?: () => void
  onTalentPool?: () => void
  onDismiss?: () => void
}

const ago = (value: string | null) =>
  value ? `${formatDistanceToNowStrict(new Date(value))} ago` : null

export function ClientVerdictBanner({
  verdict,
  onFollowUp,
  onSchedule,
  onTalentPool,
  onDismiss,
}: ClientVerdictBannerProps) {
  if (verdict.state === 'none' || verdict.resolvedAt) return null

  const addr = verdict.sentTo || 'the client'
  const opens = verdict.viewCount === 1 ? 'opened once' : `opened ${verdict.viewCount} times`

  const config = (() => {
    switch (verdict.state) {
      case 'sent':
        return {
          icon: Send,
          title: 'Dossier sent to the client',
          badge: null as string | null,
          meta: `Sent to ${addr}${verdict.sentBy ? ` by ${verdict.sentBy}` : ''} · not opened yet`,
          action: onFollowUp ? { label: 'Follow up', onClick: onFollowUp, primary: false } : null,
          bg: '#FBFAF7',
          border: '#E7E5DC',
          chipBg: '#F1F0EC',
          chipFg: '#5A6072',
        }
      case 'viewed':
        return {
          icon: Eye,
          title: 'Opened, no decision yet',
          badge: 'Awaiting the client',
          meta: `Sent to ${addr} · ${opens}${verdict.lastViewedAt ? ` · last ${ago(verdict.lastViewedAt)}` : ''}`,
          action: onFollowUp ? { label: 'Nudge the client', onClick: onFollowUp, primary: false } : null,
          bg: '#FFFBEB',
          border: '#F5E3B3',
          chipBg: '#FEF3C7',
          chipFg: '#8A5306',
        }
      case 'requested':
        return {
          icon: CalendarCheck,
          title: 'Client requested an interview',
          badge: 'Client said yes',
          meta: `Answered ${ago(verdict.answeredAt)} from the link sent to ${addr} · ${opens}`,
          action: onSchedule ? { label: 'Schedule', onClick: onSchedule, primary: true } : null,
          bg: '#F2FBF5',
          border: '#C6E9D3',
          chipBg: '#D1FAE5',
          chipFg: '#0B6E4F',
        }
      default:
        return {
          icon: MessageSquareQuote,
          title: 'Client marked them not a fit',
          badge: 'Client passed',
          meta: `Answered ${ago(verdict.answeredAt)} from the link sent to ${addr}`,
          action: onTalentPool ? { label: 'Move to talent pool', onClick: onTalentPool, primary: false } : null,
          bg: '#FBFAF7',
          border: '#E0DDD3',
          chipBg: '#F1F0EC',
          chipFg: '#5A6072',
        }
    }
  })()

  const Icon = config.icon

  return (
    <div
      className="flex items-start gap-3"
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
        borderRadius: 12,
        padding: '11px 14px',
      }}
    >
      <span
        className="flex shrink-0 items-center justify-center"
        style={{ width: 28, height: 28, borderRadius: 8, background: config.chipBg, color: config.chipFg }}
      >
        <Icon size={14} strokeWidth={2.25} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-poppins text-[12.5px] font-semibold tracking-[-0.01em] text-[#1F2230]">
            {config.title}
          </span>
          {config.badge && (
            <span
              className="inline-flex items-center rounded-full px-2 py-[1px] font-inter text-[10.5px] font-semibold"
              style={{ background: config.chipBg, color: config.chipFg }}
            >
              {config.badge}
            </span>
          )}
        </div>

        <div className="mt-0.5 font-inter text-[11px] text-[#5A6072]">{config.meta}</div>

        {verdict.reasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {verdict.reasons.map((reason) => (
              <span
                key={reason}
                className="inline-flex items-center font-inter text-[10.5px] font-medium"
                style={{ background: config.chipBg, color: config.chipFg, borderRadius: 5, padding: '2px 7px' }}
              >
                {reason}
              </span>
            ))}
          </div>
        )}

        {verdict.note && (
          <p
            className="mt-2 line-clamp-2 pl-2.5 font-inter text-[12px] leading-[1.55] text-[#1F2230]"
            style={{ borderLeft: `2px solid ${config.border}` }}
          >
            {verdict.note}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {config.action && (
          <Button
            variant={config.action.primary ? 'primary' : 'secondary'}
            size="sm"
            onClick={config.action.onClick}
          >
            {config.action.label}
          </Button>
        )}
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={X}
            aria-label="Dismiss this client update"
            onClick={onDismiss}
          />
        )}
      </div>
    </div>
  )
}
