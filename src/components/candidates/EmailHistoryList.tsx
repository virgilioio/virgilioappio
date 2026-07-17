import { useEffect, useMemo, useState } from 'react'
import { splitEmailQuote } from '@/utils/emailQuoteSplit'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Archive,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  CornerUpLeft,
  Forward,
  MailOpen,
  MoreHorizontal,
  Paperclip,
  RefreshCw,
  Reply,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import {
  format,
  formatDistanceToNow,
  isThisWeek,
  isToday,
} from 'date-fns'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SafeHtml } from '@/components/ui/safe-html'
import { InlineEmpty } from '@/components/ui/empty-state'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { fixMojibake } from '@/utils/fixMojibake'
import { useEmailLogs } from '@/hooks/useEmailLogs'
import type { EmailHistoryCardEmail } from './EmailHistoryCard'
import { EmailAttachmentsList } from './EmailAttachmentsList'

interface EmailHistoryListProps {
  candidateId: string
  jobId?: string
  candidateFirstName?: string
  onCompose?: () => void
  onReply?: (email: EmailHistoryCardEmail) => void
  onForward?: (email: EmailHistoryCardEmail) => void
}

// ─────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────

type StatusKey = 'sent' | 'delivered' | 'opened' | 'replied' | 'bounced' | 'scheduled'

function resolveStatus(e: EmailHistoryCardEmail): StatusKey | null {
  if (e.direction === 'received') return null
  if (e.replied_at) return 'replied'
  if (e.opened_at) return 'opened'
  switch (e.status) {
    case 'failed':
      return 'bounced'
    case 'pending':
      return 'scheduled'
    case 'delivered':
      return 'delivered'
    case 'sent':
      return 'sent'
    default:
      return null
  }
}

const STATUS_META: Record<StatusKey, { label: string; icon: any; color: string }> = {
  sent: { label: 'Sent', icon: Check, color: '#8B8F9E' },
  delivered: { label: 'Delivered', icon: CheckCheck, color: '#8B8F9E' },
  opened: { label: 'Opened', icon: MailOpen, color: '#12B886' },
  replied: { label: 'Replied', icon: CornerUpLeft, color: '#12B886' },
  bounced: { label: 'Bounced', icon: TriangleAlert, color: '#DC2626' },
  scheduled: { label: 'Scheduled', icon: Clock, color: '#B45309' },
}

function stripHtml(html: string) {
  return html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, '')
}

function decodeEntities(s: string) {
  if (typeof document === 'undefined') return s
  const ta = document.createElement('textarea')
  ta.innerHTML = s
  return ta.value
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

function senderName(email: EmailHistoryCardEmail, candidateFirstName?: string) {
  if (email.direction === 'received') {
    const from = email.from_address || ''
    const match = from.match(/^\s*"?([^"<]+?)"?\s*</)
    if (match) return match[1].trim()
    return candidateFirstName || from.split('@')[0] || 'Candidate'
  }
  return 'You'
}

function bareEmail(addr: string) {
  const m = addr?.match(/<([^>]+)>/)
  return (m ? m[1] : addr || '').trim()
}

type Bucket = { key: string; label: string; emails: EmailHistoryCardEmail[] }

function bucketize(emails: EmailHistoryCardEmail[]): Bucket[] {
  const today: EmailHistoryCardEmail[] = []
  const week: EmailHistoryCardEmail[] = []
  const earlier = new Map<string, EmailHistoryCardEmail[]>()

  for (const e of emails) {
    const d = new Date(e.received_at || e.sent_at || e.created_at)
    if (isToday(d)) today.push(e)
    else if (isThisWeek(d, { weekStartsOn: 1 })) week.push(e)
    else {
      const k = format(d, 'yyyy-MM')
      if (!earlier.has(k)) earlier.set(k, [])
      earlier.get(k)!.push(e)
    }
  }

  const buckets: Bucket[] = []
  if (today.length) buckets.push({ key: 'today', label: 'Today', emails: today })
  if (week.length) buckets.push({ key: 'week', label: 'This week', emails: week })
  Array.from(earlier.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .forEach(([k, list]) => {
      const label = `Earlier · ${format(new Date(list[0].received_at || list[0].sent_at || list[0].created_at), 'MMMM')}`
      buckets.push({ key: k, label, emails: list })
    })
  return buckets
}

// ─────────────────────────────────────────────────────────────
// row
// ─────────────────────────────────────────────────────────────

function EmailRow({
  email,
  candidateFirstName,
  defaultOpen,
  onReply,
  onForward,
}: {
  email: EmailHistoryCardEmail
  candidateFirstName?: string
  defaultOpen?: boolean
  onReply?: (email: EmailHistoryCardEmail) => void
  onForward?: (email: EmailHistoryCardEmail) => void
}) {
  const [open, setOpen] = useState(!!defaultOpen)
  const isInbound = email.direction === 'received'
  const isNew = isInbound && email.is_read === false
  const status = resolveStatus(email)
  const StatusIcon = status ? STATUS_META[status].icon : null
  const displayName = senderName(email, candidateFirstName)
  const relationHint = isInbound ? 'to you' : `to ${candidateFirstName || 'candidate'}`
  const emailDate = email.received_at || email.sent_at || email.created_at
  const ts = new Date(emailDate)
  const timeLabel = isToday(ts)
    ? formatDistanceToNow(ts, { addSuffix: true })
    : format(ts, 'MMM d')

  const attachmentCount = email.attachments?.length ?? 0
  const preview = useMemo(() => {
    const raw =
      email.snippet ||
      email.body_text ||
      (email.body_html ? stripHtml(email.body_html) : '') ||
      ''
    return fixMojibake(decodeEntities(raw)).replace(/\s+/g, ' ').trim().slice(0, 220)
  }, [email.snippet, email.body_text, email.body_html])

  const railColor = isNew
    ? '#6F3FF5'
    : isInbound
    ? '#BAE6FD'
    : 'transparent'

  const borderStyle = isNew
    ? '1px solid #DFCBFB'
    : open
    ? '1px solid #E0DDD3'
    : '1px solid #EDECE6'

  const boxShadow = isNew ? '0 1px 3px rgba(111,63,245,0.10)' : undefined

  const avatarBg = isInbound ? '#0EA5E9' : '#6F3FF5'
  const chipBg = isInbound ? '#E0F2FE' : '#EDE4FF'
  const chipFg = isInbound ? '#0284C7' : '#6F3FF5'
  const ChipIcon = isInbound ? ArrowDownLeft : ArrowUpRight

  return (
    <div
      className="relative bg-white rounded-[12px] overflow-hidden"
      style={{ border: borderStyle, boxShadow }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: railColor,
        }}
      />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left flex items-center gap-3"
        style={{ padding: '12px 14px 12px 17px', cursor: 'pointer' }}
      >
        {/* Avatar + direction chip */}
        <div className="relative shrink-0" style={{ width: 34, height: 34 }}>
          <div
            className="w-[34px] h-[34px] rounded-full flex items-center justify-center font-poppins font-semibold text-[12px] text-white"
            style={{ background: avatarBg }}
          >
            {initials(displayName)}
          </div>
          <div
            className="absolute rounded-full flex items-center justify-center"
            style={{
              width: 16,
              height: 16,
              right: -2,
              bottom: -2,
              background: chipBg,
              boxShadow: '0 0 0 1.5px #fff',
            }}
          >
            <ChipIcon size={10} color={chipFg} strokeWidth={2.4} />
          </div>
        </div>

        {/* Middle */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={cn('font-inter text-[13px] truncate', isNew ? 'font-bold' : 'font-semibold')}
              style={{ color: '#0d0d09' }}
            >
              {displayName}
            </span>
            <span className="font-inter text-[10.5px] shrink-0" style={{ color: '#A8ACB8' }}>
              {relationHint}
            </span>
            {isNew && (
              <span
                className="font-inter font-bold inline-flex items-center"
                style={{
                  background: '#6F3FF5',
                  color: '#fff',
                  borderRadius: 999,
                  fontSize: 9.5,
                  letterSpacing: '0.03em',
                  height: 17,
                  padding: '0 7px',
                }}
              >
                NEW
              </span>
            )}
          </div>
          <div
            className={cn('font-inter text-[12.5px] truncate mt-0.5', isNew ? 'font-semibold' : 'font-medium')}
            style={{ color: '#1F2230' }}
          >
            {fixMojibake(email.subject || '(no subject)')}
          </div>
          {!open && preview && (
            <div
              className="font-inter text-[11.5px] truncate mt-0.5"
              style={{ color: '#8B8F9E' }}
            >
              {preview}
            </div>
          )}
        </div>

        {/* Right */}
        <div className="flex flex-col items-end shrink-0" style={{ gap: 5 }}>
          <span
            className="font-inter text-[11]"
            style={{
              fontSize: 11,
              color: isNew ? '#6F3FF5' : '#8B8F9E',
              fontWeight: isNew ? 600 : 500,
            }}
          >
            {timeLabel}
          </span>
          <div className="flex items-center" style={{ gap: 8 }}>
            {attachmentCount > 0 && (
              <span className="flex items-center gap-0.5 font-inter text-[11px]" style={{ color: '#8B8F9E' }}>
                <Paperclip size={11} />
                {attachmentCount}
              </span>
            )}
            {status && StatusIcon && (
              <span
                className="flex items-center gap-1 font-inter"
                style={{ fontSize: 11, fontWeight: 500, color: STATUS_META[status].color }}
              >
                <StatusIcon size={12} />
                {STATUS_META[status].label}
              </span>
            )}
            <ChevronDown
              size={15}
              color="#B5B9C4"
              style={{
                transition: 'transform 160ms',
                transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </div>
        </div>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid #F1F0EC', padding: '14px 16px 14px 17px' }}>
          <div
            className="flex flex-wrap font-inter"
            style={{ gap: 12, fontSize: 11, color: '#8B8F9E', marginBottom: 10 }}
          >
            <span>
              <span style={{ color: '#5A6072', fontWeight: 500 }}>From:</span>{' '}
              {bareEmail(email.from_address)}
            </span>
            <span>
              <span style={{ color: '#5A6072', fontWeight: 500 }}>To:</span>{' '}
              {email.to_addresses.map(bareEmail).join(', ')}
            </span>
          </div>

          <div
            className="font-inter"
            style={{ fontSize: 12.5, color: '#1F2230', lineHeight: 1.65 }}
          >
            {email.body_html ? (
              <SafeHtml
                content={email.body_html}
                className="prose prose-sm max-w-full dark:prose-invert [&_*]:max-w-full [&_*]:break-words [&_pre]:whitespace-pre-wrap [&_img]:max-w-full [&_a]:break-all"
                style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
              />
            ) : (
              <div className="whitespace-pre-wrap break-words">
                {fixMojibake(email.body_text || email.snippet || 'No content')}
              </div>
            )}
          </div>

          {email.error_message && (
            <div
              className="mt-3 font-inter text-[11.5px]"
              style={{ color: '#DC2626', background: '#FEF2F2', padding: 8, borderRadius: 8 }}
            >
              {email.error_message}
            </div>
          )}

          {email.attachments && email.attachments.length > 0 && (
            <div className="mt-3">
              <EmailAttachmentsList attachments={email.attachments as any} />
            </div>
          )}

          <div className="flex items-center" style={{ gap: 6, marginTop: 14 }}>
            {onReply && (
              <Button
                variant="primary"
                size="sm"
                icon={Reply}
                onClick={(e) => {
                  e.stopPropagation()
                  onReply(email)
                }}
              >
                Reply
              </Button>
            )}
            {onForward && (
              <Button
                variant="secondary"
                size="sm"
                icon={Forward}
                onClick={(e) => {
                  e.stopPropagation()
                  onForward(email)
                }}
              >
                Forward
              </Button>
            )}
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              icon={Sparkles}
              onClick={(e) => {
                e.stopPropagation()
                toast('Summarize is coming soon.')
              }}
            >
              Summarize
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={Archive}
              onClick={(e) => {
                e.stopPropagation()
                toast('Archive is coming soon.')
              }}
            >
              Archive
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// list (renders own card shell)
// ─────────────────────────────────────────────────────────────

export function EmailHistoryList({
  candidateId,
  jobId,
  candidateFirstName,
  onCompose,
  onReply,
  onForward,
}: EmailHistoryListProps) {
  const { data: emails, isLoading, refetch, isFetching, dataUpdatedAt } = useEmailLogs(candidateId, jobId)

  const list = emails ?? []
  const newCount = list.filter(
    (e: any) => e.direction === 'received' && e.is_read === false,
  ).length
  const total = list.length

  const avgResponse = useMemo(() => {
    // pair outbound sent → next inbound reply
    const sorted = [...list].sort((a: any, b: any) => {
      const da = new Date(a.sent_at || a.received_at || a.created_at).getTime()
      const db = new Date(b.sent_at || b.received_at || b.created_at).getTime()
      return da - db
    })
    const gaps: number[] = []
    for (let i = 0; i < sorted.length - 1; i++) {
      const cur: any = sorted[i]
      const next: any = sorted[i + 1]
      if (cur.direction === 'sent' && next.direction === 'received') {
        const ds = new Date(cur.sent_at || cur.created_at).getTime()
        const dr = new Date(next.received_at || next.created_at).getTime()
        if (dr > ds) gaps.push(dr - ds)
      }
    }
    if (!gaps.length) return null
    const avgMs = gaps.reduce((a, b) => a + b, 0) / gaps.length
    const hours = avgMs / 36e5
    if (hours < 1) return `${Math.max(1, Math.round(avgMs / 6e4))}m`
    if (hours < 24) return `${Math.round(hours)}h`
    return `${Math.round(hours / 24)}d`
  }, [list])

  const buckets = useMemo(() => bucketize(list as any), [list])

  const firstUnreadId = useMemo(() => {
    const sorted = [...list].sort(
      (a: any, b: any) =>
        new Date(b.received_at || b.sent_at || b.created_at).getTime() -
        new Date(a.received_at || a.sent_at || a.created_at).getTime(),
    )
    const found = sorted.find(
      (e: any) => e.direction === 'received' && e.is_read === false,
    )
    return (found as any)?.id ?? null
  }, [list])

  const header = (
    <header
      className="flex items-start"
      style={{ padding: '16px 18px', borderBottom: '1px solid #F1F0EC' }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <h3
            className="font-poppins font-semibold truncate"
            style={{ fontSize: 15, color: '#0d0d09', letterSpacing: '-0.02em' }}
          >
            Email history
          </h3>
          {newCount > 0 && (
            <span
              className="inline-flex items-center gap-1 font-inter font-semibold"
              style={{
                background: '#EDE4FF',
                color: '#6F3FF5',
                borderRadius: 999,
                fontSize: 10.5,
                padding: '2px 8px',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  background: '#6F3FF5',
                  display: 'inline-block',
                }}
              />
              {newCount} new
            </span>
          )}
        </div>
        <p className="font-inter mt-1" style={{ fontSize: 11.5, color: '#8B8F9E' }}>
          {total > 0
            ? `${total} messages${candidateFirstName ? ` with ${candidateFirstName}` : ''}${
                avgResponse ? ` · replies in ~${avgResponse}` : ''
              }`
            : 'No messages yet'}
        </p>
      </div>
      <div className="shrink-0 flex items-center" style={{ gap: 8 }}>
        {dataUpdatedAt > 0 && (
          <span className="font-inter" style={{ fontSize: 10.5, color: '#A8ACB8' }}>
            Synced {formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true })}
          </span>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh emails"
        >
          <RefreshCw size={13} className={cn('mr-1', isFetching && 'animate-spin')} />
          Refresh
        </Button>
      </div>
    </header>
  )

  return (
    <section
      className="bg-white overflow-hidden"
      style={{ borderRadius: 16, border: '1px solid #E7E8EE' }}
    >
      {header}
      <div style={{ padding: 16 }}>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : total === 0 ? (
          <InlineEmpty text="No emails yet." />
        ) : (
          <div className="flex flex-col" style={{ gap: 18 }}>
            {buckets.map((b) => (
              <div key={b.key}>
                <div className="flex items-center" style={{ gap: 10, marginBottom: 8 }}>
                  <span
                    className="font-inter font-semibold uppercase"
                    style={{
                      fontSize: 10.5,
                      letterSpacing: '0.07em',
                      color: '#A8ACB8',
                    }}
                  >
                    {b.label}
                  </span>
                  <span className="flex-1 h-px" style={{ background: '#F1F0EC' }} />
                  <span
                    className="font-inter"
                    style={{ fontSize: 10.5, color: '#B5B9C4' }}
                  >
                    {b.emails.length} message{b.emails.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="flex flex-col" style={{ gap: 8 }}>
                  {b.emails.map((e) => (
                    <EmailRow
                      key={e.id}
                      email={e as any}
                      candidateFirstName={candidateFirstName}
                      defaultOpen={e.id === firstUnreadId}
                      onReply={onReply}
                      onForward={onForward}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// keep default export shape stable
export default EmailHistoryList
