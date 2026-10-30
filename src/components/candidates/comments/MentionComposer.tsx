import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Textarea } from '@/components/ui/textarea'
import { leave } from '@/lib/motion'
import { PersonAvatar } from './PersonAvatar'
import { matchPeople, mentionQuery, taggedIn, type MentionPerson } from '@/lib/mentions'
import type { CommentPerson } from '@/hooks/useCandidateComments'

/**
 * The comment box with the "@" menu (2026-10-19). Typing "@" after a space
 * opens the teammates who can see the candidate, under the "@"; arrows move
 * the highlight instantly, Enter or Tab tags, Esc closes (§12 @mention, same
 * rule as the "/" menu: it grows in from the caret and leaves faster). A
 * tagged name reads "@Name" in the box with a soft purple tint behind it, and
 * becomes a chip once posted.
 */

export interface MentionComposerHandle {
  focus: () => void
}

interface Props {
  id?: string
  value: string
  onChange: (value: string) => void
  people: CommentPerson[]
  picked: MentionPerson[]
  onPick: (person: MentionPerson) => void
  /** ⌘↵ / Ctrl↵. */
  onSubmit: () => void
  disabled?: boolean
  placeholder?: string
  'aria-describedby'?: string
}

const PANEL_W = 264
const PANEL_MAX_H = 244

/** Where the caret at `index` sits on screen (a hidden copy of the field, measured). */
export function caretRect(el: HTMLTextAreaElement, index: number) {
  const cs = getComputedStyle(el)
  const copy = document.createElement('div')
  const keep = [
    'boxSizing', 'width', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch',
    'fontSize', 'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent', 'letterSpacing', 'wordSpacing', 'tabSize',
  ] as const
  for (const k of keep) copy.style[k] = cs[k]
  Object.assign(copy.style, { position: 'absolute', visibility: 'hidden', top: '0', left: '-9999px', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', overflow: 'hidden' })
  copy.textContent = el.value.slice(0, index)
  const mark = document.createElement('span')
  mark.textContent = el.value.slice(index) || '.'
  copy.appendChild(mark)
  document.body.appendChild(copy)
  const box = el.getBoundingClientRect()
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5
  // offsetLeft/Top count from inside the copy's border.
  const left = box.left + parseFloat(cs.borderLeftWidth) + mark.offsetLeft - el.scrollLeft
  const top = box.top + parseFloat(cs.borderTopWidth) + mark.offsetTop - el.scrollTop
  copy.remove()
  return { left, top, bottom: top + lh }
}

/** The draft split into plain text and the tagged "@Name"s, for the tint layer. */
function tintParts(value: string, picked: MentionPerson[]) {
  const ranges: [number, number][] = []
  for (const p of taggedIn(value, picked)) {
    const escaped = p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    for (const m of value.matchAll(new RegExp(`@${escaped}(?![\\p{L}\\p{N}])`, 'gu'))) {
      ranges.push([m.index ?? 0, (m.index ?? 0) + m[0].length])
    }
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

export const MentionComposer = forwardRef<MentionComposerHandle, Props>(function MentionComposer(
  { id, value, onChange, people, picked, onPick, onSubmit, disabled, placeholder, ...aria },
  ref,
) {
  const field = useRef<HTMLTextAreaElement | null>(null)
  const tint = useRef<HTMLDivElement | null>(null)
  const pendingCaret = useRef<number | null>(null)
  const [open, setOpen] = useState<{ start: number; query: string } | null>(null)
  const [active, setActive] = useState(0)
  // Esc closes the menu for this "@" only; a new "@" opens it again.
  const dismissed = useRef<number | null>(null)

  useImperativeHandle(ref, () => ({ focus: () => field.current?.focus() }), [])

  const rows = useMemo(() => (open ? matchPeople(people, open.query).slice(0, 8) : []), [open, people])
  // A two-word query that matches nobody is ordinary text, not a tag.
  const showPanel = !!open && (rows.length > 0 || !open.query.includes(' '))

  const sync = useCallback(() => {
    const el = field.current
    if (!el) return
    const caret = el.selectionStart ?? 0
    const q = el.selectionStart === el.selectionEnd ? mentionQuery(el.value, caret) : null
    if (q && dismissed.current === q.start) return setOpen(null)
    if (!q) dismissed.current = null
    setOpen((cur) => {
      if (!q) return null
      if (cur && cur.start === q.start && cur.query === q.query) return cur
      return q
    })
  }, [])

  useEffect(() => setActive(0), [open?.start, open?.query])

  // Caret after a tag goes in once React has the new value.
  useLayoutEffect(() => {
    const el = field.current
    if (el && pendingCaret.current != null) {
      el.setSelectionRange(pendingCaret.current, pendingCaret.current)
      pendingCaret.current = null
    }
  }, [value])

  // The tint layer scrolls with the field and keeps clear of its scrollbar.
  const follow = useCallback(() => {
    const el = field.current
    const layer = tint.current
    if (!el || !layer) return
    // Same type as the field, whatever it computes to (inputs are 16px on phones, §12).
    const cs = getComputedStyle(el)
    for (const k of ['fontSize', 'lineHeight', 'fontFamily', 'letterSpacing', 'paddingTop', 'paddingLeft'] as const) layer.style[k] = cs[k]
    const bar = el.offsetWidth - el.clientWidth - 2
    layer.style.paddingRight = `${parseFloat(cs.paddingRight) + Math.max(0, bar)}px`
    layer.scrollTop = el.scrollTop
  }, [])
  useLayoutEffect(follow, [value, follow])

  const pick = (p: CommentPerson) => {
    const el = field.current
    if (!el || !open) return
    const caret = el.selectionStart ?? open.start + 1 + open.query.length
    const insert = `@${p.name} `
    const next = value.slice(0, open.start) + insert + value.slice(caret).replace(/^ /, '')
    pendingCaret.current = open.start + insert.length
    onPick({ id: p.user_id, name: p.name })
    onChange(next)
    setOpen(null)
  }

  // Esc belongs to the menu while it's open, not to the sheet around it.
  // Radix listens on the document in the capture phase, so the window goes first.
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
        return
      }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onSubmit()
    }
  }

  const parts = tintParts(value, picked)
  const hasTint = parts.some((p) => p.tag)

  return (
    <div className="relative">
      <Textarea
        ref={field}
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        rows={3}
        aria-describedby={aria['aria-describedby']}
        aria-autocomplete="list"
        aria-expanded={showPanel}
        aria-controls={showPanel ? 'comment-mention-menu' : undefined}
        aria-activedescendant={showPanel && rows[active] ? `mention-${rows[active].user_id}` : undefined}
        className="min-h-[76px] resize-none px-3 py-2 text-[13px] leading-[1.5]"
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
          {parts.map((p, i) =>
            p.tag ? (
              <span key={i} className="gio-mention-tint">
                {p.text}
              </span>
            ) : (
              <span key={i}>{p.text}</span>
            ),
          )}
          {'​'}
        </div>
      )}
      {showPanel && field.current && open && (
        <MentionPanel anchor={caretRect(field.current, open.start)} host={field.current} rows={rows} active={active} query={open.query} onHover={setActive} onPick={pick} />
      )}
    </div>
  )
})

function MentionPanel({
  anchor,
  host: field,
  rows,
  active,
  query,
  onHover,
  onPick,
}: {
  anchor: { left: number; top: number; bottom: number }
  host: HTMLElement
  rows: CommentPerson[]
  active: number
  query: string
  onHover: (i: number) => void
  onPick: (p: CommentPerson) => void
}) {
  const panel = useRef<HTMLDivElement | null>(null)
  const list = useRef<HTMLDivElement | null>(null)
  // Inside a sheet the panel lives in the sheet (outside it, the sheet blocks clicks).
  const host = (field.closest('[role="dialog"]') as HTMLElement | null) ?? document.body
  const vw = window.innerWidth
  const vh = window.innerHeight
  const left = Math.max(12, Math.min(vw - PANEL_W - 12, anchor.left - 6))
  // Above the "@" when there's no room below (decided once, on open).
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

  // A transformed host (the sheet) is what "fixed" is measured from, so take its corner off.
  const shift = host !== document.body && getComputedStyle(host).transform !== 'none' ? host.getBoundingClientRect() : { left: 0, top: 0, bottom: vh }
  const placement: React.CSSProperties = above
    ? { left: left - shift.left, bottom: shift.bottom - (anchor.top - 4), transformOrigin: 'bottom left' }
    : { left: left - shift.left, top: anchor.bottom + 4 - shift.top, transformOrigin: 'top left' }

  return createPortal(
    <div
      ref={panel}
      id="comment-mention-menu"
      role="listbox"
      aria-label="Tag a teammate"
      className="gio-slash-docs"
      style={{ ...placement, width: PANEL_W, maxHeight: PANEL_MAX_H }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div ref={list} className="min-h-0 flex-1 overflow-y-auto py-1">
        {rows.length === 0 ? (
          <p className="px-3 py-2 font-inter text-[12.5px] text-text-tertiary">
            {query.trim() ? <>No teammate matches “{query.trim()}”.</> : 'Nobody else can see this candidate yet.'}
          </p>
        ) : (
          <>
            <p className="px-3 pb-1 pt-1.5 font-inter text-[11px] font-medium text-text-tertiary">Can see this candidate</p>
            {rows.map((p, i) => (
              <div
                key={p.user_id}
                id={`mention-${p.user_id}`}
                role="option"
                aria-selected={i === active}
                className="gio-slash-row !h-[38px]"
                onMouseEnter={() => onHover(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onPick(p)
                }}
              >
                <PersonAvatar name={p.name} email={p.email} url={p.avatar_url} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] leading-[1.25]">{p.name}</span>
                  <span className="block truncate text-[11px] font-normal leading-[1.25] text-text-tertiary">{p.email}</span>
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>,
    host,
  )
}
