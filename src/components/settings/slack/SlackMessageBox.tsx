import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Braces } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { caretRect } from '@/components/candidates/comments/MentionComposer'
import { PersonAvatar } from '@/components/candidates/comments/PersonAvatar'
import { leave } from '@/lib/motion'
import { matchPeople, mentionQuery } from '@/lib/mentions'
import { SLACK_DETAILS, slackTagsIn, type SlackDetail, type SlackTag, type SlackUser } from '@/lib/slack'

/**
 * The Slack message box (2026-10-27): the comment box's behaviour with two
 * menus. "@" tags someone in your Slack (shown as "@Name", saved as <@ID>);
 * "{" puts in a detail of the event ({candidate}, {who}…). Both menus grow
 * from the caret and leave faster; arrows move the highlight instantly, Enter
 * or Tab inserts, Esc closes only the menu (§12).
 */

type Menu = { kind: 'people' | 'details'; start: number; query: string }
type Row =
  | { kind: 'person'; id: string; user: SlackUser }
  | { kind: 'detail'; id: SlackDetail }

const PANEL_W = 280
const PANEL_MAX_H = 260

function detailQuery(text: string, caret: number): { start: number; query: string } | null {
  const m = text.slice(0, caret).match(/\{([a-z_ ]{0,24})$/i)
  return m ? { start: caret - m[1].length - 1, query: m[1] } : null
}

/** The draft split into text and the parts to tint (tags and details). */
function tintParts(value: string, picked: SlackTag[], details: SlackDetail[]) {
  const ranges: [number, number][] = []
  for (const p of slackTagsIn(value, picked)) {
    const escaped = p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    for (const m of value.matchAll(new RegExp(`@${escaped}(?![\\p{L}\\p{N}])`, 'gu'))) ranges.push([m.index ?? 0, (m.index ?? 0) + m[0].length])
  }
  for (const m of value.matchAll(/\{\s*([a-z_]+)\s*\}/g)) {
    if (details.includes(m[1] as SlackDetail)) ranges.push([m.index ?? 0, (m.index ?? 0) + m[0].length])
  }
  ranges.sort((a, b) => a[0] - b[0])
  const parts: { text: string; tag: boolean }[] = []
  let at = 0
  for (const [s, e] of ranges) {
    if (s < at) continue
    if (s > at) parts.push({ text: value.slice(at, s), tag: false })
    parts.push({ text: value.slice(s, e), tag: true })
    at = e
  }
  parts.push({ text: value.slice(at), tag: false })
  return parts
}

export function SlackMessageBox({
  id,
  value,
  onChange,
  users,
  usersLoading,
  picked,
  onPick,
  details,
  disabled,
  invalid,
  describedBy,
  onReady,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  users: SlackUser[]
  usersLoading?: boolean
  picked: SlackTag[]
  onPick: (tag: SlackTag) => void
  /** The details this event can fill. */
  details: SlackDetail[]
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  /** Lets the chips under the box insert at the caret. */
  onReady?: (insert: (text: string) => void) => void
}) {
  const field = useRef<HTMLTextAreaElement | null>(null)
  const tint = useRef<HTMLDivElement | null>(null)
  const pendingCaret = useRef<number | null>(null)
  const [open, setOpen] = useState<Menu | null>(null)
  const [active, setActive] = useState(0)
  const dismissed = useRef<number | null>(null)

  const rows: Row[] = useMemo(() => {
    if (!open) return []
    if (open.kind === 'people') {
      const list = matchPeople(users.map((u) => ({ ...u, email: u.handle })), open.query).slice(0, 8)
      return list.map((u) => ({ kind: 'person', id: u.id, user: u }))
    }
    const q = open.query.trim().toLowerCase().replace(/\s+/g, '_')
    return details
      .filter((d) => !q || d.startsWith(q) || SLACK_DETAILS[d].label.toLowerCase().includes(open.query.trim().toLowerCase()))
      .map((d) => ({ kind: 'detail', id: d }))
  }, [open, users, details])
  const showPanel = !!open && (rows.length > 0 || (open.kind === 'people' && !open.query.includes(' ')) || open.kind === 'details')

  const sync = useCallback(() => {
    const el = field.current
    if (!el) return
    const caret = el.selectionStart ?? 0
    const same = el.selectionStart === el.selectionEnd
    const at = same ? mentionQuery(el.value, caret) : null
    const brace = same && !at ? detailQuery(el.value, caret) : null
    const q: Menu | null = at ? { kind: 'people', ...at } : brace ? { kind: 'details', ...brace } : null
    if (q && dismissed.current === q.start) return setOpen(null)
    if (!q) dismissed.current = null
    setOpen((cur) => {
      if (!q) return null
      if (cur && cur.kind === q.kind && cur.start === q.start && cur.query === q.query) return cur
      return q
    })
  }, [])

  useEffect(() => setActive(0), [open?.start, open?.query, open?.kind])

  useLayoutEffect(() => {
    const el = field.current
    if (el && pendingCaret.current != null) {
      el.setSelectionRange(pendingCaret.current, pendingCaret.current)
      pendingCaret.current = null
    }
  }, [value])

  const follow = useCallback(() => {
    const el = field.current
    const layer = tint.current
    if (!el || !layer) return
    const cs = getComputedStyle(el)
    for (const k of ['fontSize', 'lineHeight', 'fontFamily', 'letterSpacing', 'paddingTop', 'paddingLeft'] as const) layer.style[k] = cs[k]
    const bar = el.offsetWidth - el.clientWidth - 2
    layer.style.paddingRight = `${parseFloat(cs.paddingRight) + Math.max(0, bar)}px`
    layer.scrollTop = el.scrollTop
  }, [])
  useLayoutEffect(follow, [value, follow])

  // Chips under the box insert at the caret (or the end).
  useEffect(() => {
    onReady?.((text: string) => {
      const el = field.current
      const at = el && document.activeElement === el ? (el.selectionStart ?? value.length) : value.length
      const before = value.slice(0, at)
      const pad = before && !/\s$/.test(before) ? ' ' : ''
      const next = `${before}${pad}${text} ${value.slice(at).replace(/^ /, '')}`
      pendingCaret.current = at + pad.length + text.length + 1
      onChange(next)
      requestAnimationFrame(() => field.current?.focus())
    })
  }, [onReady, value, onChange])

  const pick = (row: Row) => {
    const el = field.current
    if (!el || !open) return
    const caret = el.selectionStart ?? open.start + 1 + open.query.length
    const insert = row.kind === 'person' ? `@${row.user.name} ` : `{${row.id}} `
    const next = value.slice(0, open.start) + insert + value.slice(caret).replace(/^ /, '')
    pendingCaret.current = open.start + insert.length
    if (row.kind === 'person') onPick({ id: row.user.id, name: row.user.name })
    onChange(next)
    setOpen(null)
  }

  useEffect(() => {
    if (!showPanel) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.activeElement !== field.current) return
      e.stopImmediatePropagation()
      e.preventDefault()
      dismissed.current = open?.start ?? null
      setOpen(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [showPanel, open?.start])

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showPanel && rows.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const step = e.key === 'ArrowDown' ? 1 : -1
        setActive((i) => (i + step + rows.length) % rows.length)
        return
      }
      if ((e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.shiftKey) || e.key === 'Tab') {
        e.preventDefault()
        pick(rows[active] ?? rows[0])
      }
    }
  }

  const parts = tintParts(value, picked, details)
  const hasTint = parts.some((p) => p.tag)

  return (
    <div className="relative">
      <Textarea
        ref={field}
        id={id}
        value={value}
        disabled={disabled}
        rows={3}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-autocomplete="list"
        aria-expanded={showPanel}
        aria-controls={showPanel ? 'slack-message-menu' : undefined}
        aria-activedescendant={showPanel && rows[active] ? `slack-opt-${rows[active].id}` : undefined}
        placeholder="Write the message. Type { for details, @ to tag someone in Slack."
        className="min-h-[88px] resize-none px-3 py-2 text-[13px] leading-[1.5]"
        onChange={(e) => {
          onChange(e.target.value)
          requestAnimationFrame(sync)
        }}
        onSelect={sync}
        onKeyDown={onKeyDown}
        onScroll={follow}
        onBlur={() => setOpen(null)}
      />
      {hasTint && (
        <div
          ref={tint}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-lg border border-transparent px-3 py-2 text-[13px] leading-[1.5] text-transparent"
        >
          {parts.map((p, i) => (p.tag ? <span key={i} className="gio-mention-tint">{p.text}</span> : <span key={i}>{p.text}</span>))}
          {'​'}
        </div>
      )}
      {showPanel && field.current && open && (
        <MessageMenu
          anchor={caretRect(field.current, open.start)}
          field={field.current}
          kind={open.kind}
          rows={rows}
          active={active}
          query={open.query}
          loading={open.kind === 'people' && usersLoading}
          onHover={setActive}
          onPick={pick}
        />
      )}
    </div>
  )
}

function MessageMenu({
  anchor,
  field,
  kind,
  rows,
  active,
  query,
  loading,
  onHover,
  onPick,
}: {
  anchor: { left: number; top: number; bottom: number }
  field: HTMLElement
  kind: Menu['kind']
  rows: Row[]
  active: number
  query: string
  loading?: boolean
  onHover: (i: number) => void
  onPick: (row: Row) => void
}) {
  const panel = useRef<HTMLDivElement | null>(null)
  const list = useRef<HTMLDivElement | null>(null)
  const host = (field.closest('[role="dialog"]') as HTMLElement | null) ?? document.body
  const vw = window.innerWidth
  const vh = window.innerHeight
  const left = Math.max(12, Math.min(vw - PANEL_W - 12, anchor.left - 6))
  const [above] = useState(() => anchor.bottom + 4 + PANEL_MAX_H + 12 > vh && anchor.top - 4 - PANEL_MAX_H >= 12)

  useLayoutEffect(() => {
    list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])
  useLayoutEffect(() => {
    const el = panel.current
    return () => {
      if (el?.isConnected) leave(el)
    }
  }, [])

  const shift = host !== document.body && getComputedStyle(host).transform !== 'none' ? host.getBoundingClientRect() : { left: 0, top: 0, bottom: vh }
  const placement: React.CSSProperties = above
    ? { left: left - shift.left, bottom: shift.bottom - (anchor.top - 4), transformOrigin: 'bottom left' }
    : { left: left - shift.left, top: anchor.bottom + 4 - shift.top, transformOrigin: 'top left' }

  return createPortal(
    <div
      ref={panel}
      id="slack-message-menu"
      role="listbox"
      aria-label={kind === 'people' ? 'Tag someone in Slack' : 'Put in a detail'}
      className="gio-slash-docs"
      style={{ ...placement, width: PANEL_W, maxHeight: PANEL_MAX_H }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div ref={list} className="min-h-0 flex-1 overflow-y-auto py-1">
        {rows.length === 0 ? (
          <p className="px-3 py-2 font-inter text-[12.5px] text-text-tertiary">
            {loading
              ? 'Loading your Slack…'
              : kind === 'people'
                ? query.trim() ? <>Nobody in your Slack matches “{query.trim()}”.</> : 'Nobody to tag yet.'
                : <>No detail matches “{query.trim()}”.</>}
          </p>
        ) : (
          <>
            <p className="px-3 pb-1 pt-1.5 font-inter text-[11px] font-medium text-text-tertiary">
              {kind === 'people' ? 'People in your Slack' : 'Details of this event'}
            </p>
            {rows.map((r, i) => (
              <div
                key={r.id}
                id={`slack-opt-${r.id}`}
                role="option"
                aria-selected={i === active}
                className="gio-slash-row !h-[38px]"
                onMouseEnter={() => onHover(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onPick(r)
                }}
              >
                {r.kind === 'person' ? (
                  <>
                    <PersonAvatar name={r.user.name} url={r.user.avatar} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] leading-[1.25]">{r.user.name}</span>
                      <span className="block truncate text-[11px] font-normal leading-[1.25] text-text-tertiary">@{r.user.handle}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[#F1F0EC] text-[#5A6072]">
                      <Braces className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] leading-[1.25]">{SLACK_DETAILS[r.id].label}</span>
                      <span className="block truncate text-[11px] font-normal leading-[1.25] text-text-tertiary">e.g. {SLACK_DETAILS[r.id].example}</span>
                    </span>
                  </>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>,
    host,
  )
}
