import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Briefcase, CheckCheck, ChevronLeft, ChevronRight, Forward, Inbox as InboxIcon, Mail, MailOpen, MoreHorizontal, Paperclip, Reply, ReplyAll, User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconTip } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { Loadable } from '@/components/ui/loadable'
import { SafeHtml } from '@/components/ui/safe-html'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuShortcut, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CandidatePreview, JobPreview } from '@/components/previews/EntityPreview'
import { PersonAvatar } from '@/components/candidates/comments/PersonAvatar'
import { EmailAttachmentsList } from '@/components/candidates/EmailAttachmentsList'
import { LoadError } from '@/components/empty/LoadError'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { cn } from '@/lib/utils'
import {
  bareAddress, displayName, inboxFullTime, inboxTime, type InboxConversation, type InboxMessage,
} from '@/lib/inbox'

export type ReplyMode = 'reply' | 'reply_all' | 'forward'

/** Where the open conversation sits in the list: "7 of 200", newer and older. */
export interface ReaderPosition {
  index: number
  total: number
  onNewer?: () => void
  onOlder?: () => void
}

/**
 * One conversation, oldest first. Earlier messages fold to one line each and
 * open on a click; the latest is open. Reply, Reply all and Forward hand the
 * message to the Gio composer.
 */
export function InboxReader({
  conversation,
  loading,
  error,
  onRetry,
  onBack,
  position,
  onReply,
  onDone,
  onMarkUnread,
  mine,
}: {
  conversation: InboxConversation | null | undefined
  loading: boolean
  error: boolean
  onRetry: () => void
  /** Back to the list (phones use the shell's own back button). */
  onBack?: () => void
  position?: ReaderPosition
  onReply: (message: InboxMessage, mode: ReplyMode) => void
  /** Done, or back to the Inbox when it's done already. */
  onDone: () => void
  onMarkUnread: () => void
  /** Your own addresses, so Reply all leaves you out. */
  mine: string[]
}) {
  const timedOut = useLoadTimeout(loading)

  if (error || timedOut) {
    return (
      <Centered>
        <LoadError what="this conversation" timedOut={timedOut && !error} onRetry={onRetry} compact />
      </Centered>
    )
  }

  if (!loading && conversation === null) {
    return (
      <Centered>
        <p className="font-poppins text-[15px] font-semibold text-[#0d0d09]">This conversation isn't in your Inbox</p>
        <p className="mt-1.5 text-[12.5px] text-[#5A6072]">It may belong to another mailbox, or the candidate was removed.</p>
        {onBack && (
          <Button variant="secondary" size="sm" icon={ArrowLeft} className="mt-4" onClick={onBack}>
            Back to the list
          </Button>
        )}
      </Centered>
    )
  }

  return (
    <Loadable loading={loading || !conversation} skeleton={<ReaderSkeleton />} className="h-full">
      {conversation ? (
        <Conversation
          conversation={conversation}
          onBack={onBack}
          position={position}
          onReply={onReply}
          onDone={onDone}
          onMarkUnread={onMarkUnread}
          mine={mine}
        />
      ) : null}
    </Loadable>
  )
}

function Conversation({
  conversation,
  onBack,
  position,
  onReply,
  onDone,
  onMarkUnread,
  mine,
}: {
  conversation: InboxConversation
  onBack?: () => void
  position?: ReaderPosition
  onReply: (message: InboxMessage, mode: ReplyMode) => void
  onDone: () => void
  onMarkUnread: () => void
  mine: string[]
}) {
  const { thread, messages } = conversation
  const last = messages[messages.length - 1]
  // The latest message is open; earlier ones fold. A new message opens itself.
  const [open, setOpen] = React.useState<Set<string>>(() => new Set(last ? [last.id] : []))
  React.useEffect(() => {
    if (last) setOpen(prev => (prev.has(last.id) ? prev : new Set(prev).add(last.id)))
  }, [last?.id])

  const me = React.useMemo(() => new Set(mine.map(bareAddress)), [mine])
  const others = last
    ? new Set(
        [last.from_address, ...last.to_addresses, ...(last.cc_addresses ?? [])]
          .map(bareAddress)
          .filter(a => a && !me.has(a)),
      )
    : new Set<string>()

  return (
    <article aria-label={thread.subject ?? 'Conversation'} className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-[#F1F0EC] px-5 pt-2.5 pb-3.5">
        <div className="-ml-1.5 flex h-9 items-center gap-1">
          {onBack && (
            <>
              <IconTip label="Back to the list (Esc)">
                <Button variant="ghost" size="sm" iconOnly icon={ArrowLeft} aria-label="Back to the list" onClick={onBack} />
              </IconTip>
              <span aria-hidden className="mx-1 h-4 w-px bg-[#E7E8EE]" />
            </>
          )}
          <IconTip label={thread.done ? 'Move to Inbox' : 'Done (E)'}>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={thread.done ? InboxIcon : CheckCheck}
              aria-label={thread.done ? 'Move to Inbox' : 'Done'}
              onClick={onDone}
            />
          </IconTip>
          <IconTip label="Mark unread (Shift+U)">
            <Button variant="ghost" size="sm" iconOnly icon={Mail} aria-label="Mark unread" onClick={onMarkUnread} />
          </IconTip>
          <DropdownMenu>
            <IconTip label="More">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" iconOnly icon={MoreHorizontal} aria-label="More" />
              </DropdownMenuTrigger>
            </IconTip>
            <DropdownMenuContent align="start" sideOffset={6} className="w-[272px]">
              <DropdownMenuItem asChild>
                <Link to={`/candidates/${thread.candidate_id}`}>
                  <User aria-hidden />
                  <span className="truncate">Open candidate profile</span>
                </Link>
              </DropdownMenuItem>
              {thread.job_id && (
                <DropdownMenuItem asChild>
                  <Link to={`/jobs/${thread.job_id}`}>
                    <Briefcase aria-hidden />
                    <span className="truncate">Open job</span>
                  </Link>
                </DropdownMenuItem>
              )}
              {last && (
                <DropdownMenuItem onSelect={() => onReply(last, 'forward')}>
                  <Forward aria-hidden />
                  <span className="truncate">Forward</span>
                  <DropdownMenuShortcut>F</DropdownMenuShortcut>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {position && (
            <div className="ml-auto flex items-center gap-1">
              <span className="mr-1 tabular-nums text-[12px] text-[#6B7080]">
                {position.index} of {position.total}
              </span>
              <IconTip label="Newer (K)">
                <Button variant="ghost" size="sm" iconOnly icon={ChevronLeft} aria-label="Newer conversation" onClick={position.onNewer} disabled={!position.onNewer} />
              </IconTip>
              <IconTip label="Older (J)">
                <Button variant="ghost" size="sm" iconOnly icon={ChevronRight} aria-label="Older conversation" onClick={position.onOlder} disabled={!position.onOlder} />
              </IconTip>
            </div>
          )}
        </div>
        <div className="mt-2 min-w-0">
          <h2
            className="font-poppins font-semibold text-[#0d0d09] line-clamp-2"
            style={{ fontSize: 19, letterSpacing: '-0.025em', lineHeight: 1.25 }}
          >
            {thread.subject?.trim() || '(No subject)'}
          </h2>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-[#5A6072]">
            <CandidatePreview candidateId={thread.candidate_id}>
              <Link to={`/candidates/${thread.candidate_id}`} className="font-medium text-[#0d0d09] hover:underline truncate max-w-[260px]">
                {thread.candidate_name || 'Unnamed candidate'}
              </Link>
            </CandidatePreview>
            {thread.job_id && thread.job_title && (
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden className="hidden text-[#B5B9C4] sm:inline">·</span>
                <JobPreview jobId={thread.job_id}>
                  <Link to={`/jobs/${thread.job_id}`} className="hover:underline truncate max-w-[260px]">
                    {thread.job_title}
                  </Link>
                </JobPreview>
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <ol className="space-y-2.5">
          {messages.map(m => (
            <li key={m.id}>
              <Message
                m={m}
                open={open.has(m.id)}
                onToggle={() =>
                  setOpen(prev => {
                    const next = new Set(prev)
                    if (next.has(m.id)) next.delete(m.id)
                    else next.add(m.id)
                    return next
                  })
                }
                candidateName={thread.candidate_name}
                me={me}
              />
            </li>
          ))}
        </ol>

        {last && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="md" icon={Reply} onClick={() => onReply(last, 'reply')}>
              Reply
            </Button>
            {others.size > 1 && (
              <Button variant="secondary" size="md" icon={ReplyAll} onClick={() => onReply(last, 'reply_all')}>
                Reply all
              </Button>
            )}
            <Button variant="secondary" size="md" icon={Forward} onClick={() => onReply(last, 'forward')}>
              Forward
            </Button>
          </div>
        )}
      </div>
    </article>
  )
}

function Message({
  m,
  open,
  onToggle,
  candidateName,
  me,
}: {
  m: InboxMessage
  open: boolean
  onToggle: () => void
  candidateName: string
  me: Set<string>
}) {
  const fromYou = m.direction === 'sent' || me.has(bareAddress(m.from_address))
  const sender = fromYou ? 'You' : displayName(m.from_address)
  const recipients = m.to_addresses.map(a => (me.has(bareAddress(a)) ? 'you' : displayName(a))).join(', ')
  const stored = m.attachments.filter(a => a.storagePath)
  const sentOnly = m.attachments.filter(a => !a.storagePath)

  return (
    <div className={cn('rounded-xl border bg-white', open ? 'border-[#E7E8EE]' : 'border-[#F1F0EC]')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <PersonAvatar
          name={fromYou ? displayName(m.from_address) : displayName(m.from_address) || candidateName}
          email={bareAddress(m.from_address)}
          className="h-8 w-8 [&>span]:text-[11px]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#0d0d09]">
              {sender}
              {!fromYou && (
                <span className="ml-1.5 font-normal text-[#6B7080]">{bareAddress(m.from_address)}</span>
              )}
            </span>
            <time dateTime={m.at} title={inboxFullTime(m.at)} className="shrink-0 tabular-nums text-[11.5px] text-[#6B7080]">
              {inboxTime(m.at)}
            </time>
          </div>
          {open ? (
            <div className="mt-0.5 truncate text-[12px] text-[#6B7080]">
              to {recipients || '—'}
              {m.cc_addresses && m.cc_addresses.length > 0 && <> · cc {m.cc_addresses.map(displayName).join(', ')}</>}
            </div>
          ) : (
            <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-[#5A6072]">
              <span className="truncate">{m.snippet?.trim() || m.body_text?.trim().slice(0, 160) || ''}</span>
              {m.attachments.length > 0 && <Paperclip aria-label="Has attachments" className="h-3.5 w-3.5 shrink-0" />}
            </div>
          )}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pl-[60px]">
          {m.body_html ? (
            <SafeHtml
              content={m.body_html}
              className="gio-mail-body max-w-none overflow-x-auto text-[13.5px] leading-[1.6] text-[#1F2230] [&_a]:text-[#6F3FF5] [&_a]:underline [&_img]:max-w-full [&_img]:h-auto [&_table]:max-w-full"
            />
          ) : (
            <div className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.6] text-[#1F2230]">
              {m.body_text?.trim() || m.snippet || ''}
            </div>
          )}
          {stored.length > 0 && (
            <div className="mt-3">
              <EmailAttachmentsList
                attachments={stored.map(a => ({
                  filename: a.filename,
                  mimeType: a.mimeType ?? a.content_type ?? 'application/octet-stream',
                  size: a.size ?? 0,
                  storagePath: a.storagePath!,
                }))}
              />
            </div>
          )}
          {sentOnly.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {sentOnly.map((a, i) => (
                <span key={i} className="inline-flex max-w-[240px] items-center gap-1.5 rounded-lg border border-[#E7E8EE] px-2 py-1 text-[12px] text-[#5A6072]">
                  <Paperclip aria-hidden className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{a.filename}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center px-6 text-center">{children}</div>
}

function ReaderSkeleton() {
  return (
    <div aria-hidden className="px-5 pt-3">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-4 h-5 w-2/3" />
      <Skeleton className="mt-2.5 h-3.5 w-48" />
      <div className="mt-6 space-y-2.5">
        {[0, 1].map(i => (
          <div key={i} className="rounded-xl border border-[#F1F0EC] p-4">
            <div className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
