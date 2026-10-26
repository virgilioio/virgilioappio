import * as React from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, Check, CheckCheck, ChevronDown, Inbox as InboxIcon, Mail, MailOpen, PenSquare, Plug } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { IconTip } from '@/components/ui/tooltip'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SelectionBar, type SelectionAction } from '@/components/shared/SelectionBar'
import { AnimatedEmpty } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { useToast } from '@/hooks/use-toast'
import { undoToast } from '@/lib/undoToast'
import { floatingLayerOpen } from '@/lib/floatingLayer'
import { MinimizableEmailComposer } from '@/components/candidates/MinimizableEmailComposer'
import { formatForwardedMessage, formatQuotedReply, getForwardSubject, getReplySubject } from '@/utils/emailFormatUtils'
import { InboxFolders, FOLDER_ICONS } from '@/components/inbox/InboxFolders'
import { InboxList, InboxListSkeleton, type RowActions } from '@/components/inbox/InboxList'
import { InboxReader, type ReaderPosition, type ReplyMode } from '@/components/inbox/InboxReader'
import { ComposePicker, type PickedCandidate } from '@/components/inbox/InboxCompose'
import {
  FOLDERS, FOLDER_LABELS, MAX_ROWS, bareAddress, replyAllRecipients, useInboxConversation, useInboxCounts, useInboxMark,
  useInboxThreads, useRefreshInbox, type InboxAction, type InboxFolder, type InboxMessage, type InboxThread,
} from '@/lib/inbox'

/** The list or one conversation, full width. From 1024px the folders sit beside it (icons below 1280px). */
function useWidth() {
  const [w, setW] = React.useState(() => (typeof window === 'undefined' ? 1440 : window.innerWidth))
  React.useEffect(() => {
    const on = () => setW(window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return w
}

interface ComposerState {
  mode: 'compose' | 'reply' | 'forward'
  candidateId: string
  candidateName: string
  to?: string
  cc?: string
  subject?: string
  body?: string
  replyToId?: string
  jobId?: string
}

/** Your connected mailboxes: for Reply all (leave yourself out) and the "connect Gmail" note. */
function useMyMailboxes() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['inbox', user?.id, 'mailboxes'],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_mail_identities')
        .select('email_address, sync_status')
        .eq('user_id', user!.id)
      if (error) throw error
      return data ?? []
    },
  })
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || !!el.closest('[contenteditable="true"]')
}

export default function InboxPage() {
  const { threadId: rawThread } = useParams<{ threadId: string }>()
  const threadId = rawThread ? decodeURIComponent(rawThread) : null
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const width = useWidth()
  const wide = width >= 1280
  const split = width >= 1024
  // From 640px the list is Gmail's, one line a conversation; phones keep three.
  const layout = width >= 640 ? 'line' : 'stacked'

  const folderParam = params.get('folder') as InboxFolder | null
  const folder: InboxFolder = folderParam && FOLDERS.includes(folderParam) ? folderParam : 'inbox'
  const jobId = params.get('job')

  // Search waits 150ms after typing stops (§12).
  const [search, setSearch] = React.useState(params.get('q') ?? '')
  const [query, setQuery] = React.useState(search.trim())
  React.useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 150)
    return () => clearTimeout(t)
  }, [search])

  // A job label shows everything with that job's candidates, whatever the folder.
  const listFolder: InboxFolder = jobId ? 'all' : folder
  const threads = useInboxThreads(listFolder, jobId, query)
  const counts = useInboxCounts()
  const conversation = useInboxConversation(threadId)
  const mark = useInboxMark()
  const refresh = useRefreshInbox()
  const mailboxes = useMyMailboxes()
  const mine = React.useMemo(
    () => [user?.email ?? '', ...(mailboxes.data ?? []).map(m => m.email_address ?? '')].filter(Boolean),
    [user?.email, mailboxes.data],
  )
  const noMailbox = mailboxes.isSuccess && !(mailboxes.data ?? []).some(m => m.sync_status === 'active')

  const rows = React.useMemo(() => threads.data ?? [], [threads.data])
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  // A folder, job or search change starts a new selection.
  React.useEffect(() => setSelected(new Set()), [listFolder, jobId, query])

  const [picking, setPicking] = React.useState(false)
  const [composer, setComposer] = React.useState<ComposerState | null>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)

  const keep = React.useCallback(
    (next: URLSearchParams) => {
      const p = new URLSearchParams(next)
      if (search.trim()) p.set('q', search.trim())
      else p.delete('q')
      return p.toString() ? `?${p.toString()}` : ''
    },
    [search],
  )
  const openThread = (t: { thread_id: string }) => navigate(`/inbox/${encodeURIComponent(t.thread_id)}${keep(params)}`)
  const closeThread = () => navigate(`/inbox${keep(params)}`)
  const goFolder = (f: InboxFolder) => {
    const p = new URLSearchParams()
    if (f !== 'inbox') p.set('folder', f)
    setSelected(new Set())
    navigate(`/inbox${p.toString() ? `?${p}` : ''}`)
  }
  const goJob = (id: string) => navigate(`/inbox?job=${id}`)

  // Opening an unread conversation reads it (also from a link).
  const openThreadData = conversation.data?.thread
  React.useEffect(() => {
    if (openThreadData?.unread) mark.mutate({ threadIds: [openThreadData.thread_id], action: 'read' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openThreadData?.thread_id, openThreadData?.unread])

  const act = (ids: string[], action: InboxAction, opts: { advance?: boolean } = {}) => {
    if (ids.length === 0) return
    // Done and Move to Inbox take the open conversation off this folder: go to the next one.
    let next: InboxThread | undefined
    if (opts.advance && threadId && ids.includes(threadId)) {
      const i = rows.findIndex(r => r.thread_id === threadId)
      next = rows.slice(i + 1).find(r => !ids.includes(r.thread_id)) ?? rows.slice(0, i).reverse().find(r => !ids.includes(r.thread_id))
    }
    mark.mutate(
      { threadIds: ids, action },
      {
        onError: () =>
          toast({
            title: `Couldn't ${action === 'done' ? 'mark that done' : action === 'inbox' ? 'move that to the Inbox' : `mark that ${action}`}`,
            description: 'Check your connection, then try again.',
            variant: 'destructive',
          }),
      },
    )
    setSelected(new Set())
    if (opts.advance && threadId && ids.includes(threadId)) {
      if (next && layout === 'line') openThread(next)
      else closeThread()
    }
    const n = ids.length
    const what = n === 1 ? 'Conversation' : `${n} conversations`
    if (action === 'done') undoToast(`${what} marked done`, () => mark.mutate({ threadIds: ids, action: 'inbox' }))
    if (action === 'inbox') undoToast(`${what} moved to the Inbox`, () => mark.mutate({ threadIds: ids, action: 'done' }))
  }

  const reply = (m: InboxMessage, mode: ReplyMode) => {
    const thread = conversation.data?.thread
    if (!thread) return
    const email = { ...m, subject: m.subject ?? '', created_at: m.at, sent_at: m.direction === 'sent' ? m.at : null, received_at: m.direction === 'received' ? m.at : null }
    const base = { candidateId: thread.candidate_id, candidateName: thread.candidate_name, replyToId: m.id, jobId: thread.job_id ?? undefined }
    if (mode === 'forward') {
      setComposer({ ...base, mode: 'forward', to: '', subject: getForwardSubject(email.subject), body: formatForwardedMessage(email) })
      return
    }
    const fromYou = m.direction === 'sent' || mine.map(bareAddress).includes(bareAddress(m.from_address))
    const to = fromYou ? m.to_addresses[0] : m.from_address
    const cc = mode === 'reply_all' ? replyAllRecipients(m, mine).cc : []
    setComposer({
      ...base,
      mode: 'reply',
      to: mode === 'reply_all' ? replyAllRecipients(m, mine).to : to,
      cc: cc.length ? cc.join(', ') : undefined,
      subject: getReplySubject(email.subject),
      body: formatQuotedReply(email),
    })
  }

  const startCompose = () => {
    setComposer(null)
    setPicking(true)
  }
  const onPicked = (c: PickedCandidate) => {
    setPicking(false)
    setComposer({ mode: 'compose', candidateId: c.id, candidateName: c.name, to: c.email, jobId: jobId ?? undefined })
  }

  // Keyboard: Gmail's keys, never while typing or with a menu or dialog open.
  // The handler is installed once and reads this render's state and actions.
  const state = React.useRef({ rows, threadId, selected, conversation: conversation.data, picking, composer, act, reply, openThread, closeThread, startCompose })
  state.current = { rows, threadId, selected, conversation: conversation.data, picking, composer, act, reply, openThread, closeThread, startCompose }
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      const s = state.current
      const { act, reply, openThread, closeThread, startCompose } = s
      if (e.key === 'Escape') {
        if (floatingLayerOpen()) return
        if (s.selected.size) setSelected(new Set())
        else if (s.threadId) closeThread()
        return
      }
      if (floatingLayerOpen() || s.picking || s.composer) return
      const i = s.threadId ? s.rows.findIndex(r => r.thread_id === s.threadId) : -1
      const k = e.key
      if (k === 'c') { e.preventDefault(); startCompose() }
      else if (k === '/') { e.preventDefault(); searchRef.current?.focus() }
      else if (k === 'j' || k === 'ArrowDown') {
        const n = s.rows[i + 1] ?? (i === -1 ? s.rows[0] : undefined)
        if (n) { e.preventDefault(); openThread(n) }
      } else if (k === 'k' || k === 'ArrowUp') {
        const p = i > 0 ? s.rows[i - 1] : undefined
        if (p) { e.preventDefault(); openThread(p) }
      } else if (k === 'Enter' && !s.threadId && s.rows[0]) { e.preventDefault(); openThread(s.rows[0]) }
      else if (k === 'x' && s.threadId) {
        setSelected(prev => {
          const n = new Set(prev)
          if (n.has(s.threadId!)) n.delete(s.threadId!)
          else n.add(s.threadId!)
          return n
        })
      } else if (k === 'e') {
        const ids = s.selected.size ? [...s.selected] : s.threadId ? [s.threadId] : []
        const done = s.conversation?.thread.done && !s.selected.size
        act(ids, done ? 'inbox' : 'done', { advance: true })
      } else if (k === 'U' && e.shiftKey) {
        const ids = s.selected.size ? [...s.selected] : s.threadId ? [s.threadId] : []
        act(ids, 'unread')
        if (!s.selected.size && s.threadId) closeThread()
      } else if ((k === 'r' || k === 'a' || k === 'f') && s.conversation) {
        const last = s.conversation.messages[s.conversation.messages.length - 1]
        if (last) { e.preventDefault(); reply(last, k === 'r' ? 'reply' : k === 'a' ? 'reply_all' : 'forward') }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // ── The list's body: loading, error, empty, or nothing (rows) ──
  const timedOut = useLoadTimeout(threads.isLoading)
  const filtered = !!(query || jobId)
  const jobTitle = jobId ? counts.data?.jobs.find(j => j.job_id === jobId)?.title ?? 'Job' : null
  let body: React.ReactNode | undefined
  if (threads.isError || timedOut) {
    body = (
      <div className="px-6 py-14">
        <LoadError what="your email" timedOut={timedOut && !threads.isError} onRetry={() => threads.refetch()} compact />
      </div>
    )
  } else if (threads.isLoading) {
    body = <InboxListSkeleton layout={layout} />
  } else if (rows.length === 0) {
    body = (
      <div className="px-6 py-12">
        {filtered ? (
          <AnimatedEmpty
            scene="search"
            size="compact"
            onceKey={`inbox-filtered-${listFolder}`}
            title="No conversations match"
            body={query ? `Nothing in ${jobTitle ?? FOLDER_LABELS[listFolder]} matches “${query}”.` : `No email with ${jobTitle}'s candidates yet.`}
            secondary={
              query
                ? { label: 'Clear search', onClick: () => setSearch('') }
                : { label: 'Show the Inbox', onClick: () => goFolder('inbox') }
            }
          />
        ) : (
          <AnimatedEmpty scene="candidates" size="compact" onceKey={`inbox-empty-${folder}`} {...EMPTY[folder]} primary={
            folder === 'inbox' || folder === 'all' || folder === 'sent' ? { label: 'Compose', icon: <PenSquare size={16} />, onClick: startCompose } : undefined
          } />
        )}
      </div>
    )
  }

  const header = (
    <div className="flex min-w-0 items-center gap-2">
      {split ? (
        <h1 className="m-0 min-w-0 flex-1 truncate font-poppins text-[14.5px] font-semibold text-[#0d0d09]" style={{ letterSpacing: '-0.015em' }}>
          {jobTitle ?? FOLDER_LABELS[folder]}
        </h1>
      ) : (
        <FolderMenu folder={folder} jobId={jobId} counts={counts.data} onFolder={goFolder} onJob={goJob} />
      )}
      {!threads.isLoading && rows.length > 0 && (
        <span className="shrink-0 tabular-nums text-[11.5px] text-[#6B7080]">
          {rows.length >= MAX_ROWS ? `Newest ${MAX_ROWS}` : `${rows.length} ${rows.length === 1 ? 'conversation' : 'conversations'}`}
        </span>
      )}
      {!split && (
        <IconTip label="Compose (C)">
          <Button variant="primary" size="sm" iconOnly icon={PenSquare} aria-label="Compose" onClick={startCompose} className="ml-auto" />
        </IconTip>
      )}
    </div>
  )

  const selectedIds = [...selected]
  const actions: SelectionAction[] =
    listFolder === 'done'
      ? [
          { id: 'inbox', label: 'Move to Inbox', icon: InboxIcon, slot: 'primary', onClick: () => act(selectedIds, 'inbox', { advance: true }) },
          { id: 'read', label: 'Mark read', icon: MailOpen, slot: 'secondary', onClick: () => act(selectedIds, 'read') },
          { id: 'unread', label: 'Mark unread', icon: Mail, slot: 'secondary', onClick: () => act(selectedIds, 'unread') },
        ]
      : [
          { id: 'done', label: 'Done', icon: CheckCheck, slot: 'primary', onClick: () => act(selectedIds, 'done', { advance: true }) },
          { id: 'read', label: 'Mark read', icon: MailOpen, slot: 'secondary', onClick: () => act(selectedIds, 'read') },
          { id: 'unread', label: 'Mark unread', icon: Mail, slot: 'secondary', onClick: () => act(selectedIds, 'unread') },
        ]

  // The conversation you were in, so the list scrolls back to it.
  const lastOpen = React.useRef<string | null>(null)
  if (threadId) lastOpen.current = threadId
  const at = threadId ? rows.findIndex(r => r.thread_id === threadId) : -1
  const position: ReaderPosition | undefined =
    at >= 0
      ? {
          index: at + 1,
          total: rows.length,
          onNewer: at > 0 ? () => openThread(rows[at - 1]) : undefined,
          onOlder: at < rows.length - 1 ? () => openThread(rows[at + 1]) : undefined,
        }
      : undefined
  const rowActions: RowActions = {
    inDone: listFolder === 'done',
    onDone: (t) => act([t.thread_id], listFolder === 'done' ? 'inbox' : 'done'),
    onRead: (t) => act([t.thread_id], t.unread ? 'read' : 'unread'),
  }

  return (
    <div className="flex h-[calc(100dvh-13rem)] gap-5 px-3 sm:h-[calc(100dvh-4rem)] sm:px-0 sm:pb-3 sm:pt-1">
      {split && (
        <div className="shrink-0 pt-1">
          <InboxFolders
            folder={folder}
            jobId={jobId}
            counts={counts.data}
            compact={!wide}
            onFolder={goFolder}
            onJob={goJob}
            onCompose={startCompose}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#E7E8EE] bg-white">
        {noMailbox && (
          <div className="flex shrink-0 items-center gap-3 border-b border-[#F1F0EC] bg-[#FAFAF7] px-4 py-2.5 text-[12.5px] text-[#1F2230]">
            <Plug aria-hidden className="h-4 w-4 shrink-0 text-[#6B7080]" />
            <span className="min-w-0 flex-1">Connect your Gmail to see and send candidate email here.</span>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/settings?tab=email-calendar">Connect Gmail</Link>
            </Button>
          </div>
        )}
        <div className="flex min-h-0 flex-1">
          {/* The list stays mounted under an open conversation, so it comes back where you left it. */}
          <div className={threadId ? 'hidden' : 'min-w-0 flex-1'}>
            <InboxList
              layout={layout}
              header={header}
              rows={rows}
              scrollToId={threadId ? null : lastOpen.current}
              selected={selected}
              onOpen={openThread}
              onToggle={(id) =>
                setSelected(prev => {
                  const n = new Set(prev)
                  if (n.has(id)) n.delete(id)
                  else n.add(id)
                  return n
                })
              }
              onToggleAll={() =>
                setSelected(prev => (rows.every(r => prev.has(r.thread_id)) ? new Set() : new Set(rows.map(r => r.thread_id))))
              }
              search={search}
              onSearch={setSearch}
              searching={search.trim() !== query || (threads.isFetching && !threads.isLoading && !!query)}
              searchRef={searchRef}
              onRefresh={refresh}
              refreshing={threads.isFetching && !threads.isLoading && !query}
              rowActions={rowActions}
              searchPlaceholder={layout === 'line' && !split ? 'Search mail' : undefined}
              body={body}
            />
          </div>
          {threadId && (
            <div className="min-w-0 flex-1">
              <InboxReader
                conversation={conversation.data}
                loading={conversation.isLoading}
                error={conversation.isError}
                onRetry={() => conversation.refetch()}
                // On phones the shell's own back button does this.
                onBack={width < 640 ? undefined : closeThread}
                position={position}
                onReply={reply}
                onDone={() => act([threadId], conversation.data?.thread.done ? 'inbox' : 'done', { advance: true })}
                onMarkUnread={() => {
                  act([threadId], 'unread')
                  closeThread()
                }}
                mine={mine}
              />
            </div>
          )}
        </div>
      </div>

      <SelectionBar count={selected.size} actions={actions} onClear={() => setSelected(new Set())} busy={mark.isPending} />

      {picking && <ComposePicker onPick={onPicked} onClose={() => setPicking(false)} />}
      {composer && (
        <MinimizableEmailComposer
          key={`${composer.mode}-${composer.replyToId ?? composer.candidateId}`}
          isOpen
          onOpenChange={(open) => !open && setComposer(null)}
          candidateId={composer.candidateId}
          candidateName={composer.candidateName}
          jobId={composer.jobId}
          defaultTo={composer.to}
          defaultCc={composer.cc}
          defaultSubject={composer.subject}
          defaultBody={composer.body}
          mode={composer.mode}
          inReplyToMessageId={composer.replyToId}
          onSuccess={() => {
            setComposer(null)
            // The send writes the message; Realtime brings it in, this is the safety net.
            setTimeout(refresh, 1500)
          }}
        />
      )}
    </div>
  )
}

const EMPTY: Record<InboxFolder, { title: string; body: string }> = {
  inbox: { title: "You're all caught up", body: 'New email from candidates lands here.' },
  needs_reply: { title: 'Nothing waiting on you', body: 'Conversations where the candidate wrote last show here.' },
  sent: { title: 'Nothing sent yet', body: 'Email you send to candidates shows here.' },
  done: { title: 'Nothing marked done', body: 'Mark a conversation done to clear it from your Inbox. Your Gmail stays as it is.' },
  all: { title: 'No candidate email yet', body: 'Email with candidates from your connected Gmail shows here.' },
}

/** Below 1024px the folder column folds into this menu at the top of the list. */
function FolderMenu({
  folder,
  jobId,
  counts,
  onFolder,
  onJob,
}: {
  folder: InboxFolder
  jobId: string | null
  counts?: { inbox_unread: number; needs_reply: number; jobs: { job_id: string; title: string; unread: number }[] }
  onFolder: (f: InboxFolder) => void
  onJob: (id: string) => void
}) {
  const current = jobId ? counts?.jobs.find(j => j.job_id === jobId)?.title ?? 'Job' : FOLDER_LABELS[folder]
  const countFor = (f: InboxFolder) => (f === 'inbox' ? counts?.inbox_unread : f === 'needs_reply' ? counts?.needs_reply : undefined)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="gio-pressable flex min-w-0 items-center gap-1 rounded-md font-poppins text-[14.5px] font-semibold text-[#0d0d09]"
          style={{ letterSpacing: '-0.015em' }}
        >
          <span className="truncate">{current}</span>
          <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-[#6B7080]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-[240px]">
        {FOLDERS.map(f => {
          const Icon = FOLDER_ICONS[f]
          const n = countFor(f)
          return (
            <DropdownMenuItem key={f} onSelect={() => onFolder(f)}>
              <Icon aria-hidden />
              <span className="truncate">{FOLDER_LABELS[f]}</span>
              {n ? <DropdownMenuShortcut>{n}</DropdownMenuShortcut> : null}
              {!jobId && folder === f && <span className="gio-mrow-check" aria-hidden><Check className="h-4 w-4" strokeWidth={2} /></span>}
            </DropdownMenuItem>
          )
        })}
        {(counts?.jobs.length ?? 0) > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Your jobs</DropdownMenuLabel>
            {counts!.jobs.map(j => (
              <DropdownMenuItem key={j.job_id} onSelect={() => onJob(j.job_id)}>
                <Briefcase aria-hidden />
                <span className="truncate">{j.title}</span>
                {j.unread ? <DropdownMenuShortcut>{j.unread}</DropdownMenuShortcut> : null}
                {jobId === j.job_id && <span className="gio-mrow-check" aria-hidden><Check className="h-4 w-4" strokeWidth={2} /></span>}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
