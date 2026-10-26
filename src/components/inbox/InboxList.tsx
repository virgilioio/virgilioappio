import * as React from 'react'
import { CheckCheck, Inbox as InboxIcon, Mail, MailOpen, Paperclip, RotateCw, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconTip } from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { inboxTime, type InboxThread } from '@/lib/inbox'

/**
 * The email list. From 640px it is Gmail's: a toolbar (select all, refresh,
 * the folder and its count, search) over one line per conversation, with
 * Done and Mark read/unread in place of the date on hover. On phones each
 * conversation takes three lines under the search box. Unread rows are
 * semibold with the purple dot; ticked rows feed the selection bar. Hover is
 * instant and mouse-only (§3).
 */
export function InboxList({
  layout,
  header,
  rows,
  scrollToId,
  selected,
  onOpen,
  onToggle,
  onToggleAll,
  search,
  onSearch,
  searching,
  searchRef,
  onRefresh,
  refreshing,
  rowActions,
  searchPlaceholder = 'Search candidates and messages',
  body,
}: {
  /** `line`: the full-width Gmail list; `stacked`: three lines a row (phones). */
  layout: 'line' | 'stacked'
  /** The title row (folder name, count, the phone folder menu). */
  header: React.ReactNode
  rows: InboxThread[]
  /** The conversation you came back from: kept in view. */
  scrollToId: string | null
  selected: Set<string>
  onOpen: (t: InboxThread) => void
  onToggle: (id: string) => void
  onToggleAll: () => void
  search: string
  onSearch: (q: string) => void
  /** A search or refetch is on its way: the search icon turns into a spinner. */
  searching: boolean
  searchRef: React.RefObject<HTMLInputElement>
  onRefresh: () => void
  refreshing: boolean
  /** Hover actions on a line row. */
  rowActions: RowActions
  searchPlaceholder?: string
  /** Shown instead of the rows: loading, error or empty. */
  body?: React.ReactNode
}) {
  const listRef = React.useRef<HTMLUListElement>(null)
  // Back from a conversation (or j / k inside it): keep that row in view.
  React.useEffect(() => {
    if (!scrollToId) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-thread="${CSS.escape(scrollToId)}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [scrollToId])

  const all = rows.length > 0 && rows.every(r => selected.has(r.thread_id))
  const some = !all && rows.some(r => selected.has(r.thread_id))
  const selectAll = (
    <Checkbox
      aria-label={all ? 'Clear selection' : 'Select all'}
      checked={all ? true : some ? 'indeterminate' : false}
      onCheckedChange={onToggleAll}
      disabled={rows.length === 0}
    />
  )
  const searchBox = (
    <SearchBox search={search} onSearch={onSearch} searching={searching} searchRef={searchRef} placeholder={searchPlaceholder} />
  )

  return (
    <section aria-label="Conversations" className="flex h-full min-h-0 flex-col">
      {layout === 'line' ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-[#F1F0EC] py-2 pl-[30px] pr-3">
          {selectAll}
          <IconTip label="Refresh">
            <Button variant="ghost" size="sm" iconOnly aria-label="Refresh" icon={RotateCw} loading={refreshing} onClick={onRefresh} />
          </IconTip>
          <div className="min-w-0 flex-1 pl-1">{header}</div>
          <div className="w-[240px] shrink-0 lg:w-[320px]">{searchBox}</div>
        </div>
      ) : (
        <div className="shrink-0 border-b border-[#F1F0EC] px-3 pt-3 pb-2.5">
          {searchBox}
          <div className="mt-2.5 flex items-center gap-2.5 pl-[14px] pr-1">
            {selectAll}
            <div className="min-w-0 flex-1">{header}</div>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {body ?? (
          <ul ref={listRef} className="pb-24">
            {rows.map(t =>
              layout === 'line' ? (
                <LineRow
                  key={t.thread_id}
                  t={t}
                  checked={selected.has(t.thread_id)}
                  many={rows.length > 100}
                  onOpen={() => onOpen(t)}
                  onToggle={() => onToggle(t.thread_id)}
                  actions={rowActions}
                />
              ) : (
                <Row
                  key={t.thread_id}
                  t={t}
                  checked={selected.has(t.thread_id)}
                  many={rows.length > 100}
                  onOpen={() => onOpen(t)}
                  onToggle={() => onToggle(t.thread_id)}
                />
              ),
            )}
          </ul>
        )}
      </div>
    </section>
  )
}

export interface RowActions {
  /** The list is the Done folder: the first action moves back to the Inbox. */
  inDone: boolean
  onDone: (t: InboxThread) => void
  onRead: (t: InboxThread) => void
}

function SearchBox({
  search,
  onSearch,
  searching,
  searchRef,
  placeholder,
}: {
  search: string
  onSearch: (q: string) => void
  searching: boolean
  searchRef: React.RefObject<HTMLInputElement>
  placeholder: string
}) {
  return (
        <div className="relative">
          {searching ? (
            <span
              aria-hidden
              className="gio-spinner gio-spinner-current absolute left-3.5 top-1/2 -mt-[6.5px] h-[13px] w-[13px] text-text-tertiary"
            />
          ) : (
            <Search aria-hidden className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          )}
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && search) {
                e.stopPropagation()
                onSearch('')
              }
            }}
            placeholder={placeholder}
            aria-label="Search mail"
            className="h-9 pl-10 pr-9 bg-[#FAFAF7] border-transparent rounded-xl text-[13px] focus-visible:bg-white"
          />
          <button
            type="button"
            onClick={() => onSearch('')}
            aria-label="Clear search"
            data-visible={search ? '' : undefined}
            tabIndex={search ? 0 : -1}
            className="gio-search-clear absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary hover:text-text-primary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
  )
}

function Row({
  t,
  checked,
  many,
  onOpen,
  onToggle,
}: {
  t: InboxThread
  checked: boolean
  many: boolean
  onOpen: () => void
  onToggle: () => void
}) {
  const subject = t.subject?.trim() || '(No subject)'
  const snippet = t.snippet?.trim() ?? ''
  return (
    <li
      data-thread={t.thread_id}
      className={cn(
        'group relative flex items-start gap-2.5 border-b border-[#F4F3EF] pl-[26px] pr-3',
        many && 'gio-cv-row',
        checked ? 'bg-[#F7F4FF]' : 'hover:bg-[#FAFAF7]',
      )}
    >
      {t.unread && (
        <span aria-hidden className="absolute left-[11px] top-[22px] h-[7px] w-[7px] rounded-full bg-[#6F3FF5]" />
      )}
      <div className="pt-[15px]">
        <Checkbox
          aria-label={`Select ${t.candidate_name}`}
          checked={checked}
          onCheckedChange={onToggle}
        />
      </div>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${t.unread ? 'Unread. ' : ''}${t.candidate_name}: ${subject}`}
        className="min-w-0 flex-1 py-3 text-left"
      >
        <div className="flex items-baseline gap-2">
          <span
            className={cn('min-w-0 flex-1 truncate font-inter text-[13.5px]', t.unread ? 'font-semibold text-[#0d0d09]' : 'font-medium text-[#1F2230]')}
          >
            {t.candidate_name || 'Unnamed candidate'}
            {t.message_count > 1 && (
              <span className="ml-1.5 font-normal tabular-nums text-[#6B7080] text-[12px]">{t.message_count}</span>
            )}
          </span>
          <time
            dateTime={t.last_at}
            className={cn('shrink-0 tabular-nums text-[11.5px]', t.unread ? 'font-semibold text-[#0d0d09]' : 'text-[#6B7080]')}
          >
            {inboxTime(t.last_at)}
          </time>
        </div>
        <div className={cn('mt-0.5 truncate text-[12.5px]', t.unread ? 'font-semibold text-[#0d0d09]' : 'text-[#1F2230]')}>
          {subject}
        </div>
        <div className="mt-0.5 truncate text-[12.5px] text-[#6B7080]">
          {t.last_direction === 'sent' && <span className="text-[#5A6072]">You: </span>}
          {snippet || ' '}
        </div>
        {(t.job_title || t.has_attachments) && (
          <div className="mt-1.5 flex items-center gap-1.5">
            {t.job_title && (
              <span className="max-w-[200px] truncate rounded-md bg-[#F1F0EC] px-1.5 py-0.5 text-[11px] font-medium text-[#5A6072]">
                {t.job_title}
              </span>
            )}
            {t.has_attachments && (
              <Paperclip aria-label="Has attachments" className="h-3.5 w-3.5 text-[#6B7080]" strokeWidth={2} />
            )}
          </div>
        )}
      </button>
    </li>
  )
}

/**
 * One conversation on one line (Gmail): name and count, the job chip, the
 * subject with the snippet after it, a paperclip, and the date, which turns
 * into Done and Mark read/unread on hover or when a control in the row has
 * focus.
 */
function LineRow({
  t,
  checked,
  many,
  onOpen,
  onToggle,
  actions,
}: {
  t: InboxThread
  checked: boolean
  many: boolean
  onOpen: () => void
  onToggle: () => void
  actions: RowActions
}) {
  const subject = t.subject?.trim() || '(No subject)'
  const snippet = t.snippet?.trim() ?? ''
  const name = t.candidate_name || 'Unnamed candidate'
  return (
    <li
      data-thread={t.thread_id}
      className={cn(
        'group relative flex h-11 items-center gap-3 border-b border-[#F4F3EF] pl-[30px] pr-3',
        many && 'gio-cv-row',
        checked ? 'bg-[#F7F4FF]' : 'hover:bg-[#FAFAF7]',
      )}
    >
      {t.unread && (
        <span aria-hidden className="absolute left-[13px] top-1/2 -mt-[3.5px] h-[7px] w-[7px] rounded-full bg-[#6F3FF5]" />
      )}
      <Checkbox aria-label={`Select ${name}`} checked={checked} onCheckedChange={onToggle} />
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${t.unread ? 'Unread. ' : ''}${name}: ${subject}`}
        className="flex h-full min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          className={cn(
            'w-[168px] shrink-0 truncate text-[13.5px] lg:w-[200px]',
            t.unread ? 'font-semibold text-[#0d0d09]' : 'text-[#1F2230]',
          )}
        >
          {name}
          {t.message_count > 1 && (
            <span className="ml-1.5 font-normal tabular-nums text-[12px] text-[#6B7080]">{t.message_count}</span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {t.job_title && (
            <span className="hidden max-w-[160px] shrink-0 truncate rounded-md bg-[#F1F0EC] px-1.5 py-0.5 text-[11px] font-medium text-[#5A6072] md:inline">
              {t.job_title}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-[13.5px]">
            <span className={t.unread ? 'font-semibold text-[#0d0d09]' : 'text-[#1F2230]'}>{subject}</span>
            {snippet && (
              <span className="text-[#6B7080]">
                {' – '}
                {t.last_direction === 'sent' && 'You: '}
                {snippet}
              </span>
            )}
          </span>
        </span>
        {t.has_attachments && (
          <Paperclip aria-label="Has attachments" className="h-3.5 w-3.5 shrink-0 text-[#6B7080]" strokeWidth={2} />
        )}
        <time
          dateTime={t.last_at}
          className={cn(
            'w-[64px] shrink-0 text-right tabular-nums text-[12px] group-hover:invisible group-focus-within:invisible',
            t.unread ? 'font-semibold text-[#0d0d09]' : 'text-[#6B7080]',
          )}
        >
          {inboxTime(t.last_at)}
        </time>
      </button>
      <div className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 group-hover:flex group-focus-within:flex">
        <IconTip label={actions.inDone ? 'Move to Inbox' : 'Done (E)'}>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={actions.inDone ? InboxIcon : CheckCheck}
            aria-label={actions.inDone ? `Move ${name} to the Inbox` : `Mark ${name} done`}
            onClick={() => actions.onDone(t)}
          />
        </IconTip>
        <IconTip label={t.unread ? 'Mark read' : 'Mark unread'}>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={t.unread ? MailOpen : Mail}
            aria-label={t.unread ? `Mark ${name} read` : `Mark ${name} unread`}
            onClick={() => actions.onRead(t)}
          />
        </IconTip>
      </div>
    </li>
  )
}

/** The list's first load: rows the size of real ones. */
export function InboxListSkeleton({ layout }: { layout: 'line' | 'stacked' }) {
  if (layout === 'line') {
    return (
      <ul aria-hidden>
        {Array.from({ length: 12 }).map((_, i) => (
          <li key={i} className="flex h-11 items-center gap-3 border-b border-[#F4F3EF] pl-[30px] pr-3">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-3.5 w-[168px] shrink-0 lg:w-[200px]" />
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="h-3 w-10" />
          </li>
        ))}
      </ul>
    )
  }
  return (
    <ul aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i} className="flex gap-2.5 border-b border-[#F4F3EF] pl-[26px] pr-3 py-3">
          <Skeleton className="mt-[3px] h-4 w-4 rounded-sm" />
          <div className="flex-1 space-y-2">
            <div className="flex justify-between gap-3">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        </li>
      ))}
    </ul>
  )
}
