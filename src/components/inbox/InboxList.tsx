import * as React from 'react'
import { Paperclip, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { inboxTime, type InboxThread } from '@/lib/inbox'

/**
 * The email list: search on top, one row per conversation. Unread rows are
 * semibold with the purple dot; the open row is filled; ticked rows feed the
 * selection bar. Hover is instant and mouse-only (§3).
 */
export function InboxList({
  header,
  rows,
  activeId,
  selected,
  onOpen,
  onToggle,
  onToggleAll,
  search,
  onSearch,
  searching,
  searchRef,
  body,
}: {
  /** The title row (folder name, count, the phone folder menu). */
  header: React.ReactNode
  rows: InboxThread[]
  activeId: string | null
  selected: Set<string>
  onOpen: (t: InboxThread) => void
  onToggle: (id: string) => void
  onToggleAll: () => void
  search: string
  onSearch: (q: string) => void
  /** A search or refetch is on its way: the search icon turns into a spinner. */
  searching: boolean
  searchRef: React.RefObject<HTMLInputElement>
  /** Shown instead of the rows: loading, error or empty. */
  body?: React.ReactNode
}) {
  const listRef = React.useRef<HTMLUListElement>(null)
  // j / k move the open row: keep it in view.
  React.useEffect(() => {
    if (!activeId) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-thread="${CSS.escape(activeId)}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  const all = rows.length > 0 && rows.every(r => selected.has(r.thread_id))
  const some = !all && rows.some(r => selected.has(r.thread_id))

  return (
    <section aria-label="Conversations" className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-[#F1F0EC] px-3 pt-3 pb-2.5">
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
            placeholder="Search candidates and messages"
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
        <div className="mt-2.5 flex items-center gap-2.5 pl-[14px] pr-1">
          <Checkbox
            aria-label={all ? 'Clear selection' : 'Select all'}
            checked={all ? true : some ? 'indeterminate' : false}
            onCheckedChange={onToggleAll}
            disabled={rows.length === 0}
          />
          <div className="min-w-0 flex-1">{header}</div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {body ?? (
          <ul ref={listRef} className="pb-24">
            {rows.map(t => (
              <Row
                key={t.thread_id}
                t={t}
                active={t.thread_id === activeId}
                checked={selected.has(t.thread_id)}
                many={rows.length > 100}
                onOpen={() => onOpen(t)}
                onToggle={() => onToggle(t.thread_id)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function Row({
  t,
  active,
  checked,
  many,
  onOpen,
  onToggle,
}: {
  t: InboxThread
  active: boolean
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
        active ? 'bg-[#F1F0EC]' : checked ? 'bg-[#F7F4FF]' : 'hover:bg-[#FAFAF7]',
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
        aria-current={active ? 'true' : undefined}
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

/** The list's first load: rows the size of real ones. */
export function InboxListSkeleton() {
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
