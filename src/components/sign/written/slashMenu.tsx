/* eslint-disable react-refresh/only-export-components */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MenuOption } from '@lexical/react/LexicalTypeaheadMenuPlugin'

/**
 * The offer editor's "/" menu, ported from Gio Docs (2026-10-18, Allan: "the
 * same DNA"): sections, one-line rows with an icon, the name and the typing
 * shortcut, a preview card beside the highlighted row, and "Close menu ·
 * esc" at the bottom. Drawn in the ATS's own type and colours. It grows in
 * from the caret (scale .96 + opacity, --dur-menu-in) and leaves faster
 * (--dur-menu-out); typing and the highlight never animate.
 */

/* ---- Icons: Gio Docs' 24px stroke paths (menu-icons.ts), one per row kind. */
export const SLASH_IC = {
  text: 'M6 5h12M9.6 5v14M7.4 19h4.4',
  h1: 'M5 5.5v13M12.5 5.5v13M5 12h7.5M16.5 10.4 19 8.8V19',
  h2: 'M4.5 5.5v13M12 5.5v13M4.5 12h7.5M15.4 10.6a2.3 2.3 0 0 1 4.2 1.3c0 2-4.2 3.2-4.2 6.4h4.3',
  h3: 'M4.5 5.5v13M12 5.5v13M4.5 12h7.5M15.4 10.4a2.2 2.2 0 1 1 2.4 3.3 2.3 2.3 0 1 1-2.5 3.5',
  bullet: 'M9 6h12M9 12h12M9 18h12M4.6 6h.01M4.6 12h.01M4.6 18h.01',
  numbered: 'M10 6h11M10 12h11M10 18h11M4 6.6 5.6 5.6v5M3.6 14.4a1.6 1.6 0 0 1 3 .8c0 1.4-3 2.2-3 4.4h3',
  quote: 'M5 5.5v13M10.5 8.5h9.5M10.5 12.5h9.5M10.5 16.5h6',
  callout: 'M9.6 21h4.8M10.4 18.2h3.2M12 3a6.2 6.2 0 0 0-3.6 11.2v3.2h7.2v-3.2A6.2 6.2 0 0 0 12 3z',
  divider: 'M3 12h18M7 7.4h10M7 16.6h10',
  table: 'M4.5 5h15a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5zM3 10h18M9.5 10v9',
  image:
    'M4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5zM3 15.4l5-4.4 4.6 4M13.6 13.2 16.4 11 21 14.6M15.6 8.4h.01',
  // Ours, in the same hand: a database cylinder (offer values), a pen line (signing), brackets (sections), a cut page (page break).
  field: 'M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  sign: 'M4 20h4l10-10a2.83 2.83 0 0 0-4-4L4 16v4M13.5 6.5l4 4',
  initials: 'M6 5h12M9.6 5v14M7.4 19h4.4M15 13h5M17.5 13v6',
  date: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4',
  name: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4.5 20.5a7.5 7.5 0 0 1 15 0',
  input: 'M5 7h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM8 10v4M7 10h2M7 14h2',
  checkbox: 'M5.4 4h13a1.4 1.4 0 0 1 1.4 1.4v13a1.4 1.4 0 0 1-1.4 1.4h-13A1.4 1.4 0 0 1 4 18.4v-13A1.4 1.4 0 0 1 5.4 4zM8.3 12.1l2.6 2.6 4.8-5.2',
  section: 'M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2',
  pageBreak: 'M6 3v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V3M6 21v-5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v5M3 12h2M8 12h2M14 12h2M19 12h2',
  // The block menu's rows (Docs' dup, chevUp, chevDown and trash).
  duplicate: 'M9 9h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  up: 'm18 15-6-6-6 6',
  down: 'm6 9 6 6 6-6',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3',
} as const
export type SlashIcon = keyof typeof SLASH_IC

/* ---- Preview cards (Docs' block-previews.tsx): a small example and one line on what it's for. */
const INK = '#0d0d09'
const BODY = '#3A3D48'
const MUTED = '#6B7080'
const LINE = '#E7E8EE'
export const P = ({ children, size = 10.5, weight = 400, color = BODY }: { children: ReactNode; size?: number; weight?: number; color?: string }) => (
  <span style={{ display: 'block', fontSize: size, fontWeight: weight, color, lineHeight: 1.35 }}>{children}</span>
)
const bar = (w: string) => <span style={{ display: 'block', width: w, height: 4, borderRadius: 2, background: '#D9D8D2' }} />

export interface Preview {
  draw: () => ReactNode
  what: string
}

export const BLOCK_PREVIEWS: Record<'text' | 'h1' | 'h2' | 'h3' | 'bullet' | 'numbered' | 'quote' | 'callout' | 'table' | 'divider' | 'section' | 'pageBreak', Preview> = {
  text: { what: 'Just start writing with plain text.', draw: () => <P>We’re delighted to offer you the role. This letter sets out the <b>main terms</b> of your employment.</P> },
  h1: { what: 'Big section heading.', draw: () => <P size={19} weight={600} color={INK}>Offer of employment</P> },
  h2: {
    what: 'Medium section heading.',
    draw: () => (
      <>
        <P size={14} weight={600} color={INK}>Compensation</P>
        <P>Paid monthly, in arrears.</P>
      </>
    ),
  },
  h3: {
    what: 'Small section heading.',
    draw: () => (
      <>
        <P size={11.5} weight={600} color={INK}>Notice period</P>
        <P>Thirty days, in writing.</P>
      </>
    ),
  },
  bullet: {
    what: 'A simple bulleted list.',
    draw: () => (
      <>
        <P>• Health insurance</P>
        <P>• 20 days of holiday</P>
        <P>• Remote-first</P>
      </>
    ),
  },
  numbered: {
    what: 'A list with numbering.',
    draw: () => (
      <>
        <P>1. Sign this letter</P>
        <P>2. Send your documents</P>
        <P>3. Start on day one</P>
      </>
    ),
  },
  quote: {
    what: 'Set a passage apart.',
    draw: () => (
      <span style={{ display: 'block', borderLeft: `3px solid ${INK}`, paddingLeft: 8 }}>
        <P>This offer is valid for seven days.</P>
      </span>
    ),
  },
  callout: {
    what: 'Make writing stand out.',
    draw: () => (
      <span style={{ display: 'flex', gap: 6, padding: 7, borderRadius: 4, background: '#FDF6DD', boxShadow: 'inset 0 0 0 1px #EFDFA2' }}>
        <svg viewBox="0 0 24 24" width={11} height={11} style={{ flex: 'none', marginTop: 1, color: '#A16207' }} aria-hidden>
          <path d={SLASH_IC.callout} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <P>This offer is valid for seven days.</P>
      </span>
    ),
  },
  table: {
    what: 'Simple rows and columns.',
    draw: () => (
      <span style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: '1px solid #D9D8D2', borderRadius: 2 }}>
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} style={{ height: 13, background: i < 3 ? '#F1F0EC' : undefined, borderRight: i % 3 < 2 ? '1px solid #D9D8D2' : undefined, borderBottom: i < 6 ? '1px solid #D9D8D2' : undefined }} />
        ))}
      </span>
    ),
  },
  divider: {
    what: 'Visually divide blocks.',
    draw: () => (
      <span style={{ display: 'grid', gap: 7 }}>
        {bar('80%')}
        <span style={{ display: 'block', height: 1, background: '#C9C8C1' }} />
        {bar('60%')}
      </span>
    ),
  },
  section: {
    what: 'Text that prints only when the offer says so.',
    draw: () => (
      <span style={{ display: 'block', border: '1px dashed #B9A3F4', borderRadius: 4, padding: '5px 7px', background: '#FBF9FF' }}>
        <P size={8.5} color="#6F3FF5">Only if Bonus is more than 0</P>
        <P>You’ll also receive a quarterly bonus.</P>
      </span>
    ),
  },
  pageBreak: {
    what: 'Start what follows on a new page.',
    draw: () => (
      <span style={{ display: 'grid', gap: 6 }}>
        {bar('70%')}
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 8, color: MUTED }}>
          <span style={{ flex: 1, borderTop: '1px dashed #C9C8C1' }} />
          Page break
          <span style={{ flex: 1, borderTop: '1px dashed #C9C8C1' }} />
        </span>
        {bar('50%')}
      </span>
    ),
  },
}

/** A signing block for a role: a line to sign on and the date beside it. */
export const signPreview = (role: string, color: string): Preview => ({
  what: `Where ${role || 'this person'} signs, with the date beside it.`,
  draw: () => (
    <span style={{ display: 'flex', gap: 8 }}>
      {['Signature', 'Date signed'].map((l, i) => (
        <span key={l} style={{ flex: i ? 0.6 : 1 }}>
          <span style={{ display: 'block', height: 18, borderRadius: 3, border: `1px dashed ${color}`, background: `${color}55` }} />
          <span style={{ display: 'block', marginTop: 3, fontSize: 7.5, color: MUTED }}>
            {role || 'Signer'} · {l}
          </span>
        </span>
      ))}
    </span>
  ),
})

/** An offer value: how it reads in a sentence, and where it comes from. */
export const fieldPreview = (label: string, sample: string | null, from: string): Preview => ({
  what: from,
  draw: () => (
    <P>
      Your {label.toLowerCase()} is{' '}
      <span style={{ padding: '0 4px', borderRadius: 4, background: '#F1EAFE', color: '#4C1D95', fontWeight: 500 }}>{sample || label}</span>.
    </P>
  ),
})

/** A signer field in the text, in the role's colour. */
export const signerFieldPreview = (role: string, color: string, field: string, note: string): Preview => ({
  what: note,
  draw: () => (
    <P>
      Bank account{' '}
      <span style={{ padding: '0 4px', borderRadius: 4, border: `1px solid ${color}`, background: `${color}73`, color: INK, fontWeight: 500 }}>
        {role || 'Signer'} · {field}
      </span>
    </P>
  ),
})

/* ---- Rows ---- */

export class SlashItem extends MenuOption {
  constructor(
    key: string,
    public label: string,
    public section: string,
    public icon: SlashIcon,
    public run: () => void,
    /** inline: fits in a line of text, so it's offered inside a table cell too. */
    public opts: { md?: string; kw?: string; color?: string; preview?: Preview; inline?: boolean } = {},
  ) {
    super(key)
  }
}

/* Recent picks: a per-device convenience (localStorage), never needed. */
const RECENT_KEY = 'gio.sign.slash.recent'
function readRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').slice(0, 8) : []
  } catch {
    return []
  }
}
export function rememberPick(key: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([key, ...readRecent().filter((k) => k !== key)].slice(0, 8)))
  } catch {
    /* storage unavailable */
  }
}

export const SUGGESTED = 'Suggested'

/**
 * The rows in order, as Docs does it: Suggested (recent picks, only with
 * nothing typed), then each section in order; typing filters within the
 * sections and names that start with what's typed come first.
 */
export function slashRows(items: SlashItem[], query: string): SlashItem[] {
  const q = query.toLowerCase().trim()
  const sections = [...new Set(items.map((i) => i.section))]
  const out: SlashItem[] = []
  if (!q) {
    const byKey = new Map(items.map((i) => [i.key, i]))
    for (const k of readRecent().slice(0, 4)) {
      const m = byKey.get(k)
      if (m) out.push(new SlashItem(`s:${m.key}`, m.label, SUGGESTED, m.icon, m.run, m.opts))
    }
  }
  for (const s of sections) {
    const rows = items.filter((m) => m.section === s && (!q || m.label.toLowerCase().includes(q) || s.toLowerCase().includes(q) || (m.opts.kw ?? '').includes(q)))
    if (q) rows.sort((a, b) => Number(!a.label.toLowerCase().startsWith(q)) - Number(!b.label.toLowerCase().startsWith(q)))
    out.push(...rows)
  }
  return out
}

/* ---- The panel ---- */

const W = 324
const PREVIEW_W = 190

/** On close the panel leaves as a copy that shrinks and fades (--dur-menu-out), since the menu itself is gone at once. */
export function leave(el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  const ghost = el.cloneNode(true) as HTMLElement
  ghost.style.cssText += `;position:fixed;left:${rect.left}px;top:${rect.top}px;bottom:auto;right:auto;margin:0;pointer-events:none;animation:none`
  ghost.removeAttribute('role')
  ghost.setAttribute('aria-hidden', 'true')
  ghost.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'))
  document.body.appendChild(ghost)
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const a = ghost.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: still ? 'none' : 'scale(.96)' }], {
    duration: 120,
    easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
  })
  a.onfinish = a.oncancel = () => ghost.remove()
}

export function SlashPanel({
  anchor,
  host,
  rows,
  active,
  onHover,
  onPick,
  onClose,
  query,
}: {
  anchor: HTMLElement
  /** Where the panel lives: inside a modal sheet (outside it, the sheet blocks clicks), or the page. */
  host: HTMLElement
  rows: SlashItem[]
  active: number | null
  onHover: (i: number) => void
  onPick: (m: SlashItem) => void
  onClose: () => void
  query: string
}) {
  const panel = useRef<HTMLDivElement | null>(null)
  const list = useRef<HTMLDivElement | null>(null)
  const [above, setAbove] = useState<boolean | null>(null)
  const [pvTop, setPvTop] = useState<number | null>(null)
  const vw = window.innerWidth
  const vh = window.innerHeight
  const r = anchor.getBoundingClientRect()
  const left = Math.max(12, Math.min(vw - W - 12, r.left))
  const y = r.bottom + 4

  // Above the caret when there's no room below (decided once, on open).
  useLayoutEffect(() => {
    const h = panel.current?.offsetHeight ?? 420
    setAbove(y + h + 12 > vh && r.top - 4 - h >= 12)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Keep the highlighted row in view, with the preview beside it.
  useLayoutEffect(() => {
    const row = list.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    row?.scrollIntoView({ block: 'nearest' })
    if (!row || !panel.current) return setPvTop(null)
    setPvTop(row.getBoundingClientRect().top - panel.current.getBoundingClientRect().top - 8)
  }, [active, rows.length, above])
  // Leaving: a copy shrinks out where the panel was.
  useLayoutEffect(() => {
    const el = panel.current
    return () => {
      if (el?.isConnected) leave(el)
    }
  }, [])

  // A transformed host (the sheet) is what "fixed" is measured from, so take its corner off.
  const shift = host !== document.body && getComputedStyle(host).transform !== 'none' ? host.getBoundingClientRect() : { left: 0, top: 0, bottom: vh }
  const placement: React.CSSProperties = above
    ? { left: left - shift.left, bottom: shift.bottom - (r.top - 4), transformOrigin: 'bottom left' }
    : { left: left - shift.left, top: Math.max(12, Math.min(vh - 420 - 12, y)) - shift.top, transformOrigin: 'top left', visibility: above === null ? 'hidden' : undefined }
  const current = active != null ? rows[active] : null
  const pvRight = left + W + 8 + PREVIEW_W <= vw - 8
  const phone = vw < 640

  return createPortal(
    <div ref={panel} data-slash-menu role="listbox" aria-label="Insert" className="gio-slash-docs" style={{ ...placement, width: W }}>
      <div ref={list} className="min-h-0 flex-1 overflow-y-auto py-1">
        {rows.length === 0 ? (
          <p className="px-3 py-2 font-inter text-[12.5px] text-text-tertiary">Nothing matches “{query.trim()}”.</p>
        ) : (
          rows.map((m, i) => (
            <div key={m.key}>
              {(i === 0 || rows[i - 1].section !== m.section) && (
                <p className="px-3 pb-1 font-inter text-[11px] font-medium text-text-tertiary" style={{ paddingTop: i === 0 ? 6 : 10 }}>
                  {m.section}
                </p>
              )}
              <div
                ref={m.setRefElement}
                id={`slash-${m.key}`}
                role="option"
                aria-selected={i === active}
                className="gio-slash-row"
                onMouseEnter={() => onHover(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onPick(m)
                }}
              >
                {m.opts.color ? (
                  <span aria-hidden className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: m.opts.color }} />
                  </span>
                ) : (
                  <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden className="shrink-0 text-text-secondary">
                    <path d={SLASH_IC[m.icon]} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                <span className="min-w-0 flex-1 truncate">{m.label}</span>
                {m.opts.md && <span className="shrink-0 font-mono text-[11px] text-text-tertiary">{m.opts.md}</span>}
              </div>
            </div>
          ))
        )}
      </div>
      <button
        type="button"
        className="gio-slash-close"
        onMouseDown={(e) => {
          e.preventDefault()
          onClose()
        }}
      >
        <span>Close menu</span>
        <span className="text-[11px] text-text-tertiary">esc</span>
      </button>
      {current?.opts.preview && !phone && pvTop !== null && (
        <div aria-hidden className="pointer-events-none absolute" style={{ top: Math.max(0, pvTop), ...(pvRight ? { left: W + 8 } : { right: W + 8 }) }}>
          <div className="gio-slash-preview">
            <div className="gio-slash-preview-page">
              <span className="grid gap-[3px]">{current.opts.preview.draw()}</span>
            </div>
            <p className="px-0.5 pb-px pt-[7px] font-inter text-[11.5px] leading-[1.35] text-[#E7E5DF]">{current.opts.preview.what}</p>
          </div>
        </div>
      )}
    </div>,
    host,
  )
}
